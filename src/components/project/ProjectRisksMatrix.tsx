/**
 * 5x5 risk heat map (probability x impact) as a CSS grid.
 * Clicking a cell filters the register to exactly that probability/impact pair.
 */
import { cn } from "@/lib/utils";
import {
  IMPACT_LABELS,
  PROBABILITY_LABELS,
  SCALE,
  SEVERITY_CELL_CLASSES,
  severityTone,
} from "@/components/project/ProjectRisksShared";
import type { ProjectRisk } from "@/lib/project/types";

export interface MatrixCell {
  probability: number;
  impact: number;
}

interface Props {
  risks: ProjectRisk[];
  selected: MatrixCell | null;
  onSelect: (cell: MatrixCell | null) => void;
}

export function ProjectRisksMatrix({ risks, selected, onSelect }: Props) {
  const counts = new Map<string, number>();
  for (const risk of risks) {
    const key = `${risk.probability}-${risk.impact}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows = [...SCALE].reverse();

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[17rem] max-w-[28rem]">
          <div className="grid grid-cols-[1.5rem_repeat(5,minmax(2.5rem,1fr))] gap-1">
            {rows.map((impact) => (
              <div key={`row-${impact}`} className="contents">
                <div className="flex items-center justify-center text-[11px] font-semibold text-muted-foreground tabular-nums">
                  {impact}
                </div>
                {SCALE.map((probability) => {
                  const severity = probability * impact;
                  const count = counts.get(`${probability}-${impact}`) ?? 0;
                  const tone = severityTone(severity);
                  const palette = SEVERITY_CELL_CLASSES[tone];
                  const isSelected =
                    selected?.probability === probability && selected?.impact === impact;
                  return (
                    <button
                      key={`cell-${probability}-${impact}`}
                      type="button"
                      aria-pressed={isSelected}
                      title={`Wahrscheinlichkeit ${probability} (${PROBABILITY_LABELS[probability]}) × Auswirkung ${impact} (${IMPACT_LABELS[impact]}) – Schwere ${severity} – ${count} Risiko(s)`}
                      onClick={() => onSelect(isSelected ? null : { probability, impact })}
                      className={cn(
                        "aspect-square rounded-md border flex flex-col items-center justify-center transition-colors",
                        count > 0 ? palette.filled : palette.empty,
                        isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                      )}
                    >
                      <span className={cn("text-base font-bold tabular-nums", count === 0 && "opacity-40")}>
                        {count}
                      </span>
                      <span className="text-[10px] leading-none opacity-60 tabular-nums">{severity}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div />
            {SCALE.map((probability) => (
              <div
                key={`col-${probability}`}
                className="text-center text-[11px] font-semibold text-muted-foreground tabular-nums pt-0.5"
              >
                {probability}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">Zeilen:</span> Auswirkung 1–5
        </span>
        <span>
          <span className="font-medium text-foreground">Spalten:</span> Wahrscheinlichkeit 1–5
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-success/40 border border-success/50" aria-hidden />
          Niedrig (&lt; 7)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-warning/40 border border-warning/50" aria-hidden />
          Mittel (7–14)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-destructive/40 border border-destructive/50" aria-hidden />
          Hoch (≥ 15)
        </span>
      </div>
    </div>
  );
}
