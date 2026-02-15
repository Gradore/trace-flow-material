
-- Fix INSERT policy for output_materials to include more roles
DROP POLICY IF EXISTS "Outputs insertable by production/admin" ON public.output_materials;
CREATE POLICY "Outputs insertable by staff"
ON public.output_materials
FOR INSERT
TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role) OR
  has_role(auth.uid(), 'intake'::app_role) OR
  has_role(auth.uid(), 'qa'::app_role)
);

-- Add DELETE policy for output_materials
DROP POLICY IF EXISTS "Outputs deletable by admin" ON public.output_materials;
CREATE POLICY "Outputs deletable by admin/production"
ON public.output_materials
FOR DELETE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

-- Expand UPDATE policy to include betriebsleiter and intake
DROP POLICY IF EXISTS "Outputs updatable by staff" ON public.output_materials;
CREATE POLICY "Outputs updatable by staff"
ON public.output_materials
FOR UPDATE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'qa'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role) OR
  has_role(auth.uid(), 'intake'::app_role)
);

-- Expand material_inputs DELETE to include production and betriebsleiter
DROP POLICY IF EXISTS "Material inputs deletable by admin" ON public.material_inputs;
CREATE POLICY "Material inputs deletable by staff"
ON public.material_inputs
FOR DELETE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);
