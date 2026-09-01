-- =====================================================================
--  RekuFLOW — Datenbank auf den Stand des Repositorys bringen
-- =====================================================================

-- ####################################################################
-- ##  20260901090000_project_module_schema
-- ####################################################################

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
  output_material_id uuid REFERENCES public.output_materials(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_output_fractions_run ON public.output_fractions (test_run_id);
CREATE INDEX IF NOT EXISTS idx_output_fractions_spec ON public.output_fractions (target_fraction_id);

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

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS linked_to_type text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS linked_to_id uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ai_extracted_data jsonb;
CREATE INDEX IF NOT EXISTS idx_documents_generic_link ON public.documents (linked_to_type, linked_to_id);

-- updated_at triggers
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

-- RLS
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