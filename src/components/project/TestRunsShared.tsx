import { cn } from "@/lib/utils";
import {
  PROCESS_LINES,
  PROCESS_RULE_OF_THUMB,
  TEST_RUN_PARAMETER_KEYS,
} from "@/lib/project/constants";
import type { DoeFactor, TestRunParameter } from "@/lib/project/types";

/** Sentinel values - Radix Select forbids an empty string as an item value. */
export const ALL = "__all__";
export const NONE = "__none__";

export type ParseResult = { ok: true; value: number | null } | { ok: false };

/** Accepts German (1.234,50) and plain (1234.5) decimal input. */
export function parseDecimal(raw: string, allowNegative = false): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const normalised = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalised);
  if (!Number.isFinite(parsed)) return { ok: false };
  if (!allowNegative && parsed < 0) return { ok: false };
  return { ok: true, value: parsed };
}

export function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/** ISO timestamp or date -> value for <input type="date">. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/** Renders a number back into a German-formatted editable string. */
export function toNumberInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", ",");
}

export interface ParameterMeta {
  key: string;
  label: string;
  unit: string;
  numeric: boolean;
}

const PARAMETER_META = new Map<string, ParameterMeta>(
  TEST_RUN_PARAMETER_KEYS.map((entry) => [
    entry.key,
    { key: entry.key, label: entry.label, unit: entry.unit, numeric: entry.numeric },
  ]),
);

/** Metadata for a parameter key - unknown keys stay usable but unlabelled. */
export function paramMeta(key: string): ParameterMeta {
  return PARAMETER_META.get(key) ?? { key, label: key, unit: "", numeric: false };
}

/** Display value of a stored parameter row, including its unit. */
export function formatParameterValue(param: {
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
}): string {
  if (param.value_numeric !== null) {
    const formatted = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(
      param.value_numeric,
    );
    return param.unit ? `${formatted} ${param.unit}` : formatted;
  }
  if (param.value_text) {
    return param.unit ? `${param.value_text} ${param.unit}` : param.value_text;
  }
  return "—";
}

export function sortParameters<T extends { parameter_key: string }>(rows: T[]): T[] {
  const order = new Map(TEST_RUN_PARAMETER_KEYS.map((entry, index) => [entry.key, index]));
  return [...rows].sort((a, b) => {
    const ai = order.get(a.parameter_key) ?? 999;
    const bi = order.get(b.parameter_key) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.parameter_key.localeCompare(b.parameter_key);
  });
}

export function processLine(id: string | null | undefined) {
  return PROCESS_LINES.find((line) => line.id === id) ?? null;
}

export function processLineShort(id: string | null | undefined): string {
  return processLine(id)?.short ?? (id ?? "—");
}

/**
 * The level a full-factorial run number assigns to each factor.
 * Run numbers are 1-based; factor 0 varies slowest, the last factor fastest -
 * the standard standard-order expansion of a factorial plan.
 */
export function doeLevelsForRun(
  factors: DoeFactor[],
  runNumber: number,
): Map<string, string | number> {
  const assignment = new Map<string, string | number>();
  if (!factors.length || runNumber < 1) return assignment;

  let blockSize = 1;
  for (let i = factors.length - 1; i >= 0; i -= 1) {
    const levels = factors[i].levels;
    if (!levels.length) continue;
    const index = Math.floor((runNumber - 1) / blockSize) % levels.length;
    assignment.set(factors[i].key, levels[index]);
    blockSize *= levels.length;
  }
  return assignment;
}

/**
 * The machine setup the selected process line demands. These values are the
 * factual ground truth of the process - they are shown, never edited.
 */
export function ProcessLineCard({
  lineId,
  className,
  compact = false,
}: {
  lineId: string | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  const line = processLine(lineId);
  if (!line) return null;

  const facts: { label: string; value: string }[] = [
    { label: "Ziel", value: line.goal },
    { label: "Messer", value: line.blades },
    { label: "Spalt", value: line.gap },
    { label: "Sieb", value: line.screen },
    { label: "Drehzahl", value: line.rpm },
    { label: "Kühlung", value: line.cooling },
  ];

  return (
    <div className={cn("rounded-lg border border-border bg-muted/40 p-3", className)}>
      <p className="text-sm font-semibold">{line.label}</p>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="flex gap-2 text-xs">
            <dt className="w-24 shrink-0 text-muted-foreground">{fact.label}</dt>
            <dd className="font-medium leading-snug">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {!compact && (
        <p className="mt-2.5 border-t border-border pt-2 text-xs text-muted-foreground">
          {PROCESS_RULE_OF_THUMB}
        </p>
      )}
    </div>
  );
}
