-- =====================================================================
--  RekuFLOW — Datenbank auf den Stand des Repositorys bringen
--
--  WARUM DAS NÖTIG IST
--  Lovable übernimmt Code aus GitHub, wendet aber Migrationsdateien,
--  die nicht von Lovable selbst erzeugt wurden, NICHT automatisch an.
--  Deshalb meldet die App "Could not find the table 'public.project_tasks'".
--
--  ANWENDUNG
--  Supabase Dashboard -> SQL Editor -> New query -> Inhalt einfügen -> Run.
--  Das Skript ist mehrfach ausführbar (idempotent).
--
--  ENTHÄLT (in dieser Reihenfolge)
--   1. Projektmodul-Schema      (19 Tabellen, Trigger, RLS)
--   2. Projektmodul-Seed        (Fraktionen, Partner, Phasen, Aufgaben, Vorlagen)
--   3. Selbstregistrierung zu
--   4. Plattform-Korrekturen    (RLS-Härtung, Audit, Rollen, Fremdschlüssel)
--   5. KI-Zeitpläne
--   6. Phasen ohne Patent       (Maschinenpark, GFK-Typen, Partnerzuordnung)
--
--  ACHTUNG, verändert Bestandsdaten:
--   * user_roles bekommt UNIQUE(user_id) — hat ein Benutzer zwei Rollen,
--     wird die schwächere gelöscht.
--   * Die permissiven RLS-Policies werden ersetzt; Kunden- und
--     Lieferantenkonten sehen danach deutlich weniger.
-- =====================================================================


-- ####################################################################
-- ##  20260901090000_project_module_schema

-- ####################################################################
-- ##  20260901090000_project_module_schema
-- ####################################################################

-- =====================================================================
-- GFK Recycling project module (Projektplan trace-flow-material)
-- Planning & test-phase orchestration: partners, phases, tasks,
-- material batches, test runs, output fractions, analytics,
-- product tests, communication, AI evaluations and risks.
--
-- Design rules:
--  * additive only - no existing table is dropped or altered destructively
--  * every table links back into the operational schema where sensible
--    (companies, material_inputs, output_materials, samples, documents)
--  * RLS: internal staff read/write, admins delete
-- =====================================================================

-- ---------- generic updated_at helper (idempotent) ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- MASTER DATA: partners & contacts
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.project_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'machine_manufacturer',
  subcategory text,
  street text,
  postal_code text,
  city text,
  country text DEFAULT 'DE',
  website text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'prospect',
  suitability_rating int CHECK (suitability_rating BETWEEN 1 AND 5),
  is_fixed_partner boolean NOT NULL DEFAULT false,
  material_classes text[] DEFAULT '{}',
  fraction_ids text[] DEFAULT '{}',
  notes text,
  -- bridge into the operational schema
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_partners_name ON public.project_partners (lower(name));
CREATE INDEX IF NOT EXISTS idx_project_partners_category ON public.project_partners (category);
CREATE INDEX IF NOT EXISTS idx_project_partners_company ON public.project_partners (company_id);

CREATE TABLE IF NOT EXISTS public.project_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.project_partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  department text,
  email text,
  phone text,
  mobile text,
  is_primary boolean NOT NULL DEFAULT false,
  is_decision_maker boolean NOT NULL DEFAULT false,
  last_contact_date date,
  next_action text,
  next_action_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_contacts_partner ON public.project_contacts (partner_id);

-- =====================================================================
-- PROJECT STRUCTURE: phases, tasks, dependencies
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  order_num int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'not_started',
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  due_date date,
  estimated_duration_weeks numeric,
  estimated_cost_eur numeric,
  actual_cost_eur numeric,
  assignee text,
  partner_id uuid REFERENCES public.project_partners(id) ON DELETE SET NULL,
  blocker_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_tasks_phase ON public.project_tasks (phase_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.project_tasks (status);

CREATE TABLE IF NOT EXISTS public.project_task_dependencies (
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

-- =====================================================================
-- MATERIAL FLOW
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.material_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code text NOT NULL UNIQUE,
  supplier_partner_id uuid REFERENCES public.project_partners(id) ON DELETE SET NULL,
  material_class text NOT NULL DEFAULT 'M1',
  resin_type text,
  weight_kg numeric NOT NULL DEFAULT 0,
  received_date date DEFAULT CURRENT_DATE,
  declared_fiber_content_pct numeric,
  declared_filler text,
  contamination_notes text,
  storage_location text,
  status text NOT NULL DEFAULT 'received',
  notes text,
  -- bridge into the operational schema
  material_input_id uuid REFERENCES public.material_inputs(id) ON DELETE SET NULL,
  container_id uuid REFERENCES public.containers(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_material_batches_supplier ON public.material_batches (supplier_partner_id);
CREATE INDEX IF NOT EXISTS idx_material_batches_class ON public.material_batches (material_class);

CREATE TABLE IF NOT EXISTS public.doe_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  process_line text NOT NULL DEFAULT 'A_baustoff',
  description text,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  responses text[] DEFAULT '{}',
  planned_runs int NOT NULL DEFAULT 0,
  design_type text NOT NULL DEFAULT 'full_factorial',
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_code text NOT NULL UNIQUE,
  title text NOT NULL,
  partner_id uuid REFERENCES public.project_partners(id) ON DELETE SET NULL,
  machine_name text,
  machine_type text,
  input_batch_id uuid REFERENCES public.material_batches(id) ON DELETE SET NULL,
  input_weight_kg numeric,
  process_line text NOT NULL DEFAULT 'A_baustoff',
  planned_date date,
  actual_date date,
  status text NOT NULL DEFAULT 'planned',
  doe_run_number int,
  doe_series_id uuid REFERENCES public.doe_series(id) ON DELETE SET NULL,
  cost_eur numeric,
  responsible text,
  summary text,
  ai_interpretation text,
  ai_interpreted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_runs_partner ON public.test_runs (partner_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_batch ON public.test_runs (input_batch_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_series ON public.test_runs (doe_series_id);

CREATE TABLE IF NOT EXISTS public.test_run_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  value_numeric numeric,
  value_text text,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_run_id, parameter_key)
);

CREATE TABLE IF NOT EXISTS public.fraction_specs (
  id text PRIMARY KEY,
  name text NOT NULL,
  fiber_length_min_mm numeric,
  fiber_length_max_mm numeric,
  glass_content_min_pct numeric,
  moisture_max_pct numeric,
  fines_max_pct numeric,
  application text,
  target_price_eur_t numeric,
  process_line text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.output_fractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fraction_code text NOT NULL UNIQUE,
  test_run_id uuid REFERENCES public.test_runs(id) ON DELETE CASCADE,
  target_fraction_id text REFERENCES public.fraction_specs(id) ON DELETE SET NULL,
  weight_kg numeric NOT NULL DEFAULT 0,
  yield_pct numeric,
  storage_location text,
  retained_sample_kg numeric,
  status text NOT NULL DEFAULT 'produced',
  released_for_product_test boolean NOT NULL DEFAULT false,
  notes text,
  -- bridge into the operational schema
  output_material_id uuid REFERENCES public.output_materials(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_output_fractions_run ON public.output_fractions (test_run_id);
CREATE INDEX IF NOT EXISTS idx_output_fractions_spec ON public.output_fractions (target_fraction_id);

-- =====================================================================
-- ANALYTICS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.fraction_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_code text NOT NULL UNIQUE,
  output_fraction_id uuid REFERENCES public.output_fractions(id) ON DELETE CASCADE,
  lab_partner_id uuid REFERENCES public.project_partners(id) ON DELETE SET NULL,
  method text,
  sample_sent_date date,
  result_date date,
  status text NOT NULL DEFAULT 'ordered',
  cost_eur numeric,
  ai_interpretation text,
  ai_interpreted_at timestamptz,
  notes text,
  -- bridge into the operational schema
  sample_id uuid REFERENCES public.samples(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fraction_analyses_fraction ON public.fraction_analyses (output_fraction_id);

CREATE TABLE IF NOT EXISTS public.fraction_analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.fraction_analyses(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  value_numeric numeric,
  value_text text,
  unit text,
  target_value numeric,
  spec_min numeric,
  spec_max numeric,
  pass_fail boolean,
  measured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_results_analysis ON public.fraction_analysis_results (analysis_id);

-- =====================================================================
-- PRODUCT TESTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.product_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_code text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'concrete',
  partner_id uuid REFERENCES public.project_partners(id) ON DELETE SET NULL,
  output_fraction_id uuid REFERENCES public.output_fractions(id) ON DELETE SET NULL,
  dosage_pct numeric,
  recipe_notes text,
  planned_date date,
  actual_date date,
  status text NOT NULL DEFAULT 'planned',
  cost_eur numeric,
  summary text,
  ai_interpretation text,
  ai_interpreted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_tests_fraction ON public.product_tests (output_fraction_id);

CREATE TABLE IF NOT EXISTS public.product_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_test_id uuid NOT NULL REFERENCES public.product_tests(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  value_numeric numeric,
  unit text,
  age_days int,
  baseline_value numeric,
  delta_pct numeric,
  measured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_test_results_test ON public.product_test_results (product_test_id);

-- =====================================================================
-- COMMUNICATION
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.project_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'follow_up',
  subject text NOT NULL,
  body_md text NOT NULL,
  placeholders text[] DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.project_partners(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.project_contacts(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound',
  channel text NOT NULL DEFAULT 'email',
  subject text,
  body text,
  template_id uuid REFERENCES public.project_email_templates(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  linked_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  linked_test_run_id uuid REFERENCES public.test_runs(id) ON DELETE SET NULL,
  ai_summary text,
  ai_action_items jsonb,
  ai_sentiment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_comms_partner ON public.project_communications (partner_id);

-- =====================================================================
-- AI EVALUATIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type text NOT NULL,
  scope_type text NOT NULL DEFAULT 'global',
  scope_id uuid,
  input_context jsonb,
  output_md text,
  recommendations jsonb,
  confidence text,
  model text,
  tokens_used int,
  created_for_user uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acted_upon boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_type ON public.ai_analyses (analysis_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_scope ON public.ai_analyses (scope_type, scope_id);

-- =====================================================================
-- RISKS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.project_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'technical',
  probability int NOT NULL DEFAULT 3 CHECK (probability BETWEEN 1 AND 5),
  impact int NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  severity int GENERATED ALWAYS AS (probability * impact) STORED,
  mitigation_plan text,
  owner text,
  status text NOT NULL DEFAULT 'open',
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  ai_suggested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- DOCUMENT BRIDGE: reuse the existing documents table for project
-- entities via a generic polymorphic link (additive, nullable).
-- =====================================================================
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS linked_to_type text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS linked_to_id uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ai_extracted_data jsonb;
CREATE INDEX IF NOT EXISTS idx_documents_generic_link ON public.documents (linked_to_type, linked_to_id);

-- =====================================================================
-- updated_at triggers
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_partners','project_contacts','project_phases','project_tasks',
    'material_batches','doe_series','test_runs','output_fractions',
    'fraction_analyses','product_tests','project_email_templates','project_risks'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- =====================================================================
-- Spec conformity: evaluate analysis results against fraction_specs
-- =====================================================================
CREATE OR REPLACE FUNCTION public.evaluate_analysis_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spec public.fraction_specs%ROWTYPE;
  v_min numeric;
  v_max numeric;
BEGIN
  SELECT fs.* INTO spec
  FROM public.fraction_analyses fa
  JOIN public.output_fractions f ON f.id = fa.output_fraction_id
  JOIN public.fraction_specs fs ON fs.id = f.target_fraction_id
  WHERE fa.id = NEW.analysis_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- derive spec window from the fraction spec when not supplied explicitly
  IF NEW.spec_min IS NULL AND NEW.spec_max IS NULL THEN
    CASE NEW.parameter_key
      WHEN 'fiber_length_median_mm' THEN
        v_min := spec.fiber_length_min_mm; v_max := spec.fiber_length_max_mm;
      WHEN 'glass_content_pct' THEN
        v_min := spec.glass_content_min_pct; v_max := NULL;
      WHEN 'moisture_pct' THEN
        v_min := NULL; v_max := spec.moisture_max_pct;
      WHEN 'fines_below_05mm_pct' THEN
        v_min := NULL; v_max := spec.fines_max_pct;
      WHEN 'energy_kwh_t' THEN
        v_min := NULL; v_max := 350;
      ELSE
        v_min := NULL; v_max := NULL;
    END CASE;
    NEW.spec_min := v_min;
    NEW.spec_max := v_max;
  END IF;

  IF NEW.value_numeric IS NOT NULL AND (NEW.spec_min IS NOT NULL OR NEW.spec_max IS NOT NULL) THEN
    NEW.pass_fail :=
      (NEW.spec_min IS NULL OR NEW.value_numeric >= NEW.spec_min)
      AND (NEW.spec_max IS NULL OR NEW.value_numeric <= NEW.spec_max);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluate_analysis_result ON public.fraction_analysis_results;
CREATE TRIGGER evaluate_analysis_result
  BEFORE INSERT OR UPDATE ON public.fraction_analysis_results
  FOR EACH ROW EXECUTE FUNCTION public.evaluate_analysis_result();

-- =====================================================================
-- Product test results: automatic delta vs. baseline
-- =====================================================================
CREATE OR REPLACE FUNCTION public.compute_product_test_delta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.baseline_value IS NOT NULL AND NEW.baseline_value <> 0 AND NEW.value_numeric IS NOT NULL THEN
    NEW.delta_pct := round(((NEW.value_numeric - NEW.baseline_value) / NEW.baseline_value) * 100, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compute_product_test_delta ON public.product_test_results;
CREATE TRIGGER compute_product_test_delta
  BEFORE INSERT OR UPDATE ON public.product_test_results
  FOR EACH ROW EXECUTE FUNCTION public.compute_product_test_delta();

-- =====================================================================
-- Task completion timestamp
-- =====================================================================
CREATE OR REPLACE FUNCTION public.stamp_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_task_completion ON public.project_tasks;
CREATE TRIGGER stamp_task_completion
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.stamp_task_completion();

-- =====================================================================
-- IP gate: is the patent application (P0-2) filed?
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_patent_filed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'done' FROM public.project_tasks WHERE code = 'P0-2' LIMIT 1),
    false
  );
$$;

-- =====================================================================
-- Yield calculation for output fractions
-- =====================================================================
CREATE OR REPLACE FUNCTION public.compute_fraction_yield()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  input_kg numeric;
BEGIN
  IF NEW.yield_pct IS NULL AND NEW.test_run_id IS NOT NULL AND NEW.weight_kg IS NOT NULL THEN
    SELECT input_weight_kg INTO input_kg FROM public.test_runs WHERE id = NEW.test_run_id;
    IF input_kg IS NOT NULL AND input_kg > 0 THEN
      NEW.yield_pct := round((NEW.weight_kg / input_kg) * 100, 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compute_fraction_yield ON public.output_fractions;
CREATE TRIGGER compute_fraction_yield
  BEFORE INSERT OR UPDATE ON public.output_fractions
  FOR EACH ROW EXECUTE FUNCTION public.compute_fraction_yield();

-- =====================================================================
-- RLS: internal staff read/write, admins delete
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'project_partners','project_contacts','project_phases','project_tasks',
    'project_task_dependencies','material_batches','doe_series','test_runs',
    'test_run_parameters','fraction_specs','output_fractions','fraction_analyses',
    'fraction_analysis_results','product_tests','product_test_results',
    'project_email_templates','project_communications','ai_analyses','project_risks'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "staff_select_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "staff_select_%s" ON public.%I FOR SELECT TO authenticated
       USING (public.is_internal_staff(auth.uid()))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "staff_insert_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "staff_insert_%s" ON public.%I FOR INSERT TO authenticated
       WITH CHECK (public.is_internal_staff(auth.uid()))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "staff_update_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "staff_update_%s" ON public.%I FOR UPDATE TO authenticated
       USING (public.is_internal_staff(auth.uid()))
       WITH CHECK (public.is_internal_staff(auth.uid()))', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "admin_delete_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "admin_delete_%s" ON public.%I FOR DELETE TO authenticated
       USING (public.has_role(auth.uid(), ''admin''::app_role)
              OR public.has_role(auth.uid(), ''betriebsleiter''::app_role))', t, t);
  END LOOP;
END $$;

-- =====================================================================
-- Sequential, human readable codes for project records.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.next_project_code(_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  n int;
BEGIN
  CASE _kind
    WHEN 'test_run' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(run_code, '^TR-' || yr || '-', ''), '')::int), 0) + 1
        INTO n FROM public.test_runs WHERE run_code LIKE 'TR-' || yr || '-%';
      RETURN 'TR-' || yr || '-' || lpad(n::text, 3, '0');
    WHEN 'material_batch' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(batch_code, '^MB-' || yr || '-', ''), '')::int), 0) + 1
        INTO n FROM public.material_batches WHERE batch_code LIKE 'MB-' || yr || '-%';
      RETURN 'MB-' || yr || '-' || lpad(n::text, 3, '0');
    WHEN 'analysis' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(analysis_code, '^AN-' || yr || '-', ''), '')::int), 0) + 1
        INTO n FROM public.fraction_analyses WHERE analysis_code LIKE 'AN-' || yr || '-%';
      RETURN 'AN-' || yr || '-' || lpad(n::text, 3, '0');
    WHEN 'product_test' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(test_code, '^PT-' || yr || '-', ''), '')::int), 0) + 1
        INTO n FROM public.product_tests WHERE test_code LIKE 'PT-' || yr || '-%';
      RETURN 'PT-' || yr || '-' || lpad(n::text, 3, '0');
    WHEN 'doe_series' THEN
      SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '^DOE-' || yr || '-', ''), '')::int), 0) + 1
        INTO n FROM public.doe_series WHERE code LIKE 'DOE-' || yr || '-%';
      RETURN 'DOE-' || yr || '-' || lpad(n::text, 3, '0');
    ELSE
      RAISE EXCEPTION 'Unbekannter Code-Typ: %', _kind;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_project_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_patent_filed() TO authenticated;

-- Output fraction codes are derived from their test run: OF-<run>-<spec>
CREATE OR REPLACE FUNCTION public.next_fraction_code(_test_run_id uuid, _target_fraction_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run text;
  base text;
  candidate text;
  i int := 1;
BEGIN
  SELECT run_code INTO run FROM public.test_runs WHERE id = _test_run_id;
  base := 'OF-' || COALESCE(replace(run, 'TR-', ''), to_char(now(), 'YYYY')) || '-' || COALESCE(_target_fraction_id, 'X');
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.output_fractions WHERE fraction_code = candidate) LOOP
    i := i + 1;
    candidate := base || '-' || i::text;
  END LOOP;
  RETURN candidate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_fraction_code(uuid, text) TO authenticated;


-- ####################################################################
-- ##  20260901090100_project_module_seed
-- ####################################################################

-- =====================================================================
-- Seed data for the GFK recycling project module.
-- Idempotent: safe to run repeatedly.
-- Domain values come from the project specification and must not be altered.
-- =====================================================================

-- ---------------------------------------------------------------- F1-F5
INSERT INTO public.fraction_specs
  (id, name, fiber_length_min_mm, fiber_length_max_mm, glass_content_min_pct,
   moisture_max_pct, fines_max_pct, application, target_price_eur_t, process_line) VALUES
  ('F1','Makrofaser lang',      8,   15, 80, 0.5,   5, 'Beton-/GRC-Bewehrung, Asphalt', 800, 'A_baustoff'),
  ('F2','Polymerbeton',         4,   10, 80, 0.5,   5, 'Polymerbeton',                 1100, 'A_baustoff'),
  ('F3','Mörtel / Zement',      3,    8, 75, 0.5,   8, 'Mörtel, zementäre Matrix',      800, 'A_baustoff'),
  ('F4','Compound kurz',        1,    3, 75, 0.2,  10, 'PP-GF / PA6-GF Compounding',    900, 'B_compound'),
  ('F5','Feinanteil / Füller',  0,  0.5,  0, 1.0, 100, 'Füllstoff, Zementzuschlag',     300, 'A_baustoff')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  fiber_length_min_mm = EXCLUDED.fiber_length_min_mm,
  fiber_length_max_mm = EXCLUDED.fiber_length_max_mm,
  glass_content_min_pct = EXCLUDED.glass_content_min_pct,
  moisture_max_pct = EXCLUDED.moisture_max_pct,
  fines_max_pct = EXCLUDED.fines_max_pct,
  application = EXCLUDED.application,
  target_price_eur_t = EXCLUDED.target_price_eur_t,
  process_line = EXCLUDED.process_line;

-- ---------------------------------------------------------------- Partners
INSERT INTO public.project_partners
  (name, category, subcategory, street, postal_code, city, country, phone, email,
   status, suitability_rating, is_fixed_partner, material_classes, fraction_ids, notes) VALUES
-- 4.2 machine manufacturers
 ('Siempelkamp Sizereduction (ex-Pallmann)','machine_manufacturer','shear_mill','Wolfslochstr. 51','66482','Zweibrücken','DE','+49 6332 802-0',NULL,'prospect',5,true,'{M1,M2,M3,M4,M5,M6,M7}','{F1,F2,F3,F4,F5}','Größtes Zerkleinerungs-Technikum, 900+ Maschinentypen. Sondermaschinen möglich. Zentrale +49 6332 802-0'),
 ('Vecoplan AG','machine_manufacturer','shear_mill','Vor der Bitz 10','56470','Bad Marienberg','DE','+49 2661 62670',NULL,'prospect',5,false,'{M1,M2,M3,M7}','{F1,F2,F3}','Testcenter mit bis zu 100 Konfigurationen. VAZ druckschneidend, 60–130 U/min. Wasserkühlung Schneidraum optional.'),
 ('Herbold Meckesheim GmbH','machine_manufacturer','shear_mill','Industriestr. 33','74909','Meckesheim','DE','+49 6226 932-149','herbold@herbold.com','prospect',4,false,'{M1,M2,M3}','{F1,F3,F4}','SMS Doppelschrägschnitt, verschleißarm. Komplette Kette im Technikum.'),
 ('WEIMA Maschinenbau GmbH','machine_manufacturer','pre_shredder','Bustadt 6–10','74360','Ilsfeld','DE','+49 7062 9570-0','info@weima.com','prospect',3,false,'{M3,M6,M7}','{}','WLK Einwellen druckschneidend, Schneidplatten.'),
 ('Lindner Recyclingtech GmbH','machine_manufacturer','pre_shredder','Lindenstr. 6','99819','Krauthausen','DE','+49 36920 7269620','office@lindner.com','prospect',3,false,'{M6,M7}','{}','Atlas/Micromat. AT +43 4762 2742-0'),
 ('UNTHA Shredding Technology','machine_manufacturer','pre_shredder','Kellau 141','5431','Kuchl','AT','+43 6244 7016-0',NULL,'prospect',3,false,'{M6,M7}','{}','XR-Serie langsamlaufend.'),
 ('ZENO GmbH','machine_manufacturer','shear_mill','Grüninger Weg 28','35415','Pohlheim','DE','+49 6403 90090',NULL,'prospect',4,false,'{M1,M2,M5}','{F1,F2,F3}','Sondermaschinenbau, flexibel bei Kleinserien.'),
 ('BHS-Sonthofen GmbH','machine_manufacturer','impact_benchmark','An der Eisenschmelze 47','87527','Sonthofen','DE','+49 8321 6099-0',NULL,'prospect',1,false,'{M1}','{F5}','Rotorprallmühle RPMV — NUR als Gegentest/Benchmark, gegenteiliges Prinzip.'),
 ('Getecha GmbH','machine_manufacturer','granulator','Am Gemeindegraben 13','63741','Aschaffenburg','DE','+49 6021 8400-0','mail@getecha.de','prospect',2,false,'{M1,M5}','{F4}','Kunststoff-Schneidmühlen, kleinere Chargen.'),
 ('Moditec (Mo.Di.Tec)','machine_manufacturer','tooth_roller',NULL,NULL,NULL,'FR',NULL,NULL,'prospect',4,false,'{M2,M3}','{F1,F3}','Goliath Zahnwalzenmühle 25 U/min — für hochabrasive Faser relevant.'),
-- 4.3 classification & screening
 ('Hosokawa Alpine AG','machine_manufacturer','classification','Peter-Dörfler-Str. 13–25','86199','Augsburg','DE',NULL,NULL,'prospect',5,false,'{}','{F1,F4,F5}',NULL),
 ('Westeria GmbH','machine_manufacturer','classification',NULL,NULL,'Ostbevern','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F5}',NULL),
 ('Trennso-Technik GmbH','machine_manufacturer','classification',NULL,NULL,'Weißenhorn','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F5}',NULL),
 ('Spaleck GmbH & Co. KG','machine_manufacturer','screening',NULL,NULL,'Bocholt','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F2,F3}',NULL),
 ('RHEWUM GmbH','machine_manufacturer','screening','Rosentalstr. 24','42899','Remscheid','DE',NULL,NULL,'prospect',4,false,'{}','{F3,F4,F5}',NULL),
 ('JÖST GmbH + Co. KG','machine_manufacturer','screening',NULL,NULL,'Dülmen','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F3}',NULL),
 ('Hamos GmbH','machine_manufacturer','electrostatic_separation',NULL,NULL,'Penzberg','DE',NULL,NULL,'prospect',3,false,'{}','{F4}',NULL),
 ('Allgaier Process Technology','machine_manufacturer','screening','Ulmer Str. 75','73066','Uhingen','DE',NULL,NULL,'prospect',4,false,'{}','{F3,F5}',NULL),
-- 4.4 material suppliers
 ('Optiplan','material_supplier',NULL,NULL,NULL,NULL,'DE',NULL,NULL,'prospect',5,true,'{M1}','{}','Startmaterial. Vollständiger Firmenname, Standort und Ansprechpartner noch zu verifizieren.'),
 ('Lamilux Heinrich Strunz GmbH','material_supplier',NULL,NULL,NULL,'Rehau','DE',NULL,NULL,'prospect',5,true,'{M1}','{}','Startmaterial.'),
 ('Fiberline Composites','material_supplier',NULL,NULL,NULL,'Lohne','DE',NULL,NULL,'prospect',4,false,'{M3}','{}','DE-Vertrieb.'),
 ('Werzalit GmbH + Co. KG','material_supplier',NULL,NULL,NULL,'Oberstenfeld','DE',NULL,NULL,'prospect',3,false,'{M1,M3}','{}',NULL),
 ('Röchling Industrial','material_supplier',NULL,NULL,NULL,'Haren','DE',NULL,NULL,'prospect',4,false,'{M1,M5}','{}',NULL),
 ('BÜFA Composite Systems','material_supplier',NULL,NULL,NULL,'Rastede','DE',NULL,NULL,'prospect',4,false,'{M2}','{}',NULL),
 ('Menzolit GmbH','material_supplier',NULL,'Industriestr. 35','75015','Bretten','DE',NULL,NULL,'prospect',5,false,'{M2}','{}',NULL),
 ('Polytec Composites Germany','material_supplier',NULL,NULL,'97469','Gochsheim','DE',NULL,NULL,'prospect',4,false,'{M2}','{}',NULL),
 ('Amiblu Germany GmbH','material_supplier',NULL,'Am Fuchsloch 19','04720','Mochau','DE',NULL,NULL,'prospect',5,false,'{M7}','{}','Kein Sandkern-Material annehmen.'),
 ('Bavaria Yachtbau GmbH','material_supplier',NULL,'Bavariastr. 1','97232','Giebelstadt','DE',NULL,NULL,'prospect',5,false,'{M6}','{}',NULL),
 ('HanseYachts AG','material_supplier',NULL,'Ladebower Chaussee 11','17493','Greifswald','DE',NULL,NULL,'prospect',5,false,'{M6}','{}',NULL),
 ('Haase Tank GmbH','material_supplier',NULL,'Auweg 6','23843','Bad Oldesloe','DE',NULL,NULL,'prospect',4,false,'{M7}','{}',NULL),
 ('Roth Industries GmbH','material_supplier',NULL,'Am Seerain 2','35232','Dautphetal','DE',NULL,NULL,'prospect',4,false,'{M7}','{}',NULL),
 ('Lorenz Kunststofftechnik','material_supplier',NULL,NULL,NULL,'Wellingholzhausen','DE',NULL,NULL,'prospect',4,false,'{M2}','{}',NULL),
 ('Fibrolux GmbH','material_supplier',NULL,NULL,NULL,'Hofheim am Taunus','DE',NULL,NULL,'prospect',3,false,'{M3}','{}',NULL),
-- 4.5 product partners & customers
 ('Koch CC','product_partner',NULL,NULL,NULL,NULL,'DE',NULL,NULL,'prospect',5,true,'{}','{F1,F2,F3,F5}','Fixpartner Baustoffvalidierung. Vollständiger Firmenname, Standort und Ansprechpartner noch zu ergänzen.'),
 ('STRABAG TPA','customer',NULL,NULL,NULL,'Wien / Köln','AT',NULL,NULL,'prospect',4,false,'{}','{F1}','Asphalt.'),
 ('C3 Bremen (STRABAG)','customer',NULL,NULL,NULL,'Bremen','DE',NULL,NULL,'prospect',4,false,'{}','{F1}',NULL),
 ('Heidelberg Materials','customer',NULL,NULL,NULL,'Rüdersdorf','DE',NULL,NULL,'prospect',5,false,'{}','{F3,F5}',NULL),
 ('BASF SE','customer',NULL,NULL,NULL,'Schwarzheide','DE',NULL,NULL,'prospect',4,false,'{}','{F2,F4}',NULL),
 ('Rieder Smart Elements','customer',NULL,NULL,NULL,NULL,'AT',NULL,NULL,'prospect',4,false,'{}','{F1,F3}',NULL),
 ('Dyckerhoff GmbH','customer',NULL,NULL,NULL,'Wiesbaden','DE',NULL,NULL,'prospect',4,false,'{}','{F3,F5}',NULL),
 ('BWS Betonwerk Schwerin','customer',NULL,NULL,NULL,'Schwerin','DE',NULL,NULL,'prospect',5,false,'{}','{F1,F3}',NULL),
 ('GP Hanse Frischbeton','customer',NULL,NULL,NULL,'Rostock','DE',NULL,NULL,'prospect',5,false,'{}','{F1,F3}',NULL),
 ('AKRO-PLASTIC GmbH','product_partner',NULL,'BioParK 1','56651','Niederzissen','DE',NULL,NULL,'prospect',5,false,'{}','{F4}',NULL),
 ('BARLOG plastics GmbH','product_partner',NULL,'Am Weidenbusch 13','51491','Overath','DE',NULL,NULL,'prospect',4,false,'{}','{F4}',NULL),
 ('Lehmann&Voss & Co. KG','product_partner',NULL,'Alsterufer 19','20354','Hamburg','DE',NULL,NULL,'prospect',5,false,'{}','{F4}',NULL),
 ('ALBIS (Otto Krahn Group)','product_partner',NULL,'Mühlenhagen 35','20539','Hamburg','DE',NULL,NULL,'prospect',4,false,'{}','{F4}',NULL),
 ('EconCore N.V.','product_partner',NULL,NULL,NULL,'Houthalen-Helchteren','BE',NULL,NULL,'prospect',4,false,'{}','{F4}',NULL),
 ('VELOSIT GmbH','product_partner',NULL,NULL,NULL,'Herford','DE',NULL,NULL,'prospect',4,false,'{}','{F3}','Referenzdaten VELOSIT 503: Biegezug 8,4 MPa Baseline -> 12,8–13,2 MPa bei 80 Tagen.'),
-- 4.6 science & labs
 ('TU Dresden (ILK — Institut für Leichtbau)','research_institute',NULL,NULL,NULL,'Dresden','DE',NULL,NULL,'prospect',5,true,'{}','{F1,F2,F3,F4}','Faserlängen-/Schädigungsanalyse, Verfahrensbewertung, mechanische Charakterisierung.'),
 ('TU Bergakademie Freiberg','research_institute',NULL,NULL,NULL,'Freiberg','DE',NULL,NULL,'prospect',5,true,'{}','{F1,F3,F5}','Aufbereitungstechnik, Sichtung, Korngrößen, Baustoffeignung, Stoffstromanalyse.'),
 ('SKZ – Das Kunststoff-Zentrum','lab',NULL,'Friedrich-Bergius-Ring 22','97076','Würzburg','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F2,F3,F4,F5}','Faserlänge, Aschegehalt, mechanische Prüfung, Compoundierung.'),
 ('Fraunhofer ICT','lab',NULL,'Joseph-von-Fraunhofer-Str. 7','76327','Pfinztal','DE',NULL,NULL,'prospect',4,false,'{}','{F1,F2,F3,F4,F5}','Composite-Technikum, DoE-Begleitung, LCA.'),
 ('Currenta GmbH','lab',NULL,'Chempark','51368','Leverkusen','DE',NULL,NULL,'prospect',4,false,'{}','{F4}','Akkreditierte Polymeranalytik.'),
 ('Kunststoff-Institut Lüdenscheid','lab',NULL,'Karolinenstr. 8','58507','Lüdenscheid','DE',NULL,NULL,'prospect',4,false,'{}','{F4}','Spritzguss, Bauteilprüfung.')
ON CONFLICT (lower(name)) DO NOTHING;

-- ---------------------------------------------------------------- Contacts
INSERT INTO public.project_contacts (partner_id, name, role, email, phone, is_primary, is_decision_maker, notes)
SELECT p.id, v.name, v.role, v.email, v.phone, v.is_primary, v.is_decision_maker, v.notes
FROM (VALUES
  ('Siempelkamp Sizereduction (ex-Pallmann)','Angelo Martuccio','Vertrieb / Technikum','angelo.martuccio@siempelkamp.com','+49 6332 802-270',true,true,'Kontaktdaten auf Aktualität prüfen.'),
  ('Siempelkamp Sizereduction (ex-Pallmann)','Rosario Kindlein','Technikum',NULL,'+49 6332 802-0',false,false,NULL),
  ('Herbold Meckesheim GmbH','Achim Ebel','Vertrieb','herbold@herbold.com','+49 6226 932-149',true,true,'Kontaktdaten auf Aktualität prüfen.')
) AS v(partner_name, name, role, email, phone, is_primary, is_decision_maker, notes)
JOIN public.project_partners p ON lower(p.name) = lower(v.partner_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_contacts c WHERE c.partner_id = p.id AND c.name = v.name
);

-- ---------------------------------------------------------------- Phases
INSERT INTO public.project_phases (code, name, description, order_num, status) VALUES
  ('P0','Vorbereitung & IP-Sicherung','Kritisch — muss vor Herstellerkontakt abgeschlossen sein.',0,'in_progress'),
  ('P1','Materialbeschaffung','Fixstart: Optiplan und Lamilux.',1,'not_started'),
  ('P2','Maschinen- & Verfahrenstests','Fixstart: Siempelkamp Sizereduction.',2,'not_started'),
  ('P3','Fraktionsherstellung','Definierte Materialmengen je Zielfraktion für die Produkttests.',3,'not_started'),
  ('P4','Produktvalidierung Baustoff','Fixpartner: Koch CC.',4,'not_started'),
  ('P5','Produktvalidierung Kunststoff','Compoundier-Trials PP-GF und PA6-GF.',5,'not_started'),
  ('P6','Wissenschaftliche Begleitung','Fixpartner: TU Dresden, TU Bergakademie Freiberg — laufend ab Phase 2.',6,'not_started'),
  ('P7','Auswertung & Anlagenspezifikation','Material-Maschinen-Matrix, CAPEX, Förderantrag.',7,'not_started')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, order_num = EXCLUDED.order_num;

-- ---------------------------------------------------------------- Tasks
INSERT INTO public.project_tasks
  (code, phase_id, title, description, priority, estimated_duration_weeks, estimated_cost_eur, partner_id)
SELECT v.code, ph.id, v.title, v.description, v.priority, v.weeks, v.cost,
       (SELECT id FROM public.project_partners pp WHERE lower(pp.name) = lower(v.partner) LIMIT 1)
FROM (VALUES
 ('P0','P0-1','Patentrecherche Scher-/Walkverfahren','Freedom-to-Operate klären, Abgrenzung gegen Prallverfahren (Regen Fiber).','critical',3.5,4000,NULL),
 ('P0','P0-2','Patentanmeldung einreichen','Stumpfe Messer, Low-RPM, Walk-Vorlockerung. Sperrt Phase-2-Aktivitäten bis erledigt.','critical',5,11500,NULL),
 ('P0','P0-3','NDA-Template erstellen','Herstellerschutz mit IP-Ausnahme.','high',1.5,2500,NULL),
 ('P0','P0-4','Versuchsprotokoll-Template entwickeln','Grundlage für Patentnachweis und Herstellerdoku.','high',1,0,NULL),
 ('P0','P0-5','Externes Analytik-Labor auswählen','SKZ Würzburg / Fraunhofer ICT / Currenta.','high',2,0,NULL),
 ('P0','P0-6','Fraktions-Spezifikationsblätter definieren (F1–F5)','Sollwerte je Zielfraktion festschreiben.','high',1,0,NULL),
 ('P1','P1-1','Materialanfrage Optiplan (M1, 0,5–2 t)','Startmaterial, homogene UP-Plattenware.','high',3,0,'Optiplan'),
 ('P1','P1-2','Materialanfrage Lamilux (M1, 0,5–2 t)','Startmaterial, homogene UP-Plattenware.','high',3,0,'Lamilux Heinrich Strunz GmbH'),
 ('P1','P1-3','Materialdokumentation je Charge','Harztyp, Faseranteil, Füllstoff, Datenblatt.','medium',NULL,0,NULL),
 ('P1','P1-4','Weitere Materialtypen anfragen (M2–M7)','Breite der Materialbasis für die Material-Maschinen-Matrix.','medium',5,7500,NULL),
 ('P1','P1-5','Wareneingangskontrolle + Chargen-Anlage im System','Jede Charge als material_batch erfassen.','medium',NULL,0,NULL),
 ('P2','P2-1','Hersteller-Longlist finalisieren + priorisieren','Bewertung nach Eignung 1–5.','high',2,0,NULL),
 ('P2','P2-2','Technikumstest Siempelkamp','Granulator + Sichtung/Siebung.','critical',5,7500,'Siempelkamp Sizereduction (ex-Pallmann)'),
 ('P2','P2-3','Vergleichstest Vecoplan (VAZ Einwellen)','Druckschneidend, 60–130 U/min.','high',5,7500,'Vecoplan AG'),
 ('P2','P2-4','Vergleichstest Herbold (SMS Doppelschrägschnitt)','Verschleißarme Schnittführung.','high',5,7500,'Herbold Meckesheim GmbH'),
 ('P2','P2-5','Vorzerkleinerungs-Tests (Walzenbrecher / Einwellen)','Für dickwandiges Material M7.','medium',3,7500,NULL),
 ('P2','P2-6','Sicht- und Siebdemos (Windsichtung, Klassierung)','Trennung Faser / Feinanteil.','high',5,10000,'Hosokawa Alpine AG'),
 ('P2','P2-7','DoE-Läufe dokumentieren + Laboranalytik','27–30 Versuchsläufe je Linie.','critical',NULL,20000,NULL),
 ('P2','P2-8','Benchmark-Gegentest Prallverfahren','BHS-Sonthofen RPMV — Gegenprobe zum Scherprinzip.','low',2,4000,'BHS-Sonthofen GmbH'),
 ('P2','P2-9','Optimale Maschinenkombination je Materialtyp festlegen','Ergebnis der DoE-Auswertung.','high',2,0,NULL),
 ('P3','P3-1','Fraktion F1 (8–15 mm) herstellen','Zielmenge 100–200 kg.','high',NULL,0,NULL),
 ('P3','P3-2','Fraktion F2 (4–10 mm, Polymerbeton) herstellen','Zielmenge 100–200 kg.','high',NULL,0,NULL),
 ('P3','P3-3','Fraktion F3 (3–8 mm, Mörtel/Zement) herstellen','Zielmenge 200–300 kg.','high',NULL,0,NULL),
 ('P3','P3-4','Fraktion F4 (1–3 mm / Pellet, Compound) herstellen','Zielmenge 100–200 kg.','high',NULL,0,NULL),
 ('P3','P3-5','Fraktion F5 (Feinanteil) sammeln + charakterisieren','Zielmenge 100 kg — kein Abfall, Zement-/Füllerprodukt.','medium',NULL,0,NULL),
 ('P3','P3-6','Spezifikationsblatt je Fraktion erstellen','Kundendatenblatt inkl. Knockdown-Tabelle bei F4.','high',NULL,0,NULL),
 ('P3','P3-7','Rückstellmuster archivieren','Je Fraktion 2 kg, dokumentiert.','medium',NULL,0,NULL),
 ('P4','P4-1','Koch CC — Betontest','Druckfestigkeit, Biegezug, Rissverhalten.','high',NULL,0,'Koch CC'),
 ('P4','P4-2','Koch CC — Mörteltest','Haftzug, Schwindverhalten, Verarbeitbarkeit.','high',NULL,0,'Koch CC'),
 ('P4','P4-3','Koch CC — Zementtest','Festigkeitsentwicklung, Eluat, Eignung.','high',NULL,0,'Koch CC'),
 ('P4','P4-4','Koch CC — Polymerbeton','Biegezug, Druck, Faser-Matrix-Haftung.','high',NULL,0,'Koch CC'),
 ('P4','P4-5','Dosierraten-Reihe 5 / 10 / 15 / 20 %','Optimalen Substitutionsgrad bestimmen.','high',NULL,0,NULL),
 ('P4','P4-6','Faserlängen-Leiter testen','Längenklassen gegeneinander, optimale Länge je Anwendung.','medium',NULL,0,NULL),
 ('P4','P4-7','Kundenvalidierung bei Betonwerken','Praxistest.','medium',NULL,0,NULL),
 ('P5','P5-1','Compoundier-Trial PP-GF','Einarbeitung, Faserkürzung, Drehmoment.','high',NULL,0,NULL),
 ('P5','P5-2','Compoundier-Trial PA6-GF','Wie PP-GF, höhere Temperatur.','high',NULL,0,NULL),
 ('P5','P5-3','Mechanische Prüfung Prüfkörper','Zug ISO 527, Biege 178, Charpy 179, HDT 75.','high',NULL,0,NULL),
 ('P5','P5-4','MAPP/Haftvermittler-Optimierung','Grenzflächenhaftung.','medium',NULL,0,NULL),
 ('P5','P5-5','Ausgasungsverhalten UP-Rest bewerten','Styrol-Emission bei 200–280 °C.','medium',NULL,0,NULL),
 ('P5','P5-6','Datenblatt Compound-Grade erstellen','Ehrliche Knockdown-Tabelle vs. Virgin.','medium',NULL,0,NULL),
 ('P6','P6-1','Kooperationsvertrag + IP-/Geheimhaltungsregelung','Beide TUs.','high',NULL,0,NULL),
 ('P6','P6-2','Faserlängen-/Faserschädigungsanalyse','TU Dresden (ILK).','high',NULL,0,'TU Dresden (ILK — Institut für Leichtbau)'),
 ('P6','P6-3','Verfahrensbewertung Scher- vs. Prallprinzip','TU Dresden.','high',NULL,0,'TU Dresden (ILK — Institut für Leichtbau)'),
 ('P6','P6-4','Aufbereitungs-/Sichtungsanalyse, Korngrößen','TU Freiberg.','medium',NULL,0,'TU Bergakademie Freiberg'),
 ('P6','P6-5','Baustoff-Eignungsbewertung','TU Freiberg.','medium',NULL,0,'TU Bergakademie Freiberg'),
 ('P6','P6-6','Stoffstromanalyse / Massenbilanz','TU Freiberg.','medium',NULL,0,'TU Bergakademie Freiberg'),
 ('P6','P6-7','Verwertbare Berichte für Patent & Förderung erstellen','Beide TUs.','medium',NULL,0,NULL),
 ('P7','P7-1','Material-Maschinen-Matrix vervollständigen','Ergebnis aller Versuchsläufe.','high',NULL,0,NULL),
 ('P7','P7-2','Anlagenspezifikation 32 t/Tag ableiten','≈ 8.000 t/Jahr.','high',NULL,0,NULL),
 ('P7','P7-3','CAPEX-Modell aus Testdaten','Investitionsrechnung.','high',NULL,0,NULL),
 ('P7','P7-4','Förderantrag vorbereiten','EU Innovation Fund, BMUV, KfW, GRW.','high',NULL,0,NULL),
 ('P7','P7-5','Investoren-/Kundenpräsentation aus Testdaten generieren','Außenwirkung.','medium',NULL,0,NULL)
) AS v(phase_code, code, title, description, priority, weeks, cost, partner)
JOIN public.project_phases ph ON ph.code = v.phase_code
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------- Dependencies
INSERT INTO public.project_task_dependencies (task_id, depends_on_task_id)
SELECT t.id, d.id
FROM (VALUES
  ('P0-2','P0-1'),
  ('P1-1','P0-3'), ('P1-2','P0-3'),
  ('P1-3','P1-1'), ('P1-3','P1-2'),
  ('P1-4','P1-3'), ('P1-5','P1-1'),
  ('P2-2','P0-2'), ('P2-2','P1-3'),
  ('P2-3','P2-2'), ('P2-4','P2-2'), ('P2-5','P1-4'), ('P2-6','P2-2'),
  ('P2-7','P0-5'), ('P2-7','P2-2'), ('P2-8','P2-2'), ('P2-9','P2-7'),
  ('P3-1','P2-9'), ('P3-2','P2-9'), ('P3-3','P2-9'), ('P3-4','P2-9'), ('P3-5','P2-9'),
  ('P3-6','P3-1'), ('P3-6','P3-2'), ('P3-6','P3-3'), ('P3-6','P3-4'), ('P3-6','P3-5'),
  ('P3-7','P3-1'), ('P3-7','P3-2'), ('P3-7','P3-3'), ('P3-7','P3-4'), ('P3-7','P3-5'),
  ('P4-1','P3-1'), ('P4-1','P3-2'), ('P4-2','P3-3'),
  ('P4-3','P3-3'), ('P4-3','P3-5'), ('P4-4','P3-2'),
  ('P4-5','P4-1'), ('P4-5','P4-2'), ('P4-5','P4-3'), ('P4-5','P4-4'),
  ('P4-6','P4-5'), ('P4-7','P4-5'),
  ('P5-1','P3-4'), ('P5-2','P3-4'),
  ('P5-3','P5-1'), ('P5-3','P5-2'), ('P5-4','P5-3'), ('P5-5','P5-1'), ('P5-6','P5-3'),
  ('P7-1','P2-9'), ('P7-2','P7-1'), ('P7-3','P7-2'), ('P7-4','P7-3'), ('P7-5','P7-3')
) AS v(task_code, depends_on_code)
JOIN public.project_tasks t ON t.code = v.task_code
JOIN public.project_tasks d ON d.code = v.depends_on_code
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- DoE series
INSERT INTO public.doe_series (code, name, process_line, description, factors, responses, planned_runs, design_type)
VALUES
 ('DOE-A-01','Linie A — Baustoff (längenerhaltend)','A_baustoff',
  'Vollfaktorieller Screening-Plan zur Maximierung der Faserlänge bei akzeptablem Energieeintrag.',
  '[{"key":"rpm","label":"Drehzahl","unit":"U/min","levels":[25,30,35]},
    {"key":"blade_edge_radius_mm","label":"Schneidkantenradius","unit":"mm","levels":[0.3,0.5,0.8]},
    {"key":"wedge_angle_deg","label":"Keilwinkel","unit":"°","levels":[60,70,80]},
    {"key":"cutting_gap_mm","label":"Schnittspalt","unit":"mm","levels":[0.5,0.65,0.8]},
    {"key":"screen_size_mm","label":"Siebung","unit":"mm","levels":[12,20,"ohne"]}]'::jsonb,
  '{fiber_length_median_mm,fiber_length_d10_mm,fiber_length_d90_mm,glass_content_pct,fines_below_05mm_pct,energy_kwh_t,tool_wear_g_t,throughput_kgh}',
  27,'full_factorial'),
 ('DOE-B-01','Linie B — Compound (definierte Kurzlänge)','B_compound',
  'Zweistufige Prozessführung: Granulator → Sieb → On-Spec-Fraktion 3–5 mm, Überkorn rückführen, Feinanteil in das Zement-/Füllerprodukt.',
  '[{"key":"rpm","label":"Drehzahl","unit":"U/min","levels":[100,150,200]},
    {"key":"blade_condition","label":"Messerzustand","unit":"","levels":["scharf","leicht stumpf"]},
    {"key":"cutting_gap_mm","label":"Schnittspalt","unit":"mm","levels":[0.1,0.2,0.3]},
    {"key":"screen_size_mm","label":"Sieblochung","unit":"mm","levels":[4,5,6]},
    {"key":"screen_type","label":"Siebtyp","unit":"","levels":["Rundloch","Schlitz"]}]'::jsonb,
  '{fiber_length_median_mm,fiber_length_d10_mm,fiber_length_d90_mm,glass_content_pct,fines_below_05mm_pct,energy_kwh_t,tool_wear_g_t,throughput_kgh}',
  30,'full_factorial')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  factors = EXCLUDED.factors, responses = EXCLUDED.responses,
  planned_runs = EXCLUDED.planned_runs;

-- ---------------------------------------------------------------- Email templates
INSERT INTO public.project_email_templates (code, name, category, subject, body_md, placeholders) VALUES
('MAT_REQUEST','Materialanfrage','material_request',
 'Anfrage GFK-Produktionsreste für Recyclingversuche',
 E'Sehr geehrte(r) {{contact_name}},\n\nwir entwickeln ein kaltmechanisches Recyclingverfahren für glasfaserverstärkte\nKunststoffe, das die Faserlänge erhält und dadurch hochwertige Rezyklatfasern für\nBeton-, Mörtel- und Compoundanwendungen erzeugt.\n\nFür unsere Versuchsreihe suchen wir Produktionsreste aus Ihrer Fertigung:\n\n- Menge: {{quantity}} für erste Versuche\n- Material: {{material_description}}\n- Anforderung: sortenrein, ohne Sandanteil, ohne Fremdstoffe\n\nWir übernehmen Transport und Handling. Über die Ergebnisse berichten wir Ihnen\nselbstverständlich zurück — perspektivisch bietet das Verfahren eine\nVerwertungsalternative zur Entsorgung Ihrer Produktionsabfälle.\n\nKönnen wir dazu kurz telefonieren?\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{quantity}}","{{material_description}}","{{sender_name}}"}'),
('TRIAL_REQUEST','Technikumsanfrage Maschinenhersteller','trial_request',
 'Anfrage Technikumsversuch — Zerkleinerung GFK-Produktionsreste',
 E'Sehr geehrte Damen und Herren,\n\nfür ein GFK-Recyclingprojekt suchen wir Technikums-Kapazität zur Zerkleinerung und\nKlassierung von GFK-Produktionsresten.\n\nMATERIAL\n{{material_description}}, ca. {{quantity}} je Charge, saubere Produktionsreste\n(kein Sand, keine Rotorblätter).\n\nZIEL\nFaserschonende Zerkleinerung mit Erhalt möglichst langer Faserfraktion bei niedriger\nDrehzahl. Anschließend Windsichtung und Siebung in definierte Längenklassen.\n\nBITTE TEILEN SIE UNS MIT\n- Eignung Ihrer Maschinen (Modell/Serie) für dieses Material\n- Möglichkeiten der Kühlung (Wasser Schneidraum / Rotor / Sieb)\n- Optionen für Drehzahlregelung und Anpassung der Messergeometrie\n- Verfügbare Durchsätze im Technikum\n- Tagessatz Technikum inkl. Versuchsleitung und Siebanalyse\n- Verfügbarkeit in den nächsten {{timeframe}}\n\nEin gegenseitiges NDA ist aus unserer Sicht Voraussetzung; einen Entwurf stellen wir\ngern bereit.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{material_description}}","{{quantity}}","{{timeframe}}","{{sender_name}}"}'),
('LAB_ORDER','Analytik-Beauftragung','lab_order',
 'Beauftragung Analytik — Rezyklat-Glasfaser {{fraction_code}}',
 E'Sehr geehrte Damen und Herren,\n\nwir übersenden Ihnen Proben zur Analyse.\n\nPROBE\nKennung: {{fraction_code}}\nMaterial: Rezyklat-Glasfaser aus kaltmechanischem GFK-Recycling\nMenge: {{sample_weight}}\n\nGEWÜNSCHTE ANALYSEN\n- Faserlängenverteilung (Median, D10/D50/D90) — Bildanalyse\n- Glasgehalt / Aschegehalt nach EN ISO 1172\n- Restfeuchte\n- Schüttdichte nach DIN EN ISO 60\n- Siebanalyse mit Feinanteil < 0,5 mm\n- Fremdstoffe / Metallgehalt\n\nBitte nennen Sie uns Preis und Bearbeitungsdauer. Die Ergebnisse benötigen wir bis\n{{deadline}}.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{fraction_code}}","{{sample_weight}}","{{deadline}}","{{sender_name}}"}'),
('PRODUCT_TEST','Produkttest-Anfrage','product_test',
 'Testreihe Rezyklat-Glasfaser in {{application}}',
 E'Sehr geehrte(r) {{contact_name}},\n\nwie besprochen übersenden wir Rezyklat-Glasfaser aus unserem kaltmechanischen\nVerfahren für die geplante Testreihe.\n\nMATERIAL\nFraktion: {{fraction_code}} — {{fraction_name}}\nFaserlänge: {{fiber_length}}\nGlasgehalt: {{glass_content}}\nMenge: {{quantity}}\n\nVORGESCHLAGENE TESTREIHE\nDosierraten: 5 / 10 / 15 / 20 Gew.-%\nReferenz: Rezeptur ohne Faserzusatz als Baseline\nPrüfalter: 7 / 28 / 80 Tage\n\nGEWÜNSCHTE PRÜFGRÖSSEN\n{{test_parameters}}\n\nDas Datenblatt zur Fraktion liegt bei. Für Rückfragen zur Verarbeitung stehen wir\njederzeit zur Verfügung.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{application}}","{{fraction_code}}","{{fraction_name}}","{{fiber_length}}","{{glass_content}}","{{quantity}}","{{test_parameters}}","{{sender_name}}"}'),
('SCIENCE_COOP','Wissenschaftliche Kooperation','science_coop',
 'Anfrage Forschungskooperation — kaltmechanisches GFK-Recycling',
 E'Sehr geehrte Frau / Herr Prof. {{contact_name}},\n\nwir entwickeln ein kaltmechanisches Verfahren zum Recycling glasfaserverstärkter\nKunststoffe, das gezielt den Unterschied der Bruchdehnungen von Harzmatrix und\nGlasfaser nutzt, um die Faserlänge zu erhalten.\n\nFür die wissenschaftliche Absicherung suchen wir einen Kooperationspartner mit\nExpertise in {{expertise_area}}.\n\nMÖGLICHE ARBEITSPAKETE\n{{work_packages}}\n\nWir stellen Versuchsmaterial, Anlagenzugang über unsere Technikumspartner und die\nvollständige Versuchsdokumentation bereit. Die Ergebnisse sollen in Förderanträge\n(EU Innovation Fund, BMUV, KfW) einfließen.\n\nWichtig ist uns eine klare Regelung zu Geheimhaltung und Schutzrechten, da eine\nPatentanmeldung zum Verfahren läuft.\n\nWären Sie zu einem ersten Gespräch bereit?\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{expertise_area}}","{{work_packages}}","{{sender_name}}"}'),
('FOLLOW_UP','Nachfassmail','follow_up',
 'Nachfrage zu unserer Anfrage vom {{original_date}}',
 E'Sehr geehrte(r) {{contact_name}},\n\nam {{original_date}} hatte ich Ihnen zu {{topic}} geschrieben.\n\nFalls die Anfrage untergegangen ist: gern fasse ich das Wichtigste zusammen —\n{{one_line_summary}}\n\nPasst ein kurzes Telefonat in den nächsten Tagen? Ich richte mich nach Ihrem Kalender.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{original_date}}","{{topic}}","{{one_line_summary}}","{{sender_name}}"}'),
('RESULT_SHARE','Ergebnisübermittlung','result_share',
 'Ergebnisse Versuchsreihe {{run_code}}',
 E'Sehr geehrte(r) {{contact_name}},\n\nanbei die Ergebnisse unserer gemeinsamen Versuchsreihe.\n\nKERNERGEBNISSE\n{{key_results}}\n\nBEWERTUNG\n{{assessment}}\n\nNÄCHSTE SCHRITTE\n{{next_steps}}\n\nDas vollständige Versuchsprotokoll finden Sie im Anhang.\n\nMit freundlichen Grüßen\n{{sender_name}}',
 '{"{{contact_name}}","{{run_code}}","{{key_results}}","{{assessment}}","{{next_steps}}","{{sender_name}}"}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, category = EXCLUDED.category, subject = EXCLUDED.subject,
  body_md = EXCLUDED.body_md, placeholders = EXCLUDED.placeholders;

-- ---------------------------------------------------------------- Starter risks
INSERT INTO public.project_risks (title, description, category, probability, impact, mitigation_plan, owner, phase_id)
SELECT v.title, v.description, v.category, v.probability, v.impact, v.mitigation, v.owner, ph.id
FROM (VALUES
 ('Herstellerdemo vor Patentanmeldung','Ein Technikumstermin vor Einreichung der Patentanmeldung zerstört die Neuheit des Verfahrens.','ip',3,5,'Phase-2-Aufgaben erst nach Abschluss von P0-2 starten. NDA vorab abschließen (P0-3).','manuel.buckow','P0'),
 ('Werkzeugverschleiß bei SMC/BMC','Hoher CaCO3-Füllstoffanteil in M2 führt zu überproportionalem Verschleiß der Schneidwerkzeuge.','technical',4,3,'Verschleißschutz Wolframkarbid/Stellite testen, Verschleiß in g/t je Lauf dokumentieren.','manuel.buckow','P2'),
 ('Energieeintrag über 350 kWh/t','Überschreitung der wirtschaftlichen Schwelle macht das Verfahren nicht darstellbar.','financial',3,5,'Energiemessung in jedem DoE-Lauf verpflichtend; Drehzahl/Durchsatz-Trade-off systematisch auswerten.','manuel.buckow','P2'),
 ('Glasgehalt unter 50 % in der Faserfraktion','Compoundeure verlieren das Interesse, F4 fällt auf Füllstoffqualität zurück.','market',2,5,'Sichtung/Klassierung optimieren (P2-6), Epoxid-Material M5 für High-Purity-Compound priorisieren.','manuel.buckow','P3'),
 ('Materialverfügbarkeit Startmaterial','Optiplan/Lamilux liefern nicht in der benötigten Menge oder Qualität.','supplier',2,4,'Frühzeitig Zweitquellen aus M1-Liste aktivieren (Werzalit, Röchling).','manuel.buckow','P1')
) AS v(title, description, category, probability, impact, mitigation, owner, phase_code)
LEFT JOIN public.project_phases ph ON ph.code = v.phase_code
WHERE NOT EXISTS (SELECT 1 FROM public.project_risks r WHERE r.title = v.title);

-- ---------------------------------------------------------------- Reference product test data (VELOSIT 503)
DO $$
DECLARE
  v_partner uuid;
  v_test uuid;
BEGIN
  SELECT id INTO v_partner FROM public.project_partners WHERE lower(name) = lower('VELOSIT GmbH');

  INSERT INTO public.product_tests (test_code, title, category, partner_id, dosage_pct, recipe_notes, status, summary)
  VALUES ('PT-REF-VELOSIT-503','Referenz VELOSIT 503 — Mörtel mit Rezyklat-Glasfaser','mortar', v_partner, NULL,
          'Nachgewiesene Referenzdaten aus der Verfahrensentwicklung. Baseline = Rezeptur ohne Faser.',
          'completed',
          'Biegezugfestigkeit steigt von 8,4 MPa (Baseline ohne Faser) auf 12,8–13,2 MPa bei 80 Tagen — konkurrenzfähig gegenüber Carbon- und PVA-Fasern.')
  ON CONFLICT (test_code) DO NOTHING;

  SELECT id INTO v_test FROM public.product_tests WHERE test_code = 'PT-REF-VELOSIT-503';

  IF v_test IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_test_results WHERE product_test_id = v_test
  ) THEN
    INSERT INTO public.product_test_results (product_test_id, parameter_key, value_numeric, unit, age_days, baseline_value)
    VALUES
      (v_test,'flexural_strength_mpa', 8.4, 'MPa', 80, 8.4),
      (v_test,'flexural_strength_mpa',12.8, 'MPa', 80, 8.4),
      (v_test,'flexural_strength_mpa',13.2, 'MPa', 80, 8.4);
  END IF;
END $$;


-- ####################################################################
-- ##  20260901090200_disable_self_registration
-- ####################################################################

-- =====================================================================
-- Close self-registration. From now on only administrators create users.
--
-- Layers:
--  1. profiles / user_roles INSERT is admin-only (the previous policy let
--     any authenticated user insert their own role, which made a
--     self-signed-up account able to grant itself a role).
--  2. pending_registrations no longer accepts new rows; the table and its
--     existing data stay for audit purposes.
--  3. A trigger blocks profile creation for anyone but an admin or the
--     service role (the admin-create-user edge function).
--
-- NOTE for the operator: additionally switch OFF
--   Supabase Dashboard -> Authentication -> Sign In / Providers ->
--   "Allow new users to sign up"
-- so the /auth/v1/signup endpoint is closed at the gateway as well.
-- =====================================================================

-- ---------- 1. profiles ----------
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------- 2. user_roles ----------
DROP POLICY IF EXISTS "Users can insert own role or admins can insert any" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------- 3. pending_registrations: no new self-registrations ----------
DROP POLICY IF EXISTS "Users can insert own pending registration" ON public.pending_registrations;
DROP POLICY IF EXISTS "Anyone can create pending registration" ON public.pending_registrations;
DROP POLICY IF EXISTS "Users can create their own registration" ON public.pending_registrations;

-- ---------- 4. hard guard on profile creation ----------
CREATE OR REPLACE FUNCTION public.guard_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (admin-create-user edge function) and unauthenticated
  -- server-side contexts (migrations, seeds) are allowed through.
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

-- ---------- 5. the role trigger must keep working for admin-created users ----------
-- handle_new_profile_role() is SECURITY DEFINER and therefore not subject to
-- the tightened user_roles policy; no change needed, but make sure it exists.
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


-- ####################################################################
-- ##  20260901090300_platform_fixes
-- ####################################################################

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


-- ####################################################################
-- ##  20260901090400_project_ai_schedule
-- ####################################################################

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


-- ####################################################################
-- ##  20260902080000_project_phases_rework
-- ####################################################################

-- =====================================================================
-- Projektstruktur ohne Patentphase.
--
-- Fachliche Vorgabe des Projektinhabers: es wird kein Patent angemeldet.
-- Der Schwerpunkt liegt auf
--   * Maschinentests, um den eigenen Maschinenpark auszuwählen, und
--   * der Beschaffung unterschiedlicher GFK-Typen (M1-M7) für die Versuche.
--
-- Diese Migration ersetzt daher die IP-Phase durch einen Prüfrahmen, baut die
-- Materialbeschaffung auf die einzelnen Materialklassen um, ergänzt fehlende
-- Maschinentests und macht aus der Auswertungsphase eine Maschinenpark-Phase.
-- Alle Schritte sind idempotent.
-- =====================================================================

-- ---------------------------------------------------------------- 1. Patent raus
-- Die Abhängigkeiten hängen an der Task-ID und verschwinden per ON DELETE CASCADE.
DELETE FROM public.project_tasks WHERE code IN ('P0-1', 'P0-2')
  AND title IN ('Patentrecherche Scher-/Walkverfahren', 'Patentanmeldung einreichen');

DROP FUNCTION IF EXISTS public.is_patent_filed();

-- ---------------------------------------------------------------- 2. Umnummerierung
-- Die Codes werden anhand des Titels vergeben, nicht anhand des alten Codes.
-- Dadurch ist der Schritt beliebig oft wiederholbar, auch wenn der Seed
-- zwischendurch erneut läuft.

-- 2a. Doppelte Seed-Aufgaben entfernen (entstehen, wenn der Seed nach der
--     Umnummerierung erneut läuft und einen frei gewordenen Code neu belegt).
DELETE FROM public.project_tasks t
USING public.project_tasks keep
WHERE t.title = keep.title
  AND t.id <> keep.id
  AND t.code ~ '^P[0-7]-'
  AND keep.code ~ '^P[0-7]-'
  AND (t.created_at, t.id) > (keep.created_at, keep.id);

-- 2b. Betroffene Aufgaben auf temporäre Codes parken, damit die Zielcodes frei sind.
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

-- 2c. Zielcodes anhand des Titels setzen.
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

-- 2d. Beschreibungen an den neuen Zuschnitt anpassen.
UPDATE public.project_tasks SET
  description = 'Gegenseitige Geheimhaltung mit Technikums- und Laborpartnern, bevor Material und Verfahrensdetails herausgehen.'
 WHERE code = 'P0-1';

UPDATE public.project_tasks SET
  description = 'Einheitliche Dokumentation für alle Technikumsversuche — Grundlage für die Vergleichbarkeit der Maschinen.'
 WHERE code = 'P0-2';

-- ---------------------------------------------------------------- 3. Phasen umbenennen
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

-- Geheimhaltung statt Schutzrechte in der Wissenschaftskooperation
UPDATE public.project_tasks SET
  title = 'Kooperationsvertrag + Geheimhaltungsregelung',
  description = 'Beide TUs. Regelung zur Verwertung der Ergebnisse und zur Geheimhaltung der Verfahrensparameter.'
 WHERE code = 'P6-1';

UPDATE public.project_tasks SET
  title = 'Verwertbare Berichte für Förderung und Anlagenplanung erstellen',
  description = 'Beide TUs. Die Berichte fließen in den Förderantrag und in die Auslegung des Maschinenparks ein.'
 WHERE code = 'P6-7';

-- P1-4 wird zur Planungsklammer über die einzelnen Materialklassen
UPDATE public.project_tasks SET
  title = 'Materialbedarf und Bezugsquellen je Materialklasse festlegen',
  description = 'Welche Menge je Materialklasse M1–M7 wird für die Versuchsreihen gebraucht, und von wem.'
 WHERE code = 'P1-4';

-- ---------------------------------------------------------------- 5. Neue Aufgaben
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

-- ---------------------------------------------------------------- 6. Partner zuordnen
-- Maschinen- und Materialtests hängen an konkreten Partnern; ohne Zuordnung
-- ist die Partnerseite eines Versuchs leer.
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

-- ---------------------------------------------------------------- 7. Abhängigkeiten
INSERT INTO public.project_task_dependencies (task_id, depends_on_task_id)
SELECT t.id, d.id
FROM (VALUES
  -- Materialklassen hängen an der Bedarfsplanung
  ('P1-6','P1-4'), ('P1-7','P1-4'), ('P1-8','P1-4'), ('P1-9','P1-4'), ('P1-10','P1-4'), ('P1-11','P1-4'),
  -- Beschaffung setzt das NDA voraus
  ('P1-6','P0-1'), ('P1-7','P0-1'), ('P1-9','P0-1'), ('P1-10','P0-1'), ('P1-11','P0-1'),
  -- Vergleichstests bauen auf dem ersten Technikumstest auf
  ('P2-10','P2-2'), ('P2-11','P2-2'),
  -- Maschinentests brauchen den Bewertungsrahmen
  ('P2-2','P0-5'), ('P2-9','P0-5'),
  -- Maschinenpark-Entscheidung
  ('P7-2','P7-1'), ('P7-3','P7-2'), ('P7-4','P7-2')
) AS v(task_code, depends_on_code)
JOIN public.project_tasks t ON t.code = v.task_code
JOIN public.project_tasks d ON d.code = v.depends_on_code
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- 8. Risiko anpassen
-- Das IP-Risiko trifft nicht mehr zu; an seine Stelle tritt das reale Risiko
-- der Maschinenauswahl.
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

