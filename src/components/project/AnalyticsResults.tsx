import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ANALYSIS_PARAMETER_KEYS } from "@/lib/project/constants";
import { evaluateResult, goNoGoBreaches, specWindow, type ParameterVerdict } from "@/lib/project/spec";
import { useProjectMutation } from "@/hooks/project/useProjectData";
import { ConformityBadge } from "@/components/project/ProjectUI";
import type { AnalysisResult, FractionSpec } from "@/lib/project/types";
import {
  GoNoGoAlert,
  MANDATORY_PARAMETER_KEYS,
  MandatoryChecklist,
  VerdictList,
  type AnalysisView,
  formatSpecWindow,
  fractionLabel,
  parseDecimal,
} from "./AnalyticsShared";

interface RowState {
  key: string;
  label: string;
  unit: string;
  method: string;
  raw: string;
  text: string;
  parsed: number | null;
  invalid: boolean;
  mandatory: boolean;
  verdict: ParameterVerdict;
}

interface ResultDiff {
  toDelete: string[];
  toUpdate: { id: string; value_numeric: number | null; value_text: string | null; unit: string | null }[];
  toInsert: {
    analysis_id: string;
    parameter_key: string;
    value_numeric: number | null;
    value_text: string | null;
    unit: string | null;
  }[];
}

function buildRows(
  values: Record<string, string>,
  texts: Record<string, string>,
  spec: FractionSpec | null,
): RowState[] {
  return ANALYSIS_PARAMETER_KEYS.map((entry) => {
    const raw = values[entry.key] ?? "";
    const text = texts[entry.key] ?? "";
    const parsed = parseDecimal(raw);
    const invalid = parsed === undefined;
    const numeric = invalid ? null : parsed ?? null;
    const verdict = evaluateResult(
      { parameter_key: entry.key, value_numeric: numeric, spec_min: null, spec_max: null },
      spec,
    );
    return {
      key: entry.key,
      label: entry.label,
      unit: entry.unit,
      method: entry.method,
      raw,
      text,
      parsed: numeric,
      invalid,
      mandatory: MANDATORY_PARAMETER_KEYS.includes(entry.key),
      verdict,
    };
  });
}

/** Rows to delete / update / insert. spec_min, spec_max and pass_fail stay untouched - a DB trigger fills them. */
function buildDiff(rows: RowState[], existing: AnalysisResult[], analysisId: string): ResultDiff {
  const existingByKey = new Map(existing.map((row) => [row.parameter_key, row]));
  const diff: ResultDiff = { toDelete: [], toUpdate: [], toInsert: [] };

  rows.forEach((row) => {
    if (row.invalid) return;
    const text = row.text.trim();
    const isEmpty = row.parsed === null && text === "";
    const current = existingByKey.get(row.key);
    const unit = row.unit || null;

    if (current) {
      if (isEmpty) {
        diff.toDelete.push(current.id);
        return;
      }
      const changed =
        (current.value_numeric ?? null) !== row.parsed ||
        (current.value_text ?? "") !== text ||
        (current.unit ?? "") !== (unit ?? "");
      if (changed) {
        diff.toUpdate.push({ id: current.id, value_numeric: row.parsed, value_text: text || null, unit });
      }
      return;
    }
    if (!isEmpty) {
      diff.toInsert.push({
        analysis_id: analysisId,
        parameter_key: row.key,
        value_numeric: row.parsed,
        value_text: text || null,
        unit,
      });
    }
  });

  return diff;
}

export function AnalyticsResults({
  view,
  open,
  onOpenChange,
}: {
  view: AnalysisView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [markCompleted, setMarkCompleted] = useState(false);
  const [saved, setSaved] = useState(false);

  const analysisId = view?.analysis.id ?? null;
  const spec = view?.spec ?? null;

  /** Changes only when the stored rows really change - keeps typing intact. */
  const signature = useMemo(
    () =>
      (view?.results ?? [])
        .map((row) => `${row.id}:${row.value_numeric ?? ""}:${row.value_text ?? ""}:${row.unit ?? ""}`)
        .join("|"),
    [view?.results],
  );

  useEffect(() => {
    if (!open || !view) return;
    const nextValues: Record<string, string> = {};
    const nextTexts: Record<string, string> = {};
    view.results.forEach((row) => {
      nextValues[row.parameter_key] = row.value_numeric === null ? "" : String(row.value_numeric);
      nextTexts[row.parameter_key] = row.value_text ?? "";
    });
    setValues(nextValues);
    setTexts(nextTexts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, analysisId, signature]);

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setMarkCompleted(false);
  }, [open, analysisId]);

  const rows = useMemo(() => buildRows(values, texts, spec), [values, texts, spec]);
  const diff = useMemo(
    () => buildDiff(rows, view?.results ?? [], analysisId ?? ""),
    [rows, view?.results, analysisId],
  );

  const hasInvalid = rows.some((row) => row.invalid);
  const hasChanges = diff.toDelete.length + diff.toUpdate.length + diff.toInsert.length > 0;

  const liveBreaches = useMemo(
    () => goNoGoBreaches(rows.map((row) => ({ parameter_key: row.key, value_numeric: row.parsed }))),
    [rows],
  );

  const presentKeys = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (row.parsed !== null || row.text.trim() !== "") set.add(row.key);
    });
    return set;
  }, [rows]);

  const enteredVerdicts = rows.filter((row) => row.parsed !== null).map((row) => row.verdict);

  const save = useProjectMutation(
    async (vars: { diff: ResultDiff; complete: boolean }) => {
      if (!analysisId) throw new Error("Keine Analyse ausgewählt");

      if (vars.diff.toDelete.length) {
        const { data, error } = await supabase
          .from("fraction_analysis_results")
          .delete()
          .in("id", vars.diff.toDelete)
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length !== vars.diff.toDelete.length) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
      }

      for (const row of vars.diff.toUpdate) {
        const { data, error } = await supabase
          .from("fraction_analysis_results")
          .update({ value_numeric: row.value_numeric, value_text: row.value_text, unit: row.unit })
          .eq("id", row.id)
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }

      if (vars.diff.toInsert.length) {
        const { data, error } = await supabase
          .from("fraction_analysis_results")
          .insert(vars.diff.toInsert)
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length !== vars.diff.toInsert.length) {
          throw new Error("Messwerte konnten nicht gespeichert werden");
        }
      }

      if (vars.complete) {
        const { data, error } = await supabase
          .from("fraction_analyses")
          .update({
            status: "completed",
            result_date: view?.analysis.result_date ?? new Date().toISOString().slice(0, 10),
          })
          .eq("id", analysisId)
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Messwerte gespeichert",
      errorMessage: "Messwerte konnten nicht gespeichert werden",
      onDone: () => {
        setSaved(true);
        setMarkCompleted(false);
      },
    },
  );

  const alreadyCompleted = view?.analysis.status === "completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="break-words">
            Messwerte {view?.analysis.analysis_code ?? ""}
          </DialogTitle>
          <DialogDescription>
            Fraktion {fractionLabel(view?.fraction ?? null)}
            {view?.spec ? ` · Sollwerte aus ${view.spec.id} (${view.spec.name})` : " · keine Zielfraktion hinterlegt"}
          </DialogDescription>
        </DialogHeader>

        {!view ? (
          <p className="text-sm text-muted-foreground">Keine Analyse ausgewählt.</p>
        ) : (
          <div className="space-y-4">
            <GoNoGoAlert breaches={liveBreaches} />

            {saved && (
              <Alert className="border-success/30 bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertTitle className="text-success">Messwerte gespeichert</AlertTitle>
                <AlertDescription className="text-sm">
                  Sollfenster und Pass/Fail wurden von der Datenbank aus der Zielfraktion ergänzt.
                </AlertDescription>
              </Alert>
            )}

            <MandatoryChecklist presentKeys={presentKeys} />

            <div className="space-y-2">
              {rows.map((row) => {
                const window = specWindow(row.key, spec);
                return (
                  <div key={row.key} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {row.label}
                          {row.unit ? <span className="text-muted-foreground"> ({row.unit})</span> : null}
                          {row.mandatory && (
                            <Badge variant="outline" className="ml-2 align-middle text-[10px] px-1.5 py-0">
                              Pflicht
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {row.method} · Soll {formatSpecWindow(window.min, window.max, row.unit)}
                        </p>
                      </div>
                      {row.parsed !== null && <ConformityBadge level={row.verdict.level} className="shrink-0" />}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
                      <Input
                        inputMode="decimal"
                        placeholder="Messwert"
                        aria-label={`${row.label} Messwert`}
                        aria-invalid={row.invalid}
                        className={row.invalid ? "border-destructive" : undefined}
                        value={row.raw}
                        onChange={(event) =>
                          setValues((prev) => ({ ...prev, [row.key]: event.target.value }))
                        }
                      />
                      <Input
                        placeholder="Bemerkung (optional)"
                        aria-label={`${row.label} Bemerkung`}
                        value={row.text}
                        onChange={(event) => setTexts((prev) => ({ ...prev, [row.key]: event.target.value }))}
                      />
                    </div>

                    {row.invalid && <p className="text-xs text-destructive">Keine gültige Zahl (z. B. 0,35).</p>}
                    {row.parsed !== null && row.verdict.level !== "unknown" && (
                      <p className="text-xs text-muted-foreground">{row.verdict.note}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {enteredVerdicts.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Bewertung gegen die Spezifikation</p>
                  <VerdictList verdicts={enteredVerdicts} />
                </div>
              </>
            )}

            {!alreadyCompleted && (
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
                <Checkbox
                  checked={markCompleted}
                  onCheckedChange={(checked) => setMarkCompleted(checked === true)}
                  aria-label="Analyse als abgeschlossen markieren"
                />
                <span className="text-sm">
                  Analyse als <strong>abgeschlossen</strong> markieren
                  <span className="block text-xs text-muted-foreground">
                    Setzt den Status auf „Abgeschlossen“
                    {view.analysis.result_date ? "." : " und trägt das heutige Datum als Ergebnisdatum ein."}
                  </span>
                </span>
              </label>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Schließen
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate({ diff, complete: markCompleted })}
            disabled={!view || save.isPending || hasInvalid || (!hasChanges && !markCompleted)}
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Messwerte speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
