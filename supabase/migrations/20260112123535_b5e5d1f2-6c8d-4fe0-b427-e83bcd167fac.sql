-- Fix overly permissive RLS policy on material_flow_history
DROP POLICY IF EXISTS "History insertable by authenticated" ON public.material_flow_history;

-- Grant execute permission on existing log_audit functions to authenticated users
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, jsonb, jsonb, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(text, uuid, text, jsonb, jsonb, text[]) TO authenticated;