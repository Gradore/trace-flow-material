-- Fix remaining permissive RLS policies

-- Check and fix pending_registrations INSERT policy if needed
-- New users need to be able to insert their own pending registration
DROP POLICY IF EXISTS "Users can insert own pending registration" ON public.pending_registrations;

CREATE POLICY "Users can insert own pending registration"
ON public.pending_registrations
FOR INSERT
WITH CHECK (user_id = auth.uid());