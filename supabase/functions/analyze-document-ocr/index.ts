import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileContent, fileName, documentType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Determine the extraction prompt based on document type
    let extractionPrompt = "";
    let extractionSchema: any = {};

    if (documentType === "delivery_note" || fileName.toLowerCase().includes("lieferschein")) {
      extractionPrompt = `Analysiere diesen Lieferschein und extrahiere alle wichtigen Informationen. 
Der Text wurde per OCR aus einem Dokument extrahiert. Extrahiere:
- Lieferschein-Nummer
- Datum
- Absender/Lieferant (Name, Adresse)
- Empfänger/Kunde (Name, Adresse)
- Material/Produkt Beschreibung
- Menge/Gewicht in kg
- Abfallschlüsselnummer falls vorhanden
- Chargen-/Batch-Nummer falls vorhanden
- Zusätzliche Bemerkungen

Hier ist der OCR-Text:
${fileContent}`;
      
      extractionSchema = {
        type: "object",
        properties: {
          delivery_note_id: { type: "string", description: "Lieferschein-Nummer" },
          date: { type: "string", description: "Datum im Format YYYY-MM-DD" },
          sender_name: { type: "string", description: "Name des Absenders/Lieferanten" },
          sender_address: { type: "string", description: "Adresse des Absenders" },
          recipient_name: { type: "string", description: "Name des Empfängers/Kunden" },
          recipient_address: { type: "string", description: "Adresse des Empfängers" },
          material_description: { type: "string", description: "Beschreibung des Materials/Produkts" },
          weight_kg: { type: "number", description: "Gewicht in Kilogramm" },
          waste_code: { type: "string", description: "Abfallschlüsselnummer" },
          batch_reference: { type: "string", description: "Chargen-/Batch-Nummer" },
          notes: { type: "string", description: "Zusätzliche Bemerkungen" },
          confidence: { type: "number", description: "Vertrauensgrad der Extraktion 0-100" }
        },
        required: ["delivery_note_id", "material_description", "confidence"]
      };
    } else if (documentType === "sample_report" || fileName.toLowerCase().includes("labor")) {
      extractionPrompt = `Analysiere diesen Laborbericht und extrahiere alle wichtigen Informationen.
Der Text wurde per OCR aus einem Dokument extrahiert. Extrahiere:
- Proben-ID / Labor-Referenz
- Analysedatum
- Materialart
- Alle Messwerte und Parameter (z.B. Faserlänge, Reinheit, MFI, Viskosität, Dichte, Feuchte)
- Bewertung/Freigabe-Status
- Prüfer/Labor-Name

Hier ist der OCR-Text:
${fileContent}`;

      extractionSchema = {
        type: "object",
        properties: {
          sample_id: { type: "string", description: "Proben-ID oder Labor-Referenz" },
          analysis_date: { type: "string", description: "Analysedatum im Format YYYY-MM-DD" },
          material_type: { type: "string", description: "Art des Materials" },
          parameters: { 
            type: "array", 
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                value: { type: "string" },
                unit: { type: "string" }
              }
            },
            description: "Liste der gemessenen Parameter"
          },
          approval_status: { type: "string", description: "Freigabe-Status" },
          lab_name: { type: "string", description: "Name des Labors/Prüfers" },
          notes: { type: "string", description: "Zusätzliche Bemerkungen" },
          confidence: { type: "number", description: "Vertrauensgrad der Extraktion 0-100" }
        },
        required: ["sample_id", "parameters", "confidence"]
      };
    } else if (documentType === "material_intake" || fileName.toLowerCase().includes("eingang")) {
      extractionPrompt = `Analysiere dieses Dokument für einen Materialeingang und extrahiere alle wichtigen Informationen.
Der Text wurde per OCR aus einem Dokument extrahiert. Extrahiere:
- Eingangs-ID / Referenz
- Eingangsdatum
- Lieferant
- Materialart (GFK, PP, PA etc.)
- Material-Subtyp (UP, EP, VE, PA6, PA66 etc.)
- Gewicht in kg
- Abfallschlüsselnummer
- Container-Zuweisung falls vorhanden

Hier ist der OCR-Text:
${fileContent}`;

      extractionSchema = {
        type: "object",
        properties: {
          input_id: { type: "string", description: "Eingangs-ID oder Referenz" },
          received_date: { type: "string", description: "Eingangsdatum im Format YYYY-MM-DD" },
          supplier: { type: "string", description: "Name des Lieferanten" },
          material_type: { type: "string", description: "Hauptmaterialart (gfk, pp, pa)" },
          material_subtype: { type: "string", description: "Material-Subtyp (up, ep, ve, pa6, pa66)" },
          weight_kg: { type: "number", description: "Gewicht in Kilogramm" },
          waste_code: { type: "string", description: "Abfallschlüsselnummer" },
          container_id: { type: "string", description: "Container-ID" },
          notes: { type: "string", description: "Zusätzliche Bemerkungen" },
          confidence: { type: "number", description: "Vertrauensgrad der Extraktion 0-100" }
        },
        required: ["supplier", "material_type", "weight_kg", "confidence"]
      };
    } else {
      // Generic document extraction
      extractionPrompt = `Analysiere dieses Dokument und extrahiere alle wichtigen Informationen.
Der Text wurde per OCR aus einem Dokument extrahiert. Identifiziere den Dokumenttyp und extrahiere relevante Daten.

Hier ist der OCR-Text:
${fileContent}`;

      extractionSchema = {
        type: "object",
        properties: {
          document_type: { type: "string", description: "Erkannter Dokumenttyp" },
          title: { type: "string", description: "Titel oder Überschrift des Dokuments" },
          date: { type: "string", description: "Datum falls vorhanden" },
          parties: { 
            type: "array", 
            items: { type: "string" },
            description: "Beteiligte Parteien (Firmen, Personen)"
          },
          key_values: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" }
              }
            },
            description: "Wichtige Schlüssel-Wert-Paare"
          },
          summary: { type: "string", description: "Kurze Zusammenfassung des Inhalts" },
          confidence: { type: "number", description: "Vertrauensgrad der Extraktion 0-100" }
        },
        required: ["document_type", "key_values", "confidence"]
      };
    }

    // Call AI Gateway for extraction
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Du bist ein Experte für die Analyse von Geschäftsdokumenten im Recycling- und Materialmanagement-Bereich. Extrahiere präzise strukturierte Daten aus OCR-Text. Antworte immer auf Deutsch."
          },
          {
            role: "user",
            content: extractionPrompt
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extrahierte Daten aus dem Dokument",
              parameters: extractionSchema
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_document_data" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Guthaben aufgebraucht. Bitte laden Sie Ihr Konto auf." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    console.log("AI Response:", JSON.stringify(aiResult, null, 2));

    // Extract the tool call result
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      success: true,
      data: extractedData,
      documentType: documentType || "unknown"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("OCR Analysis error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unbekannter Fehler bei der Dokumentanalyse" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
