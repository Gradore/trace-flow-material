import { useState } from "react";
import { Loader2, Play, Clock, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToneBadge } from "@/components/project/ProjectUI";
import { useRequestAiAnalysis, type AiAnalysisType } from "@/hooks/project/useProjectAi";

export type ScopeKind = "test_run" | "doe_series" | "output_fraction";

export interface ScopeOption {
  value: string;
  label: string;
}

export interface ScopeConfig {
  /** Which entity the edge function expects as scope_id. */
  scopeType: ScopeKind;
  selectLabel: string;
  placeholder: string;
  /** Shown instead of the select when there is nothing to pick. */
  emptyHint: string;
  options: ScopeOption[];
  isLoading: boolean;
}

interface AiInsightsTriggerCardProps {
  type: AiAnalysisType;
  label: string;
  description: string;
  /** Types that are meant to run unattended on a schedule. */
  scheduled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  scope?: ScopeConfig;
}

/**
 * One trigger tile. Scoped analysis types stay disabled until a concrete
 * object (run / DoE series / fraction) is selected, because the edge function
 * rejects a missing scope_id.
 */
export function AiInsightsTriggerCard({
  type,
  label,
  description,
  scheduled,
  icon: Icon,
  scope,
}: AiInsightsTriggerCardProps) {
  const [scopeId, setScopeId] = useState<string>("");
  const request = useRequestAiAnalysis();

  const hasOptions = !scope || scope.options.length > 0;
  const scopeMissing = Boolean(scope) && !scopeId;
  const disabled = request.isPending || scopeMissing || !hasOptions;

  const handleRun = () => {
    if (scope) {
      if (!scopeId) return;
      request.mutate({ analysisType: type, scopeType: scope.scopeType, scopeId });
      return;
    }
    request.mutate({ analysisType: type, scopeType: "global", scopeId: null });
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/15">
            <Icon className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight">{label}</CardTitle>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {scheduled ? (
                <ToneBadge tone="info" className="gap-1 text-[11px]">
                  <Clock className="h-3 w-3" /> Zeitplan
                </ToneBadge>
              ) : (
                <ToneBadge tone="muted" className="gap-1 text-[11px]">
                  Manuell
                </ToneBadge>
              )}
              {scope && (
                <ToneBadge tone="warning" className="gap-1 text-[11px]">
                  <Crosshair className="h-3 w-3" /> Kontext nötig
                </ToneBadge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>

        {scope && (
          <div className="space-y-1.5">
            <Label htmlFor={`scope-${type}`} className="text-xs">
              {scope.selectLabel}
            </Label>
            {scope.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : scope.options.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                {scope.emptyHint}
              </p>
            ) : (
              <Select value={scopeId || undefined} onValueChange={setScopeId}>
                <SelectTrigger id={`scope-${type}`} className="w-full">
                  <SelectValue placeholder={scope.placeholder} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {scope.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="mt-auto pt-1">
          <Button type="button" className="w-full" onClick={handleRun} disabled={disabled}>
            {request.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Läuft …
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Auswertung starten
              </>
            )}
          </Button>
          {scopeMissing && hasOptions && !scope?.isLoading && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Bitte zuerst einen Bezug auswählen.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
