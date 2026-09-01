/**
 * Release workflow for an output fraction.
 *
 * A fraction may only go into product tests when its analytics say so:
 * conformity 'pass' or 'borderline' plus at least one completed analysis.
 * 'borderline' needs an explicit confirmation, 'fail' is blocked and the
 * offending parameters are named. Go/No-Go breaches are always shown.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useProjectMutation } from "@/hooks/project/useProjectData";
import { useRequestAiAnalysis } from "@/hooks/project/useProjectAi";
import { ConformityBadge } from "@/components/project/ProjectUI";
import { FRACTION_STATUSES, labelOf } from "@/lib/project/constants";
import { formatSpecWindow, formatVerdictValue, releaseEligibility, type FractionView } from "./FractionsShared";

export function FractionsReleaseDialog({
  view,
  open,
  onOpenChange,
}: {
  view: FractionView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const requestAi = useRequestAiAnalysis();

  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open, view?.fraction.id]);

  const mutate = useProjectMutation(
    async (vars: { id: string; released: boolean; status: string }) => {
      const { data, error } = await supabase
        .from("output_fractions")
        .update({ released_for_product_test: vars.released, status: vars.status })
        .eq("id", vars.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
    },
    {
      successMessage: "Freigabestatus aktualisiert",
      errorMessage: "Freigabe konnte nicht geändert werden",
      onDone: () => onOpenChange(false),
    },
  );

  if (!view) return null;

  const { fraction, spec } = view;
  const eligibility = releaseEligibility(view);
  const isReleased = fraction.released_for_product_test;
  const canSubmit = eligibility.allowed && (!eligibility.needsConfirmation || confirmed);

  // A fraction that already left the house stays 'shipped'.
  const releasedStatus = fraction.status === "shipped" ? "shipped" : "released";

  const handleRelease = () =>
    mutate.mutate(
      { id: fraction.id, released: true, status: releasedStatus },
      {
        // Plan 6.2: Die Freigabe ist der Ausloeser fuer die KI-Spec-Bewertung
        // der Fraktion. Das Zuruckziehen loest bewusst nichts aus.
        onSuccess: () => {
          requestAi.mutate({
            analysisType: "spec_conformity",
            scopeType: "output_fraction",
            scopeId: fraction.id,
          });
        },
      },
    );

  // Nur ein reiner Freigabestatus fällt zurück - 'shipped' oder 'rejected'
  // beschreiben einen Zustand, den ein Widerruf nicht rückgängig macht.
  const withdrawnStatus = fraction.status === "released" ? "in_analysis" : fraction.status;

  const handleWithdraw = () =>
    mutate.mutate({ id: fraction.id, released: false, status: withdrawnStatus });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base">Freigabe für Produkttests</DialogTitle>
          <DialogDescription className="text-xs">
            {fraction.fraction_code}
            {spec ? ` · Zielfraktion ${spec.id} — ${spec.name}` : " · ohne Zielfraktion"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">

          <div className="flex flex-wrap items-center gap-2">
            <ConformityBadge level={view.conformity} />
            <span className="text-xs text-muted-foreground">
              {view.completedAnalyses.length} abgeschlossene Analyse
              {view.completedAnalyses.length === 1 ? "" : "n"} · {view.results.length} Messwert
              {view.results.length === 1 ? "" : "e"} · Status {labelOf(FRACTION_STATUSES, fraction.status)}
            </span>
          </div>

          {view.breaches.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Go/No-Go-Grenzwert verletzt</AlertTitle>
              <AlertDescription className="text-xs">
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  {view.breaches.map((breach) => (
                    <li key={breach}>{breach}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {view.failingVerdicts.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive mb-2">Parameter außerhalb der Spezifikation</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[18rem] text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-medium pb-1">Kennwert</th>
                      <th className="text-right font-medium pb-1">Ist</th>
                      <th className="text-right font-medium pb-1">Soll</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.failingVerdicts.map((verdict) => (
                      <tr key={verdict.parameterKey} className="border-t border-destructive/20">
                        <td className="py-1 pr-2">{verdict.label}</td>
                        <td className="py-1 text-right font-mono text-destructive">{formatVerdictValue(verdict)}</td>
                        <td className="py-1 text-right font-mono text-muted-foreground">{formatSpecWindow(verdict)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {eligibility.blockers.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Freigabe nicht möglich</AlertTitle>
              <AlertDescription className="text-xs">
                <ul className="list-disc pl-4 space-y-1 mt-1">
                  {eligibility.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {eligibility.allowed && !isReleased && (
            <Alert className="border-success/30 bg-success/5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertTitle className="text-success text-sm">Freigabe möglich</AlertTitle>
              <AlertDescription className="text-xs">
                Mit der Freigabe wird die Fraktion für Produkttests verfügbar und der Status auf
                „{labelOf(FRACTION_STATUSES, releasedStatus)}“ gesetzt.
              </AlertDescription>
            </Alert>
          )}

          {eligibility.needsConfirmation && !isReleased && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <Checkbox
                id="borderline-confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="borderline-confirm" className="text-xs leading-snug font-normal cursor-pointer">
                Die Messwerte liegen innerhalb von 10 % an einer Spezifikationsgrenze. Ich gebe die Fraktion
                bewusst grenzwertig frei und informiere den Produktpartner über die Lage der Werte.
              </Label>
            </div>
          )}

          {isReleased && (
            <Alert className="border-info/30 bg-info/5">
              <CheckCircle2 className="h-4 w-4 text-info" />
              <AlertTitle className="text-info text-sm">Bereits freigegeben</AlertTitle>
              <AlertDescription className="text-xs">
                Die Fraktion ist für Produkttests freigegeben. Ein Zurückziehen{" "}
                {withdrawnStatus === fraction.status
                  ? `belässt den Status bei „${labelOf(FRACTION_STATUSES, fraction.status)}“`
                  : `setzt den Status auf „${labelOf(FRACTION_STATUSES, withdrawnStatus)}“ zurück`}
                ; bereits laufende Produkttests bleiben bestehen.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
          {isReleased ? (
            <Button variant="destructive" onClick={handleWithdraw} disabled={mutate.isPending}>
              {mutate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Undo2 className="h-4 w-4 mr-2" />}
              Freigabe zurückziehen
            </Button>
          ) : (
            <Button onClick={handleRelease} disabled={!canSubmit || mutate.isPending}>
              {mutate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Freigeben
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
