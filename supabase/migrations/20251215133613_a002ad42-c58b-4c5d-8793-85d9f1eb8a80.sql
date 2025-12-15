-- Allow production role to insert material_inputs
DROP POLICY IF EXISTS "Material inputs insertable by intake/admin" ON public.material_inputs;
CREATE POLICY "Material inputs insertable by staff"
ON public.material_inputs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
);

-- Allow production to update samples (not just view)
DROP POLICY IF EXISTS "Samples updatable by qa/admin" ON public.samples;
CREATE POLICY "Samples updatable by staff"
ON public.samples
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'qa'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
);

-- Allow production to update delivery_notes
CREATE POLICY "Delivery notes updatable by staff"
ON public.delivery_notes
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role)
);

-- Allow production to update documents
CREATE POLICY "Documents updatable by staff"
ON public.documents
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR 
  has_role(auth.uid(), 'qa'::app_role)
);