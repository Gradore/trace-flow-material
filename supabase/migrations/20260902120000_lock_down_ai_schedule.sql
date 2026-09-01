-- =====================================================================
--  Sicherheitskorrektur: anonym aufrufbare KI-Zeitplan-Funktionen
--
--  ZWEI FEHLER, BEIDE HIER BEHOBEN
--
--  1. Die Wache lautete
--         IF NOT has_role(auth.uid(),'admin') AND auth.uid() IS NOT NULL
--     Bei einem anonymen API-Aufruf ist auth.uid() NULL, damit war die zweite
--     Bedingung falsch und die Wache griff nicht.
--
--  2. Der Rechteentzug lautete REVOKE ALL ... FROM PUBLIC. Supabase vergibt
--     das Ausführungsrecht über Default-Privileges aber DIREKT an die Rollen
--     anon und authenticated, nicht über PUBLIC — der Entzug lief ins Leere.
--
--  Folge: Jeder Inhaber des öffentlichen anon-Keys, der im Browser-Bundle
--  steht, konnte schedule_project_ai(url, key) aufrufen und damit geplante
--  HTTP-Aufrufe an ein beliebiges Ziel einrichten, sobald pg_cron aktiv ist.
--  Auf dieser Datenbank war pg_cron nicht aktiviert, die Funktion stieg
--  deshalb vorher aus und es wurden keine Jobs angelegt.
--
--  Die beiden Profil-Trigger behalten ihre Ausnahme für auth.uid() IS NULL
--  bewusst: dort ist RLS das äussere Tor, und die Edge Function
--  admin-create-user arbeitet mit dem Service-Role-Schlüssel.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.schedule_project_ai(_base_url text, _service_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jobs constant text[][] := ARRAY[
    ARRAY['rekuflow-daily-briefing',   '0 5 * * *', 'daily_briefing'],
    ARRAY['rekuflow-next-actions',     '5 5 * * *', 'next_actions'],
    ARRAY['rekuflow-weekly-report',    '0 6 * * 1', 'weekly_report'],
    ARRAY['rekuflow-partner-followup', '10 6 * * 1','partner_followup'],
    ARRAY['rekuflow-risk-scan',        '20 6 * * 1','risk_scan']
  ];
  i int;
  created int := 0;
BEGIN
  -- Jeder API-Aufruf bringt request.jwt.claims mit, auch ein anonymer.
  -- Nur eine direkte Datenbanksitzung (SQL-Editor, Migration) hat keine.
  -- Die frühere Bedingung liess anonyme Aufrufe durch, weil auth.uid()
  -- dort ebenfalls NULL ist.
  IF current_setting('request.jwt.claims', true) IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen die KI-Zeitpläne einrichten.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'schedule'
  ) THEN
    RETURN 'pg_cron ist nicht aktiviert. Bitte zuerst: create extension pg_cron;';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net' AND p.proname = 'http_post'
  ) THEN
    RETURN 'pg_net ist nicht aktiviert. Bitte zuerst: create extension pg_net;';
  END IF;

  FOR i IN 1 .. array_length(jobs, 1) LOOP
    PERFORM cron.unschedule(jobs[i][1]) WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = jobs[i][1]
    );
    PERFORM cron.schedule(
      jobs[i][1],
      jobs[i][2],
      format(
        $cmd$select net.http_post(
          url     := %L,
          headers := jsonb_build_object('Content-Type','application/json','Authorization',%L),
          body    := jsonb_build_object('analysisType', %L)
        );$cmd$,
        rtrim(_base_url, '/') || '/functions/v1/project-ai',
        'Bearer ' || _service_key,
        jobs[i][3]
      )
    );
    created := created + 1;
  END LOOP;

  RETURN created || ' KI-Zeitpläne eingerichtet.';
END;
$$;

CREATE OR REPLACE FUNCTION public.unschedule_project_ai()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  names constant text[] := ARRAY['rekuflow-daily-briefing','rekuflow-next-actions',
    'rekuflow-weekly-report','rekuflow-partner-followup','rekuflow-risk-scan'];
  n text;
  removed int := 0;
BEGIN
  -- Jeder API-Aufruf bringt request.jwt.claims mit, auch ein anonymer.
  -- Nur eine direkte Datenbanksitzung (SQL-Editor, Migration) hat keine.
  -- Die frühere Bedingung liess anonyme Aufrufe durch, weil auth.uid()
  -- dort ebenfalls NULL ist.
  IF current_setting('request.jwt.claims', true) IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen die KI-Zeitpläne entfernen.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'unschedule'
  ) THEN
    RETURN 'pg_cron ist nicht aktiviert.';
  END IF;

  FOREACH n IN ARRAY names LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = n) THEN
      PERFORM cron.unschedule(n);
      removed := removed + 1;
    END IF;
  END LOOP;

  RETURN removed || ' KI-Zeitpläne entfernt.';
END;
$$;


-- ---------------------------------------------------------------- Ausführungsrechte
-- Der Entzug muss anon ausdrücklich nennen; FROM PUBLIC allein genügt bei
-- Supabase nicht.
REVOKE ALL ON FUNCTION public.schedule_project_ai(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unschedule_project_ai()         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_project_code(text)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_fraction_code(uuid, text)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_role(uuid, app_role)   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.schedule_project_ai(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unschedule_project_ai()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_project_code(text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_fraction_code(uuid, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, app_role)   TO authenticated;

-- Trigger-Funktionen ruft niemand direkt auf.
DO $revoke$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.set_updated_at()', 'public.evaluate_analysis_result()',
    'public.compute_product_test_delta()', 'public.stamp_task_completion()',
    'public.compute_fraction_yield()', 'public.audit_row_change()',
    'public.guard_profile_insert()', 'public.guard_profile_update()',
    'public.handle_new_profile_role()'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $revoke$;

-- get_email_by_username bleibt für anon offen: die Anmeldemaske löst damit den
-- Benutzernamen auf, bevor eine Sitzung existiert. Der Aufruf ist über die
-- Edge Function rate-limit gedrosselt.
