
-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN username text;

-- Set username for existing profiles based on name (lowercase, no spaces)
UPDATE public.profiles SET username = lower(replace(name, ' ', '.'));

-- Make username NOT NULL and unique after setting values
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX idx_profiles_username ON public.profiles (username);

-- Make email nullable (was required before, now optional)
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- Create function to look up email by username (for login)
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email
  FROM public.profiles
  WHERE username = lower(_username)
  LIMIT 1
$$;
