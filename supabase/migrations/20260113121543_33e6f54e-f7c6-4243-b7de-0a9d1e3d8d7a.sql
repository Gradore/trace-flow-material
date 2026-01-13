-- Fix schema: processing_steps must allow multiple rows per processing_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'processing_steps'
      AND c.conname = 'processing_steps_processing_id_key'
  ) THEN
    ALTER TABLE public.processing_steps
      DROP CONSTRAINT processing_steps_processing_id_key;
  END IF;
END $$;

-- Ensure each step order within a processing run is unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'processing_steps'
      AND c.conname = 'processing_steps_processing_id_step_order_key'
  ) THEN
    ALTER TABLE public.processing_steps
      ADD CONSTRAINT processing_steps_processing_id_step_order_key
      UNIQUE (processing_id, step_order);
  END IF;
END $$;

-- Helpful index for duplicate-check queries by material_input_id + status
CREATE INDEX IF NOT EXISTS idx_processing_steps_material_input_status
  ON public.processing_steps (material_input_id, status, created_at DESC);
