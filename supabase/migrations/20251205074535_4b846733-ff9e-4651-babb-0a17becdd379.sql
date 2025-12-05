-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'intake', 'production', 'qa', 'customer')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Containers table
CREATE TABLE public.containers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  container_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('bigbag', 'box', 'cage', 'container')),
  volume_liters INTEGER,
  weight_kg NUMERIC(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'empty' CHECK (status IN ('empty', 'filling', 'full', 'in_processing', 'processed')),
  location TEXT,
  qr_code TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Material Inputs (Materialeingang)
CREATE TABLE public.material_inputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  input_id TEXT NOT NULL UNIQUE,
  supplier TEXT NOT NULL,
  material_type TEXT NOT NULL CHECK (material_type IN ('gfk', 'pp', 'pa')),
  material_subtype TEXT,
  weight_kg NUMERIC(10,2) NOT NULL,
  waste_code TEXT,
  container_id UUID REFERENCES public.containers(id),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_processing', 'processed')),
  notes TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Processing Steps (Verarbeitungsschritte)
CREATE TABLE public.processing_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processing_id TEXT NOT NULL UNIQUE,
  material_input_id UUID NOT NULL REFERENCES public.material_inputs(id),
  step_type TEXT NOT NULL CHECK (step_type IN ('shredding', 'sorting', 'milling', 'separation')),
  step_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'sample_required')),
  progress INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  operator_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Samples (Proben)
CREATE TABLE public.samples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_id TEXT NOT NULL UNIQUE,
  processing_step_id UUID REFERENCES public.processing_steps(id),
  material_input_id UUID REFERENCES public.material_inputs(id),
  sampler_id UUID REFERENCES public.profiles(id),
  sampler_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_analysis', 'approved', 'rejected')),
  notes TEXT,
  sampled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sample Results (Probenergebnisse)
CREATE TABLE public.sample_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_id UUID NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL,
  parameter_value TEXT NOT NULL,
  unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Output Materials (Ausgangsmaterialien)
CREATE TABLE public.output_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  output_id TEXT NOT NULL UNIQUE,
  batch_id TEXT NOT NULL,
  output_type TEXT NOT NULL CHECK (output_type IN ('glass_fiber', 'resin_powder', 'pp_regrind', 'pa_regrind')),
  weight_kg NUMERIC(10,2) NOT NULL,
  quality_grade TEXT CHECK (quality_grade IN ('A', 'B', 'C')),
  attributes JSONB DEFAULT '{}',
  container_id UUID REFERENCES public.containers(id),
  destination TEXT,
  sample_id UUID REFERENCES public.samples(id),
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'reserved', 'shipped')),
  qr_code TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Delivery Notes (Lieferscheine)
CREATE TABLE public.delivery_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('incoming', 'outgoing')),
  partner_name TEXT NOT NULL,
  material_description TEXT NOT NULL,
  batch_reference TEXT,
  weight_kg NUMERIC(10,2) NOT NULL,
  waste_code TEXT,
  qr_code TEXT,
  pdf_url TEXT,
  material_input_id UUID REFERENCES public.material_inputs(id),
  output_material_id UUID REFERENCES public.output_materials(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Documents (Dokumente)
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  tag TEXT CHECK (tag IN ('reach', 'delivery_note', 'sample_report', 'certificate', 'photo', 'other')),
  material_input_id UUID REFERENCES public.material_inputs(id),
  container_id UUID REFERENCES public.containers(id),
  sample_id UUID REFERENCES public.samples(id),
  output_material_id UUID REFERENCES public.output_materials(id),
  delivery_note_id UUID REFERENCES public.delivery_notes(id),
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Material Flow History (Materialfluss-Historie)
CREATE TABLE public.material_flow_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  event_details JSONB DEFAULT '{}',
  material_input_id UUID REFERENCES public.material_inputs(id),
  container_id UUID REFERENCES public.containers(id),
  processing_step_id UUID REFERENCES public.processing_steps(id),
  sample_id UUID REFERENCES public.samples(id),
  output_material_id UUID REFERENCES public.output_materials(id),
  delivery_note_id UUID REFERENCES public.delivery_notes(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.output_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_flow_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Profiles
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS Policies: Containers (viewable by all authenticated, editable by non-customer roles)
CREATE POLICY "Containers viewable by authenticated" ON public.containers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Containers insertable by staff" ON public.containers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'intake', 'production', 'qa'))
);
CREATE POLICY "Containers updatable by staff" ON public.containers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'intake', 'production', 'qa'))
);
CREATE POLICY "Containers deletable by admin" ON public.containers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS Policies: Material Inputs
CREATE POLICY "Material inputs viewable by authenticated" ON public.material_inputs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Material inputs insertable by intake/admin" ON public.material_inputs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'intake'))
);
CREATE POLICY "Material inputs updatable by staff" ON public.material_inputs FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'intake', 'production'))
);

-- RLS Policies: Processing Steps
CREATE POLICY "Processing viewable by authenticated" ON public.processing_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Processing insertable by production/admin" ON public.processing_steps FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'production'))
);
CREATE POLICY "Processing updatable by production/admin" ON public.processing_steps FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'production'))
);

-- RLS Policies: Samples
CREATE POLICY "Samples viewable by authenticated" ON public.samples FOR SELECT TO authenticated USING (true);
CREATE POLICY "Samples insertable by qa/production/admin" ON public.samples FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'production', 'qa'))
);
CREATE POLICY "Samples updatable by qa/admin" ON public.samples FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'qa'))
);

-- RLS Policies: Sample Results
CREATE POLICY "Sample results viewable by authenticated" ON public.sample_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sample results insertable by qa/admin" ON public.sample_results FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'qa'))
);

-- RLS Policies: Output Materials
CREATE POLICY "Outputs viewable by authenticated" ON public.output_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Outputs insertable by production/admin" ON public.output_materials FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'production'))
);
CREATE POLICY "Outputs updatable by staff" ON public.output_materials FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'production', 'qa'))
);

-- RLS Policies: Delivery Notes
CREATE POLICY "Delivery notes viewable by authenticated" ON public.delivery_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Delivery notes insertable by staff" ON public.delivery_notes FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'intake', 'production'))
);

-- RLS Policies: Documents
CREATE POLICY "Documents viewable by authenticated" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Documents insertable by authenticated" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Documents deletable by uploader or admin" ON public.documents FOR DELETE TO authenticated USING (
  uploaded_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS Policies: Material Flow History
CREATE POLICY "History viewable by authenticated" ON public.material_flow_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "History insertable by authenticated" ON public.material_flow_history FOR INSERT TO authenticated WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_containers_updated_at BEFORE UPDATE ON public.containers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_material_inputs_updated_at BEFORE UPDATE ON public.material_inputs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_processing_steps_updated_at BEFORE UPDATE ON public.processing_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_samples_updated_at BEFORE UPDATE ON public.samples FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_output_materials_updated_at BEFORE UPDATE ON public.output_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_containers_status ON public.containers(status);
CREATE INDEX idx_material_inputs_status ON public.material_inputs(status);
CREATE INDEX idx_processing_steps_status ON public.processing_steps(status);
CREATE INDEX idx_samples_status ON public.samples(status);
CREATE INDEX idx_output_materials_status ON public.output_materials(status);
CREATE INDEX idx_documents_tag ON public.documents(tag);
CREATE INDEX idx_material_flow_history_material_input ON public.material_flow_history(material_input_id);

-- Generate unique IDs function
CREATE OR REPLACE FUNCTION public.generate_unique_id(prefix TEXT)
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_id TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the next sequence number for this prefix and year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(
      CASE 
        WHEN prefix = 'BB' OR prefix = 'GX' OR prefix = 'BX' THEN container_id
        WHEN prefix = 'ME' THEN input_id
        WHEN prefix = 'VRB' THEN processing_id
        WHEN prefix = 'PRB' THEN sample_id
        WHEN prefix = 'OUT' THEN output_id
        WHEN prefix = 'LS' THEN note_id
      END
    FROM 6 FOR 4) AS INTEGER)
  ), 0) + 1 INTO seq_num
  FROM (
    SELECT container_id FROM public.containers WHERE container_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT input_id FROM public.material_inputs WHERE input_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT processing_id FROM public.processing_steps WHERE processing_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT sample_id FROM public.samples WHERE sample_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT output_id FROM public.output_materials WHERE output_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT note_id FROM public.delivery_notes WHERE note_id LIKE prefix || '-' || year_part || '-%'
  ) combined;
  
  new_id := prefix || '-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;