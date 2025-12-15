import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText, contractContext } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Du bist ein Experte für die Analyse von Verträgen im Recycling-Bereich. 
Extrahiere folgende Informationen aus dem Vertragstext und gib sie als strukturiertes JSON zurück:
- payment_terms: Zahlungsbedingungen (z.B. "30 Tage netto", "14 Tage 2% Skonto")
- delivery_terms: Lieferbedingungen (z.B. "frei Haus", "ab Werk", "DDP", "EXW")
- freight_payer: Wer zahlt die Fracht? (nur: "sender", "receiver", oder "shared")
- price_per_kg: Preis pro kg als Zahl (nur die Zahl, ohne Währung)
- currency: Währung (z.B. "EUR", "USD")
- material_type: Um welches Material geht es?
- valid_from: Gültig ab (Format: YYYY-MM-DD)
- valid_until: Gültig bis (Format: YYYY-MM-DD)
- contract_number: Vertragsnummer falls vorhanden
- key_terms: Array mit wichtigen Vertragspunkten (max 5)

Wenn eine Information nicht gefunden wird, setze null.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Kontext: ${contractContext || 'Allgemeiner Vertrag'}\n\nVertragstext:\n${pdfText}` }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contract_data",
              description: "Extrahierte Vertragsdaten strukturiert zurückgeben",
              parameters: {
                type: "object",
                properties: {
                  payment_terms: { type: "string", description: "Zahlungsbedingungen" },
                  delivery_terms: { type: "string", description: "Lieferbedingungen" },
                  freight_payer: { type: "string", enum: ["sender", "receiver", "shared"] },
                  price_per_kg: { type: "number", description: "Preis pro kg" },
                  currency: { type: "string", description: "Währung" },
                  material_type: { type: "string", description: "Materialtyp" },
                  valid_from: { type: "string", description: "Gültig ab (YYYY-MM-DD)" },
                  valid_until: { type: "string", description: "Gültig bis (YYYY-MM-DD)" },
                  contract_number: { type: "string", description: "Vertragsnummer" },
                  key_terms: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Wichtige Vertragspunkte"
                  }
                },
                required: []
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_contract_data" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let extractedData = {};
    
    if (toolCall?.function?.arguments) {
      try {
        extractedData = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in extract-contract:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
