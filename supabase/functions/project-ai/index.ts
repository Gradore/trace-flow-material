import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Domain system prompt. This is the factual ground truth of the process and
 * must not be softened or "improved" - it comes from real process development.
 */
const SYSTEM_PROMPT = `Du bist technischer Analyst für ein GFK-Recyclingprojekt in Deutschland.

VERFAHREN:
Kaltmechanisches Recycling durch Scher- und Walkbeanspruchung. Kernaggregat ist eine
modifizierte Schneidmühle bei ca. 30 U/min mit bewusst stumpfen, verschleißgeschützten
Messern (Schneidkantenradius 0,3–0,8 mm, Keilwinkel 60–80°, Schnittspalt 0,5–0,8 mm).

PHYSIKALISCHES PRINZIP:
Die Harzmatrix (Bruchdehnung 1–2,5 %) versagt bei niedrigerer Dehnung als die
E-Glasfaser (Bruchdehnung 3,5–4,8 %). Langsame Biege-/Scherbeanspruchung zerstört
selektiv die Matrix und erhält die Faserlänge. Prallverfahren (Hammermühle) zerstören
beide gleichermaßen und sind explizit ausgeschlossen.

ZWEI PRODUKTLINIEN mit GEGENSÄTZLICHEN Einstellungen:
- Linie A (Baustoff): maximale Faserlänge, stumpfe Messer, weiter Spalt, ~30 U/min,
  großes/kein Sieb. Fraktionen F1, F2, F3, F5.
- Linie B (Compound): definierte Kurzlänge 3–5 mm, scharfe Messer, enger Spalt
  0,1–0,3 mm, 100–200 U/min, Sieb 5–6 mm Rundloch. Fraktion F4.
Das Sieb steuert die Länge, nicht die Drehzahl.

ZIELFRAKTIONEN:
F1 Makrofaser 8–15 mm, >80 % Glas, Beton/GRC/Asphalt, 800 €/t
F2 Polymerbeton 4–10 mm, >80 % Glas, 1.000–1.200 €/t
F3 Mörtel/Zement 3–8 mm, >75 % Glas, 800 €/t
F4 Compound 1–3 mm, >75 % Glas, PP-GF/PA6-GF, 900 €/t
F5 Feinanteil <0,5 mm, Füller/Zementzuschlag, 200–400 €/t

GO/NO-GO-SCHWELLEN:
- Faserlänge Median < 0,3 mm → Konfiguration ungeeignet
- Energieeintrag > 350 kWh/t → wirtschaftlich nicht darstellbar
- Glasgehalt Faserfraktion < 50 % → Compoundeure verlieren Interesse

WIRTSCHAFTLICHER RAHMEN:
Gate Fee 200–250 €/t. Erstkanal Abnahme gesichert bei 1.000–1.200 €/t.
Zielausbau 32 t/Tag ≈ 8.000 t/Jahr.

IP-HINWEIS:
Das Verfahren ist patentrelevant. Vor jeder Veröffentlichung oder Herstellerdemo muss
die Patentanmeldung eingereicht sein. Weise darauf hin, wenn Aktivitäten dies gefährden.

DEIN STIL:
- Deutsch, sachlich, dicht. Keine Floskeln, keine Wiederholung der Frage.
- Konkrete Zahlen und Schwellwerte nennen.
- Bei Unsicherheit sagen, was fehlt, statt zu raten.
- Immer priorisierte Handlungsempfehlungen am Ende.
- Wenn Daten gegen die Erwartung sprechen, das klar sagen — nicht beschönigen.`;

const ANALYSIS_TYPES = [
  "daily_briefing", "test_interpretation", "doe_optimization", "next_actions",
  "partner_followup", "spec_conformity", "risk_scan", "weekly_report",
] as const;
type AnalysisType = (typeof ANALYSIS_TYPES)[number];

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const GATEWAY_MODEL = "google/gemini-2.5-flash";

interface AiResult { text: string; model: string; tokens: number }

/**
 * Calls the LLM server-side. Prefers the Anthropic API when a key is
 * configured, otherwise falls back to the Lovable AI gateway that the rest of
 * the app already uses. The key never reaches the client either way.
 */
async function callModel(prompt: string): Promise<AiResult> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    const body = await res.json();
    const text = (body.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    const tokens = (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0);
    return { text, model: ANTHROPIC_MODEL, tokens };
  }

  const gatewayKey = Deno.env.get("LOVABLE_API_KEY");
  if (!gatewayKey) {
    throw new Error("Kein KI-Schlüssel konfiguriert (ANTHROPIC_API_KEY oder LOVABLE_API_KEY).");
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayKey}` },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI-Gateway ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return {
    text: body.choices?.[0]?.message?.content ?? "",
    model: GATEWAY_MODEL,
    tokens: body.usage?.total_tokens ?? 0,
  };
}

function table(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "(keine Daten)";
  const keys = Object.keys(rows[0]);
  const head = `| ${keys.join(" | ")} |`;
  const sep = `| ${keys.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${keys.map((k) => String(r[k] ?? "—")).join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

type Db = ReturnType<typeof createClient>;

/** Builds the prompt and the audit context for one analysis type. */
async function buildContext(
  db: Db,
  type: AnalysisType,
  scopeId: string | null,
): Promise<{ prompt: string; context: Record<string, unknown> }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  switch (type) {
    case "test_interpretation": {
      if (!scopeId) throw new Error("scopeId (test_run) fehlt.");
      const { data: run } = await db.from("test_runs").select("*").eq("id", scopeId).single();
      if (!run) throw new Error("Versuchslauf nicht gefunden.");
      const { data: params } = await db.from("test_run_parameters").select("*").eq("test_run_id", scopeId);
      const { data: fractions } = await db.from("output_fractions").select("*").eq("test_run_id", scopeId);
      const fractionIds = (fractions ?? []).map((f: { id: string }) => f.id);
      const { data: analyses } = fractionIds.length
        ? await db.from("fraction_analyses").select("*").in("output_fraction_id", fractionIds)
        : { data: [] };
      const analysisIds = (analyses ?? []).map((a: { id: string }) => a.id);
      const { data: results } = analysisIds.length
        ? await db.from("fraction_analysis_results").select("*").in("analysis_id", analysisIds)
        : { data: [] };
      const { data: specs } = await db.from("fraction_specs").select("*");
      const { data: batch } = run.input_batch_id
        ? await db.from("material_batches").select("*").eq("id", run.input_batch_id).single()
        : { data: null };
      const { data: partner } = run.partner_id
        ? await db.from("project_partners").select("name").eq("id", run.partner_id).single()
        : { data: null };
      const { data: history } = await db
        .from("test_runs").select("run_code, title, process_line, machine_name, summary")
        .neq("id", scopeId).eq("process_line", run.process_line).limit(10);

      const context = { run, params, fractions, analyses, results, specs, batch, partner, history };
      const prompt = `Werte den folgenden Versuchslauf aus.

VERSUCHSLAUF: ${run.run_code} — ${run.title}
Partner: ${partner?.name ?? "—"}, Maschine: ${run.machine_name ?? "—"}
Prozesslinie: ${run.process_line}
Input: ${batch?.batch_code ?? "—"}, Materialklasse ${batch?.material_class ?? "—"}, Harztyp ${batch?.resin_type ?? "—"}, ${run.input_weight_kg ?? "—"} kg

MASCHINENPARAMETER:
${table((params ?? []).map((p: Record<string, unknown>) => ({ Parameter: p.parameter_key, Wert: p.value_numeric ?? p.value_text, Einheit: p.unit })))}

AUSGANGSFRAKTIONEN:
${table((fractions ?? []).map((f: Record<string, unknown>) => ({ Code: f.fraction_code, Ziel: f.target_fraction_id, kg: f.weight_kg, "Ausbeute %": f.yield_pct, Status: f.status })))}

ANALYSENERGEBNISSE:
${table((results ?? []).map((r: Record<string, unknown>) => ({ Parameter: r.parameter_key, Wert: r.value_numeric ?? r.value_text, Einheit: r.unit, Min: r.spec_min, Max: r.spec_max, "in Spec": r.pass_fail })))}

ZIELSPEZIFIKATION:
${table((specs ?? []).map((s: Record<string, unknown>) => ({ ID: s.id, Name: s.name, "Länge min": s.fiber_length_min_mm, "Länge max": s.fiber_length_max_mm, "Glas min %": s.glass_content_min_pct, "Feuchte max %": s.moisture_max_pct, "Fein max %": s.fines_max_pct })))}

FRÜHERE VERGLEICHSLÄUFE (gleiche Prozesslinie):
${table((history ?? []) as Record<string, unknown>[])}

Beantworte:
1. Ist die Zielspezifikation erreicht? Welche Parameter liegen außerhalb?
2. Welche Auffälligkeiten gibt es im Vergleich zu früheren Läufen?
3. Was ist die wahrscheinlichste Ursache für Abweichungen (verfahrenstechnisch begründet)?
4. Welche Parameteränderung empfiehlst du für den nächsten Lauf? Nenne konkrete Werte.
5. Sind Go/No-Go-Schwellen verletzt?

Antworte als Markdown, max. 400 Wörter.`;
      return { prompt, context };
    }

    case "doe_optimization": {
      if (!scopeId) throw new Error("scopeId (doe_series) fehlt.");
      const { data: series } = await db.from("doe_series").select("*").eq("id", scopeId).single();
      if (!series) throw new Error("DoE-Serie nicht gefunden.");
      const { data: runs } = await db.from("test_runs").select("*").eq("doe_series_id", scopeId).order("doe_run_number");
      const runIds = (runs ?? []).map((r: { id: string }) => r.id);
      const { data: params } = runIds.length
        ? await db.from("test_run_parameters").select("*").in("test_run_id", runIds)
        : { data: [] };
      const { data: fractions } = runIds.length
        ? await db.from("output_fractions").select("*").in("test_run_id", runIds)
        : { data: [] };
      const fractionIds = (fractions ?? []).map((f: { id: string }) => f.id);
      const { data: analyses } = fractionIds.length
        ? await db.from("fraction_analyses").select("*").in("output_fraction_id", fractionIds)
        : { data: [] };
      const analysisIds = (analyses ?? []).map((a: { id: string }) => a.id);
      const { data: results } = analysisIds.length
        ? await db.from("fraction_analysis_results").select("*").in("analysis_id", analysisIds)
        : { data: [] };

      const context = { series, runs, params, fractions, analyses, results };
      const prompt = `Optimiere die folgende DoE-Serie.

SERIE: ${series.code} — ${series.name} (${series.process_line})
Geplante Läufe: ${series.planned_runs}, dokumentiert: ${(runs ?? []).length}
Faktoren: ${JSON.stringify(series.factors)}
Antwortgrößen: ${(series.responses ?? []).join(", ")}

LÄUFE:
${table((runs ?? []).map((r: Record<string, unknown>) => ({ Nr: r.doe_run_number, Code: r.run_code, Status: r.status, Maschine: r.machine_name })))}

PARAMETER JE LAUF:
${table((params ?? []).map((p: Record<string, unknown>) => ({ Lauf: p.test_run_id, Parameter: p.parameter_key, Wert: p.value_numeric ?? p.value_text })))}

ERGEBNISSE:
${table((results ?? []).map((r: Record<string, unknown>) => ({ Analyse: r.analysis_id, Parameter: r.parameter_key, Wert: r.value_numeric, "in Spec": r.pass_fail })))}

Beantworte:
1. Welche Faktorkombination optimiert die Faserlänge bei akzeptablem Energieeintrag (< 350 kWh/t)? Nenne konkrete Stufen.
2. Welche Haupteffekte sind aus den vorhandenen Daten erkennbar, welche Wechselwirkungen sind zu vermuten?
3. Welche Läufe fehlen noch, um belastbar auszuwerten? Nenne sie als konkrete Faktorkombinationen.
4. Wo widersprechen die Daten der Erwartung?

Antworte als Markdown, max. 500 Wörter.`;
      return { prompt, context };
    }

    case "spec_conformity": {
      if (!scopeId) throw new Error("scopeId (output_fraction) fehlt.");
      const { data: fraction } = await db.from("output_fractions").select("*").eq("id", scopeId).single();
      if (!fraction) throw new Error("Fraktion nicht gefunden.");
      const { data: spec } = fraction.target_fraction_id
        ? await db.from("fraction_specs").select("*").eq("id", fraction.target_fraction_id).single()
        : { data: null };
      const { data: analyses } = await db.from("fraction_analyses").select("*").eq("output_fraction_id", scopeId);
      const analysisIds = (analyses ?? []).map((a: { id: string }) => a.id);
      const { data: results } = analysisIds.length
        ? await db.from("fraction_analysis_results").select("*").in("analysis_id", analysisIds)
        : { data: [] };

      const context = { fraction, spec, analyses, results };
      const prompt = `Prüfe die folgende Ausgangsfraktion gegen ihre Zielspezifikation.

FRAKTION: ${fraction.fraction_code} (Ziel ${fraction.target_fraction_id ?? "—"}), ${fraction.weight_kg} kg, Ausbeute ${fraction.yield_pct ?? "—"} %

SPEZIFIKATION:
${spec ? table([spec as Record<string, unknown>]) : "(keine Spezifikation hinterlegt)"}

MESSWERTE:
${table((results ?? []).map((r: Record<string, unknown>) => ({ Parameter: r.parameter_key, Wert: r.value_numeric, Einheit: r.unit, Min: r.spec_min, Max: r.spec_max, "in Spec": r.pass_fail })))}

Beantworte:
1. Ist die Fraktion freigabefähig? Klare Ja/Nein-Aussage.
2. Welche Parameter weichen ab und um wie viel?
3. Fachliche Erklärung der Abweichungen aus der Verfahrenstechnik.
4. Welche Anwendung ist mit diesen Werten realistisch — auch wenn es nicht die Zielanwendung ist?

Antworte als Markdown, max. 350 Wörter.`;
      return { prompt, context };
    }

    case "partner_followup": {
      const { data: partners } = await db.from("project_partners").select("*");
      const { data: contacts } = await db.from("project_contacts").select("*");
      const { data: comms } = await db.from("project_communications").select("*").order("occurred_at", { ascending: false }).limit(200);
      const context = { partners, contacts, comms };
      const prompt = `Prüfe den Kontaktstand zu allen Projektpartnern.

PARTNER:
${table((partners ?? []).map((p: Record<string, unknown>) => ({ Name: p.name, Kategorie: p.category, Status: p.status, Fix: p.is_fixed_partner, Rating: p.suitability_rating })))}

KONTAKTE MIT NÄCHSTER AKTION:
${table((contacts ?? []).map((c: Record<string, unknown>) => ({ Name: c.name, Partner: c.partner_id, "Letzter Kontakt": c.last_contact_date, "Nächste Aktion": c.next_action, Fällig: c.next_action_date })))}

KOMMUNIKATIONSVERLAUF (neueste zuerst):
${table((comms ?? []).slice(0, 40).map((c: Record<string, unknown>) => ({ Datum: c.occurred_at, Partner: c.partner_id, Richtung: c.direction, Kanal: c.channel, Betreff: c.subject })))}

Beantworte:
1. Bei welchen Partnern ist zu lange nichts passiert? Priorisiert, mit Begründung.
2. Welche Fixpartner (Siempelkamp, Optiplan, Lamilux, Koch CC, TU Dresden, TU Freiberg) brauchen dringend eine Aktion?
3. Formuliere für die drei dringendsten Fälle je einen Zweizeiler als Aufhänger für die Nachfassmail.

Antworte als Markdown, max. 400 Wörter.`;
      return { prompt, context };
    }

    case "risk_scan": {
      const { data: risks } = await db.from("project_risks").select("*");
      const { data: tasks } = await db.from("project_tasks").select("*");
      const { data: runs } = await db.from("test_runs").select("*");
      const context = { risks, tasks, runs };
      const prompt = `Scanne den Projektzustand auf Risiken.

BESTEHENDE RISIKEN:
${table((risks ?? []).map((r: Record<string, unknown>) => ({ Titel: r.title, Kategorie: r.category, W: r.probability, A: r.impact, Severity: r.severity, Status: r.status })))}

AUFGABEN:
${table((tasks ?? []).map((t: Record<string, unknown>) => ({ Code: t.code, Titel: t.title, Status: t.status, Priorität: t.priority, Fällig: t.due_date, Blocker: t.blocker_reason })))}

VERSUCHSLÄUFE:
${table((runs ?? []).map((r: Record<string, unknown>) => ({ Code: r.run_code, Status: r.status, Linie: r.process_line, Datum: r.actual_date ?? r.planned_date })))}

Beantworte:
1. Welche NEUEN Risiken sind aus dem aktuellen Projektzustand ableitbar? Je Risiko: Titel, Kategorie, Eintrittswahrscheinlichkeit 1–5, Auswirkung 1–5, Gegenmaßnahme.
2. Welche bestehenden Risiken haben sich verschärft?
3. Ist die Patentanmeldung (P0-2) gefährdet?

Antworte als Markdown, max. 400 Wörter.`;
      return { prompt, context };
    }

    case "weekly_report":
    case "daily_briefing":
    case "next_actions":
    default: {
      const { data: phases } = await db.from("project_phases").select("*").order("order_num");
      const { data: tasks } = await db.from("project_tasks").select("*");
      const { data: deps } = await db.from("project_task_dependencies").select("*");
      const { data: runs } = await db.from("test_runs").select("*").order("planned_date", { ascending: false }).limit(30);
      const { data: batches } = await db.from("material_batches").select("*");
      const { data: fractions } = await db.from("output_fractions").select("*");
      const { data: risks } = await db.from("project_risks").select("*").order("severity", { ascending: false }).limit(10);
      const { data: recentRuns } = await db.from("test_runs").select("*").gte("updated_at", since);
      const { data: recentTasks } = await db.from("project_tasks").select("*").gte("updated_at", since);

      const context = { phases, tasks, deps, runs, batches, fractions, risks, recentRuns, recentTasks, since };

      const shared = `PHASEN:
${table((phases ?? []).map((p: Record<string, unknown>) => ({ Code: p.code, Name: p.name, Status: p.status })))}

OFFENE AUFGABEN:
${table((tasks ?? []).filter((t: Record<string, unknown>) => t.status !== "done" && t.status !== "skipped").map((t: Record<string, unknown>) => ({ Code: t.code, Titel: t.title, Status: t.status, Priorität: t.priority, Fällig: t.due_date, Blocker: t.blocker_reason })))}

VERSUCHSLÄUFE:
${table((runs ?? []).map((r: Record<string, unknown>) => ({ Code: r.run_code, Titel: r.title, Status: r.status, Linie: r.process_line, Datum: r.actual_date ?? r.planned_date })))}

MATERIALBESTAND:
${table((batches ?? []).map((b: Record<string, unknown>) => ({ Charge: b.batch_code, Klasse: b.material_class, kg: b.weight_kg, Status: b.status })))}

FRAKTIONSBESTAND:
${table((fractions ?? []).map((f: Record<string, unknown>) => ({ Code: f.fraction_code, Ziel: f.target_fraction_id, kg: f.weight_kg, Status: f.status, Freigegeben: f.released_for_product_test })))}

TOP-RISIKEN:
${table((risks ?? []).map((r: Record<string, unknown>) => ({ Titel: r.title, Severity: r.severity, Status: r.status })))}`;

      if (type === "next_actions") {
        return {
          prompt: `${shared}

ABHÄNGIGKEITEN (task -> Vorgänger):
${table((deps ?? []) as Record<string, unknown>[])}

Erstelle eine priorisierte Liste der nächsten 7 Handlungen. Berücksichtige Abhängigkeiten,
Fälligkeiten und die IP-Sperre (Phase-2-Aufgaben erst nach P0-2). Je Handlung: Aufgabencode,
was konkret zu tun ist, warum jetzt, und was sie freischaltet. Antworte als Markdown-Liste.`,
          context,
        };
      }

      if (type === "weekly_report") {
        return {
          prompt: `${shared}

SEIT ${since} GEÄNDERTE VERSUCHSLÄUFE:
${table((recentRuns ?? []).map((r: Record<string, unknown>) => ({ Code: r.run_code, Status: r.status, Zusammenfassung: r.summary })))}

SEIT ${since} GEÄNDERTE AUFGABEN:
${table((recentTasks ?? []).map((t: Record<string, unknown>) => ({ Code: t.code, Titel: t.title, Status: t.status })))}

Schreibe einen Wochenbericht: Rückblick auf die vergangene Woche, aktueller Projektstand
je Phase, Ausblick auf die kommende Woche, Entscheidungsbedarf. Der Text soll ohne
Nacharbeit an Partner und Investoren weitergeleitet werden können. Antworte als Markdown,
max. 600 Wörter.`,
          context,
        };
      }

      return {
        prompt: `${shared}

SEIT ${since} GEÄNDERT — VERSUCHSLÄUFE:
${table((recentRuns ?? []).map((r: Record<string, unknown>) => ({ Code: r.run_code, Status: r.status })))}
AUFGABEN:
${table((recentTasks ?? []).map((t: Record<string, unknown>) => ({ Code: t.code, Status: t.status })))}

Erstelle das Tages-Briefing: Was ist seit gestern passiert, was ist heute dran, worauf ist
zu achten. Maximal 300 Wörter, Markdown, am Ende drei priorisierte Handlungsempfehlungen.`,
        context,
      };
    }
  }
}

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

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: isStaff } = await userClient.rpc("is_internal_staff", { _user_id: user.id });
    if (!isStaff) return json({ error: "Nur interne Mitarbeiter dürfen KI-Auswertungen anfordern." }, 403);

    const body = await req.json().catch(() => ({}));
    const analysisType = body.analysisType as AnalysisType;
    const scopeId: string | null = body.scopeId ?? null;
    const scopeType: string = body.scopeType ?? "global";

    if (!ANALYSIS_TYPES.includes(analysisType)) {
      return json({ error: `Unbekannter Auswertungstyp: ${analysisType}` }, 400);
    }

    const db = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { prompt, context } = await buildContext(db, analysisType, scopeId);
    const result = await callModel(prompt);

    const { data: stored, error: storeError } = await db
      .from("ai_analyses")
      .insert({
        analysis_type: analysisType,
        scope_type: scopeType,
        scope_id: scopeId,
        input_context: { prompt, ...context },
        output_md: result.text,
        confidence: result.text.length > 400 ? "high" : "medium",
        model: result.model,
        tokens_used: result.tokens,
        created_for_user: user.id,
      })
      .select()
      .single();

    if (storeError) throw new Error(storeError.message);

    // Write the interpretation back onto the analysed record so it is visible
    // in context, not only in the AI log.
    if (analysisType === "test_interpretation" && scopeId) {
      await db.from("test_runs")
        .update({ ai_interpretation: result.text, ai_interpreted_at: new Date().toISOString() })
        .eq("id", scopeId);
    }
    if (analysisType === "spec_conformity" && scopeId) {
      await db.from("fraction_analyses")
        .update({ ai_interpretation: result.text, ai_interpreted_at: new Date().toISOString() })
        .eq("output_fraction_id", scopeId);
    }

    await db.from("notifications").insert({
      user_id: user.id,
      title: "Neue KI-Auswertung",
      message: `${analysisType} wurde erstellt.`,
      type: "info",
      link: "/projekt/ki",
      related_id: stored.id,
    });

    return json({ success: true, analysis: stored });
  } catch (error: unknown) {
    console.error("project-ai error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
