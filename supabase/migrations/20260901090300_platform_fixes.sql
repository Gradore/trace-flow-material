-- =====================================================================
-- Platform fixes found during the full application audit.
--   1. Login by username works for accounts without an e-mail address
--   2. Ambiguous log_audit() overload removed (every audit call failed)
--   3. audit_logs is actually written (the page could never show anything)
--   4. One role per user, enforced in the DB
--   5. Referential integrity: deletes no longer fail on history rows
--   6. RLS: the "any authenticated user may read everything" policies are
--      replaced by staff / tenant scoped ones
-- =====================================================================

-- ---------------------------------------------------------------- 1. login
-- Accounts created by an admin without an e-mail address authenticate with a
-- synthetic <username>@rekuflow.internal address while profiles.email stays
-- NULL. The username lookup has to fall back to the auth address, otherwise
-- those users can never sign in.
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

-- ---------------------------------------------------------------- 2. log_audit
-- Two overloads with identical parameter names existed, so PostgREST could not
-- resolve supabase.rpc('log_audit') and every call failed with PGRST203.
-- The older overload is log_audit(_table_name, _record_id, _action, ...) and the
-- newer one log_audit(_action, _table_name, _record_id, ...). Both have the
-- signature (text, text, uuid, ...) resp. (text, uuid, text, ...); keeping the
-- newer one matches src/hooks/useAuditLog.ts.
DROP FUNCTION IF EXISTS public.log_audit(text, uuid, text, jsonb, jsonb, text[]);
REVOKE ALL ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text[]) TO authenticated;

-- ---------------------------------------------------------------- 3. audit trail
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
    -- nothing but updated_at changed: not worth an audit row
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

-- Betriebsleiter needs to read the audit log the menu offers them.
DROP POLICY IF EXISTS "Betriebsleiter can view audit logs" ON public.audit_logs;
CREATE POLICY "Betriebsleiter can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'betriebsleiter'::app_role));

-- ---------------------------------------------------------------- 4. one role
-- The whole application assumes exactly one role per user (useUserRole reads a
-- single row, the UI offers a single Select). Multiple rows made the role
-- lookup fail and left the user without any navigation.
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

-- Betriebsleiter manages users through the menu, so they must be able to read
-- the roles of the users they see.
DROP POLICY IF EXISTS "Betriebsleiter can view roles" ON public.user_roles;
CREATE POLICY "Betriebsleiter can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'betriebsleiter'::app_role));

-- Atomic role change - delete+insert from the client left admins without a role
-- whenever RLS rejected the follow-up insert.
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

-- ---------------------------------------------------------------- 5. FK cleanup
-- Deleting a container or an intake always failed with 23503 because the
-- history row written on creation referenced it without an ON DELETE action.
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
      AND c.confdeltype = 'a'   -- NO ACTION
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

-- A sample must not block the deletion of the output material it belongs to.
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

-- documents.uploaded_by / delivery_notes.created_by point at profiles.id, but
-- the client only knows auth.uid(). Repoint them at the auth user so uploads
-- and delivery notes can be saved at all.
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

-- ---------------------------------------------------------------- 6. RLS
-- "viewable by any authenticated user" leaked the whole operational database
-- to customer and supplier accounts.
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

-- Customers legitimately browse the available stock catalogue, but only that.
DROP POLICY IF EXISTS "Outputs viewable by authenticated" ON public.output_materials;
DROP POLICY IF EXISTS "Outputs viewable by staff or in stock" ON public.output_materials;
CREATE POLICY "Outputs viewable by staff or in stock"
ON public.output_materials FOR SELECT TO authenticated
USING (
  public.is_internal_staff(auth.uid())
  OR status = 'in_stock'
);

-- A customer sees the delivery notes addressed to their own company.
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

-- The old permissive orders policy was never dropped, so the multi-tenant one
-- added later had no effect (policies are OR-ed).
DROP POLICY IF EXISTS "Orders viewable by authenticated" ON public.orders;

-- Profiles: an external user has no business reading the whole staff directory.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or staff can view all" ON public.profiles;
CREATE POLICY "Users can view own profile or staff can view all"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_internal_staff(auth.uid())
);

-- ---------------------------------------------------------------- 7. anon leaks
-- Policies created without TO authenticated are granted to PUBLIC, which
-- includes the anon role - anyone holding the publishable key could read them.
DROP POLICY IF EXISTS "Batch allocations viewable by authenticated" ON public.batch_allocations;
DROP POLICY IF EXISTS "Batch allocations viewable by staff" ON public.batch_allocations;
CREATE POLICY "Batch allocations viewable by staff"
ON public.batch_allocations FOR SELECT TO authenticated
USING (public.is_internal_staff(auth.uid()));

-- Notifications could be addressed to any user by any user.
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications insertable for self or by staff" ON public.notifications;
CREATE POLICY "Notifications insertable for self or by staff"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_internal_staff(auth.uid())
);

-- ---------------------------------------------------------------- 8. storage
-- The private documents bucket was readable and deletable by every logged-in
-- user, which made the table-level policies pointless.
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete any document" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff can write documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete documents bucket" ON storage.objects;

DROP POLICY IF EXISTS "Staff can read documents bucket" ON storage.objects;
CREATE POLICY "Staff can read documents bucket"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can write documents bucket" ON storage.objects;
CREATE POLICY "Staff can write documents bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update documents bucket" ON storage.objects;
CREATE POLICY "Staff can update documents bucket"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete documents bucket" ON storage.objects;
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

-- ---------------------------------------------------------------- 9. documents delete
-- The old policy compared uploaded_by (a profiles.id) with auth.uid(), so the
-- uploader branch could never be true and every non-admin delete silently
-- no-opped while the UI reported success.
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

-- ---------------------------------------------------------------- 10. username lookup
-- get_email_by_username is SECURITY DEFINER and was callable by anon, handing
-- out e-mail addresses. Only the login form needs it, and that request is
-- unauthenticated, so keep anon EXECUTE but make the function leak nothing but
-- the login address for an exact username match (it already does) and rate
-- limit it at the edge. Revoke from PUBLIC so the grant is explicit.
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;

-- ---------------------------------------------------------------- 11. R&D data
-- Recipes, datasheet analyses, sales leads and application profiles are
-- internal engineering and sales data. `auth.role() = 'authenticated'` let any
-- customer or supplier account read and write them through the API, even after
-- the UI routes were closed.
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

-- Uploading a document is a staff action, not something any account may do.
DROP POLICY IF EXISTS "Documents insertable by authenticated" ON public.documents;
DROP POLICY IF EXISTS "Documents insertable by staff" ON public.documents;
CREATE POLICY "Documents insertable by staff"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.is_internal_staff(auth.uid()));

-- ---------------------------------------------------------------- 12. rejected intake
-- Rejecting a sample is supposed to reject its batch and stop the running
-- processing steps (SampleResultsDialog / Sampling), and the intake page counts
-- and styles rejected batches. The CHECK constraint never allowed the value, so
-- that UPDATE always failed and the rejection silently did not happen.
ALTER TABLE public.material_inputs DROP CONSTRAINT IF EXISTS material_inputs_status_check;
ALTER TABLE public.material_inputs ADD CONSTRAINT material_inputs_status_check
  CHECK (status = ANY (ARRAY['received', 'in_processing', 'processed', 'rejected']));

-- ---------------------------------------------------------------- 13. tenant writes
-- The supplier INSERT policies correlated `c.company_id = company_id`; inside
-- the subquery the bare column resolves to the alias `c`, so the condition was
-- `c.company_id = c.company_id` - always true. Any supplier could therefore
-- create announcements and pickup requests in the name of any other company.
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

-- ---------------------------------------------------------------- 14. stock catalogue
-- "any authenticated principal may read every in_stock row" was too wide: it
-- also covered accounts without a role. Only customers browse the catalogue.
DROP POLICY IF EXISTS "Outputs viewable by staff or in stock" ON public.output_materials;
DROP POLICY IF EXISTS "Outputs viewable by staff or customers in stock" ON public.output_materials;
CREATE POLICY "Outputs viewable by staff or customers in stock"
ON public.output_materials FOR SELECT TO authenticated
USING (
  public.is_internal_staff(auth.uid())
  OR (status = 'in_stock' AND public.has_role(auth.uid(), 'customer'::app_role))
);

-- ---------------------------------------------------------------- 15. profile updates
-- A user could update their own profiles row including the `role` column. The
-- column is only a display copy - user_roles is authoritative - but a stale
-- role there is confusing and any future policy reading it would be exploitable.
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

  -- Non-admins may edit their own data, never their role or their identity.
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
