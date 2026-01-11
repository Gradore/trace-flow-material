-- Add 'betriebsleiter' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'betriebsleiter';

-- Create user_permissions table for granular permission control
CREATE TABLE public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Module visibility permissions
    can_view_dashboard BOOLEAN DEFAULT true,
    can_view_reporting BOOLEAN DEFAULT true,
    can_view_orders BOOLEAN DEFAULT true,
    can_view_companies BOOLEAN DEFAULT true,
    can_view_containers BOOLEAN DEFAULT true,
    can_view_intake BOOLEAN DEFAULT true,
    can_view_processing BOOLEAN DEFAULT true,
    can_view_maintenance BOOLEAN DEFAULT true,
    can_view_sampling BOOLEAN DEFAULT true,
    can_view_output BOOLEAN DEFAULT true,
    can_view_delivery_notes BOOLEAN DEFAULT true,
    can_view_documents BOOLEAN DEFAULT true,
    can_view_traceability BOOLEAN DEFAULT true,
    can_view_recipe_matching BOOLEAN DEFAULT true,
    can_view_sales_search BOOLEAN DEFAULT true,
    can_view_logistics BOOLEAN DEFAULT true,
    can_view_users BOOLEAN DEFAULT true,
    can_view_admin BOOLEAN DEFAULT true,
    can_view_audit_logs BOOLEAN DEFAULT true,
    can_view_api_docs BOOLEAN DEFAULT true,
    can_view_settings BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view and manage permissions
CREATE POLICY "Admins can manage user permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get default permissions for a role
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(role_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    CASE role_name
        WHEN 'admin' THEN
            RETURN jsonb_build_object(
                'can_view_dashboard', true, 'can_view_reporting', true, 'can_view_orders', true,
                'can_view_companies', true, 'can_view_containers', true, 'can_view_intake', true,
                'can_view_processing', true, 'can_view_maintenance', true, 'can_view_sampling', true,
                'can_view_output', true, 'can_view_delivery_notes', true, 'can_view_documents', true,
                'can_view_traceability', true, 'can_view_recipe_matching', true, 'can_view_sales_search', true,
                'can_view_logistics', true, 'can_view_users', true, 'can_view_admin', true,
                'can_view_audit_logs', true, 'can_view_api_docs', true, 'can_view_settings', true
            );
        WHEN 'betriebsleiter' THEN
            -- Operations manager: sees everything except finances, AI recipes, reporting, API docs
            RETURN jsonb_build_object(
                'can_view_dashboard', true, 'can_view_reporting', false, 'can_view_orders', true,
                'can_view_companies', true, 'can_view_containers', true, 'can_view_intake', true,
                'can_view_processing', true, 'can_view_maintenance', true, 'can_view_sampling', true,
                'can_view_output', true, 'can_view_delivery_notes', true, 'can_view_documents', true,
                'can_view_traceability', true, 'can_view_recipe_matching', false, 'can_view_sales_search', false,
                'can_view_logistics', true, 'can_view_users', true, 'can_view_admin', false,
                'can_view_audit_logs', true, 'can_view_api_docs', false, 'can_view_settings', true
            );
        WHEN 'production' THEN
            RETURN jsonb_build_object(
                'can_view_dashboard', true, 'can_view_reporting', false, 'can_view_orders', true,
                'can_view_companies', false, 'can_view_containers', true, 'can_view_intake', true,
                'can_view_processing', true, 'can_view_maintenance', true, 'can_view_sampling', true,
                'can_view_output', true, 'can_view_delivery_notes', true, 'can_view_documents', true,
                'can_view_traceability', true, 'can_view_recipe_matching', true, 'can_view_sales_search', true,
                'can_view_logistics', false, 'can_view_users', false, 'can_view_admin', false,
                'can_view_audit_logs', false, 'can_view_api_docs', false, 'can_view_settings', false
            );
        WHEN 'intake' THEN
            RETURN jsonb_build_object(
                'can_view_dashboard', true, 'can_view_reporting', true, 'can_view_orders', true,
                'can_view_companies', true, 'can_view_containers', true, 'can_view_intake', true,
                'can_view_processing', false, 'can_view_maintenance', false, 'can_view_sampling', false,
                'can_view_output', false, 'can_view_delivery_notes', true, 'can_view_documents', true,
                'can_view_traceability', true, 'can_view_recipe_matching', true, 'can_view_sales_search', true,
                'can_view_logistics', true, 'can_view_users', false, 'can_view_admin', false,
                'can_view_audit_logs', false, 'can_view_api_docs', false, 'can_view_settings', false
            );
        WHEN 'qa' THEN
            RETURN jsonb_build_object(
                'can_view_dashboard', true, 'can_view_reporting', true, 'can_view_orders', true,
                'can_view_companies', false, 'can_view_containers', true, 'can_view_intake', false,
                'can_view_processing', false, 'can_view_maintenance', false, 'can_view_sampling', true,
                'can_view_output', true, 'can_view_delivery_notes', false, 'can_view_documents', true,
                'can_view_traceability', true, 'can_view_recipe_matching', true, 'can_view_sales_search', true,
                'can_view_logistics', false, 'can_view_users', false, 'can_view_admin', false,
                'can_view_audit_logs', false, 'can_view_api_docs', false, 'can_view_settings', false
            );
        WHEN 'customer' THEN
            RETURN jsonb_build_object(
                'can_view_dashboard', false, 'can_view_reporting', false, 'can_view_orders', true,
                'can_view_companies', false, 'can_view_containers', false, 'can_view_intake', false,
                'can_view_processing', false, 'can_view_maintenance', false, 'can_view_sampling', false,
                'can_view_output', false, 'can_view_delivery_notes', false, 'can_view_documents', false,
                'can_view_traceability', false, 'can_view_recipe_matching', false, 'can_view_sales_search', false,
                'can_view_logistics', false, 'can_view_users', false, 'can_view_admin', false,
                'can_view_audit_logs', false, 'can_view_api_docs', false, 'can_view_settings', false
            );
        WHEN 'supplier' THEN
            RETURN jsonb_build_object(
                'can_view_dashboard', false, 'can_view_reporting', false, 'can_view_orders', false,
                'can_view_companies', false, 'can_view_containers', false, 'can_view_intake', false,
                'can_view_processing', false, 'can_view_maintenance', false, 'can_view_sampling', false,
                'can_view_output', false, 'can_view_delivery_notes', false, 'can_view_documents', false,
                'can_view_traceability', false, 'can_view_recipe_matching', false, 'can_view_sales_search', false,
                'can_view_logistics', false, 'can_view_users', false, 'can_view_admin', false,
                'can_view_audit_logs', false, 'can_view_api_docs', false, 'can_view_settings', false
            );
        WHEN 'logistics' THEN
            RETURN jsonb_build_object(
                'can_view_dashboard', true, 'can_view_reporting', false, 'can_view_orders', false,
                'can_view_companies', true, 'can_view_containers', true, 'can_view_intake', false,
                'can_view_processing', false, 'can_view_maintenance', false, 'can_view_sampling', false,
                'can_view_output', false, 'can_view_delivery_notes', true, 'can_view_documents', false,
                'can_view_traceability', false, 'can_view_recipe_matching', false, 'can_view_sales_search', false,
                'can_view_logistics', true, 'can_view_users', false, 'can_view_admin', false,
                'can_view_audit_logs', false, 'can_view_api_docs', false, 'can_view_settings', false
            );
        ELSE
            -- Default minimal permissions
            RETURN jsonb_build_object(
                'can_view_dashboard', true, 'can_view_reporting', false, 'can_view_orders', false,
                'can_view_companies', false, 'can_view_containers', false, 'can_view_intake', false,
                'can_view_processing', false, 'can_view_maintenance', false, 'can_view_sampling', false,
                'can_view_output', false, 'can_view_delivery_notes', false, 'can_view_documents', false,
                'can_view_traceability', false, 'can_view_recipe_matching', false, 'can_view_sales_search', false,
                'can_view_logistics', false, 'can_view_users', false, 'can_view_admin', false,
                'can_view_audit_logs', false, 'can_view_api_docs', false, 'can_view_settings', false
            );
    END CASE;
END;
$$;