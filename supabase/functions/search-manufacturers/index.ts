import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireStaff } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// German/English filler words that carry no signal when matching company records.
const STOP_WORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'und', 'oder', 'aber', 'mit', 'ohne', 'fuer', 'für', 'von', 'vom', 'aus', 'bei', 'nach', 'auf',
  'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'kann', 'koennen', 'können', 'nicht', 'auch',
  'sehr', 'mehr', 'sowie', 'bzw', 'ca', 'etwa', 'the', 'and', 'for', 'with', 'from',
  'material', 'materialien', 'werkstoff', 'kunststoff', 'produkt', 'produkte', 'typ', 'type',
  'wert', 'werte', 'einheit', 'norm', 'din', 'iso', 'astm', 'min', 'max', 'mpa', 'gpa', 'kpa',
  'kg', 'kgh', 'bar', 'mm', 'cm', 'grad', 'celsius', 'prozent', 'gew',
  'gmbh', 'mbh', 'kg-', 'ag', 'ohg', 'kgaa', 'ltd', 'inc', 'co', 'gesellschaft',
]);

/**
 * Turns a free-text query (a keyword or a whole pasted datasheet) into a short list of
 * distinctive search terms. Numbers, stop words and very short tokens are dropped so a
 * long datasheet cannot dilute the score.
 */
function extractSearchTerms(query: unknown): string[] {
  if (typeof query !== 'string') return [];
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/)
    .filter((t) => t.length >= 3 && !/^\d/.test(t) && !STOP_WORDS.has(t));
  return Array.from(new Set(tokens)).slice(0, 25);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const gate = await requireStaff(req);
  if (!gate.ok) return gate.response;

  try {
    const { materialProperties, searchQuery, includeExternal } = await req.json();

    let searchTerms = extractSearchTerms(searchQuery);
    // Short queries like "PP" are filtered out by the token rules - keep them as one term.
    if (searchTerms.length === 0 && typeof searchQuery === 'string' && searchQuery.trim().length >= 2) {
      searchTerms = [searchQuery.trim().toLowerCase()];
    }
    if (searchTerms.length === 0) {
      return new Response(JSON.stringify({
        error: 'Bitte geben Sie einen aussagekräftigen Suchbegriff ein.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // At least two hits are required for long inputs (e.g. a pasted datasheet) so a single
    // incidental word does not match every company in the address book.
    const requiredHits = searchTerms.length > 8 ? 2 : 1;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: any[] = [];
    let internalError: string | null = null;

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
      .in('type', ['customer', 'supplier', 'both']);

    if (companyError) {
      console.error('Error fetching internal companies:', companyError);
      internalError = 'Die interne Firmensuche ist fehlgeschlagen.';
    } else if (internalCompanies) {
      // Einfache Textsuche in den internen Daten
      for (const company of internalCompanies) {
        const companyText = [
          company.name,
          company.notes || '',
          company.city || '',
          company.address || '',
          company.country || '',
        ].join(' ').toLowerCase();
        const matchedTerms = searchTerms.filter((term) => companyText.includes(term));
        // Score by how many distinct terms were found, capped so a short query can reach 1.0.
        const matchScore = Math.min(1, matchedTerms.length / Math.min(searchTerms.length, 4));

        if (matchedTerms.length >= requiredHits) {
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
      internalError,
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
