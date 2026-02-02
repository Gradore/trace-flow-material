import { Info, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "react-router-dom";

interface WorkflowLink {
  label: string;
  path: string;
  direction: "previous" | "next";
}

interface PageDescriptionProps {
  title: string;
  description: string;
  nextSteps?: string[];
  workflowLinks?: WorkflowLink[];
  className?: string;
  variant?: "full" | "tooltip";
}

/**
 * A reusable component that displays a brief description of a database tool page.
 * Explains the purpose, available actions, and links to related tools.
 * 
 * @param variant - "full" for the full info box (default), "tooltip" for a small icon with tooltip
 * @param workflowLinks - Links to previous/next steps in the workflow
 */
export function PageDescription({ title, description, nextSteps, workflowLinks, className, variant = "full" }: PageDescriptionProps) {
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

  const previousLinks = workflowLinks?.filter(l => l.direction === "previous") || [];
  const nextLinks = workflowLinks?.filter(l => l.direction === "next") || [];

  return (
    <div className={cn(
      "glass-card rounded-lg p-4 mb-6 border border-primary/10 bg-primary/5",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
          <Info className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-2 flex-1">
          <h3 className="font-medium text-sm text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          
          {nextSteps && nextSteps.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground font-medium">Was Sie hier tun:</p>
              <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
                {nextSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Workflow Links */}
          {workflowLinks && workflowLinks.length > 0 && (
            <div className="pt-2 border-t border-border/50 mt-2">
              <p className="text-xs text-muted-foreground font-medium mb-2">Verknüpfte Module:</p>
              <div className="flex flex-wrap gap-2">
                {previousLinks.map((link, index) => (
                  <Link
                    key={`prev-${index}`}
                    to={link.path}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary text-xs font-medium transition-colors"
                  >
                    <ArrowRight className="h-3 w-3 rotate-180" />
                    {link.label}
                  </Link>
                ))}
                {nextLinks.map((link, index) => (
                  <Link
                    key={`next-${index}`}
                    to={link.path}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-xs font-medium text-primary transition-colors"
                  >
                    {link.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
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
export function PageDescriptionTooltip({ title, description, nextSteps }: Omit<PageDescriptionProps, 'variant' | 'className' | 'workflowLinks'>) {
  return (
    <PageDescription 
      title={title} 
      description={description} 
      nextSteps={nextSteps} 
      variant="tooltip" 
    />
  );
}
