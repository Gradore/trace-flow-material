-- Verträge / Konditionen für Firmen
CREATE TABLE public.company_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_number TEXT,
  valid_from DATE,
  valid_until DATE,
  payment_terms TEXT, -- z.B. "30 Tage netto", "14 Tage 2% Skonto"
  delivery_terms TEXT, -- z.B. "frei Haus", "ab Werk", "DDP"
  freight_payer TEXT CHECK (freight_payer IN ('sender', 'receiver', 'shared')),
  price_per_kg NUMERIC,
  currency TEXT DEFAULT 'EUR',
  material_type TEXT,
  notes TEXT,
  pdf_url TEXT,
  extracted_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Dokumente pro Firma (allgemein)
CREATE TABLE public.company_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_type TEXT CHECK (document_type IN ('contract', 'certificate', 'license', 'other')),
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES public.profiles(id)
);

-- Pending user registrations for approval
CREATE TABLE public.pending_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('customer', 'supplier', 'logistics')),
  company_name TEXT,
  company_id UUID REFERENCES public.companies(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Erweitere pickup_requests um Zahlungskonditionen
ALTER TABLE public.pickup_requests 
ADD COLUMN IF NOT EXISTS freight_payer TEXT CHECK (freight_payer IN ('sender', 'receiver', 'shared')),
ADD COLUMN IF NOT EXISTS transport_cost NUMERIC,
ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- Erweitere material_announcements um Konditionen
ALTER TABLE public.material_announcements
ADD COLUMN IF NOT EXISTS freight_payer TEXT CHECK (freight_payer IN ('sender', 'receiver', 'shared')),
ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC;

-- Enable RLS
ALTER TABLE public.company_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Company Contracts Policies
CREATE POLICY "Contracts viewable by staff"
  ON public.company_contracts FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'intake') OR 
    has_role(auth.uid(), 'logistics')
  );

CREATE POLICY "Customers can view own contracts"
  ON public.company_contracts FOR SELECT
  USING (
    (has_role(auth.uid(), 'customer') OR has_role(auth.uid(), 'supplier')) AND
    EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.company_id = company_contracts.company_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Contracts manageable by admin"
  ON public.company_contracts FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Company Documents Policies
CREATE POLICY "Company docs viewable by staff"
  ON public.company_documents FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'intake') OR 
    has_role(auth.uid(), 'logistics')
  );

CREATE POLICY "Users can view own company docs"
  ON public.company_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.company_id = company_documents.company_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can upload company docs"
  ON public.company_documents FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'intake') OR
    has_role(auth.uid(), 'logistics')
  );

CREATE POLICY "Docs deletable by admin"
  ON public.company_documents FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Pending Registrations Policies
CREATE POLICY "Admins can manage registrations"
  ON public.pending_registrations FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own registration"
  ON public.pending_registrations FOR SELECT
  USING (user_id = auth.uid());

-- Triggers
CREATE TRIGGER update_company_contracts_updated_at
  BEFORE UPDATE ON public.company_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();