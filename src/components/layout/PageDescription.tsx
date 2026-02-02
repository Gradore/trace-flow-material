import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageDescriptionProps {
  title: string;
  description: string;
  nextSteps?: string[];
  className?: string;
}

/**
 * A reusable component that displays a brief description of a database tool page.
 * Explains the purpose, available actions, and links to related tools.
 */
export function PageDescription({ title, description, nextSteps, className }: PageDescriptionProps) {
  return (
    <div className={cn(
      "glass-card rounded-lg p-4 mb-6 border border-primary/10 bg-primary/5",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <Info className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="font-medium text-sm text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          {nextSteps && nextSteps.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground font-medium">Nächste Schritte:</p>
              <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
                {nextSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
