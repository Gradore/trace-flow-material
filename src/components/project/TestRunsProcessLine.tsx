import { cn } from "@/lib/utils";
import { PROCESS_RULE_OF_THUMB } from "@/lib/project/constants";
import { processLine } from "@/components/project/TestRunsShared";

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
