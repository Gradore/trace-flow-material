import { supabase } from "@/integrations/supabase/client";

interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  error?: string;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_RETRY_AFTER_S = 60;

/**
 * The check sits in front of the login form, so an unresponsive edge function
 * must not leave the submit button spinning forever - abort and fail open.
 */
const CHECK_TIMEOUT_MS = 5_000;

/**
 * The answer used whenever the check itself could not be completed. The limiter
 * deliberately fails open: an outage of the edge function must never lock users
 * out of the login form.
 */
function allowByDefault(): RateLimitResponse {
  return { allowed: true, remaining: 100, resetAt: Date.now() + DEFAULT_WINDOW_MS };
}

/**
 * supabase-js turns every non-2xx answer of an edge function into an `error`
 * (`FunctionsHttpError`) with `data === null` and the raw Response in
 * `error.context` - including the 429 the rate-limit function uses to signal
 * "throttled". Reading only `data` therefore fails open exactly when the
 * limiter is supposed to bite, so the denial is recovered from the response.
 */
async function readDenial(error: unknown): Promise<RateLimitResponse | null> {
  const response = (error as { context?: { status?: number; headers?: { get(name: string): string | null }; clone?: () => { json(): Promise<unknown> } } } | null)?.context;

  if (!response || response.status !== 429) return null;

  let retryAfter = NaN;

  // Prefer the body: `Retry-After` is not a CORS-safelisted response header, so
  // it is invisible to the browser unless the function exposes it explicitly.
  try {
    const body = (await response.clone?.()?.json()) as { retryAfter?: unknown } | null;
    if (typeof body?.retryAfter === "number") retryAfter = body.retryAfter;
  } catch {
    /* not JSON or already consumed - fall back to the header below */
  }

  if (!Number.isFinite(retryAfter)) {
    retryAfter = Number(response.headers?.get("Retry-After"));
  }
  if (!Number.isFinite(retryAfter) || retryAfter <= 0) {
    retryAfter = DEFAULT_RETRY_AFTER_S;
  }

  return {
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + retryAfter * 1000,
    retryAfter,
  };
}

/**
 * Check if the current request is within rate limits
 * @param endpoint - The endpoint being accessed (for granular rate limiting)
 * @returns RateLimitResponse with allowed status and limit info
 */
export async function checkRateLimit(endpoint: string = "default"): Promise<RateLimitResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("rate-limit", {
      body: { endpoint },
      timeout: CHECK_TIMEOUT_MS,
    });

    if (error) {
      const denial = await readDenial(error);
      if (denial) return denial;

      // Anything else (function missing, 5xx, network) - allow but log it.
      console.error("Rate limit check failed:", error);
      return allowByDefault();
    }

    // Only an explicit `allowed: false` counts as a denial; a body that does not
    // have the expected shape must not lock anybody out.
    const result = data as Partial<RateLimitResponse> | null;
    if (!result || typeof result.allowed !== "boolean") {
      console.error("Rate limit check returned an unexpected payload:", data);
      return allowByDefault();
    }

    return {
      allowed: result.allowed,
      remaining: typeof result.remaining === "number" ? result.remaining : 0,
      resetAt: typeof result.resetAt === "number" ? result.resetAt : Date.now() + DEFAULT_WINDOW_MS,
      retryAfter: typeof result.retryAfter === "number" ? result.retryAfter : undefined,
    };
  } catch (err) {
    console.error("Rate limit error:", err);
    // On error, allow the request
    return allowByDefault();
  }
}

/**
 * Thrown by withRateLimit when the edge function refused the request, so
 * callers can tell a throttled call apart from a genuine failure.
 */
export class RateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(`Zu viele Anfragen. Bitte warten Sie ${retryAfter} Sekunden.`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Wrapper for API calls that enforces rate limiting
 * @param endpoint - The endpoint name for rate limiting
 * @param apiCall - The async function to execute if rate limit allows
 * @returns The result of the API call or throws RateLimitError if rate limited
 */
export async function withRateLimit<T>(
  endpoint: string,
  apiCall: () => Promise<T>
): Promise<T> {
  const limitResult = await checkRateLimit(endpoint);

  if (!limitResult.allowed) {
    throw new RateLimitError(limitResult.retryAfter || DEFAULT_RETRY_AFTER_S);
  }

  return apiCall();
}
