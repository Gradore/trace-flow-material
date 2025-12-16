import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token or user not found');
    }

    console.log(`GDPR export requested for user: ${user.id}`);

    // Collect all user data
    const exportData: Record<string, unknown> = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
      created_at: user.created_at,
    };

    // Get profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (profile) {
      exportData.profile = profile;
    }

    // Get user roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id);
    
    if (roles?.length) {
      exportData.roles = roles;
    }

    // Get contact associations
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*, companies(name, company_id)')
      .eq('user_id', user.id);
    
    if (contacts?.length) {
      exportData.contacts = contacts;
    }

    // Get notifications
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id);
    
    if (notifications?.length) {
      exportData.notifications = notifications;
    }

    // Get pending registrations
    const { data: registrations } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('user_id', user.id);
    
    if (registrations?.length) {
      exportData.registrations = registrations;
    }

    // Get audit logs for this user
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (auditLogs?.length) {
      exportData.audit_logs = auditLogs;
    }

    // Get created content
    const { data: createdMaterialInputs } = await supabase
      .from('material_inputs')
      .select('input_id, material_type, supplier, weight_kg, created_at')
      .eq('created_by', user.id);
    
    if (createdMaterialInputs?.length) {
      exportData.created_material_inputs = createdMaterialInputs;
    }

    const { data: createdSamples } = await supabase
      .from('samples')
      .select('sample_id, status, sampled_at, created_at')
      .eq('sampler_id', user.id);
    
    if (createdSamples?.length) {
      exportData.created_samples = createdSamples;
    }

    const { data: createdOrders } = await supabase
      .from('orders')
      .select('order_id, customer_name, product_category, quantity_kg, status, created_at')
      .eq('created_by', user.id);
    
    if (createdOrders?.length) {
      exportData.created_orders = createdOrders;
    }

    const { data: uploadedDocuments } = await supabase
      .from('documents')
      .select('name, file_type, tag, created_at')
      .eq('uploaded_by', user.id);
    
    if (uploadedDocuments?.length) {
      exportData.uploaded_documents = uploadedDocuments;
    }

    console.log(`GDPR export completed for user: ${user.id}`);

    return new Response(JSON.stringify({
      success: true,
      data: exportData,
      filename: `dsgvo-export-${user.id}-${new Date().toISOString().split('T')[0]}.json`
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('GDPR export error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
