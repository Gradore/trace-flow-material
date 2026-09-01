/**
 * Shared building blocks for the Produkttests page.
 *
 * Product validation is where the recycling process meets the customer: a
 * fraction only has value if it improves a concrete, mortar or compound
 * recipe. Everything here revolves around one comparison — measured value
 * versus the baseline recipe without recycled fibre.
 */
import { ArrowDownRight, ArrowUpRight, ExternalLink, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_TEST_PARAMETER_KEYS, TEST_RUN_STATUSES } from "@/lib/project/constants";
import { formatKg, formatNumber } from "@/components/project/ProjectUI";
import type { OutputFraction } from "@/lib/project/types";

/** The seeded reference dataset from the process development. */
export const REFERENCE_TEST_CODE = "PT-REF-VELOSIT-503";

/** product_tests re-uses the run status vocabulary (planned … cancelled). */
export const PRODUCT_TEST_STATUSES = TEST_RUN_STATUSES;

/** Sentinel for "no selection" — Radix forbids an empty SelectItem value. */
export const NO_SELECTION = "__none__";

/** Categories where an age curve (7/28/80 d hydration) is meaningful. */
const CONSTRUCTION_CATEGORY_IDS = ["concrete", "mortar", "cement", "polymer_concrete", "asphalt"];

export function isConstructionCategory(category: string | null | undefined): boolean {
  return typeof category === "string" && CONSTRUCTION_CATEGORY_IDS.includes(category);
}

export function productParameterMeta(key: string): { label: string; unit: string } {
  const entry = PRODUCT_TEST_PARAMETER_KEYS.find((p) => p.key === key);
  return { label: entry?.label ?? key, unit: entry?.unit ?? "" };
}

export function dosageLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) return "ohne Angabe";
  if (value === 0) return "0 % (Baseline)";
  return `${formatNumber(value, 1)} %`;
}

export function fractionLabel(fraction: OutputFraction | null | undefined): string {
  if (!fraction) return "—";
  return fraction.target_fraction_id
    ? `${fraction.fraction_code} · ${fraction.target_fraction_id}`
    : fraction.fraction_code;
}

/** Parse a German or plain decimal input into a number, or null when empty. */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function parseWholeNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? Math.round(value) : null;
}

/** Distinct colours for the dosage lines; the baseline gets a muted dashed line. */
export const DOSAGE_SERIES_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--info))",
];
export const BASELINE_COLOR = "hsl(var(--muted-foreground))";

/**
 * delta_pct is written by a database trigger from baseline_value — the UI only
 * renders it. Up = the recipe got stronger than its baseline.
 */
export function DeltaBadge({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }
  const neutral = Math.abs(value) < 0.05;
  const Icon = neutral ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = neutral ? "text-muted-foreground" : value > 0 ? "text-success" : "text-destructive";
  const sign = !neutral && value > 0 ? "+" : "";
  return (
    <span
      className={cn("inline-flex items-center gap-1 font-medium tabular-nums whitespace-nowrap", tone, className)}
      title={`${sign}${formatNumber(value, 2)} % gegenüber Baseline`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {sign}
      {formatNumber(value, 1)} %
    </span>
  );
}

/**
 * Fraction picker for product tests. Only fractions that carry the explicit
 * product-test release may be dosed into a customer recipe — everything else
 * is still waiting for its analytics.
 */
export function ReleasedFractionField({
  id,
  fractions,
  value,
  onChange,
  allowEmpty = true,
}: {
  id: string;
  fractions: OutputFraction[];
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  const released = fractions.filter((fraction) => fraction.released_for_product_test);
  const blocked = fractions.length - released.length;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Fraktion{allowEmpty ? "" : " *"}</Label>
      <Select value={value} onValueChange={onChange} disabled={released.length === 0 && !allowEmpty}>
        <SelectTrigger id={id}>
          <SelectValue
            placeholder={released.length ? "Freigegebene Fraktion wählen" : "Keine freigegebene Fraktion"}
          />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {allowEmpty && <SelectItem value={NO_SELECTION}>Ohne Fraktion</SelectItem>}
          {released.map((fraction) => (
            <SelectItem key={fraction.id} value={fraction.id}>
              {fractionLabel(fraction)} · {formatKg(fraction.weight_kg)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Nur Fraktionen mit gesetzter Produkttest-Freigabe sind wählbar.
        {blocked > 0
          ? ` ${blocked} weitere ${blocked === 1 ? "Fraktion ist" : "Fraktionen sind"} noch nicht freigegeben — die Analytik muss vorher in Spec liegen.`
          : ""}{" "}
        <Link
          to="/projekt/fraktionen"
          className="underline underline-offset-2 inline-flex items-center gap-1 text-foreground"
        >
          Fraktionen verwalten
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </p>
    </div>
  );
}
