import { AlertTriangle, Check, Minus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
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
  Partner,
  TestRun,
} from "@/lib/project/types";
import { ConformityBadge, formatNumber } from "@/components/project/ProjectUI";

/** Radix Select forbids an empty string value - this is the "nothing selected" sentinel. */
export const NONE = "__none__";

/**
 * The mandatory analytics set of the specification (section 1.6). Every test
 * run has to end with these eight numbers - the UI shows what is still missing.
 */
export const MANDATORY_PARAMETER_KEYS: string[] = [
  "fiber_length_median_mm",
  "glass_content_pct",
  "moisture_pct",
  "bulk_density_gl",
  "fines_below_05mm_pct",
  "energy_kwh_t",
  "tool_wear_g_t",
  "metal_ppm",
];

const PARAMETER_ORDER = new Map(ANALYSIS_PARAMETER_KEYS.map((entry, index) => [entry.key as string, index]));

export function parameterMeta(key: string): { label: string; unit: string; method: string } {
  const entry = ANALYSIS_PARAMETER_KEYS.find((p) => p.key === key);
  return {
    label: entry?.label ?? key,
    unit: entry?.unit ?? "",
    method: entry?.method ?? "",
  };
}

export function parameterSortIndex(key: string): number {
  return PARAMETER_ORDER.get(key) ?? 999;
}

/** "3,0 mm" - a value with its unit, "—" when there is no value. */
export function formatValueWithUnit(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "—";
  return unit ? `${formatNumber(value, 3)} ${unit}` : formatNumber(value, 3);
}

/** "≥ 50 %", "≤ 2 %", "3 – 12 mm" or "—" when the spec defines no window. */
export function formatSpecWindow(min: number | null, max: number | null, unit: string): string {
  const suffix = unit ? ` ${unit}` : "";
  if (min !== null && max !== null) return `${formatNumber(min, 3)} – ${formatNumber(max, 3)}${suffix}`;
  if (min !== null) return `≥ ${formatNumber(min, 3)}${suffix}`;
  if (max !== null) return `≤ ${formatNumber(max, 3)}${suffix}`;
  return "—";
}

/** German decimal input ("0,35") to a number. Returns undefined for invalid text. */
export function parseDecimal(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function fractionLabel(fraction: OutputFraction | null): string {
  if (!fraction) return "—";
  return fraction.target_fraction_id
    ? `${fraction.fraction_code} · ${fraction.target_fraction_id}`
    : fraction.fraction_code;
}

/** Everything one row of the analysis list needs, resolved once per data change. */
export interface AnalysisView {
  analysis: FractionAnalysis;
  fraction: OutputFraction | null;
  spec: FractionSpec | null;
  lab: Partner | null;
  run: TestRun | null;
  results: AnalysisResult[];
  verdicts: ParameterVerdict[];
  /** Parameters that can be judged against a spec window. */
  evaluableCount: number;
  /** Of those, the ones inside the window. */
  inSpecCount: number;
  level: ConformityLevel;
  breaches: string[];
  presentKeys: Set<string>;
  missingMandatory: string[];
}

export function buildAnalysisViews(args: {
  analyses: FractionAnalysis[];
  fractions: OutputFraction[];
  specs: FractionSpec[];
  partners: Partner[];
  runs: TestRun[];
  results: AnalysisResult[];
}): AnalysisView[] {
  const fractionById = new Map(args.fractions.map((f) => [f.id, f]));
  const specById = new Map(args.specs.map((s) => [s.id, s]));
  const partnerById = new Map(args.partners.map((p) => [p.id, p]));
  const runById = new Map(args.runs.map((r) => [r.id, r]));

  const resultsByAnalysis = new Map<string, AnalysisResult[]>();
  args.results.forEach((result) => {
    const bucket = resultsByAnalysis.get(result.analysis_id);
    if (bucket) bucket.push(result);
    else resultsByAnalysis.set(result.analysis_id, [result]);
  });

  return args.analyses.map((analysis) => {
    const fraction = analysis.output_fraction_id ? fractionById.get(analysis.output_fraction_id) ?? null : null;
    const spec = fraction?.target_fraction_id ? specById.get(fraction.target_fraction_id) ?? null : null;
    const lab = analysis.lab_partner_id ? partnerById.get(analysis.lab_partner_id) ?? null : null;
    const run = fraction?.test_run_id ? runById.get(fraction.test_run_id) ?? null : null;

    const results = [...(resultsByAnalysis.get(analysis.id) ?? [])].sort(
      (a, b) => parameterSortIndex(a.parameter_key) - parameterSortIndex(b.parameter_key),
    );
    const verdicts = results.map((result) => evaluateResult(result, spec));
    const evaluable = verdicts.filter((v) => v.level !== "unknown");
    const inSpecCount = evaluable.filter((v) => v.level === "pass" || v.level === "borderline").length;
    const presentKeys = new Set(
      results.filter((r) => r.value_numeric !== null || (r.value_text ?? "").trim() !== "").map((r) => r.parameter_key),
    );

    return {
      analysis,
      fraction,
      spec,
      lab,
      run,
      results,
      verdicts,
      evaluableCount: evaluable.length,
      inSpecCount,
      level: conformityOf(verdicts),
      breaches: goNoGoBreaches(results),
      presentKeys,
      missingMandatory: MANDATORY_PARAMETER_KEYS.filter((key) => !presentKeys.has(key)),
    };
  });
}

/** The hard thresholds of the specification - never soften this alert. */
export function GoNoGoAlert({ breaches, className }: { breaches: string[]; className?: string }) {
  if (!breaches.length) return null;
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Go/No-Go-Kriterium verletzt</AlertTitle>
      <AlertDescription className="text-sm">
        <ul className="space-y-1 mt-1">
          {breaches.map((breach) => (
            <li key={breach} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{breach}</span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function MandatoryChecklist({
  presentKeys,
  className,
}: {
  presentKeys: Set<string>;
  className?: string;
}) {
  const done = MANDATORY_PARAMETER_KEYS.filter((key) => presentKeys.has(key)).length;
  const total = MANDATORY_PARAMETER_KEYS.length;
  const complete = done === total;

  return (
    <div className={cn("rounded-lg border border-border p-3", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-medium">Pflichtparameter der Spezifikation</p>
        <span className={cn("text-xs font-semibold shrink-0", complete ? "text-success" : "text-warning")}>
          {done} / {total}
        </span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {MANDATORY_PARAMETER_KEYS.map((key) => {
          const meta = parameterMeta(key);
          const ok = presentKeys.has(key);
          return (
            <li key={key} className="flex items-start gap-2 text-xs">
              {ok ? (
                <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" aria-hidden />
              ) : (
                <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
              )}
              <span className={ok ? "text-foreground" : "text-muted-foreground"}>
                {meta.label}
                {meta.unit ? <span className="text-muted-foreground"> ({meta.unit})</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {!complete && (
        <p className="text-xs text-muted-foreground mt-2">
          Ohne den vollständigen Satz ist der Versuch nicht bewertbar — {total - done} Wert
          {total - done === 1 ? "" : "e"} fehlen noch.
        </p>
      )}
    </div>
  );
}

/** Parameter / value / spec window / verdict - readable at 360 px. */
export function VerdictList({ verdicts }: { verdicts: ParameterVerdict[] }) {
  if (!verdicts.length) {
    return <p className="text-sm text-muted-foreground">Noch keine Messwerte erfasst.</p>;
  }
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {verdicts.map((verdict) => (
        <div key={verdict.parameterKey} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{verdict.label}</p>
            <p className="text-xs text-muted-foreground">
              Soll {formatSpecWindow(verdict.specMin, verdict.specMax, verdict.unit)} · {verdict.note}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-mono">{formatValueWithUnit(verdict.value, verdict.unit)}</span>
            <ConformityBadge level={verdict.level} />
          </div>
        </div>
      ))}
    </div>
  );
}
