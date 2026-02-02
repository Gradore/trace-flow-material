import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

interface RateLimitEntry {
  id: string;
  ip_address: string;
  endpoint: string;
  request_count: number;
  window_start: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

async function checkRateLimit(
  supabaseUrl: string,
  supabaseServiceKey: string,
  ipAddress: string,
  endpoint: string
): Promise<RateLimitResult> {
  // Create a fresh client for each request to avoid type issues
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  
  // Get current request count for this IP within the window
  const { data: existingEntries, error: fetchError } = await supabase
    .from("rate_limit_log")
    .select("id, request_count, window_start")
    .eq("ip_address", ipAddress)
    .eq("endpoint", endpoint)
    .gte("window_start", windowStart.toISOString())
    .order("window_start", { ascending: false })
    .limit(1);

  if (fetchError) {
    console.error("Rate limit fetch error:", fetchError);
    // On error, allow the request but log it
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW, resetAt: Date.now() + RATE_LIMIT_WINDOW_MS };
  }

  const now = new Date();
  const entries = existingEntries as RateLimitEntry[] | null;
  
  if (entries && entries.length > 0) {
    const entry = entries[0];
    const currentCount = entry.request_count || 0;
    const entryWindowStart = new Date(entry.window_start);
    const resetAt = entryWindowStart.getTime() + RATE_LIMIT_WINDOW_MS;
    
    if (currentCount >= MAX_REQUESTS_PER_WINDOW) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: retryAfter > 0 ? retryAfter : 1
      };
    }
    
    // Increment the counter
    await supabase
      .from("rate_limit_log")
      .update({ request_count: currentCount + 1 })
      .eq("id", entry.id);
    
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - currentCount - 1,
      resetAt
    };
  } else {
    // Create new entry
    await supabase
      .from("rate_limit_log")
      .insert({
        ip_address: ipAddress,
        endpoint,
        request_count: 1,
        window_start: now.toISOString()
      });
    
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetAt: now.getTime() + RATE_LIMIT_WINDOW_MS
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get IP address from headers
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
    
    // Get endpoint from request body or default
    const body = await req.json().catch(() => ({}));
    const endpoint = body.endpoint || "default";
    
    // Check rate limit
    const result = await checkRateLimit(supabaseUrl, supabaseServiceKey, ipAddress, endpoint);
    
    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: result.retryAfter
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(result.retryAfter),
            "X-RateLimit-Limit": String(MAX_REQUESTS_PER_WINDOW),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
          }
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        allowed: true,
        remaining: result.remaining,
        resetAt: result.resetAt
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(MAX_REQUESTS_PER_WINDOW),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
        }
      }
    );
  } catch (error: unknown) {
    console.error("Rate limit error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
