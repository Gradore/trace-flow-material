-- Fix search_path for functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_unique_id(prefix TEXT)
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_id TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
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
$$ LANGUAGE plpgsql SET search_path = public;