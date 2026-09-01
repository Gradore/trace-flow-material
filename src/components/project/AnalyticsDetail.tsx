import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Beaker, ExternalLink, FlaskConical, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectMutation } from "@/hooks/project/useProjectData";
import { useUserRole } from "@/hooks/useUserRole";
import { hasAccess } from "@/components/layout/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectDocuments } from "@/components/project/ProjectDocuments";
import { useRequestAiAnalysis } from "@/hooks/project/useProjectAi";
import { linkAnalysisToSample, pushResultsToSample } from "@/lib/project/bridges";
import { ANALYSIS_STATUSES, PARTNER_CATEGORIES, labelOf, toneOf } from "@/lib/project/constants";
import {
  ConformityBadge,
  Markdown,
  ToneBadge,
  formatDate,
  formatDateTime,
  formatEur,
} from "@/components/project/ProjectUI";
import {
  GoNoGoAlert,
  MandatoryChecklist,
  VerdictList,
  type AnalysisView,
  fractionLabel,
} from "./AnalyticsShared";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

export function AnalyticsDetail({
  view,
  open,
  onOpenChange,
  onEnterResults,
  onEdit,
}: {
  view: AnalysisView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnterResults: () => void;
  onEdit: () => void;
}) {
  const { user } = useAuth();
  const { role, isAdmin } = useUserRole();
  /* intake darf /projekt/analytik, aber nicht /sampling. */
  const canOpenSampling = hasAccess("/sampling", role, isAdmin);
  const [sampler, setSampler] = useState("");
  const requestAi = useRequestAiAnalysis();

  useEffect(() => {
    if (!open) return;
    setSampler(user?.email ?? "");
  }, [open, view?.analysis.id, user?.email]);

  const linkSample = useProjectMutation(
    async (vars: { samplerName: string }) => {
      if (!view) throw new Error("Keine Analyse ausgewählt");

      // Die gecachte Zeile kann veraltet sein. Vor dem Anlegen den aktuellen
      // Stand lesen, sonst legt ein zweiter Klick eine zweite Probe zur selben
      // Analyse an.
      const { data: current, error: readError } = await supabase
        .from("fraction_analyses")
        .select("sample_id")
        .eq("id", view.analysis.id)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!current) throw new Error("Keine Berechtigung oder Analyse nicht gefunden");
      if (current.sample_id) {
        toast({
          title: "Probe bereits vorhanden",
          description: "Zu dieser Analyse ist in der Probenverwaltung bereits eine Probe angelegt.",
        });
        return;
      }

      const sampleId = await linkAnalysisToSample(view.analysis, view.fraction, vars.samplerName);

      // linkAnalysisToSample setzt sample_id per UPDATE ohne .select(); RLS kann
      // die Zeile still herausfiltern. Ohne diese Prüfung meldeten wir Erfolg und
      // ließen eine Probe ohne Verknüpfung zur Analyse zurück.
      const { data: linked, error: verifyError } = await supabase
        .from("fraction_analyses")
        .select("sample_id")
        .eq("id", view.analysis.id)
        .maybeSingle();
      if (verifyError) throw new Error(verifyError.message);
      if (!linked || linked.sample_id !== sampleId) {
        throw new Error(
          "Die Probe wurde angelegt, konnte der Analyse aber nicht zugeordnet werden (fehlende Berechtigung).",
        );
      }

      const transferred = await pushResultsToSample(
        sampleId,
        view.results.map((result) => ({
          parameter_key: result.parameter_key,
          value_numeric: result.value_numeric,
          value_text: result.value_text,
          unit: result.unit,
        })),
      );
      toast({
        title: "Probe im Betrieb angelegt",
        description:
          transferred > 0
            ? `${transferred} Messwerte wurden in die Probenverwaltung übernommen.`
            : "Es lagen noch keine Messwerte zur Übernahme vor.",
      });
    },
    { errorMessage: "Probe konnte nicht angelegt werden" },
  );

  if (!view) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Analyse</DialogTitle>
            <DialogDescription>Keine Analyse ausgewählt.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const { analysis, fraction, spec, lab, run } = view;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 break-words">
            <FlaskConical className="h-4 w-4 text-violet-400 shrink-0" aria-hidden />
            <span className="font-mono">{analysis.analysis_code}</span>
            <ToneBadge tone={toneOf(ANALYSIS_STATUSES, analysis.status)}>
              {labelOf(ANALYSIS_STATUSES, analysis.status)}
            </ToneBadge>
            <ConformityBadge level={view.level} />
          </DialogTitle>
          <DialogDescription>
            {view.evaluableCount > 0
              ? `${view.inSpecCount} von ${view.evaluableCount} bewertbaren Parametern in Spezifikation.`
              : "Noch keine gegen die Spezifikation bewertbaren Messwerte."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="analysis">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analysis" className="text-xs py-1.5">Analyse</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs py-1.5">Dokumente</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4 mt-4">
          <GoNoGoAlert breaches={view.breaches} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fraktion">
              {fraction ? (
                <Link to="/projekt/fraktionen" className="underline underline-offset-2">
                  {fractionLabel(fraction)}
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Zielspezifikation">{spec ? `${spec.id} — ${spec.name}` : "—"}</Field>
            <Field label="Versuch">
              {run ? (
                <Link to="/projekt/versuche" className="underline underline-offset-2">
                  {run.run_code}
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Labor">
              {lab ? `${lab.name} (${labelOf(PARTNER_CATEGORIES, lab.category)})` : "—"}
            </Field>
            <Field label="Methode">{analysis.method ?? "—"}</Field>
            <Field label="Kosten">{formatEur(analysis.cost_eur)}</Field>
            <Field label="Probe versendet">{formatDate(analysis.sample_sent_date)}</Field>
            <Field label="Ergebnis">{formatDate(analysis.result_date)}</Field>
          </div>

          {analysis.notes && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Notizen</p>
              <p className="text-sm whitespace-pre-wrap break-words">{analysis.notes}</p>
            </div>
          )}

          <MandatoryChecklist presentKeys={view.presentKeys} />

          <div className="space-y-2">
            <p className="text-sm font-medium">Messwerte</p>
            <VerdictList verdicts={view.verdicts} />
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Beaker className="h-4 w-4 text-muted-foreground" aria-hidden />
              Übernahme in den Betrieb
            </p>
            {analysis.sample_id ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  Probe angelegt
                </Badge>
                {canOpenSampling && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/sampling">
                      Zur Probenverwaltung
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sampler-name">Probenehmer</Label>
                  <Input
                    id="sampler-name"
                    value={sampler}
                    placeholder="Name des Probenehmers"
                    onChange={(event) => setSampler(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={linkSample.isPending}
                  onClick={() => linkSample.mutate({ samplerName: sampler.trim() })}
                >
                  {linkSample.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Beaker className="h-4 w-4" />
                  )}
                  Probe + Ergebnisse übernehmen
                </Button>
                <p className="text-xs text-muted-foreground">
                  Legt eine Probe in der Probenverwaltung an und überträgt alle erfassten Messwerte.
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
                KI-Spec-Bewertung
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!analysis.output_fraction_id || requestAi.isPending}
                onClick={() =>
                  requestAi.mutate({
                    analysisType: "spec_conformity",
                    scopeType: "output_fraction",
                    scopeId: analysis.output_fraction_id,
                  })
                }
              >
                {requestAi.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {analysis.ai_interpretation ? "Neu bewerten" : "KI-Spec-Bewertung"}
              </Button>
            </div>
            {!analysis.output_fraction_id && (
              <p className="text-xs text-muted-foreground">
                Ohne zugeordnete Fraktion kann die Spec-Konformität nicht bewertet werden.
              </p>
            )}
            {analysis.ai_interpretation ? (
              <div className="rounded-lg border border-border p-3">
                <Markdown content={analysis.ai_interpretation} />
                {analysis.ai_interpreted_at && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Erstellt am {formatDateTime(analysis.ai_interpreted_at)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine KI-Bewertung vorhanden.</p>
            )}
          </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <ProjectDocuments
              entityType="fraction_analysis"
              entityId={analysis.id}
              title="Dokumente zur Analyse"
              description="Laborbericht als PDF, Fotos der Probe und der Prüfkörper."
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onEdit}>
            Bearbeiten
          </Button>
          <Button type="button" onClick={onEnterResults}>
            Messwerte erfassen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
