-- Create audit_logs table for tracking all changes
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  user_id uuid,
  user_email text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Audit logs viewable by admin"
ON public.audit_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can insert audit logs (triggered by app)
CREATE POLICY "Audit logs insertable by authenticated"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- Create function to log audit entries
CREATE OR REPLACE FUNCTION public.log_audit(
  _table_name text,
  _record_id uuid,
  _action text,
  _old_data jsonb DEFAULT NULL,
  _new_data jsonb DEFAULT NULL,
  _changed_fields text[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id uuid;
  _user_email text;
BEGIN
  -- Get user email if available
  SELECT email INTO _user_email FROM profiles WHERE user_id = auth.uid();
  
  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email)
  VALUES (_table_name, _record_id, _action, _old_data, _new_data, _changed_fields, auth.uid(), _user_email)
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;