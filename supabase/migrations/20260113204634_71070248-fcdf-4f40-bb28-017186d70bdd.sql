-- Add fields for retention sample tracking: storage location, customer reference, batch reference, retention purpose
ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS storage_location TEXT,
  ADD COLUMN IF NOT EXISTS retention_purpose TEXT,
  ADD COLUMN IF NOT EXISTS customer_order_id UUID REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS output_material_id UUID REFERENCES public.output_materials(id);

-- Add index for faster lookup of retention samples by customer/order
CREATE INDEX IF NOT EXISTS idx_samples_customer_order ON public.samples(customer_order_id) WHERE customer_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_samples_output_material ON public.samples(output_material_id) WHERE output_material_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_samples_retention ON public.samples(is_retention_sample) WHERE is_retention_sample = true;

-- Comment for clarity
COMMENT ON COLUMN public.samples.storage_location IS 'Lagerplatz der Rückstellprobe';
COMMENT ON COLUMN public.samples.retention_purpose IS 'Zweck: warehouse (Lager) oder lab_complaint (Labor bei Beanstandung)';
COMMENT ON COLUMN public.samples.customer_order_id IS 'Verknüpfter Kundenauftrag';
COMMENT ON COLUMN public.samples.output_material_id IS 'Verknüpfte Chargen-ID';