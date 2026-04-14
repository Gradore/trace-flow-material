
-- Allow the handle_new_profile_role trigger and self-registration to work
-- The trigger runs as SECURITY DEFINER but RLS still applies to the session user
-- We need to allow users to insert their own role entry
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

CREATE POLICY "Users can insert own role or admins can insert any"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
);

-- Update the trigger to not insert a default role, since InviteUserDialog handles this
CREATE OR REPLACE FUNCTION public.handle_new_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only insert default role if no role exists yet for this user
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, COALESCE(NEW.role, 'customer')::app_role);
  END IF;
  RETURN NEW;
END;
$$;

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_role();
