-- Add betriebsleiter role to all relevant RLS policies

-- 1. ORDERS - Add betriebsleiter to INSERT and UPDATE policies
DROP POLICY IF EXISTS "Orders insertable by staff" ON public.orders;
CREATE POLICY "Orders insertable by staff" ON public.orders
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Orders updatable by staff" ON public.orders;
CREATE POLICY "Orders updatable by staff" ON public.orders
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

-- 2. COMPANIES - Add betriebsleiter to INSERT and UPDATE policies
DROP POLICY IF EXISTS "Companies manageable by admin/intake" ON public.companies;
CREATE POLICY "Companies manageable by admin/intake" ON public.companies
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Companies updatable by admin/intake" ON public.companies;
CREATE POLICY "Companies updatable by admin/intake" ON public.companies
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Companies viewable by staff" ON public.companies;
CREATE POLICY "Companies viewable by staff" ON public.companies
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR 
  has_role(auth.uid(), 'qa'::app_role) OR 
  has_role(auth.uid(), 'logistics'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

-- 3. CONTAINERS - Add betriebsleiter to INSERT and UPDATE policies
DROP POLICY IF EXISTS "Containers insertable by staff" ON public.containers;
CREATE POLICY "Containers insertable by staff" ON public.containers
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR 
  has_role(auth.uid(), 'qa'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Containers updatable by staff" ON public.containers;
CREATE POLICY "Containers updatable by staff" ON public.containers
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR 
  has_role(auth.uid(), 'qa'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

-- 4. EQUIPMENT - Add betriebsleiter to SELECT and management policies
DROP POLICY IF EXISTS "Equipment viewable by staff" ON public.equipment;
CREATE POLICY "Equipment viewable by staff" ON public.equipment
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Equipment manageable by admin/production" ON public.equipment;
CREATE POLICY "Equipment manageable by admin/production" ON public.equipment
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Equipment updatable by admin/production" ON public.equipment;
CREATE POLICY "Equipment updatable by admin/production" ON public.equipment
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

-- 5. MAINTENANCE_RECORDS - Add betriebsleiter to policies
DROP POLICY IF EXISTS "Maintenance viewable by staff" ON public.maintenance_records;
CREATE POLICY "Maintenance viewable by staff" ON public.maintenance_records
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Maintenance manageable by admin/production" ON public.maintenance_records;
CREATE POLICY "Maintenance manageable by admin/production" ON public.maintenance_records
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Maintenance updatable by admin/production" ON public.maintenance_records;
CREATE POLICY "Maintenance updatable by admin/production" ON public.maintenance_records
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

-- 6. PROCESSING_STEPS - Add betriebsleiter to policies
DROP POLICY IF EXISTS "Processing insertable by production/admin" ON public.processing_steps;
CREATE POLICY "Processing insertable by production/admin" ON public.processing_steps
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Processing updatable by production/admin" ON public.processing_steps;
CREATE POLICY "Processing updatable by production/admin" ON public.processing_steps
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

-- 7. MATERIAL_INPUTS - Add betriebsleiter and DELETE policy for admin
DROP POLICY IF EXISTS "Material inputs insertable by staff" ON public.material_inputs;
CREATE POLICY "Material inputs insertable by staff" ON public.material_inputs
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Material inputs updatable by staff" ON public.material_inputs;
CREATE POLICY "Material inputs updatable by staff" ON public.material_inputs
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

-- Add DELETE policy for material_inputs (admin only)
DROP POLICY IF EXISTS "Material inputs deletable by admin" ON public.material_inputs;
CREATE POLICY "Material inputs deletable by admin" ON public.material_inputs
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. DELIVERY_NOTES - Add betriebsleiter and DELETE policy for admin
DROP POLICY IF EXISTS "Delivery notes insertable by staff" ON public.delivery_notes;
CREATE POLICY "Delivery notes insertable by staff" ON public.delivery_notes
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

DROP POLICY IF EXISTS "Delivery notes updatable by staff" ON public.delivery_notes;
CREATE POLICY "Delivery notes updatable by staff" ON public.delivery_notes
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);

-- Add DELETE policy for delivery_notes (admin only)
DROP POLICY IF EXISTS "Delivery notes deletable by admin" ON public.delivery_notes;
CREATE POLICY "Delivery notes deletable by admin" ON public.delivery_notes
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. SAMPLES - Add DELETE policy for admin
DROP POLICY IF EXISTS "Samples deletable by admin" ON public.samples;
CREATE POLICY "Samples deletable by admin" ON public.samples
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. MATERIAL_FLOW_HISTORY - Add betriebsleiter to policies
DROP POLICY IF EXISTS "Material flow history insertable by staff" ON public.material_flow_history;
CREATE POLICY "Material flow history insertable by staff" ON public.material_flow_history
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR 
  has_role(auth.uid(), 'qa'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);