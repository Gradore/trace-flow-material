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
    const { datasheetText, materialContext, analysisType } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    let systemPrompt = '';
    let toolDefinition = {};

    if (analysisType === 'recipe_matching') {
      systemPrompt = `Du bist ein Experte für Kunststoff-Rezepturen und Compound-Technologie, spezialisiert auf PP (Polypropylen) und glasfaserverstärkte Kunststoffe.

Analysiere die gegebenen Materialdaten (Laborergebnisse, Datenblätter) und:
1. Identifiziere die Materialzusammensetzung
2. Extrahiere die wichtigsten mechanischen und thermischen Eigenschaften
3. Schlage passende Rezepturen vor
4. Empfehle geeignete Anwendungsbereiche

Antworte immer auf Deutsch und sei präzise mit technischen Daten.`;

      toolDefinition = {
        type: "function",
        function: {
          name: "analyze_material",
          description: "Analysiert Materialdaten und schlägt Rezepturen vor",
          parameters: {
            type: "object",
            properties: {
              material_type: { type: "string", description: "Identifizierter Materialtyp (z.B. PP-GF30)" },
              material_grade: { type: "string", description: "Materialgüte oder -qualität" },
              composition: {
                type: "object",
                properties: {
                  base_polymer: { type: "string" },
                  filler_type: { type: "string" },
                  filler_percentage: { type: "number" },
                  additives: { type: "array", items: { type: "string" } }
                }
              },
              properties: {
                type: "object",
                properties: {
                  tensile_strength: { type: "string" },
                  flexural_modulus: { type: "string" },
                  impact_strength: { type: "string" },
                  density: { type: "string" },
                  melt_flow_rate: { type: "string" },
                  heat_deflection_temp: { type: "string" }
                }
              },
              suggested_recipes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    match_score: { type: "number" },
                    reason: { type: "string" }
                  }
                }
              },
              applications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    industry: { type: "string" },
                    description: { type: "string" },
                    suitability_score: { type: "number" }
                  }
                }
              },
              summary: { type: "string" }
            },
            required: ["material_type", "summary", "applications"]
          }
        }
      };
    } else if (analysisType === 'sales_search') {
      systemPrompt = `Du bist ein Experte für Kunststoff-Anwendungen und Marktkenntnisse in der Kunststoffindustrie.

Basierend auf dem Datenblatt, identifiziere:
1. Alle passenden Anwendungsbereiche und Bauteile
2. Branchen, die dieses Material verwenden
3. Typische Hersteller von Produkten, die dieses Material benötigen
4. Potenzielle Kunden und deren Kontaktmöglichkeiten

Sei spezifisch und nenne konkrete Unternehmen, Produkte und Anwendungen wo möglich.
Antworte immer auf Deutsch.`;

      toolDefinition = {
        type: "function",
        function: {
          name: "find_applications",
          description: "Findet passende Anwendungen und Hersteller für ein Material",
          parameters: {
            type: "object",
            properties: {
              material_summary: { type: "string" },
              applications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    industry: { type: "string" },
                    typical_components: { type: "array", items: { type: "string" } }
                  }
                }
              },
              potential_manufacturers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    company_name: { type: "string" },
                    industry: { type: "string" },
                    products: { type: "array", items: { type: "string" } },
                    location: { type: "string" },
                    website: { type: "string" },
                    notes: { type: "string" }
                  }
                }
              },
              market_insights: { type: "string" },
              recommended_approach: { type: "string" }
            },
            required: ["material_summary", "applications", "potential_manufacturers"]
          }
        }
      };
    }

    const userContent = materialContext 
      ? `Materialkontext: ${materialContext}\n\nDatenblatt/Laborergebnisse:\n${datasheetText}`
      : `Datenblatt/Laborergebnisse:\n${datasheetText}`;

    console.log('Calling Lovable AI for analysis type:', analysisType);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        tools: [toolDefinition],
        tool_choice: { type: "function", function: { name: analysisType === 'recipe_matching' ? 'analyze_material' : 'find_applications' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit erreicht. Bitte versuchen Sie es später erneut.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Guthaben erschöpft. Bitte laden Sie Ihr Konto auf.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('Keine strukturierte Antwort von der KI erhalten');
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ 
      success: true,
      analysisType,
      result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-datasheet:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unbekannter Fehler' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
