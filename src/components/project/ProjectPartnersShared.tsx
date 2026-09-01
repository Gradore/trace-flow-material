/**
 * Shared building blocks for the partner module (cards, table, pipeline,
 * detail sheet and the create dialog all use these).
 */
import { Link } from "react-router-dom";
import { Building2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { hasAccess } from "@/components/layout/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import type { Partner } from "@/lib/project/types";

/** Sentinel for shadcn selects - Radix forbids an empty string value. */
export const ALL = "__all__";

/** Fraction ids as defined by the specification (F1 … F5). */
export const FALLBACK_FRACTION_IDS = ["F1", "F2", "F3", "F4", "F5"] as const;

/** Subcategories used in the partner base data. */
export const PARTNER_SUBCATEGORY_LABELS: Record<string, string> = {
  shear_mill: "Schermühle",
  pre_shredder: "Vorzerkleinerer",
  granulator: "Granulator",
  tooth_roller: "Zahnwalzenmühle",
  roller_crusher: "Walzenbrecher",
  classification: "Sichtung",
  screening: "Siebung",
  electrostatic_separation: "Elektrostatische Trennung",
  impact_benchmark: "Prallmühle (Benchmark)",
};

export function subcategoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return PARTNER_SUBCATEGORY_LABELS[value] ?? value;
}

/**
 * One definition for both communication UIs - /projekt/vorlagen writes the
 * same communications rows this sheet reads.
 */
export { COMMUNICATION_CHANNELS, COMMUNICATION_DIRECTIONS } from "@/lib/project/constants";

export interface OptionItem {
  id: string;
  label: string;
  hint?: string;
}

/* ------------------------------------------------------------------ badges */

/** Fixed partners are set in stone by the project plan - violet accent. */
export function FixedPartnerBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-violet-400/40 bg-violet-400/15 text-violet-300 font-semibold",
        className,
      )}
    >
      <Star className="h-3 w-3 fill-current" aria-hidden />
      Gesetzt
    </Badge>
  );
}

/**
 * Production and QA may open /projekt/partner but not /companies - for them the
 * badge stays a plain badge, otherwise the click lands on "Kein Zugriff".
 */
export function CompanyLinkBadge({ className }: { className?: string }) {
  const { role, isAdmin } = useUserRole();
  const canOpenCompanies = hasAccess("/companies", role, isAdmin);

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-emerald-400/40 bg-emerald-400/15 text-emerald-300 font-medium",
        canOpenCompanies && "hover:bg-emerald-400/25",
      )}
    >
      <Building2 className="h-3 w-3" aria-hidden />
      Verknüpft mit Firma
    </Badge>
  );

  if (!canOpenCompanies) {
    return (
      <span className={cn("inline-flex", className)} title="Verknüpft mit einer Firma">
        {badge}
      </span>
    );
  }

  return (
    <Link to="/companies" className={cn("inline-flex", className)} title="Zur Firmenliste">
      {badge}
    </Link>
  );
}

/* ------------------------------------------------------------------ rating */

export function RatingDots({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const filled = value ?? 0;
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      title={value ? `Eignung ${value} von 5` : "Keine Bewertung"}
      aria-label={value ? `Eignung ${value} von 5` : "Keine Bewertung"}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          aria-hidden
          className={cn(
            "h-2 w-2 rounded-full",
            step <= filled ? "bg-amber-400" : "bg-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
}

export function RatingPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {[1, 2, 3, 4, 5].map((step) => (
        <button
          key={step}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === step ? null : step)}
          aria-pressed={value === step}
          aria-label={`Eignung ${step}`}
          className={cn(
            "h-8 w-8 rounded-md border text-xs font-semibold transition-colors disabled:opacity-50",
            value !== null && step <= value
              ? "border-amber-400/50 bg-amber-400/20 text-amber-300"
              : "border-border bg-muted/40 text-muted-foreground hover:border-amber-400/40",
          )}
        >
          {step}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled || value === null}
        onClick={() => onChange(null)}
        className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
      >
        zurücksetzen
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ multi select */

export function CheckboxGroup({
  options,
  value,
  onChange,
  idPrefix,
  columns = 2,
  disabled,
}: {
  options: readonly OptionItem[];
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
  columns?: 1 | 2;
  disabled?: boolean;
}) {
  const toggle = (id: string, checked: boolean) => {
    if (checked) {
      if (value.includes(id)) return;
      onChange([...value, id]);
    } else {
      onChange(value.filter((entry) => entry !== id));
    }
  };

  return (
    <div className={cn("grid gap-2", columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
      {options.map((option) => {
        const inputId = `${idPrefix}-${option.id}`;
        const checked = value.includes(option.id);
        return (
          <label
            key={option.id}
            htmlFor={inputId}
            className={cn(
              "flex items-start gap-2 rounded-md border p-2 cursor-pointer transition-colors",
              checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <Checkbox
              id={inputId}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(state) => toggle(option.id, state === true)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{option.label}</span>
              {option.hint && (
                <span className="block text-xs text-muted-foreground leading-tight mt-0.5">
                  {option.hint}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Compact read-only chip list, e.g. for material classes on a card. */
export function ChipList({
  values,
  emptyLabel = "—",
  labelFor,
  className,
}: {
  values: string[] | null | undefined;
  emptyLabel?: string;
  labelFor?: (value: string) => string;
  className?: string;
}) {
  if (!values || values.length === 0) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {values.map((entry) => (
        <span
          key={entry}
          className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          title={labelFor ? labelFor(entry) : entry}
        >
          {entry}
        </span>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- helpers */

/** Fixed partners first, then the best rating, then alphabetically. */
export function comparePartners(a: Partner, b: Partner): number {
  if (a.is_fixed_partner !== b.is_fixed_partner) return a.is_fixed_partner ? -1 : 1;
  const ratingA = a.suitability_rating ?? 0;
  const ratingB = b.suitability_rating ?? 0;
  if (ratingA !== ratingB) return ratingB - ratingA;
  return a.name.localeCompare(b.name, "de");
}

export function partnerAddress(partner: Partner): string {
  const parts = [
    partner.street,
    [partner.postal_code, partner.city].filter(Boolean).join(" "),
    partner.country,
  ].filter((entry): entry is string => Boolean(entry && entry.trim()));
  return parts.length ? parts.join(", ") : "—";
}

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
export function toLocalInputValue(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local datetime input value -> ISO timestamp, null when unparsable. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Trim a form string, mapping empty input to null for nullable columns. */
export function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/** A date-only column value (yyyy-mm-dd) from an <input type="date">. */
export function dateOrNull(value: string): string | null {
  return value ? value : null;
}

export function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

/**
 * True when a date column value (yyyy-mm-dd) is today or already past.
 * The value has to be read as a *local* date: `new Date("2026-09-01")` parses
 * as UTC midnight, which in MEZ/MESZ is 01:00/02:00 local and therefore later
 * than the local start of today - every follow-up due today would be missed.
 */
export function isDueOrOverdue(date: string | null | undefined): boolean {
  if (!date) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return false;
  const due = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() <= startOfToday();
}
