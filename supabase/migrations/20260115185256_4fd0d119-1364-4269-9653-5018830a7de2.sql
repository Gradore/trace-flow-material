-- Add fiber_size column to output_materials table
ALTER TABLE public.output_materials 
ADD COLUMN IF NOT EXISTS fiber_size text;

-- Add comment for documentation
COMMENT ON COLUMN public.output_materials.fiber_size IS 'Fasergröße des Ausgangsmaterials (z.B. 0.125mm, 1mm, 3mm, 5mm, Überkorn)';