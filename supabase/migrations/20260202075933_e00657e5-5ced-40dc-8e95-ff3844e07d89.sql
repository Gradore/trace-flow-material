-- =============================================
-- MULTI-TENANCY ISOLATION IMPLEMENTATION
-- =============================================

-- 1. Create helper function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.company_id
  FROM public.contacts c
  WHERE c.user_id = _user_id
  LIMIT 1
$$;

-- 2. Create helper function to check if user belongs to a company
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.user_id = _user_id
      AND c.company_id = _company_id
  )
$$;

-- 3. Create helper function to check if user is internal staff (can see all data)
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'intake', 'production', 'qa', 'betriebsleiter', 'logistics')
  )
$$;

-- =============================================
-- UPDATE RLS POLICIES FOR MULTI-TENANCY
-- =============================================

-- ORDERS: Customers can only see orders for their own company
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own company orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

DROP POLICY IF EXISTS "Customers can create orders for own company" ON public.orders;
CREATE POLICY "Customers can create orders for own company"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

-- MATERIAL_ANNOUNCEMENTS: Suppliers can only see their own announcements
DROP POLICY IF EXISTS "Suppliers can view their announcements" ON public.material_announcements;
DROP POLICY IF EXISTS "Announcements viewable by authenticated" ON public.material_announcements;
CREATE POLICY "Multi-tenant announcement access"
ON public.material_announcements FOR SELECT
TO authenticated
USING (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

DROP POLICY IF EXISTS "Announcements insertable by staff" ON public.material_announcements;
CREATE POLICY "Multi-tenant announcement insert"
ON public.material_announcements FOR INSERT
TO authenticated
WITH CHECK (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

DROP POLICY IF EXISTS "Announcements updatable by staff" ON public.material_announcements;
CREATE POLICY "Multi-tenant announcement update"
ON public.material_announcements FOR UPDATE
TO authenticated
USING (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

-- PICKUP_REQUESTS: Suppliers can only see their own pickup requests
DROP POLICY IF EXISTS "Pickup requests viewable by authenticated" ON public.pickup_requests;
DROP POLICY IF EXISTS "Pickup viewable by authenticated" ON public.pickup_requests;
CREATE POLICY "Multi-tenant pickup access"
ON public.pickup_requests FOR SELECT
TO authenticated
USING (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

DROP POLICY IF EXISTS "Pickup requests insertable by staff" ON public.pickup_requests;
DROP POLICY IF EXISTS "Pickup insertable by staff" ON public.pickup_requests;
CREATE POLICY "Multi-tenant pickup insert"
ON public.pickup_requests FOR INSERT
TO authenticated
WITH CHECK (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

DROP POLICY IF EXISTS "Pickup requests updatable by staff" ON public.pickup_requests;
DROP POLICY IF EXISTS "Pickup updatable by staff" ON public.pickup_requests;
CREATE POLICY "Multi-tenant pickup update"
ON public.pickup_requests FOR UPDATE
TO authenticated
USING (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

-- COMPANY_CONTRACTS: Only visible to assigned company
DROP POLICY IF EXISTS "Contracts viewable by authenticated" ON public.company_contracts;
CREATE POLICY "Multi-tenant contract access"
ON public.company_contracts FOR SELECT
TO authenticated
USING (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

-- COMPANY_DOCUMENTS: Only visible to assigned company
DROP POLICY IF EXISTS "Company documents viewable by authenticated" ON public.company_documents;
CREATE POLICY "Multi-tenant company document access"
ON public.company_documents FOR SELECT
TO authenticated
USING (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id)
);

-- CONTACTS: Users can only see contacts from their own company
DROP POLICY IF EXISTS "Contacts viewable by authenticated" ON public.contacts;
CREATE POLICY "Multi-tenant contact access"
ON public.contacts FOR SELECT
TO authenticated
USING (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), company_id) OR
  user_id = auth.uid()
);

-- COMPANIES: External users can only see their own company
DROP POLICY IF EXISTS "Companies viewable by authenticated" ON public.companies;
CREATE POLICY "Multi-tenant company access"
ON public.companies FOR SELECT
TO authenticated
USING (
  is_internal_staff(auth.uid()) OR 
  user_belongs_to_company(auth.uid(), id)
);

-- =============================================
-- RATE LIMITING TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_window 
ON public.rate_limit_log (ip_address, window_start);

-- Enable RLS on rate_limit_log
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Only allow backend functions to access rate_limit_log
CREATE POLICY "Rate limit log for service role only"
ON public.rate_limit_log FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Cleanup old rate limit entries (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_log
  WHERE window_start < now() - interval '1 hour';
END;
$$;