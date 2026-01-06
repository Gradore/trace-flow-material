import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');
const PIPEDRIVE_BASE_URL = 'https://api.pipedrive.com/v1';

interface SyncRequest {
  action: 'sync_company' | 'sync_order' | 'sync_activity' | 'get_deals' | 'get_persons';
  data?: Record<string, unknown>;
}

async function pipedriveRequest(endpoint: string, method: string = 'GET', body?: Record<string, unknown>) {
  const url = `${PIPEDRIVE_BASE_URL}${endpoint}?api_token=${PIPEDRIVE_API_KEY}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  console.log(`Pipedrive request: ${method} ${endpoint}`);
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!data.success) {
    console.error('Pipedrive API error:', data);
    throw new Error(data.error || 'Pipedrive API request failed');
  }
  
  return data;
}

async function syncCompanyToPipedrive(company: Record<string, unknown>) {
  const orgData = {
    name: company.name,
    address: company.address,
    visible_to: 3,
    add_time: company.created_at,
  };
  
  const searchResult = await pipedriveRequest(`/organizations/search?term=${encodeURIComponent(company.name as string)}&exact_match=true`);
  
  if (searchResult.data?.items?.length > 0) {
    const orgId = searchResult.data.items[0].item.id;
    const result = await pipedriveRequest(`/organizations/${orgId}`, 'PUT', orgData);
    console.log(`Updated organization ${orgId} in Pipedrive`);
    return { action: 'updated', pipedrive_id: orgId, data: result.data };
  } else {
    const result = await pipedriveRequest('/organizations', 'POST', orgData);
    console.log(`Created organization ${result.data.id} in Pipedrive`);
    return { action: 'created', pipedrive_id: result.data.id, data: result.data };
  }
}

// deno-lint-ignore no-explicit-any
async function syncOrderToDeal(order: Record<string, unknown>, supabaseClient: any) {
  let companyName = order.customer_name;
  if (order.company_id) {
    const { data: company } = await supabaseClient
      .from('companies')
      .select('name')
      .eq('id', order.company_id)
      .single();
    if (company) companyName = (company as { name: string }).name;
  }
  
  const stageMap: Record<string, number> = {
    'pending': 1,
    'in_production': 2,
    'ready': 3,
    'delivered': 4,
    'cancelled': 5,
  };
  
  const dealData = {
    title: `${order.order_id} - ${order.product_name || order.product_category}`,
    value: (order.quantity_kg as number) * 2,
    currency: 'EUR',
    stage_id: stageMap[order.status as string] || 1,
    expected_close_date: order.delivery_deadline,
    visible_to: 3,
  };
  
  const searchResult = await pipedriveRequest(`/deals/search?term=${encodeURIComponent(order.order_id as string)}`);
  
  if (searchResult.data?.items?.length > 0) {
    const dealId = searchResult.data.items[0].item.id;
    const result = await pipedriveRequest(`/deals/${dealId}`, 'PUT', dealData);
    console.log(`Updated deal ${dealId} in Pipedrive`);
    return { action: 'updated', pipedrive_id: dealId, data: result.data };
  } else {
    const result = await pipedriveRequest('/deals', 'POST', dealData);
    console.log(`Created deal ${result.data.id} in Pipedrive`);
    return { action: 'created', pipedrive_id: result.data.id, data: result.data };
  }
}

async function createActivity(activityData: Record<string, unknown>) {
  const activity = {
    subject: activityData.subject,
    type: activityData.type || 'task',
    due_date: activityData.due_date || new Date().toISOString().split('T')[0],
    due_time: activityData.due_time,
    duration: activityData.duration,
    note: activityData.note,
    deal_id: activityData.deal_id,
    org_id: activityData.org_id,
    done: activityData.done || 0,
  };
  
  const result = await pipedriveRequest('/activities', 'POST', activity);
  console.log(`Created activity ${result.data.id} in Pipedrive`);
  return { action: 'created', pipedrive_id: result.data.id, data: result.data };
}

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

    const userId = claimsData.claims.sub;
    console.log(`Authenticated user: ${userId}`);

    if (!PIPEDRIVE_API_KEY) {
      throw new Error('PIPEDRIVE_API_KEY not configured');
    }

    // Use service role for database operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, data } = await req.json() as SyncRequest;
    console.log(`Processing Pipedrive action: ${action} for user ${userId}`);

    let result;
    
    switch (action) {
      case 'sync_company':
        result = await syncCompanyToPipedrive(data!);
        break;
        
      case 'sync_order':
        result = await syncOrderToDeal(data!, supabaseAdmin);
        break;
        
      case 'sync_activity':
        result = await createActivity(data!);
        break;
        
      case 'get_deals':
        result = await pipedriveRequest('/deals?status=open&limit=50');
        break;
        
      case 'get_persons':
        result = await pipedriveRequest('/persons?limit=50');
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Pipedrive sync error:', error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
