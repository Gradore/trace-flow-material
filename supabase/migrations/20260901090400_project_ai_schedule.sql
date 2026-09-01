-- =====================================================================
-- Scheduling for the AI evaluations of section 6.2 of the project plan.
--
-- The schedules need a service-role identity, which must never live in the
-- repository. This migration therefore only provides the setup: the operator
-- runs ONE statement with the key, and the five jobs are created.
--
--   select public.schedule_project_ai(
--     'https://<PROJECT_REF>.supabase.co',
--     '<SERVICE_ROLE_KEY>');
--
-- and to remove them again:
--   select public.unschedule_project_ai();
--
-- Times are UTC. 05:00 UTC = 06:00 CET (07:00 CEST), matching the plan's
-- "Cron 06:00 CET" for the daily briefing.
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
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() IS NOT NULL THEN
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
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() IS NOT NULL THEN
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

REVOKE ALL ON FUNCTION public.schedule_project_ai(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unschedule_project_ai() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_project_ai(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unschedule_project_ai() TO authenticated;
