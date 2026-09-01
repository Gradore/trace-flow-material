-- 20260901090200_disable_self_registration
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert own role or admins can insert any" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert own pending registration" ON public.pending_registrations;
DROP POLICY IF EXISTS "Anyone can create pending registration" ON public.pending_registrations;
DROP POLICY IF EXISTS "Users can create their own registration" ON public.pending_registrations;

CREATE OR REPLACE FUNCTION public.guard_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Selbstregistrierung ist deaktiviert. Benutzer werden ausschliesslich von Administratoren angelegt.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_insert ON public.profiles;
CREATE TRIGGER guard_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_insert();

CREATE OR REPLACE FUNCTION public.handle_new_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, COALESCE(NEW.role, 'customer')::app_role);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_role();

-- 20260901090300_platform_fixes
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.email, u.email)
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.username = lower(_username)
  LIMIT 1
$$;

DROP FUNCTION IF EXISTS public.log_audit(text, uuid, text, jsonb, jsonb, text[]);
REVOKE ALL ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_record uuid;
  v_email text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD); v_new := NULL; v_record := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL; v_new := to_jsonb(NEW); v_record := NEW.id;
  ELSE
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_record := NEW.id;
    SELECT array_agg(n.key) INTO v_changed
    FROM jsonb_each(v_new) AS n(key, value)
    WHERE n.value IS DISTINCT FROM (v_old -> n.key);
    IF v_changed IS NULL OR v_changed <@ ARRAY['updated_at'] THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_logs
    (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email)
  VALUES
    (TG_TABLE_NAME, v_record, TG_OP, v_old, v_new, v_changed, auth.uid(), v_email);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'containers','material_inputs','processing_steps','samples','output_materials',
    'delivery_notes','orders','companies','documents','equipment','maintenance_records',
    'project_partners','project_tasks','material_batches','test_runs','output_fractions',
    'fraction_analyses','product_tests','project_risks'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER audit_row_change
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Betriebsleiter can view audit logs" ON public.audit_logs;
CREATE POLICY "Betriebsleiter can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'betriebsleiter'::app_role));

DELETE FROM public.user_roles ur
USING public.user_roles keep
WHERE ur.user_id = keep.user_id
  AND ur.id <> keep.id
  AND array_position(
        ARRAY['admin','betriebsleiter','production','qa','intake','logistics','supplier','customer']::text[],
        ur.role::text)
      > array_position(
        ARRAY['admin','betriebsleiter','production','qa','intake','logistics','supplier','customer']::text[],
        keep.role::text);

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

DROP POLICY IF EXISTS "Betriebsleiter can view roles" ON public.user_roles;
CREATE POLICY "Betriebsleiter can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'betriebsleiter'::app_role));

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Nur Administratoren dürfen Rollen ändern.' USING ERRCODE = '42501';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Die eigene Rolle kann nicht geändert werden.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.profiles SET role = _role::text WHERE user_id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, app_role) TO authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, t.relname AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) AS k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND t.relname IN ('material_flow_history','documents')
      AND a.attname IN ('material_input_id','container_id','processing_step_id',
                        'sample_id','output_material_id','delivery_note_id')
      AND c.confdeltype = 'a'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s ON DELETE CASCADE',
      r.tbl, r.conname, r.col,
      CASE r.col
        WHEN 'material_input_id'   THEN 'public.material_inputs(id)'
        WHEN 'container_id'        THEN 'public.containers(id)'
        WHEN 'processing_step_id'  THEN 'public.processing_steps(id)'
        WHEN 'sample_id'           THEN 'public.samples(id)'
        WHEN 'output_material_id'  THEN 'public.output_materials(id)'
        WHEN 'delivery_note_id'    THEN 'public.delivery_notes(id)'
        ELSE NULL
      END);
  END LOOP;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FK cleanup skipped: %', SQLERRM;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) AS k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE c.contype = 'f' AND n.nspname = 'public'
      AND t.relname = 'samples' AND a.attname = 'output_material_id'
  LOOP
    EXECUTE format('ALTER TABLE public.samples DROP CONSTRAINT %I', r.conname);
  END LOOP;

  ALTER TABLE public.samples ADD CONSTRAINT samples_output_material_id_fkey
    FOREIGN KEY (output_material_id) REFERENCES public.output_materials(id) ON DELETE SET NULL;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, t.relname AS tbl
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) AS k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    JOIN pg_class rt ON rt.oid = c.confrelid
    WHERE c.contype = 'f' AND n.nspname = 'public'
      AND rt.relname = 'profiles'
      AND ((t.relname = 'documents'      AND a.attname = 'uploaded_by')
        OR (t.relname = 'delivery_notes' AND a.attname = 'created_by')
        OR (t.relname = 'material_flow_history' AND a.attname = 'created_by'))
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Containers viewable by authenticated" ON public.containers;
DROP POLICY IF EXISTS "Containers viewable by staff" ON public.containers;
CREATE POLICY "Containers viewable by staff"
ON public.containers FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Material inputs viewable by authenticated" ON public.material_inputs;
DROP POLICY IF EXISTS "Material inputs viewable by staff" ON public.material_inputs;
CREATE POLICY "Material inputs viewable by staff"
ON public.material_inputs FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Processing viewable by authenticated" ON public.processing_steps;
DROP POLICY IF EXISTS "Processing viewable by staff" ON public.processing_steps;
CREATE POLICY "Processing viewable by staff"
ON public.processing_steps FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Samples viewable by authenticated" ON public.samples;
DROP POLICY IF EXISTS "Samples viewable by staff" ON public.samples;
CREATE POLICY "Samples viewable by staff"
ON public.samples FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Sample results viewable by authenticated" ON public.sample_results;
DROP POLICY IF EXISTS "Sample results viewable by staff" ON public.sample_results;
CREATE POLICY "Sample results viewable by staff"
ON public.sample_results FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "History viewable by authenticated" ON public.material_flow_history;
DROP POLICY IF EXISTS "History viewable by staff" ON public.material_flow_history;
CREATE POLICY "History viewable by staff"
ON public.material_flow_history FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Documents viewable by authenticated" ON public.documents;
DROP POLICY IF EXISTS "Documents viewable by staff" ON public.documents;
CREATE POLICY "Documents viewable by staff"
ON public.documents FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Outputs viewable by authenticated" ON public.output_materials;
DROP POLICY IF EXISTS "Outputs viewable by staff or in stock" ON public.output_materials;
CREATE POLICY "Outputs viewable by staff or in stock"
ON public.output_materials FOR SELECT TO authenticated
USING (
  public.is_internal_staff(auth.uid())
  OR status = 'in_stock'
);

DROP POLICY IF EXISTS "Delivery notes viewable by authenticated" ON public.delivery_notes;
DROP POLICY IF EXISTS "Delivery notes viewable by staff or own company" ON public.delivery_notes;
CREATE POLICY "Delivery notes viewable by staff or own company"
ON public.delivery_notes FOR SELECT TO authenticated
USING (
  public.is_internal_staff(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    JOIN public.companies co ON co.id = c.company_id
    WHERE c.user_id = auth.uid()
      AND co.name = delivery_notes.partner_name
  )
);

DROP POLICY IF EXISTS "Orders viewable by authenticated" ON public.orders;

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or staff can view all" ON public.profiles;
CREATE POLICY "Users can view own profile or staff can view all"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_internal_staff(auth.uid())
);

DROP POLICY IF EXISTS "Batch allocations viewable by authenticated" ON public.batch_allocations;
DROP POLICY IF EXISTS "Batch allocations viewable by staff" ON public.batch_allocations;
CREATE POLICY "Batch allocations viewable by staff"
ON public.batch_allocations FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications insertable for self or by staff" ON public.notifications;
CREATE POLICY "Notifications insertable for self or by staff"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_internal_staff(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete any document" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff can write documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete documents bucket" ON storage.objects;

CREATE POLICY "Staff can read documents bucket"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff can write documents bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff can update documents bucket"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff can delete documents bucket"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'betriebsleiter'::app_role)
    OR owner = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Documents deletable by uploader or admin" ON public.documents;
CREATE POLICY "Documents deletable by uploader or admin"
ON public.documents FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'betriebsleiter'::app_role)
  OR uploaded_by = auth.uid()
  OR uploaded_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('applications','datasheet_analyses','manufacturer_matches',
                        'order_recipe_matches','recipes')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['applications','datasheet_analyses','manufacturer_matches',
                           'order_recipe_matches','recipes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "staff_select_%s" ON public.%I FOR SELECT TO authenticated
       USING (public.is_internal_staff(auth.uid()))', t, t);
    EXECUTE format(
      'CREATE POLICY "staff_insert_%s" ON public.%I FOR INSERT TO authenticated
       WITH CHECK (public.is_internal_staff(auth.uid()))', t, t);
    EXECUTE format(
      'CREATE POLICY "staff_update_%s" ON public.%I FOR UPDATE TO authenticated
       USING (public.is_internal_staff(auth.uid()))
       WITH CHECK (public.is_internal_staff(auth.uid()))', t, t);
    EXECUTE format(
      'CREATE POLICY "admin_delete_%s" ON public.%I FOR DELETE TO authenticated
       USING (public.has_role(auth.uid(), ''admin''::app_role)
              OR public.has_role(auth.uid(), ''betriebsleiter''::app_role))', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Documents insertable by authenticated" ON public.documents;
DROP POLICY IF EXISTS "Documents insertable by staff" ON public.documents;
CREATE POLICY "Documents insertable by staff"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.is_internal_staff(auth.uid()));

ALTER TABLE public.material_inputs DROP CONSTRAINT IF EXISTS material_inputs_status_check;
ALTER TABLE public.material_inputs ADD CONSTRAINT material_inputs_status_check
  CHECK (status = ANY (ARRAY['received', 'in_processing', 'processed', 'rejected']));

DROP POLICY IF EXISTS "Suppliers can create pickup requests" ON public.pickup_requests;
CREATE POLICY "Suppliers can create pickup requests"
ON public.pickup_requests FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'supplier'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.company_id = pickup_requests.company_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Suppliers can create announcements" ON public.material_announcements;
CREATE POLICY "Suppliers can create announcements"
ON public.material_announcements FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'supplier'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.company_id = material_announcements.company_id
      AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Outputs viewable by staff or in stock" ON public.output_materials;
DROP POLICY IF EXISTS "Outputs viewable by staff or customers in stock" ON public.output_materials;
CREATE POLICY "Outputs viewable by staff or customers in stock"
ON public.output_materials FOR SELECT TO authenticated
USING (
  public.is_internal_staff(auth.uid())
  OR (status = 'in_stock' AND public.has_role(auth.uid(), 'customer'::app_role))
);

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.role := OLD.role;
  NEW.user_id := OLD.user_id;
  NEW.username := OLD.username;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_update ON public.profiles;
CREATE TRIGGER guard_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- 20260901090400_project_ai_schedule
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

-- 20260902080000_project_phases_rework
DELETE FROM public.project_tasks WHERE code IN ('P0-1', 'P0-2')
  AND title IN ('Patentrecherche Scher-/Walkverfahren', 'Patentanmeldung einreichen');

DROP FUNCTION IF EXISTS public.is_patent_filed();

DELETE FROM public.project_tasks t
USING public.project_tasks keep
WHERE t.title = keep.title
  AND t.id <> keep.id
  AND t.code ~ '^P[0-7]-'
  AND keep.code ~ '^P[0-7]-'
  AND (t.created_at, t.id) > (keep.created_at, keep.id);

UPDATE public.project_tasks
   SET code = 'TMP-' || left(replace(id::text, '-', ''), 12)
 WHERE title IN (
   'NDA-Template erstellen',
   'Versuchsprotokoll-Template entwickeln',
   'Externes Analytik-Labor auswählen',
   'Fraktions-Spezifikationsblätter definieren (F1–F5)',
   'Material-Maschinen-Matrix vervollständigen',
   'Anlagenspezifikation 32 t/Tag ableiten',
   'CAPEX-Modell aus Testdaten',
   'Förderantrag vorbereiten',
   'Investoren-/Kundenpräsentation aus Testdaten generieren'
 );

UPDATE public.project_tasks t SET code = v.code
FROM (VALUES
  ('NDA-Template erstellen','P0-1'),
  ('Versuchsprotokoll-Template entwickeln','P0-2'),
  ('Externes Analytik-Labor auswählen','P0-3'),
  ('Fraktions-Spezifikationsblätter definieren (F1–F5)','P0-4'),
  ('Material-Maschinen-Matrix vervollständigen','P7-1'),
  ('Anlagenspezifikation 32 t/Tag ableiten','P7-4'),
  ('CAPEX-Modell aus Testdaten','P7-5'),
  ('Förderantrag vorbereiten','P7-6'),
  ('Investoren-/Kundenpräsentation aus Testdaten generieren','P7-7')
) AS v(title, code)
WHERE t.title = v.title;

UPDATE public.project_tasks SET
  description = 'Gegenseitige Geheimhaltung mit Technikums- und Laborpartnern, bevor Material und Verfahrensdetails herausgehen.'
 WHERE code = 'P0-1';

UPDATE public.project_tasks SET
  description = 'Einheitliche Dokumentation für alle Technikumsversuche — Grundlage für die Vergleichbarkeit der Maschinen.'
 WHERE code = 'P0-2';

UPDATE public.project_phases SET
  name = 'Vorbereitung & Prüfrahmen',
  description = 'NDA, Versuchsprotokoll, Analytiklabor und die Bewertungskriterien, nach denen der Maschinenpark ausgewählt wird.'
 WHERE code = 'P0';

UPDATE public.project_phases SET
  name = 'Materialbeschaffung GFK-Typen',
  description = 'Unterschiedliche GFK-Typen M1–M7 für die Versuchsreihen beschaffen und je Charge dokumentieren. Fixstart: Optiplan und Lamilux (M1).'
 WHERE code = 'P1';

UPDATE public.project_phases SET
  name = 'Maschinentests im Technikum',
  description = 'Herstellertechnika: Eignung je Materialtyp und Prozessstufe ermitteln. Fixstart: Siempelkamp Sizereduction.'
 WHERE code = 'P2';

UPDATE public.project_phases SET
  name = 'Maschinenpark & Anlagenspezifikation',
  description = 'Maschinenauswahl je Prozessstufe, Angebotsvergleich, Anlagenspezifikation, CAPEX und Förderung.'
 WHERE code = 'P7';

UPDATE public.project_tasks SET
  title = 'Kooperationsvertrag + Geheimhaltungsregelung',
  description = 'Beide TUs. Regelung zur Verwertung der Ergebnisse und zur Geheimhaltung der Verfahrensparameter.'
 WHERE code = 'P6-1';

UPDATE public.project_tasks SET
  title = 'Verwertbare Berichte für Förderung und Anlagenplanung erstellen',
  description = 'Beide TUs. Die Berichte fließen in den Förderantrag und in die Auslegung des Maschinenparks ein.'
 WHERE code = 'P6-7';

UPDATE public.project_tasks SET
  title = 'Materialbedarf und Bezugsquellen je Materialklasse festlegen',
  description = 'Welche Menge je Materialklasse M1–M7 wird für die Versuchsreihen gebraucht, und von wem.'
 WHERE code = 'P1-4';

INSERT INTO public.project_tasks
  (code, phase_id, title, description, priority, estimated_duration_weeks, estimated_cost_eur, partner_id)
SELECT v.code, ph.id, v.title, v.description, v.priority, v.weeks, v.cost,
       (SELECT id FROM public.project_partners pp WHERE lower(pp.name) = lower(v.partner) LIMIT 1)
FROM (VALUES
 ('P0','P0-5','Bewertungskriterien Maschinenauswahl festlegen',
  'Gewichtung von Faserlänge, Durchsatz, spezifischem Energiebedarf, Werkzeugverschleiß und Investitionskosten. Ohne dieses Raster sind die Technikumsergebnisse nicht vergleichbar.',
  'high',1,0,NULL),
 ('P1','P1-6','M2 SMC/BMC Pressreste beschaffen',
  'Hoher Füllstoffanteil (CaCO₃) — dient zugleich als Verschleißtest für die Werkzeuge.','high',4,0,'Menzolit GmbH'),
 ('P1','P1-7','M3 Pultrudat-Profile beschaffen',
  'Gerichtete Endlosfaser, hartzäh — der Härtefall für niedrige Drehzahl.','high',4,0,'Fiberline Composites'),
 ('P1','P1-8','M4 Sandwich mit Schaumkern beschaffen',
  'Kernmaterial muss abgetrennt werden. Bezugsquelle noch festzulegen.','medium',4,0,NULL),
 ('P1','P1-9','M5 Epoxid-Spezialverbund beschaffen',
  'Thermisch stabil, bevorzugt für hochreine Compound-Anwendungen.','high',4,0,'Röchling Industrial'),
 ('P1','P1-10','M6 Boots-/Yachtlaminat beschaffen',
  'Gemischte Laminate mit Gelcoat.','medium',4,0,'Bavaria Yachtbau GmbH'),
 ('P1','P1-11','M7 GFK-Rohr / Tank beschaffen',
  'Dickwandig, Vorzerkleinerung nötig. Ausdrücklich kein sandhaltiges Material (kein Schleuderguss mit Sandkern).','medium',4,0,'Amiblu Germany GmbH'),
 ('P2','P2-10','Zahnwalzenmühle Moditec testen',
  'Goliath 25 U/min — langsamlaufend und für hochabrasive Faser relevant.','medium',4,5000,'Moditec (Mo.Di.Tec)'),
 ('P2','P2-11','Sondermaschinen-Option ZENO prüfen',
  'Sondermaschinenbau, flexibel bei Kleinserien — Option für eine angepasste Schermühle im eigenen Park.','medium',3,5000,'ZENO GmbH'),
 ('P7','P7-2','Maschinenauswahl je Prozessstufe festlegen',
  'Verbindliche Auswahl für den eigenen Maschinenpark: Vorzerkleinerung, Schermühle/Granulator, Sichtung, Siebung — je Stufe Fabrikat und Baugröße, begründet aus den Technikumsergebnissen.',
  'critical',3,0,NULL),
 ('P7','P7-3','Angebote der Hersteller einholen und vergleichen',
  'Angebote je ausgewählter Maschine inklusive Verschleißteilkosten, Lieferzeit und Inbetriebnahme.','high',4,0,NULL)
) AS v(phase_code, code, title, description, priority, weeks, cost, partner)
JOIN public.project_phases ph ON ph.code = v.phase_code
ON CONFLICT (code) DO NOTHING;

UPDATE public.project_tasks t SET partner_id = p.id
FROM (VALUES
  ('P2-5','WEIMA Maschinenbau GmbH'),
  ('P2-7','SKZ – Das Kunststoff-Zentrum'),
  ('P5-1','AKRO-PLASTIC GmbH'),
  ('P5-2','Lehmann&Voss & Co. KG'),
  ('P5-3','SKZ – Das Kunststoff-Zentrum'),
  ('P4-7','BWS Betonwerk Schwerin')
) AS v(task_code, partner_name)
JOIN public.project_partners p ON lower(p.name) = lower(v.partner_name)
WHERE t.code = v.task_code AND t.partner_id IS NULL;

INSERT INTO public.project_task_dependencies (task_id, depends_on_task_id)
SELECT t.id, d.id
FROM (VALUES
  ('P1-6','P1-4'), ('P1-7','P1-4'), ('P1-8','P1-4'), ('P1-9','P1-4'), ('P1-10','P1-4'), ('P1-11','P1-4'),
  ('P1-6','P0-1'), ('P1-7','P0-1'), ('P1-9','P0-1'), ('P1-10','P0-1'), ('P1-11','P0-1'),
  ('P2-10','P2-2'), ('P2-11','P2-2'),
  ('P2-2','P0-5'), ('P2-9','P0-5'),
  ('P7-2','P7-1'), ('P7-3','P7-2'), ('P7-4','P7-2')
) AS v(task_code, depends_on_code)
JOIN public.project_tasks t ON t.code = v.task_code
JOIN public.project_tasks d ON d.code = v.depends_on_code
ON CONFLICT DO NOTHING;

DELETE FROM public.project_risks WHERE title = 'Herstellerdemo vor Patentanmeldung';

INSERT INTO public.project_risks (title, description, category, probability, impact, mitigation_plan, owner, phase_id)
SELECT v.title, v.description, v.category, v.probability, v.impact, v.mitigation, v.owner, ph.id
FROM (VALUES
 ('Verfahrens-Know-how ohne NDA offengelegt',
  'Verfahrensparameter gehen im Technikum an einen Hersteller, bevor eine Geheimhaltungsvereinbarung unterschrieben ist.',
  'ip',3,4,'P0-1 (NDA-Template) vor dem ersten Herstellerkontakt abschließen; Versuchsprotokolle nur nach unterschriebenem NDA herausgeben.','manuel.buckow','P0'),
 ('Maschinenauswahl auf zu schmaler Datenbasis',
  'Der Maschinenpark wird festgelegt, obwohl nicht alle Materialklassen M1–M7 getestet wurden — im Betrieb zeigt sich dann eine Materialklasse als nicht verarbeitbar.',
  'technical',3,5,'Material-Maschinen-Matrix (P7-1) vor der Auswahl vollständig füllen; je Materialklasse mindestens einen dokumentierten Lauf fordern.','manuel.buckow','P7')
) AS v(title, description, category, probability, impact, mitigation, owner, phase_code)
LEFT JOIN public.project_phases ph ON ph.code = v.phase_code
WHERE NOT EXISTS (SELECT 1 FROM public.project_risks r WHERE r.title = v.title);