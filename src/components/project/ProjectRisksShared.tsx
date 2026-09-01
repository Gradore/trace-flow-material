/**
 * Shared building blocks of the risk register (page /projekt/risiken).
 *
 * `project_risks.severity` is a GENERATED column (probability * impact) and is
 * never written by the client. `severityOf()` mirrors the DB formula so that a
 * freshly edited row can be rendered before the trigger value comes back.
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ToneBadge } from "@/components/project/ProjectUI";
import type { ProjectRisk } from "@/lib/project/types";

/** Single definition in constants.ts - the cockpit renders the same values. */
export { RISK_STATUSES } from "@/lib/project/constants";

export const PROBABILITY_LABELS: Record<number, string> = {
  1: "sehr unwahrscheinlich",
  2: "unwahrscheinlich",
  3: "möglich",
  4: "wahrscheinlich",
  5: "sehr wahrscheinlich",
};

export const IMPACT_LABELS: Record<number, string> = {
  1: "vernachlässigbar",
  2: "gering",
  3: "spürbar",
  4: "schwer",
  5: "projektgefährdend",
};

export const SCALE = [1, 2, 3, 4, 5] as const;

export type SeverityTone = "success" | "warning" | "destructive";

/** Severity as stored by the DB (probability * impact), with a client fallback. */
export function severityOf(risk: Pick<ProjectRisk, "severity" | "probability" | "impact">): number {
  if (risk.severity !== null && risk.severity !== undefined) return risk.severity;
  return (risk.probability ?? 0) * (risk.impact ?? 0);
}

export function severityTone(severity: number): SeverityTone {
  if (severity >= 15) return "destructive";
  if (severity >= 7) return "warning";
  return "success";
}

export function severityLabel(severity: number): string {
  const tone = severityTone(severity);
  if (tone === "destructive") return "Hoch";
  if (tone === "warning") return "Mittel";
  return "Niedrig";
}

/** Cell colouring of the 5x5 heat map - green / amber / red by severity. */
export const SEVERITY_CELL_CLASSES: Record<SeverityTone, { filled: string; empty: string }> = {
  success: {
    filled: "bg-success/25 border-success/40 text-success hover:bg-success/35",
    empty: "bg-success/[0.06] border-success/20 text-muted-foreground hover:bg-success/15",
  },
  warning: {
    filled: "bg-warning/25 border-warning/40 text-warning hover:bg-warning/35",
    empty: "bg-warning/[0.06] border-warning/20 text-muted-foreground hover:bg-warning/15",
  },
  destructive: {
    filled: "bg-destructive/25 border-destructive/40 text-destructive hover:bg-destructive/35",
    empty: "bg-destructive/[0.06] border-destructive/20 text-muted-foreground hover:bg-destructive/15",
  },
};

export function SeverityBadge({ severity, className }: { severity: number; className?: string }) {
  const tone = severityTone(severity);
  return (
    <ToneBadge tone={tone} className={cn("gap-1.5 tabular-nums", className)}>
      <span className="font-bold">{severity}</span>
      <span className="text-[11px] font-normal opacity-80">{severityLabel(severity)}</span>
    </ToneBadge>
  );
}

/** 1-5 selector used for probability and impact - large touch targets for site use. */
export function ScaleSelector({
  value,
  onChange,
  labels,
  idPrefix,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  labels: Record<number, string>;
  idPrefix: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-5 gap-1.5">
        {SCALE.map((step) => {
          const active = value === step;
          return (
            <button
              key={`${idPrefix}-${step}`}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              aria-label={`${step} – ${labels[step]}`}
              onClick={() => onChange(step)}
              className={cn(
                "h-10 rounded-md border text-sm font-semibold transition-colors disabled:opacity-50",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {step}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value} – {labels[value] ?? "—"}
      </p>
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
      {children}
    </label>
  );
}
