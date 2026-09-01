/**
 * Shared derivation logic for the output fraction page.
 *
 * A fraction is only as good as its analytics: the traffic light, the release
 * eligibility and the customer datasheet all read from the same derived view so
 * the table, the dialogs and the PDF can never disagree with each other.
 */
import { ANALYSIS_PARAMETER_KEYS } from "@/lib/project/constants";
import {
  conformityOf,
  evaluateResult,
  goNoGoBreaches,
  type ConformityLevel,
  type ParameterVerdict,
} from "@/lib/project/spec";
import type {
  AnalysisResult,
  FractionAnalysis,
  FractionSpec,
  OutputFraction,
  ProductTest,
  ProductTestResult,
  TestRun,
} from "@/lib/project/types";

/** Everything the UI needs about one output fraction, derived once. */
export interface FractionView {
  fraction: OutputFraction;
  spec: FractionSpec | null;
  run: TestRun | null;
  /** All analyses of this fraction, newest first. */
  analyses: FractionAnalysis[];
  /** Analyses with status = completed - the evidence a release needs. */
  completedAnalyses: FractionAnalysis[];
  /** Latest measurement per parameter, from analyses that did not fail. */
  results: AnalysisResult[];
  verdicts: ParameterVerdict[];
  failingVerdicts: ParameterVerdict[];
  conformity: ConformityLevel;
  /** Hard specification breaches (fibre length, energy, glass content). */
  breaches: string[];
  productTests: ProductTest[];
  /** Stock value in EUR from the target price of the spec. */
  valueEur: number | null;
}

const PARAMETER_ORDER = new Map<string, number>(
  ANALYSIS_PARAMETER_KEYS.map((entry, index) => [entry.key, index]),
);

function groupBy<T, K>(rows: T[], key: (row: T) => K | null): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (k === null || k === undefined) continue;
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Keeps the most recent measurement per parameter key. */
function latestPerParameter(results: AnalysisResult[]): AnalysisResult[] {
  const latest = new Map<string, AnalysisResult>();
  for (const result of results) {
    const current = latest.get(result.parameter_key);
    if (!current || timestamp(result.measured_at) >= timestamp(current.measured_at)) {
      latest.set(result.parameter_key, result);
    }
  }
  return Array.from(latest.values()).sort(
    (a, b) =>
      (PARAMETER_ORDER.get(a.parameter_key) ?? 999) - (PARAMETER_ORDER.get(b.parameter_key) ?? 999) ||
      a.parameter_key.localeCompare(b.parameter_key),
  );
}

export interface BuildViewsArgs {
  fractions: OutputFraction[];
  specs: FractionSpec[];
  runs: TestRun[];
  analyses: FractionAnalysis[];
  analysisResults: AnalysisResult[];
  productTests: ProductTest[];
}

export function buildFractionViews({
  fractions,
  specs,
  runs,
  analyses,
  analysisResults,
  productTests,
}: BuildViewsArgs): FractionView[] {
  const specById = new Map(specs.map((spec) => [spec.id, spec]));
  const runById = new Map(runs.map((run) => [run.id, run]));
  const analysesByFraction = groupBy(analyses, (a) => a.output_fraction_id);
  const resultsByAnalysis = groupBy(analysisResults, (r) => r.analysis_id);
  const testsByFraction = groupBy(productTests, (t) => t.output_fraction_id);

  return fractions.map((fraction) => {
    const spec = fraction.target_fraction_id ? specById.get(fraction.target_fraction_id) ?? null : null;
    const run = fraction.test_run_id ? runById.get(fraction.test_run_id) ?? null : null;

    const fractionAnalyses = (analysesByFraction.get(fraction.id) ?? [])
      .slice()
      .sort((a, b) => timestamp(b.result_date ?? b.created_at) - timestamp(a.result_date ?? a.created_at));

    // A failed analysis is not evidence - its numbers must not colour the light.
    const usableResults = fractionAnalyses
      .filter((a) => a.status !== "failed")
      .flatMap((a) => resultsByAnalysis.get(a.id) ?? []);

    const results = latestPerParameter(usableResults);
    const verdicts = results.map((result) => evaluateResult(result, spec));
    const conformity = conformityOf(verdicts);

    const price = spec?.target_price_eur_t ?? null;
    const valueEur = price === null ? null : (fraction.weight_kg / 1000) * price;

    return {
      fraction,
      spec,
      run,
      analyses: fractionAnalyses,
      completedAnalyses: fractionAnalyses.filter((a) => a.status === "completed"),
      results,
      verdicts,
      failingVerdicts: verdicts.filter((v) => v.level === "fail"),
      conformity,
      breaches: goNoGoBreaches(results),
      productTests: testsByFraction.get(fraction.id) ?? [],
      valueEur,
    };
  });
}

export interface ReleaseEligibility {
  /** May the fraction be released at all? */
  allowed: boolean;
  /** Borderline results need an explicit confirmation from the user. */
  needsConfirmation: boolean;
  /** Why a release is impossible - shown verbatim in the dialog. */
  blockers: string[];
}

/**
 * Release rule from the specification: only 'pass' or 'borderline' fractions
 * with at least one completed analysis may go into product tests. 'borderline'
 * additionally requires an explicit confirmation.
 */
export function releaseEligibility(view: FractionView): ReleaseEligibility {
  const blockers: string[] = [];

  if (!view.fraction.target_fraction_id) {
    blockers.push("Der Fraktion ist keine Zielfraktion (F1–F5) zugeordnet — ohne Zielspezifikation ist keine Bewertung möglich.");
  }
  if (view.completedAnalyses.length === 0) {
    blockers.push("Keine abgeschlossene Analyse vorhanden — mindestens eine Analytik muss den Status „Abgeschlossen“ haben.");
  }
  if (view.conformity === "fail") {
    const params = view.failingVerdicts
      .map((v) => `${v.label} = ${formatVerdictValue(v)} (${v.note})`)
      .join("; ");
    blockers.push(`Spezifikation verletzt: ${params || "Parameter außerhalb der Zielspezifikation"}.`);
  }
  if (view.conformity === "unknown") {
    blockers.push("Keine Messwerte gegen die Zielspezifikation vorhanden — die Konformität ist unbekannt.");
  }

  return {
    allowed: blockers.length === 0,
    needsConfirmation: blockers.length === 0 && view.conformity === "borderline",
    blockers,
  };
}

/** Value of a verdict as plain text, for reasons and PDF cells. */
export function formatVerdictValue(verdict: ParameterVerdict): string {
  if (verdict.value === null || verdict.value === undefined) return "—";
  const formatted = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(verdict.value);
  return verdict.unit ? `${formatted} ${verdict.unit}` : formatted;
}

/** Target window of a verdict as plain text ("8–15 mm", "≥ 80 %", "≤ 0,5 %"). */
export function formatSpecWindow(verdict: ParameterVerdict): string {
  const fmt = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(value);
  const unit = verdict.unit ? ` ${verdict.unit}` : "";
  if (verdict.specMin !== null && verdict.specMax !== null) {
    return `${fmt(verdict.specMin)}–${fmt(verdict.specMax)}${unit}`;
  }
  if (verdict.specMin !== null) return `≥ ${fmt(verdict.specMin)}${unit}`;
  if (verdict.specMax !== null) return `≤ ${fmt(verdict.specMax)}${unit}`;
  return "—";
}

export const VERDICT_LABEL: Record<ConformityLevel, string> = {
  pass: "in Spec",
  borderline: "grenzwertig",
  fail: "außerhalb",
  unknown: "kein Sollwert",
};

/** Accepts German decimal input ("12,5") and returns null for empty input. */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Is the input either empty or a valid number? */
export function isDecimalInputValid(input: string): boolean {
  return input.trim() === "" || parseDecimal(input) !== null;
}

/** Numeric column value as a German-formatted editable string. */
export function decimalToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", ",");
}

/** Latest product test measurement per parameter, per compound category. */
export interface CompoundMeasurement {
  parameterKey: string;
  value: number;
  unit: string | null;
  testCode: string;
  dosagePct: number | null;
  measuredAt: string;
}

export function compoundMeasurements(
  view: FractionView,
  productTestResults: ProductTestResult[],
  category: "compound_pp" | "compound_pa6",
): Map<string, CompoundMeasurement> {
  const tests = view.productTests.filter((test) => test.category === category);
  const testById = new Map(tests.map((test) => [test.id, test]));
  const latest = new Map<string, CompoundMeasurement>();

  for (const result of productTestResults) {
    const test = testById.get(result.product_test_id);
    if (!test || result.value_numeric === null) continue;
    const current = latest.get(result.parameter_key);
    if (current && timestamp(current.measuredAt) > timestamp(result.measured_at)) continue;
    latest.set(result.parameter_key, {
      parameterKey: result.parameter_key,
      value: result.value_numeric,
      unit: result.unit,
      testCode: test.test_code,
      dosagePct: test.dosage_pct,
      measuredAt: result.measured_at,
    });
  }
  return latest;
}
