import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationEmailRequest {
  to: string;
  subject: string;
  title: string;
  message: string;
  link?: string;
  type: 'sample_approved' | 'sample_rejected' | 'order_created' | 'deadline_approaching' | 'registration_approved' | 'registration_rejected' | 'pickup_request' | 'announcement' | 'general';
}

const getEmailTemplate = (title: string, message: string, link?: string, type?: string) => {
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
            <h1 style="margin: 16px 0 0 0; color: #18181b; font-size: 24px;">RecyTrack</h1>
          </div>
          
          <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">${title}</h2>
          <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${message}</p>
          
          ${linkButton}
          
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 16px 0;">
          <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
            Diese E-Mail wurde automatisch von RecyTrack gesendet.
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

    const { to, subject, title, message, link, type }: NotificationEmailRequest = await req.json();

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
        from: "RecyTrack <onboarding@resend.dev>",
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
