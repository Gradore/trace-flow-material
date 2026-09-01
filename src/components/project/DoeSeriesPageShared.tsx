/**
 * Shared domain logic for the DoE module (statistical design of experiments).
 *
 * Everything in here is pure: plan generation from the stored factors, the
 * join from a test run to its measured responses and the CSV serialisation.
 * The React components in DoeSeriesPage*.tsx only render what these helpers
 * return.
 */
import {
  DOE_RESPONSE_KEYS,
  GO_NO_GO,
  TEST_RUN_PARAMETER_KEYS,
} from "@/lib/project/constants";
import { parameterLabel } from "@/lib/project/spec";
import { formatNumber } from "@/components/project/ProjectUI";
import type {
  AnalysisResult,
  DoeFactor,
  FractionAnalysis,
  OutputFraction,
  TestRun,
  TestRunParameter,
} from "@/lib/project/types";

/** Derived from TEST_RUN_STATUSES in constants.ts - see there. */
export { DOE_SERIES_STATUSES } from "@/lib/project/constants";

export const DESIGN_TYPES = [
  {
    id: "full_factorial",
    label: "Vollfaktoriell",
    note: "Alle Kombinationen aller Faktorstufen.",
  },
  {
    id: "fractional_factorial",
    label: "Teilfaktoriell",
    note: "Jede k-te Kombination, bis genau die geplante Laufzahl erreicht ist.",
  },
] as const;

/** Rows beyond this are not rendered - a phone cannot work with more. */
export const MAX_PLAN_ROWS = 200;

/**
 * Keys whose value is not measured in the lab but recorded at the machine
 * (test_run_parameters), e.g. throughput_kgh. DOE_RESPONSE_KEYS only *offers*
 * throughput_kgh, but a series may already have another machine key stored in
 * doe_series.responses - that one has to resolve to its value too.
 */
const PARAMETER_RESPONSE_KEYS = new Set<string>(
  TEST_RUN_PARAMETER_KEYS.filter((entry) => entry.numeric).map((entry) => entry.key),
);

/** A level needs this many completed runs before it is charted. */
export const MIN_RUNS_PER_LEVEL = 2;

/** Hard project limits, drawn as a reference line into the effect charts. */
export const RESPONSE_LIMITS: Record<
  string,
  { value: number; kind: "min" | "max"; label: string }
> = {
  fiber_length_median_mm: {
    value: GO_NO_GO.fiberLengthMedianMinMm,
    kind: "min",
    label: `Go/No-Go ${GO_NO_GO.fiberLengthMedianMinMm} mm`,
  },
  energy_kwh_t: {
    value: GO_NO_GO.energyMaxKwhPerTon,
    kind: "max",
    label: `Go/No-Go ${GO_NO_GO.energyMaxKwhPerTon} kWh/t`,
  },
  glass_content_pct: {
    value: GO_NO_GO.glassContentMinPct,
    kind: "min",
    label: `Go/No-Go ${GO_NO_GO.glassContentMinPct} %`,
  },
};

export type LevelValue = string | number;

export interface PlanRow {
  /** 1-based position within the plan - written to test_runs.doe_run_number. */
  runNumber: number;
  /** Index within the full factorial enumeration. */
  comboIndex: number;
  /** One level per factor, aligned with PlanResult.factors. */
  levels: LevelValue[];
}

export interface PlanResult {
  /** Factors that actually carry levels - the plan columns. */
  factors: DoeFactor[];
  rows: PlanRow[];
  /** Size of the complete factorial design. */
  totalCombinations: number;
  /** How many rows the design asks for before the display cap. */
  requestedRows: number;
  /** True when requestedRows had to be cut down to MAX_PLAN_ROWS. */
  capped: boolean;
  /** Distance between two taken combinations (1 = full factorial). */
  step: number;
  /** The design is so large that it cannot be enumerated safely. */
  tooLarge: boolean;
}

export function combinationCount(factors: DoeFactor[]): number {
  return factors.reduce((total, factor) => total * Math.max(factor.levels.length, 1), 1);
}

/** Decodes a combination index as a mixed-radix number (last factor fastest). */
function combinationAt(factors: DoeFactor[], index: number): LevelValue[] {
  const values: LevelValue[] = new Array(factors.length).fill("");
  let rest = index;
  for (let i = factors.length - 1; i >= 0; i -= 1) {
    const levels = factors[i].levels;
    const size = Math.max(levels.length, 1);
    const position = rest % size;
    rest = Math.floor(rest / size);
    values[i] = levels.length ? levels[position] : "";
  }
  return values;
}

/**
 * Builds the run plan from the stored factors.
 *
 * full_factorial       - every combination, in standard order.
 * fractional_factorial - every k-th combination with k = floor(total / planned),
 *                        which yields exactly `plannedRuns` rows.
 */
export function buildPlan(
  factors: DoeFactor[],
  designType: string,
  plannedRuns: number,
): PlanResult {
  const usable = factors.filter((factor) => factor.levels.length > 0);
  const empty: PlanResult = {
    factors: usable,
    rows: [],
    totalCombinations: 0,
    requestedRows: 0,
    capped: false,
    step: 1,
    tooLarge: false,
  };
  if (!usable.length) return empty;

  const total = combinationCount(usable);
  if (!Number.isSafeInteger(total) || total <= 0) {
    return { ...empty, totalCombinations: Number.isFinite(total) ? total : 0, tooLarge: true };
  }
  if (total > 1_000_000) {
    return { ...empty, totalCombinations: total, tooLarge: true };
  }

  const fractional =
    designType === "fractional_factorial" && plannedRuns > 0 && plannedRuns < total;
  const step = fractional ? Math.max(1, Math.floor(total / plannedRuns)) : 1;
  const requestedRows = fractional ? plannedRuns : total;
  const shown = Math.min(requestedRows, MAX_PLAN_ROWS);

  const rows: PlanRow[] = Array.from({ length: shown }, (_, i) => {
    const comboIndex = i * step;
    return { runNumber: i + 1, comboIndex, levels: combinationAt(usable, comboIndex) };
  });

  return {
    factors: usable,
    rows,
    totalCombinations: total,
    requestedRows,
    capped: requestedRows > MAX_PLAN_ROWS,
    step,
    tooLarge: false,
  };
}

/** "0.1, 0.3, ohne" -> [0.1, 0.3, "ohne"]. Comma separates, the point is decimal. */
export function parseLevelInput(raw: string): LevelValue[] {
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => {
      const parsed = Number(token);
      return Number.isFinite(parsed) ? parsed : token;
    });
}

/** Inverse of parseLevelInput, for the factor editor. */
export function levelsToInput(levels: LevelValue[]): string {
  return levels.map((level) => (typeof level === "number" ? String(level) : level)).join(", ");
}

/**
 * Normalised comparison key so a planned level matches a stored parameter.
 * doe_series.factors is jsonb, so a level can be anything - never assume a
 * string method is available on it.
 */
export function levelKey(value: LevelValue | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value.trim();
  return String(value);
}

/** German display of a factor level. */
export function formatLevel(value: LevelValue | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isFinite(value) ? formatNumber(value, 3) : "—";
  if (typeof value === "string") return value.trim().length ? value : "—";
  return String(value);
}

export function factorTitle(factor: DoeFactor): string {
  return factor.unit && factor.unit.trim().length
    ? `${factor.label} (${factor.unit})`
    : factor.label;
}

export interface ResponseStat {
  mean: number;
  count: number;
}

export interface RunData {
  run: TestRun;
  /** parameter_key -> the level actually set for this run. */
  levels: Map<string, LevelValue>;
  /**
   * parameter_key -> mean of all analysis results of this run, or the value
   * recorded at the machine when the key is a test_run_parameters response.
   */
  responses: Map<string, ResponseStat>;
  fractionCount: number;
  analysisCount: number;
}

export interface RunDataInput {
  runs: TestRun[];
  parameters: TestRunParameter[];
  fractions: OutputFraction[];
  analyses: FractionAnalysis[];
  results: AnalysisResult[];
  /** Restrict the response join to one target fraction (F1 ... F5). */
  targetFractionId: string | null;
}

/**
 * Joins test_runs -> test_run_parameters (the factor levels and the machine-side
 * responses such as throughput_kgh) and test_runs -> output_fractions ->
 * fraction_analyses -> fraction_analysis_results (the measured responses).
 * Several fractions per run are averaged; the number of contributing
 * measurements is kept so the UI can be honest about it. A key measured in the
 * lab wins over the machine value of the same key.
 */
export function buildRunData(input: RunDataInput): Map<string, RunData> {
  const byRun = new Map<string, RunData>();
  input.runs.forEach((run) => {
    byRun.set(run.id, {
      run,
      levels: new Map<string, LevelValue>(),
      responses: new Map<string, ResponseStat>(),
      fractionCount: 0,
      analysisCount: 0,
    });
  });

  input.parameters.forEach((parameter) => {
    const entry = byRun.get(parameter.test_run_id);
    if (!entry) return;
    const value: LevelValue | null =
      parameter.value_numeric !== null && parameter.value_numeric !== undefined
        ? parameter.value_numeric
        : parameter.value_text;
    if (value === null || value === undefined) return;
    entry.levels.set(parameter.parameter_key, value);
    /* Machine-side responses (throughput etc.) never reach the lab tables. */
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      PARAMETER_RESPONSE_KEYS.has(parameter.parameter_key)
    ) {
      entry.responses.set(parameter.parameter_key, { mean: value, count: 1 });
    }
  });

  const fractionToRun = new Map<string, string>();
  input.fractions.forEach((fraction) => {
    if (!fraction.test_run_id) return;
    const entry = byRun.get(fraction.test_run_id);
    if (!entry) return;
    if (input.targetFractionId && fraction.target_fraction_id !== input.targetFractionId) return;
    fractionToRun.set(fraction.id, fraction.test_run_id);
    entry.fractionCount += 1;
  });

  const analysisToRun = new Map<string, string>();
  input.analyses.forEach((analysis) => {
    if (!analysis.output_fraction_id) return;
    const runId = fractionToRun.get(analysis.output_fraction_id);
    if (!runId) return;
    analysisToRun.set(analysis.id, runId);
    const entry = byRun.get(runId);
    if (entry) entry.analysisCount += 1;
  });

  const sums = new Map<string, { sum: number; count: number }>();
  input.results.forEach((result) => {
    if (result.value_numeric === null || result.value_numeric === undefined) return;
    const runId = analysisToRun.get(result.analysis_id);
    if (!runId) return;
    const key = `${runId} ${result.parameter_key}`;
    const current = sums.get(key) ?? { sum: 0, count: 0 };
    sums.set(key, { sum: current.sum + result.value_numeric, count: current.count + 1 });
  });

  sums.forEach((value, key) => {
    const separator = key.indexOf(" ");
    const runId = key.slice(0, separator);
    const parameterKey = key.slice(separator + 1);
    const entry = byRun.get(runId);
    if (!entry || value.count === 0) return;
    entry.responses.set(parameterKey, { mean: value.sum / value.count, count: value.count });
  });

  return byRun;
}

/* --------------------------------------------------------------------- CSV */

/** Decimal comma, no thousands separator - what German Excel expects. */
export function csvNumber(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return String(Number(value.toFixed(digits))).replace(".", ",");
}

export function csvLevel(value: LevelValue | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return csvNumber(value);
  return typeof value === "string" ? value : String(value);
}

function csvCell(value: string): string {
  if (/[";\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Semicolon separated, CRLF line endings, UTF-8 BOM for German Excel. */
export function buildCsv(rows: string[][]): string {
  const body = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------- response keys */

/**
 * The responses to evaluate: what the series declares, or - when nothing is
 * declared - every evaluable parameter that actually has measured data.
 */
export function resolveResponseKeys(
  declared: string[] | null | undefined,
  runData: Map<string, RunData>,
): string[] {
  const fromSeries = (declared ?? []).filter((key) => key.trim().length > 0);
  if (fromSeries.length) return fromSeries;
  const measured = new Set<string>();
  runData.forEach((entry) => {
    entry.responses.forEach((_value, key) => measured.add(key));
  });
  return DOE_RESPONSE_KEYS.filter((parameter) => measured.has(parameter.key)).map(
    (parameter) => parameter.key,
  );
}

/** Label and unit of a response - analytics parameter or machine parameter. */
function responseMeta(key: string): { label: string; unit: string } {
  const entry = DOE_RESPONSE_KEYS.find((item) => item.key === key);
  if (entry) return { label: entry.label, unit: entry.unit };
  /* A series may declare a machine parameter that is not offered as a response
   * any more - it still needs its German label instead of the bare key. */
  const machine = TEST_RUN_PARAMETER_KEYS.find((item) => item.key === key);
  if (machine) return { label: machine.label, unit: machine.unit };
  return parameterLabel(key);
}

/** "Faserlänge Median (mm)" */
export function responseTitle(key: string): string {
  const { label, unit } = responseMeta(key);
  return unit ? `${label} (${unit})` : label;
}

export function responseUnit(key: string): string {
  return responseMeta(key).unit;
}
