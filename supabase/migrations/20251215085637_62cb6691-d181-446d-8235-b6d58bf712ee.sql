-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- Product configuration
  product_category TEXT NOT NULL, -- UP-Harz Material, EP-Harz Material
  product_grain_size TEXT NOT NULL, -- 0.125mm, 1mm, 3mm, 5mm, Überkorn
  product_subcategory TEXT NOT NULL, -- Harz, Faser
  product_name TEXT GENERATED ALWAYS AS (product_category || '-' || product_grain_size || '-' || product_subcategory) STORED,
  
  quantity_kg NUMERIC NOT NULL,
  
  -- Deadlines
  production_deadline DATE NOT NULL,
  delivery_deadline DATE NOT NULL,
  
  -- Delivery
  delivery_partner TEXT,
  delivery_address TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_production, produced, shipped, delivered, cancelled
  
  -- References
  output_material_id UUID,
  delivery_note_id UUID,
  
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Orders viewable by authenticated" ON public.orders
  FOR SELECT USING (true);

CREATE POLICY "Orders insertable by staff" ON public.orders
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'intake'::app_role) OR 
    has_role(auth.uid(), 'production'::app_role)
  );

CREATE POLICY "Orders updatable by staff" ON public.orders
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'intake'::app_role) OR 
    has_role(auth.uid(), 'production'::app_role)
  );

CREATE POLICY "Orders deletable by admin" ON public.orders
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();