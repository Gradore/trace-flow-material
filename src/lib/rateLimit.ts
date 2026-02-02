import { supabase } from "@/integrations/supabase/client";

interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  error?: string;
}

/**
 * Check if the current request is within rate limits
 * @param endpoint - The endpoint being accessed (for granular rate limiting)
 * @returns RateLimitResponse with allowed status and limit info
 */
export async function checkRateLimit(endpoint: string = "default"): Promise<RateLimitResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("rate-limit", {
      body: { endpoint }
    });

    if (error) {
      // If rate limit check fails, allow the request but log the error
      console.error("Rate limit check failed:", error);
      return { allowed: true, remaining: 100, resetAt: Date.now() + 60000 };
    }

    return data as RateLimitResponse;
  } catch (err) {
    console.error("Rate limit error:", err);
    // On error, allow the request
    return { allowed: true, remaining: 100, resetAt: Date.now() + 60000 };
  }
}

/**
 * Wrapper for API calls that enforces rate limiting
 * @param endpoint - The endpoint name for rate limiting
 * @param apiCall - The async function to execute if rate limit allows
 * @returns The result of the API call or throws if rate limited
 */
export async function withRateLimit<T>(
  endpoint: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const limitResult = await checkRateLimit(endpoint);

  if (!limitResult.allowed) {
    const error = new Error(
      `Zu viele Anfragen. Bitte warten Sie ${limitResult.retryAfter || 60} Sekunden.`
    );
    (error as Error & { retryAfter?: number }).retryAfter = limitResult.retryAfter;
    throw error;
  }

  return apiCall();
}

/**
 * React hook-friendly rate limit check
 * Returns current rate limit status without making an API call
 */
export function getRateLimitHeaders(response: Response): {
  limit: number;
  remaining: number;
  resetAt: number;
} {
  return {
    limit: parseInt(response.headers.get("X-RateLimit-Limit") || "100", 10),
    remaining: parseInt(response.headers.get("X-RateLimit-Remaining") || "100", 10),
    resetAt: parseInt(response.headers.get("X-RateLimit-Reset") || "0", 10) * 1000
  };
}
