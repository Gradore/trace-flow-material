/**
 * Detail view of one output fraction: editable master data, the measured
 * values against the target specification, retained sample management and the
 * product tests that already run on this material.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Beaker, ExternalLink, FileDown, Loader2, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useProjectMutation } from "@/hooks/project/useProjectData";
import { useUserRole } from "@/hooks/useUserRole";
import { hasAccess } from "@/components/layout/navigation";
import { ProjectDocuments } from "@/components/project/ProjectDocuments";
import { toast } from "@/hooks/use-toast";
import {
  ConformityBadge,
  ToneBadge,
  formatDate,
  formatEur,
  formatKg,
  formatNumber,
} from "@/components/project/ProjectUI";
import { CONFORMITY_META } from "@/lib/project/spec";
import {
  ANALYSIS_STATUSES,
  FRACTION_STATUSES,
  PROCESS_LINES,
  PRODUCT_TEST_CATEGORIES,
  TEST_RUN_STATUSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import type { FractionSpec, ProductTestResult } from "@/lib/project/types";
import { downloadFractionDatasheet } from "./FractionsDatasheet";
import {
  decimalToInput,
  formatSpecWindow,
  formatVerdictValue,
  isDecimalInputValid,
  parseDecimal,
  VERDICT_LABEL,
  type FractionView,
} from "./FractionsShared";

interface FormState {
  targetFractionId: string;
  weightKg: string;
  status: string;
  storageLocation: string;
  retainedSampleKg: string;
  notes: string;
}

export function FractionsDetailDialog({
  view,
  specs,
  productTestResults,
  open,
  onOpenChange,
}: {
  view: FractionView | null;
  specs: FractionSpec[];
  productTestResults: ProductTestResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { role, isAdmin } = useUserRole();
  /* intake darf /projekt/fraktionen, aber nicht /output. */
  const canOpenOutput = hasAccess("/output", role, isAdmin);

  const [form, setForm] = useState<FormState>({
    targetFractionId: "",
    weightKg: "",
    status: "produced",
    storageLocation: "",
    retainedSampleKg: "",
    notes: "",
  });

  // Reset only when the dialog opens, the fraction changes or the record was
  // genuinely written to - a background refetch must not eat pending edits.
  const fractionId = view?.fraction.id ?? null;
  const fractionUpdatedAt = view?.fraction.updated_at ?? null;
  useEffect(() => {
    if (!open || !view) return;
    const { fraction } = view;
    setForm({
      targetFractionId: fraction.target_fraction_id ?? "",
      weightKg: decimalToInput(fraction.weight_kg),
      status: fraction.status,
      storageLocation: fraction.storage_location ?? "",
      retainedSampleKg: decimalToInput(fraction.retained_sample_kg),
      notes: fraction.notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fractionId, fractionUpdatedAt]);

  const save = useProjectMutation(
    async (vars: { id: string; form: FormState }) => {
      const { data, error } = await supabase
        .from("output_fractions")
        .update({
          target_fraction_id: vars.form.targetFractionId || null,
          weight_kg: parseDecimal(vars.form.weightKg) ?? 0,
          status: vars.form.status,
          storage_location: vars.form.storageLocation.trim() || null,
          retained_sample_kg: parseDecimal(vars.form.retainedSampleKg),
          notes: vars.form.notes.trim() || null,
          // yield_pct wird vom Trigger compute_fraction_yield gefüllt und
          // nie vom Client geschrieben.
        })
        .eq("id", vars.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
    },
    {
      successMessage: "Fraktion gespeichert",
      errorMessage: "Fraktion konnte nicht gespeichert werden",
      onDone: () => onOpenChange(false),
    },
  );

  const weight = parseDecimal(form.weightKg);
  const retained = parseDecimal(form.retainedSampleKg);

  const validationMessage = useMemo(() => {
    if (!isDecimalInputValid(form.weightKg) || !isDecimalInputValid(form.retainedSampleKg)) {
      return "Bitte nur Zahlen eingeben (Dezimaltrennzeichen Komma oder Punkt).";
    }
    if (weight === null) return "Eine Menge in kg ist erforderlich.";
    if (weight < 0) return "Die Menge kann nicht negativ sein.";
    if (retained !== null && retained < 0) return "Das Rückstellmuster kann nicht negativ sein.";
    if (retained !== null && retained > weight) {
      return "Das Rückstellmuster kann nicht größer als die Fraktionsmenge sein.";
    }
    return null;
  }, [form.weightKg, form.retainedSampleKg, weight, retained]);

  if (!view) return null;

  const { fraction, spec, run } = view;
  const field = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  // jsPDF wirft synchron - ohne Abfangen bliebe der Klick wirkungslos.
  const handleDatasheet = () => {
    try {
      downloadFractionDatasheet(view, productTestResults);
      toast({ title: `Datenblatt ${fraction.fraction_code} erstellt` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Datenblatt konnte nicht erstellt werden",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base flex flex-wrap items-center gap-2">
            <span className="font-mono">{fraction.fraction_code}</span>
            <ConformityBadge level={view.conformity} />
            {fraction.released_for_product_test && (
              <ToneBadge tone="success">Freigegeben</ToneBadge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {spec ? `${spec.id} — ${spec.name}` : "Ohne Zielfraktion"}
            {run ? ` · Versuch ${run.run_code}` : ""}
            {spec?.process_line ? ` · ${labelOf(PROCESS_LINES, spec.process_line)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="master">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto gap-1">
            <TabsTrigger value="master" className="text-xs py-1.5">Stammdaten</TabsTrigger>
            <TabsTrigger value="spec" className="text-xs py-1.5">Ist vs. Soll</TabsTrigger>
            <TabsTrigger value="retained" className="text-xs py-1.5">Rückstellmuster</TabsTrigger>
            <TabsTrigger value="tests" className="text-xs py-1.5">Produkttests</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs py-1.5">Dokumente</TabsTrigger>
          </TabsList>

          {/* ------------------------------------------------ master data */}
          <TabsContent value="master" className="space-y-3 mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="detail-target">Zielfraktion</Label>
                <Select
                  value={form.targetFractionId || "none"}
                  onValueChange={(value) => field("targetFractionId", value === "none" ? "" : value)}
                >
                  <SelectTrigger id="detail-target">
                    <SelectValue placeholder="Zielfraktion wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht zugeordnet</SelectItem>
                    {specs.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.id} — {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="detail-status">Status</Label>
                <Select value={form.status} onValueChange={(value) => field("status", value)}>
                  <SelectTrigger id="detail-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRACTION_STATUSES.map((status) => (
                      <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="detail-weight">Menge (kg)</Label>
                <Input
                  id="detail-weight"
                  inputMode="decimal"
                  value={form.weightKg}
                  onChange={(e) => field("weightKg", e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Ausbeute {fraction.yield_pct !== null ? `${formatNumber(fraction.yield_pct)} %` : "—"}
                  {run?.input_weight_kg
                    ? ` (Einsatz ${formatKg(run.input_weight_kg)}) · von der Datenbank berechnet, hier nicht überschrieben`
                    : " · braucht ein Einsatzgewicht am Versuchslauf, wird von der Datenbank berechnet"}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Wert nach Zielpreis</Label>
                <div className="h-10 flex items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                  {view.valueEur === null ? "Kein Zielpreis hinterlegt" : formatEur(view.valueEur)}
                  {spec?.target_price_eur_t !== null && spec?.target_price_eur_t !== undefined && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({formatEur(spec.target_price_eur_t)}/t)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="detail-notes">Notizen</Label>
              <Textarea
                id="detail-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
                placeholder="Beobachtungen zur Fraktion, Auffälligkeiten beim Sichten, Geruch, Staub …"
              />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t pt-3">
              <div>
                <dt className="text-muted-foreground">Versuchslauf</dt>
                <dd className="font-medium">
                  {run ? (
                    <Link to="/projekt/versuche" className="underline underline-offset-2">
                      {run.run_code}
                    </Link>
                  ) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Angelegt</dt>
                <dd className="font-medium">{formatDate(fraction.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Zuletzt geändert</dt>
                <dd className="font-medium">{formatDate(fraction.updated_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lagerbestand</dt>
                <dd className="font-medium">
                  {fraction.output_material_id ? (
                    canOpenOutput ? (
                      <Link to="/output" className="underline underline-offset-2 inline-flex items-center gap-1">
                        gebucht <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      "gebucht"
                    )
                  ) : "nicht gebucht"}
                </dd>
              </div>
            </dl>
          </TabsContent>

          {/* --------------------------------------------- measured values */}
          <TabsContent value="spec" className="space-y-3 mt-4">
            {view.breaches.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Go/No-Go-Grenzwert verletzt</AlertTitle>
                <AlertDescription className="text-xs">
                  <ul className="list-disc pl-4 space-y-1 mt-1">
                    {view.breaches.map((breach) => <li key={breach}>{breach}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {view.verdicts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Für diese Fraktion liegen noch keine Analyseergebnisse vor.{" "}
                <Link to="/projekt/analytik" className="underline underline-offset-2">Analytik beauftragen</Link>
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Kennwert</th>
                      <th className="text-right font-medium px-3 py-2">Ist</th>
                      <th className="text-right font-medium px-3 py-2">Soll</th>
                      <th className="text-left font-medium px-3 py-2">Bewertung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.verdicts.map((verdict) => (
                      <tr key={verdict.parameterKey} className="border-t">
                        <td className="px-3 py-2">{verdict.label}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatVerdictValue(verdict)}</td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {formatSpecWindow(verdict)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className={`h-2 w-2 rounded-full ${CONFORMITY_META[verdict.level].dot}`} aria-hidden />
                            <span>{VERDICT_LABEL[verdict.level]}</span>
                          </span>
                          <span className="block text-[11px] text-muted-foreground">{verdict.note}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Analysen dieser Fraktion ({view.analyses.length})
              </p>
              {view.analyses.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine Analytik beauftragt.</p>
              ) : (
                <ul className="space-y-1.5">
                  {view.analyses.map((analysis) => (
                    <li key={analysis.id} className="flex flex-wrap items-center gap-2 text-xs">
                      <Beaker className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono">{analysis.analysis_code}</span>
                      <ToneBadge tone={toneOf(ANALYSIS_STATUSES, analysis.status)}>
                        {labelOf(ANALYSIS_STATUSES, analysis.status)}
                      </ToneBadge>
                      <span className="text-muted-foreground">{analysis.method ?? "ohne Methode"}</span>
                      <span className="text-muted-foreground">{formatDate(analysis.result_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* -------------------------------------------- retained samples */}
          <TabsContent value="retained" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              Das Rückstellmuster ist der Beleg gegenüber Produktpartnern und Laboren. Ohne Rückstellmuster
              lässt sich eine spätere Reklamation nicht mehr gegen die ursprüngliche Charge prüfen.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="detail-retained">Rückstellmuster (kg)</Label>
                <Input
                  id="detail-retained"
                  inputMode="decimal"
                  value={form.retainedSampleKg}
                  onChange={(e) => field("retainedSampleKg", e.target.value)}
                  placeholder="z. B. 2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="detail-storage">Lagerort</Label>
                <Input
                  id="detail-storage"
                  value={form.storageLocation}
                  onChange={(e) => field("storageLocation", e.target.value)}
                  placeholder="z. B. Regal C3, Musterschrank"
                />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
              <p>
                Aktuell hinterlegt:{" "}
                <strong>
                  {fraction.retained_sample_kg !== null ? formatKg(fraction.retained_sample_kg) : "kein Rückstellmuster"}
                </strong>
              </p>
              <p>
                Lagerort: <strong>{fraction.storage_location ?? "nicht gesetzt"}</strong>
              </p>
              <p>
                Verbleibende Fraktionsmenge nach Rückstellung:{" "}
                <strong>
                  {weight !== null ? formatKg(Math.max(weight - (retained ?? 0), 0)) : "—"}
                </strong>
              </p>
            </div>
          </TabsContent>

          {/* ------------------------------------------------ product tests */}
          <TabsContent value="tests" className="space-y-3 mt-4">
            {view.productTests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Für diese Fraktion läuft noch kein Produkttest.{" "}
                <Link to="/projekt/produkttests" className="underline underline-offset-2">Produkttests öffnen</Link>
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Test</th>
                      <th className="text-left font-medium px-3 py-2">Kategorie</th>
                      <th className="text-right font-medium px-3 py-2">Dosierung</th>
                      <th className="text-left font-medium px-3 py-2">Status</th>
                      <th className="text-left font-medium px-3 py-2">Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.productTests.map((test) => (
                      <tr key={test.id} className="border-t">
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs">{test.test_code}</span>
                          <span className="block text-xs text-muted-foreground">{test.title}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">{labelOf(PRODUCT_TEST_CATEGORIES, test.category)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {test.dosage_pct !== null ? `${formatNumber(test.dosage_pct, 1)} %` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <ToneBadge tone={toneOf(TEST_RUN_STATUSES, test.status)}>
                            {labelOf(TEST_RUN_STATUSES, test.status)}
                          </ToneBadge>
                        </td>
                        <td className="px-3 py-2 text-xs">{formatDate(test.actual_date ?? test.planned_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Link to="/projekt/produkttests" className="text-xs underline underline-offset-2 inline-flex items-center gap-1">
              Zu den Produkttests <ExternalLink className="h-3 w-3" />
            </Link>
          </TabsContent>

          {/* --------------------------------------------------- documents */}
          <TabsContent value="documents" className="mt-4">
            <ProjectDocuments
              entityType="output_fraction"
              entityId={fraction.id}
              title="Dokumente zur Fraktion"
              description="Fotos der Fraktion, Laborberichte und Datenblätter."
            />
          </TabsContent>
        </Tabs>

        {validationMessage && <p className="text-xs text-destructive">{validationMessage}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleDatasheet}>
            <FileDown className="h-4 w-4 mr-2" />
            Datenblatt (PDF)
          </Button>
          <Button
            onClick={() => save.mutate({ id: fraction.id, form })}
            disabled={save.isPending || validationMessage !== null}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
