/**
 * Domain constants for the GFK recycling planning & test phase.
 * These values come from the project specification and are the factual
 * ground truth of the process - do not "improve" them.
 */

export const MATERIAL_CLASSES = [
  { id: "M1", label: "UP-Plattenware", resin: "UP", note: "Homogen, Referenzmaterial. Startmaterial: Optiplan, Lamilux" },
  { id: "M2", label: "SMC/BMC Pressreste", resin: "UP/VE", note: "Hoher Füllstoffanteil (CaCO₃) → Verschleißtest" },
  { id: "M3", label: "Pultrudat-Profile", resin: "UP/VE/EP", note: "Gerichtete Endlosfaser, hartzäh → Härtefall niedrige Drehzahl" },
  { id: "M4", label: "Sandwich mit Schaumkern", resin: "UP", note: "Kernmaterial muss abgetrennt werden" },
  { id: "M5", label: "Epoxid-Spezialverbund", resin: "EP", note: "Thermisch stabil, bevorzugt für High-Purity-Compound" },
  { id: "M6", label: "Boots-/Yachtlaminat", resin: "UP/VE", note: "Gemischte Laminate, Gelcoat" },
  { id: "M7", label: "GFK-Rohr / Tank", resin: "UP/VE", note: "Dickwandig, Vorzerkleinerung nötig. Kein Sandkern-Material!" },
] as const;

export type MaterialClassId = (typeof MATERIAL_CLASSES)[number]["id"];

export const RESIN_TYPES = ["UP", "VE", "EP", "unbekannt"] as const;

export const PROCESS_LINES = [
  {
    id: "A_baustoff",
    label: "Linie A — Baustoff",
    short: "Linie A",
    goal: "maximale Faserlänge",
    blades: "stumpf, Low-Impact",
    gap: "weit / unkritisch",
    screen: "groß oder keins",
    rpm: "~30 U/min",
    cooling: "Absaugung + Luft",
  },
  {
    id: "B_compound",
    label: "Linie B — Compound",
    short: "Linie B",
    goal: "definierte kurze Länge 3–5 mm",
    blades: "scharf, sauberer Schnitt",
    gap: "eng, 0,1–0,3 mm",
    screen: "5–6 mm Rundloch",
    rpm: "100–200 U/min",
    cooling: "Absaugung + ggf. Wasser (Schneidraum)",
  },
] as const;

export type ProcessLineId = (typeof PROCESS_LINES)[number]["id"];

/** The screen controls the length, not the rotor speed. */
export const PROCESS_RULE_OF_THUMB =
  "Das Sieb steuert die Länge, nicht die Drehzahl. Die Drehzahl ist der Hebel Durchsatz vs. Wärme/Feinanteil.";

export const MACHINE_TYPES = [
  { id: "shear_mill", label: "Schermühle" },
  { id: "granulator", label: "Granulator" },
  { id: "roller_crusher", label: "Walzenbrecher" },
  { id: "pre_shredder", label: "Vorzerkleinerer" },
  { id: "classifier", label: "Sichter" },
  { id: "screen", label: "Siebmaschine" },
  { id: "impact_benchmark", label: "Prallmühle (Benchmark)" },
] as const;

export const PARTNER_CATEGORIES = [
  { id: "machine_manufacturer", label: "Maschinenhersteller" },
  { id: "material_supplier", label: "Materiallieferant" },
  { id: "lab", label: "Labor" },
  { id: "research_institute", label: "Forschungsinstitut" },
  { id: "product_partner", label: "Produktpartner" },
  { id: "customer", label: "Kunde" },
  { id: "toll_processor", label: "Lohnverarbeiter" },
  { id: "consultant", label: "Berater" },
] as const;

export const PARTNER_STATUSES = [
  { id: "prospect", label: "Interessent", tone: "muted" },
  { id: "contacted", label: "Kontaktiert", tone: "info" },
  { id: "nda_signed", label: "NDA unterzeichnet", tone: "info" },
  { id: "testing", label: "Im Test", tone: "warning" },
  { id: "active_partner", label: "Aktiver Partner", tone: "success" },
  { id: "rejected", label: "Abgelehnt", tone: "destructive" },
  { id: "on_hold", label: "Zurückgestellt", tone: "muted" },
] as const;

export const TASK_STATUSES = [
  { id: "todo", label: "Offen", tone: "muted" },
  { id: "doing", label: "In Arbeit", tone: "info" },
  { id: "blocked", label: "Blockiert", tone: "destructive" },
  { id: "done", label: "Erledigt", tone: "success" },
  { id: "skipped", label: "Übersprungen", tone: "muted" },
] as const;

export const TASK_PRIORITIES = [
  { id: "critical", label: "Kritisch", tone: "destructive" },
  { id: "high", label: "Hoch", tone: "warning" },
  { id: "medium", label: "Mittel", tone: "info" },
  { id: "low", label: "Niedrig", tone: "muted" },
] as const;

export const PHASE_STATUSES = [
  { id: "not_started", label: "Nicht gestartet", tone: "muted" },
  { id: "in_progress", label: "Läuft", tone: "info" },
  { id: "blocked", label: "Blockiert", tone: "destructive" },
  { id: "completed", label: "Abgeschlossen", tone: "success" },
] as const;

export const TEST_RUN_STATUSES = [
  { id: "planned", label: "Geplant", tone: "muted" },
  { id: "running", label: "Läuft", tone: "info" },
  { id: "completed", label: "Abgeschlossen", tone: "success" },
  { id: "failed", label: "Fehlgeschlagen", tone: "destructive" },
  { id: "cancelled", label: "Abgebrochen", tone: "muted" },
] as const;

export const BATCH_STATUSES = [
  { id: "received", label: "Eingegangen", tone: "info" },
  { id: "in_test", label: "Im Versuch", tone: "warning" },
  { id: "consumed", label: "Verbraucht", tone: "muted" },
  { id: "archived", label: "Archiviert", tone: "muted" },
] as const;

export const FRACTION_STATUSES = [
  { id: "produced", label: "Hergestellt", tone: "info" },
  { id: "in_analysis", label: "In Analyse", tone: "warning" },
  { id: "released", label: "Freigegeben", tone: "success" },
  { id: "shipped", label: "Versendet", tone: "info" },
  { id: "rejected", label: "Gesperrt", tone: "destructive" },
] as const;

export const ANALYSIS_STATUSES = [
  { id: "ordered", label: "Beauftragt", tone: "muted" },
  { id: "in_progress", label: "In Bearbeitung", tone: "info" },
  { id: "completed", label: "Abgeschlossen", tone: "success" },
  { id: "failed", label: "Fehlgeschlagen", tone: "destructive" },
] as const;

export const ANALYSIS_METHODS = [
  "EN ISO 1172 (Glühverlust)",
  "Bildanalyse Faserlänge",
  "Siebanalyse",
  "DIN EN ISO 60 (Schüttdichte)",
  "Trocknungsverlust",
  "Leistungsmessung",
  "RFA / Magnetprüfung",
  "Wägung Verschleißteile",
] as const;

export const PRODUCT_TEST_CATEGORIES = [
  { id: "concrete", label: "Beton" },
  { id: "mortar", label: "Mörtel" },
  { id: "cement", label: "Zement" },
  { id: "polymer_concrete", label: "Polymerbeton" },
  { id: "compound_pp", label: "Compound PP-GF" },
  { id: "compound_pa6", label: "Compound PA6-GF" },
  { id: "asphalt", label: "Asphalt" },
] as const;

export const RISK_CATEGORIES = [
  { id: "technical", label: "Technisch" },
  { id: "ip", label: "Schutzrechte" },
  { id: "supplier", label: "Lieferant" },
  { id: "financial", label: "Wirtschaftlich" },
  { id: "regulatory", label: "Regulatorisch" },
  { id: "market", label: "Markt" },
  { id: "schedule", label: "Termine" },
] as const;

/** Machine parameters recorded per test run (the DoE factors). */
export const TEST_RUN_PARAMETER_KEYS = [
  { key: "rpm", label: "Rotordrehzahl", unit: "U/min", numeric: true },
  { key: "blade_edge_radius_mm", label: "Schneidkantenradius", unit: "mm", numeric: true },
  { key: "wedge_angle_deg", label: "Keilwinkel", unit: "°", numeric: true },
  { key: "cutting_gap_mm", label: "Schnittspalt Rotor/Stator", unit: "mm", numeric: true },
  { key: "screen_size_mm", label: "Sieblochung", unit: "mm", numeric: true },
  { key: "screen_type", label: "Siebtyp", unit: "", numeric: false },
  { key: "blade_condition", label: "Messerzustand", unit: "", numeric: false },
  { key: "air_velocity_ms", label: "Sichtergeschwindigkeit", unit: "m/s", numeric: true },
  { key: "throughput_kgh", label: "Durchsatz", unit: "kg/h", numeric: true },
  { key: "circumferential_speed_ms", label: "Umfangsgeschwindigkeit", unit: "m/s", numeric: true },
  { key: "cooling_type", label: "Kühlung", unit: "", numeric: false },
  { key: "wear_protection", label: "Verschleißschutz", unit: "", numeric: false },
] as const;

/** Mandatory analytics parameters per test run (section 1.6 of the spec). */
export const ANALYSIS_PARAMETER_KEYS = [
  { key: "fiber_length_median_mm", label: "Faserlänge Median", unit: "mm", method: "Bildanalyse Faserlänge" },
  { key: "fiber_length_d10_mm", label: "Faserlänge D10", unit: "mm", method: "Bildanalyse Faserlänge" },
  { key: "fiber_length_d50_mm", label: "Faserlänge D50", unit: "mm", method: "Bildanalyse Faserlänge" },
  { key: "fiber_length_d90_mm", label: "Faserlänge D90", unit: "mm", method: "Bildanalyse Faserlänge" },
  { key: "glass_content_pct", label: "Glasgehalt / Aschegehalt", unit: "%", method: "EN ISO 1172 (Glühverlust)" },
  { key: "moisture_pct", label: "Restfeuchte", unit: "%", method: "Trocknungsverlust" },
  { key: "bulk_density_gl", label: "Schüttdichte", unit: "g/l", method: "DIN EN ISO 60 (Schüttdichte)" },
  { key: "fines_below_05mm_pct", label: "Feinanteil < 0,5 mm", unit: "%", method: "Siebanalyse" },
  { key: "energy_kwh_t", label: "Spezifischer Energiebedarf", unit: "kWh/t", method: "Leistungsmessung" },
  { key: "tool_wear_g_t", label: "Werkzeugverschleiß", unit: "g/t", method: "Wägung Verschleißteile" },
  { key: "metal_ppm", label: "Fremdstoffe (Metall)", unit: "ppm", method: "RFA / Magnetprüfung" },
] as const;

export const PRODUCT_TEST_PARAMETER_KEYS = [
  { key: "flexural_strength_mpa", label: "Biegezugfestigkeit", unit: "MPa" },
  { key: "compressive_strength_mpa", label: "Druckfestigkeit", unit: "MPa" },
  { key: "tensile_strength_mpa", label: "Zugfestigkeit", unit: "MPa" },
  { key: "e_modulus_mpa", label: "E-Modul", unit: "MPa" },
  { key: "charpy_kj_m2", label: "Charpy-Kerbschlagzähigkeit", unit: "kJ/m²" },
  { key: "hdt_c", label: "HDT", unit: "°C" },
  { key: "shrinkage_pct", label: "Schwindung", unit: "%" },
  { key: "bond_strength_mpa", label: "Haftzugfestigkeit", unit: "MPa" },
] as const;

/** Hard go / no-go thresholds from the specification. */
export const GO_NO_GO = {
  fiberLengthMedianMinMm: 0.3,
  energyMaxKwhPerTon: 350,
  glassContentMinPct: 50,
} as const;

export const ECONOMICS = {
  gateFeeMinEurPerTon: 200,
  gateFeeMaxEurPerTon: 250,
  firstChannelMinEurPerTon: 1000,
  firstChannelMaxEurPerTon: 1200,
  targetCapacityTonsPerDay: 32,
  targetCapacityTonsPerYear: 8000,
} as const;

/** The task that gates every phase-2 activity. */
export const PATENT_TASK_CODE = "P0-2";
export const IP_WARNING =
  "Patent noch nicht eingereicht — Herstellerdemo gefährdet die Neuheit.";

export const DOSAGE_SERIES = [5, 10, 15, 20] as const;
export const CONCRETE_TEST_AGES_DAYS = [7, 28, 80] as const;

export const AI_ANALYSIS_TYPES = [
  { id: "daily_briefing", label: "Tages-Briefing" },
  { id: "test_interpretation", label: "Versuchsauswertung" },
  { id: "doe_optimization", label: "DoE-Optimierung" },
  { id: "next_actions", label: "Nächste Aktionen" },
  { id: "partner_followup", label: "Partner-Nachfassen" },
  { id: "spec_conformity", label: "Spec-Konformität" },
  { id: "risk_scan", label: "Risiko-Scan" },
  { id: "weekly_report", label: "Wochenbericht" },
] as const;

export const EMAIL_TEMPLATE_CATEGORIES = [
  { id: "material_request", label: "Materialanfrage" },
  { id: "trial_request", label: "Technikumsanfrage" },
  { id: "lab_order", label: "Analytik-Beauftragung" },
  { id: "product_test", label: "Produkttest" },
  { id: "science_coop", label: "Wissenschaft" },
  { id: "follow_up", label: "Nachfassen" },
  { id: "result_share", label: "Ergebnisübermittlung" },
] as const;

export function labelOf<T extends { id: string; label: string }>(
  list: readonly T[],
  id: string | null | undefined,
  fallback = "—",
): string {
  if (!id) return fallback;
  return list.find((entry) => entry.id === id)?.label ?? id;
}

export function toneOf(
  list: readonly { id: string; tone?: string }[],
  id: string | null | undefined,
): string {
  if (!id) return "muted";
  return list.find((entry) => entry.id === id)?.tone ?? "muted";
}
