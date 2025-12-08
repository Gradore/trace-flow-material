-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'intake', 'production', 'qa', 'customer');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create SECURITY DEFINER function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Create function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 6. RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- 7. Update profiles RLS - restrict visibility
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 8. Update all existing RLS policies to use has_role function

-- Containers policies
DROP POLICY IF EXISTS "Containers deletable by admin" ON public.containers;
DROP POLICY IF EXISTS "Containers insertable by staff" ON public.containers;
DROP POLICY IF EXISTS "Containers updatable by staff" ON public.containers;

CREATE POLICY "Containers deletable by admin"
ON public.containers
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Containers insertable by staff"
ON public.containers
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'intake') OR
  public.has_role(auth.uid(), 'production') OR
  public.has_role(auth.uid(), 'qa')
);

CREATE POLICY "Containers updatable by staff"
ON public.containers
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'intake') OR
  public.has_role(auth.uid(), 'production') OR
  public.has_role(auth.uid(), 'qa')
);

-- Delivery notes policies
DROP POLICY IF EXISTS "Delivery notes insertable by staff" ON public.delivery_notes;

CREATE POLICY "Delivery notes insertable by staff"
ON public.delivery_notes
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'intake') OR
  public.has_role(auth.uid(), 'production')
);

-- Documents policies
DROP POLICY IF EXISTS "Documents deletable by uploader or admin" ON public.documents;

CREATE POLICY "Documents deletable by uploader or admin"
ON public.documents
FOR DELETE
USING (
  uploaded_by = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

-- Material inputs policies
DROP POLICY IF EXISTS "Material inputs insertable by intake/admin" ON public.material_inputs;
DROP POLICY IF EXISTS "Material inputs updatable by staff" ON public.material_inputs;

CREATE POLICY "Material inputs insertable by intake/admin"
ON public.material_inputs
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'intake')
);

CREATE POLICY "Material inputs updatable by staff"
ON public.material_inputs
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'intake') OR
  public.has_role(auth.uid(), 'production')
);

-- Output materials policies
DROP POLICY IF EXISTS "Outputs insertable by production/admin" ON public.output_materials;
DROP POLICY IF EXISTS "Outputs updatable by staff" ON public.output_materials;

CREATE POLICY "Outputs insertable by production/admin"
ON public.output_materials
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'production')
);

CREATE POLICY "Outputs updatable by staff"
ON public.output_materials
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'production') OR
  public.has_role(auth.uid(), 'qa')
);

-- Processing steps policies
DROP POLICY IF EXISTS "Processing insertable by production/admin" ON public.processing_steps;
DROP POLICY IF EXISTS "Processing updatable by production/admin" ON public.processing_steps;

CREATE POLICY "Processing insertable by production/admin"
ON public.processing_steps
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'production')
);

CREATE POLICY "Processing updatable by production/admin"
ON public.processing_steps
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'production')
);

-- Sample results policies
DROP POLICY IF EXISTS "Sample results insertable by qa/admin" ON public.sample_results;

CREATE POLICY "Sample results insertable by qa/admin"
ON public.sample_results
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'qa')
);

-- Samples policies
DROP POLICY IF EXISTS "Samples insertable by qa/production/admin" ON public.samples;
DROP POLICY IF EXISTS "Samples updatable by qa/admin" ON public.samples;

CREATE POLICY "Samples insertable by qa/production/admin"
ON public.samples
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'production') OR
  public.has_role(auth.uid(), 'qa')
);

CREATE POLICY "Samples updatable by qa/admin"
ON public.samples
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'qa')
);

-- 9. Create trigger to create user_roles entry when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'customer'::app_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_add_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_role();