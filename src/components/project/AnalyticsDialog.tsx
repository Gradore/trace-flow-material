import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ANALYSIS_METHODS,
  ANALYSIS_STATUSES,
  PARTNER_CATEGORIES,
  labelOf,
} from "@/lib/project/constants";
import { nextProjectCode, useProjectMutation } from "@/hooks/project/useProjectData";
import { IpGateBanner } from "@/components/project/ProjectUI";
import type { FractionAnalysis, FractionSpec, OutputFraction, Partner } from "@/lib/project/types";
import { NONE, formatSpecWindow, fractionLabel, parseDecimal } from "./AnalyticsShared";

const LAB_CATEGORIES = ["lab", "research_institute"];

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AnalyticsDialog({
  open,
  onOpenChange,
  analysis,
  fractions,
  partners,
  specs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new analysis. */
  analysis: FractionAnalysis | null;
  fractions: OutputFraction[];
  partners: Partner[];
  specs: FractionSpec[];
}) {
  const isEdit = Boolean(analysis);
  const analysisId = analysis?.id ?? null;

  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [fractionId, setFractionId] = useState<string>(NONE);
  const [labId, setLabId] = useState<string>(NONE);
  const [method, setMethod] = useState<string>(NONE);
  const [status, setStatus] = useState("ordered");
  const [sentDate, setSentDate] = useState("");
  const [resultDate, setResultDate] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const loadCode = useCallback(async () => {
    setCodeLoading(true);
    setCodeError(null);
    try {
      const generated = await nextProjectCode("analysis");
      setCode(generated);
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : "Analysenummer konnte nicht erzeugt werden");
    } finally {
      setCodeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (analysis) {
      setCode(analysis.analysis_code);
      setCodeError(null);
      setFractionId(analysis.output_fraction_id ?? NONE);
      setLabId(analysis.lab_partner_id ?? NONE);
      setMethod(analysis.method ?? NONE);
      setStatus(analysis.status);
      setSentDate(toDateInput(analysis.sample_sent_date));
      setResultDate(toDateInput(analysis.result_date));
      setCost(analysis.cost_eur === null ? "" : String(analysis.cost_eur));
      setNotes(analysis.notes ?? "");
      return;
    }
    setCode("");
    setFractionId(NONE);
    setLabId(NONE);
    setMethod(NONE);
    setStatus("ordered");
    setSentDate(todayIso());
    setResultDate("");
    setCost("");
    setNotes("");
    void loadCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, analysisId, loadCode]);

  const labPartners = useMemo(
    () => partners.filter((p) => LAB_CATEGORIES.includes(p.category)),
    [partners],
  );
  const otherPartners = useMemo(
    () => partners.filter((p) => !LAB_CATEGORIES.includes(p.category)),
    [partners],
  );

  const methodOptions = useMemo(() => {
    const list = [...ANALYSIS_METHODS] as string[];
    if (analysis?.method && !list.includes(analysis.method)) list.push(analysis.method);
    return list;
  }, [analysis?.method]);

  const selectedFraction = fractions.find((f) => f.id === fractionId) ?? null;
  const selectedSpec = selectedFraction?.target_fraction_id
    ? specs.find((s) => s.id === selectedFraction.target_fraction_id) ?? null
    : null;

  const save = useProjectMutation(
    async (vars: {
      analysis_code: string;
      output_fraction_id: string | null;
      lab_partner_id: string | null;
      method: string | null;
      sample_sent_date: string | null;
      result_date: string | null;
      status: string;
      cost_eur: number | null;
      notes: string | null;
    }) => {
      if (analysisId) {
        const { data, error } = await supabase
          .from("fraction_analyses")
          .update({
            output_fraction_id: vars.output_fraction_id,
            lab_partner_id: vars.lab_partner_id,
            method: vars.method,
            sample_sent_date: vars.sample_sent_date,
            result_date: vars.result_date,
            status: vars.status,
            cost_eur: vars.cost_eur,
            notes: vars.notes,
          })
          .eq("id", analysisId)
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        return;
      }

      const { data, error } = await supabase
        .from("fraction_analyses")
        .insert({
          analysis_code: vars.analysis_code,
          output_fraction_id: vars.output_fraction_id,
          lab_partner_id: vars.lab_partner_id,
          method: vars.method,
          sample_sent_date: vars.sample_sent_date,
          result_date: vars.result_date,
          status: vars.status,
          cost_eur: vars.cost_eur,
          notes: vars.notes,
        })
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("Analyse konnte nicht angelegt werden");
    },
    {
      successMessage: isEdit ? "Analyse aktualisiert" : "Analyse beauftragt",
      errorMessage: isEdit ? "Analyse konnte nicht gespeichert werden" : "Analyse konnte nicht angelegt werden",
      onDone: () => onOpenChange(false),
    },
  );

  const handleSubmit = () => {
    setFormError(null);

    if (!code.trim()) {
      setFormError("Es liegt keine Analysenummer vor. Bitte erneut erzeugen.");
      return;
    }
    if (fractionId === NONE) {
      setFormError("Bitte die zu untersuchende Fraktion wählen.");
      return;
    }
    const parsedCost = parseDecimal(cost);
    if (parsedCost === undefined) {
      setFormError("Die Kosten sind keine gültige Zahl.");
      return;
    }

    const finalResultDate = status === "completed" && !resultDate ? todayIso() : resultDate || null;

    save.mutate({
      analysis_code: code.trim(),
      output_fraction_id: fractionId,
      lab_partner_id: labId === NONE ? null : labId,
      method: method === NONE ? null : method,
      sample_sent_date: sentDate || null,
      result_date: finalResultDate,
      status,
      cost_eur: parsedCost,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Analyse ${analysis?.analysis_code ?? ""} bearbeiten` : "Neue Laboranalyse beauftragen"}
          </DialogTitle>
          <DialogDescription>
            Eine Analyse gehört immer zu genau einer Fraktion. Das Sollfenster kommt aus der Zielfraktion
            und wird beim Speichern der Messwerte automatisch angewendet.
          </DialogDescription>
        </DialogHeader>

        {!isEdit && <IpGateBanner compact />}

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="analysis-code">Analysenummer</Label>
              <div className="flex gap-2">
                <Input id="analysis-code" value={codeLoading ? "" : code} readOnly disabled className="font-mono" />
                {!isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void loadCode()}
                    disabled={codeLoading}
                    aria-label="Analysenummer neu erzeugen"
                  >
                    {codeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              {codeError && <p className="text-xs text-destructive">{codeError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="analysis-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="analysis-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {ANALYSIS_STATUSES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis-fraction">Fraktion</Label>
            <Select value={fractionId} onValueChange={setFractionId}>
              <SelectTrigger id="analysis-fraction">
                <SelectValue placeholder="Fraktion wählen" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {fractions.length === 0 ? (
                  <SelectItem value={NONE} disabled>
                    Keine Fraktionen vorhanden
                  </SelectItem>
                ) : (
                  fractions.map((fraction) => (
                    <SelectItem key={fraction.id} value={fraction.id}>
                      {fractionLabel(fraction)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedSpec && (
              <p className="text-xs text-muted-foreground">
                Zielfraktion {selectedSpec.id} — {selectedSpec.name}. Faserlänge{" "}
                {formatSpecWindow(selectedSpec.fiber_length_min_mm, selectedSpec.fiber_length_max_mm, "mm")}, Glasgehalt{" "}
                {formatSpecWindow(selectedSpec.glass_content_min_pct, null, "%")}.
              </p>
            )}
            {fractions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Es existieren noch keine Fraktionen. Zuerst einen Versuch auswerten und Fraktionen erfassen.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="analysis-lab">Labor / Institut</Label>
              <Select value={labId} onValueChange={setLabId}>
                <SelectTrigger id="analysis-lab">
                  <SelectValue placeholder="Labor wählen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={NONE}>Noch offen</SelectItem>
                  {labPartners.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Labore &amp; Institute</SelectLabel>
                      {labPartners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {otherPartners.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Weitere Partner</SelectLabel>
                      {otherPartners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name} ({labelOf(PARTNER_CATEGORIES, partner.category)})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="analysis-method">Methode</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="analysis-method">
                  <SelectValue placeholder="Methode wählen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={NONE}>Nicht festgelegt</SelectItem>
                  {methodOptions.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="analysis-sent">Probe versendet am</Label>
              <Input
                id="analysis-sent"
                type="date"
                value={sentDate}
                onChange={(event) => setSentDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="analysis-result-date">Ergebnis am</Label>
              <Input
                id="analysis-result-date"
                type="date"
                value={resultDate}
                onChange={(event) => setResultDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis-cost">Kosten (EUR)</Label>
            <Input
              id="analysis-cost"
              inputMode="decimal"
              placeholder="z. B. 450"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis-notes">Notizen</Label>
            <Textarea
              id="analysis-notes"
              rows={3}
              placeholder="Probenmenge, Ansprechpartner, Auftragsnummer des Labors …"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Eingabe unvollständig</AlertTitle>
              <AlertDescription className="text-sm">{formError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={save.isPending || codeLoading || !code}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Änderungen speichern" : "Analyse anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
