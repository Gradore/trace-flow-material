-- Create equipment table for machines/plants
CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create maintenance records table
CREATE TABLE public.maintenance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maintenance_id TEXT NOT NULL UNIQUE,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  maintenance_type TEXT NOT NULL, -- 'scheduled', 'repair', 'inspection'
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE,
  completed_date DATE,
  next_due_date DATE,
  interval_days INTEGER, -- for recurring maintenance
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'overdue'
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  performed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for equipment
CREATE POLICY "Equipment viewable by staff"
ON public.equipment
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role)
);

CREATE POLICY "Equipment manageable by admin/production"
ON public.equipment
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
);

CREATE POLICY "Equipment updatable by admin/production"
ON public.equipment
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
);

CREATE POLICY "Equipment deletable by admin"
ON public.equipment
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for maintenance_records
CREATE POLICY "Maintenance viewable by staff"
ON public.maintenance_records
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role)
);

CREATE POLICY "Maintenance manageable by admin/production"
ON public.maintenance_records
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
);

CREATE POLICY "Maintenance updatable by admin/production"
ON public.maintenance_records
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
);

CREATE POLICY "Maintenance deletable by admin"
ON public.maintenance_records
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default equipment
INSERT INTO public.equipment (equipment_id, name, type, manufacturer) VALUES
('EQ-001', 'Arjes Vorzerkleinerer', 'Vorzerkleinerer', 'Arjes'),
('EQ-002', 'Granulator', 'Granulator', NULL),
('EQ-003', 'Merdeckersieb', 'Siebanlage', 'Merdecker'),
('EQ-004', 'Absaugung Haupthalle', 'Absaugung', NULL),
('EQ-005', 'Absaugung Verarbeitung', 'Absaugung', NULL),
('EQ-006', 'Turbomühle', 'Mühle', NULL),
('EQ-007', 'Dichtetrenner', 'Trenner', NULL);

-- Create function to update timestamps
CREATE TRIGGER update_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_records_updated_at
BEFORE UPDATE ON public.maintenance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();