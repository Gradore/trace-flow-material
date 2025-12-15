-- Firmendatenbank (Kunden und Lieferanten)
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('customer', 'supplier', 'both')),
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Deutschland',
  tax_id TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Ansprechpartner
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  position TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Materialanmeldungen von Lieferanten
CREATE TABLE public.material_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  contact_id UUID REFERENCES public.contacts(id),
  material_type TEXT NOT NULL,
  material_subtype TEXT,
  estimated_weight_kg NUMERIC NOT NULL,
  container_type TEXT NOT NULL CHECK (container_type IN ('container', 'bigbag', 'palette', 'lose', 'other')),
  container_count INTEGER DEFAULT 1,
  waste_code TEXT,
  notes TEXT,
  preferred_date DATE,
  preferred_time_slot TEXT CHECK (preferred_time_slot IN ('morning', 'afternoon', 'flexible')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'arrived', 'processed', 'cancelled')),
  confirmed_date DATE,
  confirmed_time_slot TEXT,
  material_input_id UUID REFERENCES public.material_inputs(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Abholungsanfragen
CREATE TABLE public.pickup_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  contact_id UUID REFERENCES public.contacts(id),
  container_id UUID REFERENCES public.containers(id),
  material_description TEXT NOT NULL,
  weight_kg NUMERIC,
  pickup_address TEXT,
  preferred_date DATE,
  preferred_time_slot TEXT CHECK (preferred_time_slot IN ('morning', 'afternoon', 'flexible')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'picked_up', 'cancelled')),
  confirmed_date DATE,
  assigned_to UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Verknüpfe orders mit companies
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;

-- Companies Policies
CREATE POLICY "Companies viewable by staff"
  ON public.companies FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'intake') OR 
    has_role(auth.uid(), 'production') OR 
    has_role(auth.uid(), 'qa') OR
    has_role(auth.uid(), 'logistics')
  );

CREATE POLICY "Suppliers can view own company"
  ON public.companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.company_id = companies.id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Companies manageable by admin/intake"
  ON public.companies FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'intake'));

CREATE POLICY "Companies updatable by admin/intake"
  ON public.companies FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'intake'));

CREATE POLICY "Companies deletable by admin"
  ON public.companies FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Contacts Policies
CREATE POLICY "Contacts viewable by staff"
  ON public.contacts FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'intake') OR 
    has_role(auth.uid(), 'production') OR 
    has_role(auth.uid(), 'qa') OR
    has_role(auth.uid(), 'logistics')
  );

CREATE POLICY "Users can view own contact"
  ON public.contacts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Contacts manageable by admin/intake"
  ON public.contacts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'intake'));

CREATE POLICY "Contacts updatable by admin/intake"
  ON public.contacts FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'intake'));

CREATE POLICY "Contacts deletable by admin"
  ON public.contacts FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Material Announcements Policies
CREATE POLICY "Announcements viewable by staff"
  ON public.material_announcements FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'intake') OR 
    has_role(auth.uid(), 'logistics')
  );

CREATE POLICY "Suppliers can view own announcements"
  ON public.material_announcements FOR SELECT
  USING (
    has_role(auth.uid(), 'supplier') AND
    EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.company_id = material_announcements.company_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can create announcements"
  ON public.material_announcements FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'supplier') AND
    EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.company_id = company_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create announcements"
  ON public.material_announcements FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'intake')
  );

CREATE POLICY "Staff can update announcements"
  ON public.material_announcements FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'intake') OR has_role(auth.uid(), 'logistics'));

-- Pickup Requests Policies
CREATE POLICY "Pickup requests viewable by logistics/staff"
  ON public.pickup_requests FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'intake') OR 
    has_role(auth.uid(), 'logistics')
  );

CREATE POLICY "Suppliers can view own pickup requests"
  ON public.pickup_requests FOR SELECT
  USING (
    has_role(auth.uid(), 'supplier') AND
    EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.company_id = pickup_requests.company_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can create pickup requests"
  ON public.pickup_requests FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'supplier') AND
    EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.company_id = company_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage pickup requests"
  ON public.pickup_requests FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'logistics'));

-- Update orders policy for customers
CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  USING (
    has_role(auth.uid(), 'customer') AND
    EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.company_id = orders.company_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create orders for own company"
  ON public.orders FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'customer') AND
    EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.company_id = company_id AND c.user_id = auth.uid()
    )
  );

-- Output materials viewable by customers (for stock overview)
CREATE POLICY "Customers can view available stock"
  ON public.output_materials FOR SELECT
  USING (
    has_role(auth.uid(), 'customer') AND status = 'in_stock'
  );

-- Triggers for updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.material_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pickup_requests_updated_at
  BEFORE UPDATE ON public.pickup_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();