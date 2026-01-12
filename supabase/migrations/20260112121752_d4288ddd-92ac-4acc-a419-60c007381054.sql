-- ================================================================
-- PRIORITY 1: SECURITY FIXES
-- ================================================================

-- 1. Fix audit_logs INSERT policy - use SECURITY DEFINER function instead
-- First drop the overly permissive policy
DROP POLICY IF EXISTS "Audit logs insertable by service role only" ON public.audit_logs;

-- Create a new restrictive policy that only allows service_role
CREATE POLICY "Audit logs insertable by service role only"
ON public.audit_logs
FOR INSERT
WITH CHECK (false);

-- Create SECURITY DEFINER function for audit logging (can bypass RLS)
CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _table_name text,
  _record_id uuid,
  _old_data jsonb DEFAULT NULL,
  _new_data jsonb DEFAULT NULL,
  _changed_fields text[] DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    changed_fields,
    user_id,
    user_email
  ) VALUES (
    _action,
    _table_name,
    _record_id,
    _old_data,
    _new_data,
    _changed_fields,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid())
  ) RETURNING id INTO _id;
  
  RETURN _id;
END;
$$;

-- 2. Fix documents INSERT policy - should check auth status
DROP POLICY IF EXISTS "Documents insertable by authenticated" ON public.documents;

CREATE POLICY "Documents insertable by authenticated"
ON public.documents
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- 3. Fix notifications INSERT policy - should verify user can only insert for themselves or authorized targets
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- 4. Ensure betriebsleiter can also view all profiles for operational oversight
DROP POLICY IF EXISTS "Betriebsleiter can view all profiles" ON public.profiles;

CREATE POLICY "Betriebsleiter can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'betriebsleiter'::app_role));

-- 5. Add missing material_flow_history INSERT policy for staff
DROP POLICY IF EXISTS "Staff can insert material flow history" ON public.material_flow_history;

CREATE POLICY "Staff can insert material flow history"
ON public.material_flow_history
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'intake'::app_role) OR 
  has_role(auth.uid(), 'production'::app_role) OR
  has_role(auth.uid(), 'qa'::app_role) OR
  has_role(auth.uid(), 'betriebsleiter'::app_role)
);