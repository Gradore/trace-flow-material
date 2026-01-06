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
    // JWT Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('JWT validation failed:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;
    console.log(`GDPR export requested for user: ${userId}`);

    // Use service role for full data access
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Collect all user data
    const exportData: Record<string, unknown> = {
      export_date: new Date().toISOString(),
      user_id: userId,
      email: userEmail,
    };

    // Get profile data
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (profile) {
      exportData.profile = profile;
    }

    // Get user roles
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('user_id', userId);
    
    if (roles?.length) {
      exportData.roles = roles;
    }

    // Get contact associations
    const { data: contacts } = await supabaseAdmin
      .from('contacts')
      .select('*, companies(name, company_id)')
      .eq('user_id', userId);
    
    if (contacts?.length) {
      exportData.contacts = contacts;
    }

    // Get notifications
    const { data: notifications } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId);
    
    if (notifications?.length) {
      exportData.notifications = notifications;
    }

    // Get pending registrations
    const { data: registrations } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('user_id', userId);
    
    if (registrations?.length) {
      exportData.registrations = registrations;
    }

    // Get audit logs for this user
    const { data: auditLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (auditLogs?.length) {
      exportData.audit_logs = auditLogs;
    }

    // Get profile ID for created_by queries
    const profileId = profile?.id;

    if (profileId) {
      // Get created content
      const { data: createdMaterialInputs } = await supabaseAdmin
        .from('material_inputs')
        .select('input_id, material_type, supplier, weight_kg, created_at')
        .eq('created_by', profileId);
      
      if (createdMaterialInputs?.length) {
        exportData.created_material_inputs = createdMaterialInputs;
      }

      const { data: createdSamples } = await supabaseAdmin
        .from('samples')
        .select('sample_id, status, sampled_at, created_at')
        .eq('sampler_id', profileId);
      
      if (createdSamples?.length) {
        exportData.created_samples = createdSamples;
      }

      const { data: createdOrders } = await supabaseAdmin
        .from('orders')
        .select('order_id, customer_name, product_category, quantity_kg, status, created_at')
        .eq('created_by', profileId);
      
      if (createdOrders?.length) {
        exportData.created_orders = createdOrders;
      }

      const { data: uploadedDocuments } = await supabaseAdmin
        .from('documents')
        .select('name, file_type, tag, created_at')
        .eq('uploaded_by', profileId);
      
      if (uploadedDocuments?.length) {
        exportData.uploaded_documents = uploadedDocuments;
      }
    }

    console.log(`GDPR export completed for user: ${userId}`);

    return new Response(JSON.stringify({
      success: true,
      data: exportData,
      filename: `dsgvo-export-${userId}-${new Date().toISOString().split('T')[0]}.json`
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
