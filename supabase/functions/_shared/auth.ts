import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface AuthResult {
  userId: string;
  email: string | null;
}

/**
 * Verifies the caller and that they are internal staff. Returns a Response to
 * send back when the caller is not allowed - callers must return it as-is.
 */
export async function requireStaff(
  req: Request,
): Promise<{ ok: true; auth: AuthResult } | { ok: false; response: Response }> {
  const deny = (message: string, status: number) => ({
    ok: false as const,
    response: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return deny("Missing authorization header", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return deny("Unauthorized", 401);

  const { data: isStaff } = await userClient.rpc("is_internal_staff", { _user_id: user.id });
  if (!isStaff) return deny("Nur interne Mitarbeiter dürfen diese Funktion nutzen.", 403);

  return { ok: true, auth: { userId: user.id, email: user.email ?? null } };
}
