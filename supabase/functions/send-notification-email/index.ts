import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  /** Explicit recipient. Ignored when userId is supplied. */
  to?: string;
  /** Preferred: the recipient is resolved from this account server-side. */
  userId?: string;
  subject: string;
  title: string;
  message: string;
  link?: string;
  type: 'sample_approved' | 'sample_rejected' | 'order_created' | 'deadline_approaching' | 'registration_approved' | 'registration_rejected' | 'pickup_request' | 'announcement' | 'general';
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getEmailTemplate = (rawTitle: string, rawMessage: string, link?: string, type?: string) => {
  const title = escapeHtml(rawTitle);
  const message = escapeHtml(rawMessage);
  const buttonText = type === 'sample_approved' ? 'Probe anzeigen' 
    : type === 'order_created' ? 'Auftrag anzeigen'
    : type === 'deadline_approaching' ? 'Details anzeigen'
    : type === 'registration_approved' ? 'Jetzt anmelden'
    : type === 'pickup_request' ? 'Abholung anzeigen'
    : type === 'announcement' ? 'Ankündigung anzeigen'
    : 'Details anzeigen';

  const linkButton = link ? `
    <a href="${link}" style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">${buttonText}</a>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #16a34a; padding: 12px; border-radius: 8px;">
              <span style="color: white; font-size: 24px;">♻️</span>
            </div>
            <h1 style="margin: 16px 0 0 0; color: #18181b; font-size: 24px;">RekuFLOW</h1>
          </div>
          
          <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">${title}</h2>
          <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${message}</p>
          
          ${linkButton}
          
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 16px 0;">
          <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
            Diese E-Mail wurde automatisch von RekuFLOW gesendet.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT Authentication - verify the caller is authenticated
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
    console.log(`Sending email requested by user: ${userId}`);

    // Sending under the company brand is staff-only - otherwise this is an
    // authenticated open mail relay.
    const { data: isStaff } = await supabase.rpc('is_internal_staff', { _user_id: userId });
    if (!isStaff) {
      return new Response(JSON.stringify({ error: 'Nur interne Mitarbeiter dürfen Benachrichtigungen versenden.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: NotificationEmailRequest = await req.json();
    const { subject, title, message, type } = body;

    // The recipient is resolved server-side from a known account whenever a
    // userId is supplied; a free-text address is only accepted from admins.
    let to = body.to;
    if (body.userId) {
      const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: profile } = await serviceClient
        .from('profiles').select('email').eq('user_id', body.userId).maybeSingle();
      if (!profile?.email || profile.email.endsWith('@rekuflow.internal')) {
        return new Response(JSON.stringify({ error: 'Empfänger hat keine E-Mail-Adresse hinterlegt.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      to = profile.email;
    }

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return new Response(JSON.stringify({ error: 'Ungültige Empfängeradresse.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only links back into the application are embedded as a button, so the
    // branded mail cannot be turned into a phishing vector.
    const allowedOrigins = [Deno.env.get('APP_ORIGIN'), req.headers.get('origin')]
      .filter((o): o is string => !!o);
    const link = (() => {
      if (!body.link) return undefined;
      if (body.link.startsWith('/')) {
        return allowedOrigins[0] ? `${allowedOrigins[0]}${body.link}` : undefined;
      }
      try {
        const url = new URL(body.link);
        return allowedOrigins.some((o) => url.origin === new URL(o).origin) ? url.toString() : undefined;
      } catch {
        return undefined;
      }
    })();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    console.log(`Sending notification email to ${to}: ${subject}`);

    const html = getEmailTemplate(title, message, link, type);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RekuFLOW <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend API error:", response.status, errorText);
      throw new Error(`Resend API error: ${response.status} - ${errorText}`);
    }

    const emailResponse = await response.json();
    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-notification-email function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
