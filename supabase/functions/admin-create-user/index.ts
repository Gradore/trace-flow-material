import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = [
  "admin",
  "betriebsleiter",
  "intake",
  "production",
  "qa",
  "customer",
  "supplier",
  "logistics",
] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) return json({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: requestingUser.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Nur Administratoren dürfen Benutzer anlegen." }, 403);

    const { username, email, name, password, role, companyId } = await req.json();

    const EXTERNAL_ROLES = ["customer", "supplier", "logistics"];

    if (!username || !name || !password) {
      return json({ error: "username, name und password sind erforderlich." }, 400);
    }
    if (!/^[a-z0-9._-]+$/i.test(username)) {
      return json({ error: "Benutzername darf nur Buchstaben, Zahlen, Punkte, Unterstriche und Bindestriche enthalten." }, 400);
    }
    if (typeof password !== "string" || password.length < 8) {
      return json({ error: "Passwort muss mindestens 8 Zeichen lang sein." }, 400);
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Ungültige E-Mail-Adresse." }, 400);
    }
    if (!VALID_ROLES.includes(role)) {
      return json({ error: "Ungültige Rolle." }, 400);
    }
    if (EXTERNAL_ROLES.includes(role) && !companyId) {
      return json({ error: "Externe Rollen benötigen eine Firmenzuordnung." }, 400);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normalizedUsername = String(username).toLowerCase();

    // Username must be unique - check before touching auth
    const { data: existing } = await adminClient
      .from("profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .maybeSingle();
    if (existing) return json({ error: "Benutzername ist bereits vergeben." }, 409);

    // Users without a real mail address get an internal, non-routable address
    const authEmail = email || `${normalizedUsername}@rekuflow.internal`;

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError || !created?.user) {
      return json({ error: createError?.message ?? "Benutzer konnte nicht angelegt werden." }, 400);
    }

    const newUserId = created.user.id;

    const { error: profileError } = await adminClient.from("profiles").insert({
      user_id: newUserId,
      // Store the address the account actually authenticates with - login
      // resolves the password e-mail from profiles.email via username.
      email: authEmail,
      name,
      username: normalizedUsername,
      role,
    });

    if (profileError) {
      // roll back the auth user so a failed insert does not leave an orphan
      await adminClient.auth.admin.deleteUser(newUserId);
      return json({ error: profileError.message }, 400);
    }

    // handle_new_profile_role() creates the role row; make sure it matches.
    // user_roles has a UNIQUE(user_id) constraint - exactly one role per user.
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert({ user_id: newUserId, role }, { onConflict: "user_id" });

    if (roleError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return json({ error: `Rolle konnte nicht gesetzt werden: ${roleError.message}` }, 400);
    }

    // External roles are bound to a company through a contacts row -
    // get_user_company_id() and every tenant RLS policy read that link.
    if (companyId) {
      const parts = String(name).trim().split(/\s+/);
      const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : name;
      const lastName = parts.length > 1 ? parts[parts.length - 1] : "";

      const { error: contactError } = await adminClient.from("contacts").insert({
        company_id: companyId,
        user_id: newUserId,
        first_name: firstName,
        last_name: lastName,
        email: email || null,
      });

      if (contactError) {
        console.error("Could not link user to company:", contactError);
        return json({
          success: true,
          userId: newUserId,
          username: normalizedUsername,
          authEmail,
          warning: `Benutzer angelegt, Firmenzuordnung fehlgeschlagen: ${contactError.message}`,
        });
      }
    }

    return json({
      success: true,
      userId: newUserId,
      username: normalizedUsername,
      authEmail,
    });
  } catch (error: unknown) {
    console.error("admin-create-user error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
