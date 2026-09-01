import { ANALYSIS_PARAMETER_KEYS, GO_NO_GO } from "./constants";
import type { AnalysisResult, FractionSpec } from "./types";

export type ConformityLevel = "pass" | "borderline" | "fail" | "unknown";

export interface ParameterVerdict {
  parameterKey: string;
  label: string;
  unit: string;
  value: number | null;
  specMin: number | null;
  specMax: number | null;
  level: ConformityLevel;
  /** How far outside (or inside) the window, in percent of the window. */
  note: string;
}

const BORDERLINE_MARGIN = 0.1; // within 10 % of a limit counts as borderline

export function parameterLabel(key: string): { label: string; unit: string } {
  const entry = ANALYSIS_PARAMETER_KEYS.find((p) => p.key === key);
  return { label: entry?.label ?? key, unit: entry?.unit ?? "" };
}

/**
 * Derive the target window for a parameter from the fraction spec.
 * Mirrors the database trigger evaluate_analysis_result() so the UI can show
 * a verdict before the row round-trips.
 */
export function specWindow(
  parameterKey: string,
  spec: FractionSpec | null | undefined,
): { min: number | null; max: number | null } {
  if (!spec) {
    if (parameterKey === "energy_kwh_t") return { min: null, max: GO_NO_GO.energyMaxKwhPerTon };
    return { min: null, max: null };
  }
  switch (parameterKey) {
    case "fiber_length_median_mm":
      return { min: spec.fiber_length_min_mm, max: spec.fiber_length_max_mm };
    case "glass_content_pct":
      return { min: spec.glass_content_min_pct, max: null };
    case "moisture_pct":
      return { min: null, max: spec.moisture_max_pct };
    case "fines_below_05mm_pct":
      return { min: null, max: spec.fines_max_pct };
    case "energy_kwh_t":
      return { min: null, max: GO_NO_GO.energyMaxKwhPerTon };
    default:
      return { min: null, max: null };
  }
}

export function evaluateResult(
  result: Pick<AnalysisResult, "parameter_key" | "value_numeric" | "spec_min" | "spec_max">,
  spec: FractionSpec | null | undefined,
): ParameterVerdict {
  const { label, unit } = parameterLabel(result.parameter_key);
  const derived = specWindow(result.parameter_key, spec);
  const min = result.spec_min ?? derived.min;
  const max = result.spec_max ?? derived.max;
  const value = result.value_numeric;

  if (value === null || value === undefined || (min === null && max === null)) {
    return { parameterKey: result.parameter_key, label, unit, value, specMin: min, specMax: max, level: "unknown", note: "keine Sollwerte hinterlegt" };
  }

  const belowMin = min !== null && value < min;
  const aboveMax = max !== null && value > max;

  if (belowMin || aboveMax) {
    const limit = belowMin ? min! : max!;
    const deviation = limit === 0 ? 100 : Math.abs(((value - limit) / limit) * 100);
    return {
      parameterKey: result.parameter_key, label, unit, value, specMin: min, specMax: max,
      level: "fail",
      note: `${deviation.toFixed(1)} % ${belowMin ? "unter" : "über"} Grenzwert ${limit}`,
    };
  }

  // inside the window - how close to an edge?
  const distances: number[] = [];
  if (min !== null && min !== 0) distances.push(Math.abs((value - min) / min));
  if (max !== null && max !== 0) distances.push(Math.abs((max - value) / max));
  const closest = distances.length ? Math.min(...distances) : 1;

  if (closest <= BORDERLINE_MARGIN) {
    return { parameterKey: result.parameter_key, label, unit, value, specMin: min, specMax: max, level: "borderline", note: "grenzwertig" };
  }
  return { parameterKey: result.parameter_key, label, unit, value, specMin: min, specMax: max, level: "pass", note: "in Spezifikation" };
}

/** Traffic light for a whole fraction: worst parameter wins. */
export function conformityOf(verdicts: ParameterVerdict[]): ConformityLevel {
  if (!verdicts.length) return "unknown";
  if (verdicts.some((v) => v.level === "fail")) return "fail";
  if (verdicts.some((v) => v.level === "borderline")) return "borderline";
  if (verdicts.some((v) => v.level === "pass")) return "pass";
  return "unknown";
}

export const CONFORMITY_META: Record<ConformityLevel, { label: string; className: string; dot: string }> = {
  pass: { label: "In Spec", className: "bg-success/10 text-success border-success/20", dot: "bg-success" },
  borderline: { label: "Grenzwertig", className: "bg-warning/10 text-warning border-warning/20", dot: "bg-warning" },
  fail: { label: "Außerhalb", className: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
  unknown: { label: "Keine Daten", className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
};

/** Go / No-Go breaches from the specification. */
export function goNoGoBreaches(results: Pick<AnalysisResult, "parameter_key" | "value_numeric">[]): string[] {
  const breaches: string[] = [];
  for (const r of results) {
    if (r.value_numeric === null || r.value_numeric === undefined) continue;
    if (r.parameter_key === "fiber_length_median_mm" && r.value_numeric < GO_NO_GO.fiberLengthMedianMinMm) {
      breaches.push(`Faserlänge Median ${r.value_numeric} mm < ${GO_NO_GO.fiberLengthMedianMinMm} mm — Verfahren für diese Konfiguration ungeeignet`);
    }
    if (r.parameter_key === "energy_kwh_t" && r.value_numeric > GO_NO_GO.energyMaxKwhPerTon) {
      breaches.push(`Energieeintrag ${r.value_numeric} kWh/t > ${GO_NO_GO.energyMaxKwhPerTon} kWh/t — wirtschaftlich nicht darstellbar`);
    }
    if (r.parameter_key === "glass_content_pct" && r.value_numeric < GO_NO_GO.glassContentMinPct) {
      breaches.push(`Glasgehalt ${r.value_numeric} % < ${GO_NO_GO.glassContentMinPct} % — Compoundeure verlieren Interesse`);
    }
  }
  return breaches;
}
