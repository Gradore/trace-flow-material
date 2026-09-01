-- =====================================================================
-- Close self-registration. From now on only administrators create users.
--
-- Layers:
--  1. profiles / user_roles INSERT is admin-only (the previous policy let
--     any authenticated user insert their own role, which made a
--     self-signed-up account able to grant itself a role).
--  2. pending_registrations no longer accepts new rows; the table and its
--     existing data stay for audit purposes.
--  3. A trigger blocks profile creation for anyone but an admin or the
--     service role (the admin-create-user edge function).
--
-- NOTE for the operator: additionally switch OFF
--   Supabase Dashboard -> Authentication -> Sign In / Providers ->
--   "Allow new users to sign up"
-- so the /auth/v1/signup endpoint is closed at the gateway as well.
-- =====================================================================

-- ---------- 1. profiles ----------
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------- 2. user_roles ----------
DROP POLICY IF EXISTS "Users can insert own role or admins can insert any" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;

CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------- 3. pending_registrations: no new self-registrations ----------
DROP POLICY IF EXISTS "Users can insert own pending registration" ON public.pending_registrations;
DROP POLICY IF EXISTS "Anyone can create pending registration" ON public.pending_registrations;
DROP POLICY IF EXISTS "Users can create their own registration" ON public.pending_registrations;

-- ---------- 4. hard guard on profile creation ----------
CREATE OR REPLACE FUNCTION public.guard_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (admin-create-user edge function) and unauthenticated
  -- server-side contexts (migrations, seeds) are allowed through.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Selbstregistrierung ist deaktiviert. Benutzer werden ausschliesslich von Administratoren angelegt.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_insert ON public.profiles;
CREATE TRIGGER guard_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_insert();

-- ---------- 5. the role trigger must keep working for admin-created users ----------
-- handle_new_profile_role() is SECURITY DEFINER and therefore not subject to
-- the tightened user_roles policy; no change needed, but make sure it exists.
CREATE OR REPLACE FUNCTION public.handle_new_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, COALESCE(NEW.role, 'customer')::app_role);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_role();
