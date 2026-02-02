import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PageDescriptionProps {
  title: string;
  description: string;
  nextSteps?: string[];
  className?: string;
  variant?: "full" | "tooltip";
}

/**
 * A reusable component that displays a brief description of a database tool page.
 * Explains the purpose, available actions, and links to related tools.
 * 
 * @param variant - "full" for the full info box (default), "tooltip" for a small icon with tooltip
 */
export function PageDescription({ title, description, nextSteps, className, variant = "full" }: PageDescriptionProps) {
  if (variant === "tooltip") {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button 
              type="button"
              className="inline-flex items-center justify-center p-1.5 rounded-full hover:bg-primary/10 transition-colors"
              aria-label="Mehr Informationen"
            >
              <Info className="h-4 w-4 text-primary" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-sm p-3">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">{title}</h4>
              <p className="text-xs text-muted-foreground">{description}</p>
              {nextSteps && nextSteps.length > 0 && (
                <div className="pt-1 border-t border-border">
                  <p className="text-xs text-muted-foreground font-medium">Nächste Schritte:</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
                    {nextSteps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

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

/**
 * Compact info icon with tooltip for use in headers
 */
export function PageDescriptionTooltip({ title, description, nextSteps }: Omit<PageDescriptionProps, 'variant' | 'className'>) {
  return (
    <PageDescription 
      title={title} 
      description={description} 
      nextSteps={nextSteps} 
      variant="tooltip" 
    />
  );
}
