import { useMemo, useState } from "react";
import { CheckCheck, ChevronDown, Database, Eye, Loader2, ServerCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Markdown, ToneBadge, formatDateTime, formatNumber } from "@/components/project/ProjectUI";
import { useAcknowledgeAiAnalysis } from "@/hooks/project/useProjectAi";
import type { AiAnalysis } from "@/lib/project/types";

const CONFIDENCE_META: Record<string, { label: string; tone: string }> = {
  high: { label: "Konfidenz hoch", tone: "success" },
  medium: { label: "Konfidenz mittel", tone: "warning" },
  low: { label: "Konfidenz niedrig", tone: "destructive" },
};

interface AiInsightsEntryCardProps {
  analysis: AiAnalysis;
  typeLabel: string;
  /** Human readable code/name of the scope object, already resolved. */
  scopeLabel: string;
}

export function AiInsightsEntryCard({ analysis, typeLabel, scopeLabel }: AiInsightsEntryCardProps) {
  const [contextOpen, setContextOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"read" | "acted" | null>(null);
  const acknowledge = useAcknowledgeAiAnalysis();

  const isRead = Boolean(analysis.acknowledged_at);
  const isActed = analysis.acted_upon;

  const contextJson = useMemo(() => {
    if (analysis.input_context === null || analysis.input_context === undefined) return null;
    return JSON.stringify(analysis.input_context, null, 2);
  }, [analysis.input_context]);

  const confidence = analysis.confidence
    ? CONFIDENCE_META[analysis.confidence] ?? { label: `Konfidenz ${analysis.confidence}`, tone: "muted" }
    : null;

  const mark = async (action: "read" | "acted") => {
    setPendingAction(action);
    try {
      // useAcknowledgeAiAnalysis schreibt mit .select("id") und wirft, wenn RLS
      // die Zeile still herausfiltert - eine zweite Lesekontrolle hier würde
      // nichts zusätzlich absichern, aber bei einem Netzfehler fälschlich
      // „nicht gespeichert“ melden.
      await acknowledge.mutateAsync(
        action === "acted" ? { id: analysis.id, actedUpon: true } : { id: analysis.id },
      );
      toast({ title: action === "acted" ? "Als umgesetzt markiert" : "Als gelesen markiert" });
    } catch {
      // Der Fehler-Toast kommt bereits aus useAcknowledgeAiAnalysis.
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <Card className={cn(!isRead && "border-primary/40")}>
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <ToneBadge tone="info">{typeLabel}</ToneBadge>
          {!isRead && <ToneBadge tone="warning">Ungelesen</ToneBadge>}
          {isActed && <ToneBadge tone="success">Umgesetzt</ToneBadge>}
          {confidence && <ToneBadge tone={confidence.tone}>{confidence.label}</ToneBadge>}
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            <span className="text-foreground">Bezug:</span> {scopeLabel}
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{formatDateTime(analysis.created_at)}</span>
            <span>Modell: {analysis.model ?? "—"}</span>
            <span>
              Tokens:{" "}
              {analysis.tokens_used === null ? "—" : formatNumber(analysis.tokens_used, 0)}
            </span>
          </p>
          {isRead && <p>Gelesen am {formatDateTime(analysis.acknowledged_at)}</p>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {analysis.output_md ? (
          <Markdown content={analysis.output_md} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Diese Auswertung enthält keinen Ergebnistext. Bitte erneut anfordern.
          </p>
        )}

        <Separator />

        <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2 text-xs sm:w-auto">
              <span className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                Grundlage der Auswertung
              </span>
              <ChevronDown
                className={cn("ml-2 h-3.5 w-3.5 transition-transform", contextOpen && "rotate-180")}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <p className="mb-2 flex items-start gap-2 text-xs text-muted-foreground">
              <ServerCog className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Exakt diese Daten hat die Edge Function <code className="font-mono">project-ai</code> an das
                Modell übergeben. Der Modellaufruf erfolgt ausschließlich serverseitig — im Browser
                existiert kein API-Schlüssel. Jede Aussage der KI ist damit auf den hier gezeigten
                Datenstand zurückführbar.
              </span>
            </p>
            {contextJson ? (
              <pre className="max-h-80 overflow-auto whitespace-pre rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {contextJson}
              </pre>
            ) : (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Für diese Auswertung wurde kein Eingabekontext gespeichert.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={isRead || acknowledge.isPending || pendingAction !== null}
            onClick={() => void mark("read")}
          >
            {pendingAction === "read" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {isRead ? "Gelesen" : "Als gelesen markieren"}
          </Button>
          <Button
            type="button"
            variant={isActed ? "secondary" : "default"}
            size="sm"
            className="w-full sm:w-auto"
            disabled={isActed || acknowledge.isPending || pendingAction !== null}
            onClick={() => void mark("acted")}
          >
            {pendingAction === "acted" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            {isActed ? "Umgesetzt" : "Als umgesetzt markieren"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
