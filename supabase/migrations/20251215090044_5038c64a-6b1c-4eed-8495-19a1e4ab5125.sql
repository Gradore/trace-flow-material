-- Create notifications table for in-app notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, success, error
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT, -- optional link to navigate to
  related_id UUID, -- optional related entity id
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- System can insert notifications (via service role or triggers)
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Add foreign key from orders to output_materials and delivery_notes
ALTER TABLE public.orders 
  ADD CONSTRAINT fk_orders_output_material 
  FOREIGN KEY (output_material_id) REFERENCES public.output_materials(id);

ALTER TABLE public.orders 
  ADD CONSTRAINT fk_orders_delivery_note 
  FOREIGN KEY (delivery_note_id) REFERENCES public.delivery_notes(id);

-- Function to create notification when order deadline is approaching
CREATE OR REPLACE FUNCTION public.check_order_deadlines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_rec RECORD;
BEGIN
  -- Find orders with production deadline tomorrow that are still pending
  FOR order_rec IN 
    SELECT o.id, o.order_id, o.customer_name, o.production_deadline, o.created_by
    FROM orders o
    WHERE o.status IN ('pending', 'in_production')
      AND o.production_deadline = CURRENT_DATE + INTERVAL '1 day'
  LOOP
    -- Create notification for the order creator
    INSERT INTO notifications (user_id, title, message, type, link, related_id)
    VALUES (
      order_rec.created_by,
      'Produktionsfrist morgen',
      'Auftrag ' || order_rec.order_id || ' für ' || order_rec.customer_name || ' muss morgen produziert werden.',
      'warning',
      '/orders',
      order_rec.id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;