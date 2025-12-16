-- Fix: Audit Logs Can Be Written by Client Code
-- Remove the overly permissive INSERT policy that allows any authenticated user to insert
-- The log_audit function is SECURITY DEFINER and will bypass RLS, so it can still insert

DROP POLICY IF EXISTS "Audit logs insertable by authenticated" ON public.audit_logs;

-- Create a more restrictive policy that only allows inserts from service role
-- Regular users must use the log_audit RPC function which is SECURITY DEFINER
CREATE POLICY "Audit logs insertable by service role only" 
ON public.audit_logs 
FOR INSERT 
TO service_role
WITH CHECK (true);