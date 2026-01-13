-- Add retention sample flag to samples table
ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS is_retention_sample BOOLEAN NOT NULL DEFAULT false;

-- Add processing_step_id link for better traceability
ALTER TABLE public.output_materials
  ADD COLUMN IF NOT EXISTS processing_step_id UUID REFERENCES public.processing_steps(id);

-- Create batch allocations table for assigning output materials to customer orders
CREATE TABLE IF NOT EXISTS public.batch_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  output_material_id UUID NOT NULL REFERENCES public.output_materials(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  allocated_weight_kg NUMERIC NOT NULL CHECK (allocated_weight_kg > 0),
  allocated_by UUID REFERENCES auth.users(id),
  allocated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(output_material_id, order_id)
);

-- Enable RLS on batch_allocations
ALTER TABLE public.batch_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies for batch_allocations
CREATE POLICY "Batch allocations viewable by authenticated"
  ON public.batch_allocations FOR SELECT
  USING (true);

CREATE POLICY "Batch allocations insertable by staff"
  ON public.batch_allocations FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'production'::app_role) OR
    has_role(auth.uid(), 'betriebsleiter'::app_role)
  );

CREATE POLICY "Batch allocations updatable by staff"
  ON public.batch_allocations FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'production'::app_role) OR
    has_role(auth.uid(), 'betriebsleiter'::app_role)
  );

CREATE POLICY "Batch allocations deletable by admin"
  ON public.batch_allocations FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_batch_allocations_output ON public.batch_allocations(output_material_id);
CREATE INDEX IF NOT EXISTS idx_batch_allocations_order ON public.batch_allocations(order_id);
CREATE INDEX IF NOT EXISTS idx_samples_retention ON public.samples(is_retention_sample) WHERE is_retention_sample = true;