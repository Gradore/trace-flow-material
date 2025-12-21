import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { materialProperties, searchQuery, includeExternal } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: any[] = [];

    // 1. Interne Suche in der companies-Tabelle
    console.log('Searching internal companies...');
    const { data: internalCompanies, error: companyError } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        email,
        phone,
        address,
        city,
        country,
        type,
        notes,
        contacts (
          first_name,
          last_name,
          email,
          phone,
          position,
          is_primary
        )
      `)
      .eq('status', 'active')
      .or(`type.eq.customer,type.eq.supplier`);

    if (companyError) {
      console.error('Error fetching internal companies:', companyError);
    } else if (internalCompanies) {
      // Einfache Textsuche in den internen Daten
      const searchTerms = searchQuery.toLowerCase().split(' ');
      
      for (const company of internalCompanies) {
        const companyText = `${company.name} ${company.notes || ''} ${company.city || ''}`.toLowerCase();
        const matchScore = searchTerms.filter((term: string) => companyText.includes(term)).length / searchTerms.length;
        
        if (matchScore > 0.2) {
          const primaryContact = company.contacts?.find((c: any) => c.is_primary) || company.contacts?.[0];
          
          results.push({
            manufacturer_name: company.name,
            source: 'internal',
            confidence_score: matchScore,
            contact_name: primaryContact ? `${primaryContact.first_name} ${primaryContact.last_name}` : null,
            contact_email: primaryContact?.email || company.email,
            contact_phone: primaryContact?.phone || company.phone,
            address: [company.address, company.city, company.country].filter(Boolean).join(', '),
            notes: company.notes,
            company_id: company.id
          });
        }
      }
    }

    // 2. Externe Suche via Lovable AI (wenn gewünscht)
    if (includeExternal) {
      console.log('Performing external AI search...');
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        const searchPrompt = `Suche nach Herstellern und Unternehmen, die folgendes Material oder Produkt verwenden könnten:

${searchQuery}

${materialProperties ? `Materialeigenschaften: ${JSON.stringify(materialProperties)}` : ''}

Nenne konkrete Unternehmen mit:
- Firmenname
- Branche
- Typische Produkte/Anwendungen
- Standort (wenn bekannt)
- Website (wenn bekannt)

Fokussiere auf den deutschsprachigen Raum (DACH) und Europa.`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [
              { 
                role: 'system', 
                content: 'Du bist ein Experte für B2B-Vertrieb in der Kunststoffindustrie. Nenne konkrete, existierende Unternehmen.' 
              },
              { role: 'user', content: searchPrompt }
            ],
            tools: [{
              type: "function",
              function: {
                name: "list_manufacturers",
                description: "Liste von potenziellen Herstellern/Kunden",
                parameters: {
                  type: "object",
                  properties: {
                    manufacturers: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          company_name: { type: "string" },
                          industry: { type: "string" },
                          products: { type: "array", items: { type: "string" } },
                          location: { type: "string" },
                          website: { type: "string" },
                          relevance_reason: { type: "string" }
                        },
                        required: ["company_name", "industry"]
                      }
                    }
                  },
                  required: ["manufacturers"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "list_manufacturers" } }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
          
          if (toolCall) {
            const aiResult = JSON.parse(toolCall.function.arguments);
            
            for (const mfr of aiResult.manufacturers || []) {
              results.push({
                manufacturer_name: mfr.company_name,
                source: 'ai_search',
                confidence_score: 0.7,
                application_areas: mfr.products,
                address: mfr.location,
                website: mfr.website,
                notes: mfr.relevance_reason,
                industry: mfr.industry
              });
            }
          }
        } else {
          console.error('AI search failed:', response.status);
        }
      }
    }

    // Sortieren nach Konfidenz
    results.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));

    return new Response(JSON.stringify({ 
      success: true,
      results,
      internalCount: results.filter(r => r.source === 'internal').length,
      externalCount: results.filter(r => r.source !== 'internal').length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-manufacturers:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unbekannter Fehler' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
