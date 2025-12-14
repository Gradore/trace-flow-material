-- Fix the generate_unique_id function to properly extract sequence numbers
CREATE OR REPLACE FUNCTION public.generate_unique_id(prefix text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_id TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Extract the sequence number from existing IDs
  -- Format is: PREFIX-YYYY-NNNN, so we need positions after the second dash
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(id_value FROM LENGTH(prefix) + 7) AS INTEGER
    )
  ), 0) + 1 INTO seq_num
  FROM (
    SELECT container_id AS id_value FROM public.containers WHERE container_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT input_id AS id_value FROM public.material_inputs WHERE input_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT processing_id AS id_value FROM public.processing_steps WHERE processing_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT sample_id AS id_value FROM public.samples WHERE sample_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT output_id AS id_value FROM public.output_materials WHERE output_id LIKE prefix || '-' || year_part || '-%'
    UNION ALL
    SELECT note_id AS id_value FROM public.delivery_notes WHERE note_id LIKE prefix || '-' || year_part || '-%'
  ) combined;
  
  new_id := prefix || '-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_id;
END;
$function$;