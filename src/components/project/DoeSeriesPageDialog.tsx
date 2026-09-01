import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANALYSIS_PARAMETER_KEYS,
  PROCESS_LINES,
  PROCESS_RULE_OF_THUMB,
  TEST_RUN_PARAMETER_KEYS,
} from "@/lib/project/constants";
import { nextProjectCode } from "@/hooks/project/useProjectData";
import { parseDoeFactors, type DoeFactor, type DoeSeries } from "@/lib/project/types";
import { formatNumber } from "@/components/project/ProjectUI";
import {
  DESIGN_TYPES,
  DOE_SERIES_STATUSES,
  MAX_PLAN_ROWS,
  buildPlan,
  levelsToInput,
  parseLevelInput,
} from "@/components/project/DoeSeriesPageShared";

/** Sentinel for the "own factor key" option - Radix forbids an empty value. */
const CUSTOM_KEY = "__custom__";

export interface DoeSeriesFormPayload {
  code: string;
  name: string;
  process_line: string;
  description: string | null;
  design_type: string;
  planned_runs: number;
  responses: string[];
  factors: DoeFactor[];
  status: string;
}

interface DoeSeriesPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  series: DoeSeries | null;
  isSaving: boolean;
  onSubmit: (payload: DoeSeriesFormPayload) => void;
}

interface FactorDraft {
  id: string;
  /** Selected entry of TEST_RUN_PARAMETER_KEYS, or CUSTOM_KEY. */
  source: string;
  key: string;
  label: string;
  unit: string;
  levels: string;
}

interface FormState {
  name: string;
  processLine: string;
  designType: string;
  plannedRuns: string;
  description: string;
  status: string;
  responses: string[];
  factors: FactorDraft[];
}

let draftCounter = 0;
function nextDraftId(): string {
  draftCounter += 1;
  return `factor-${draftCounter}`;
}

function emptyFactor(): FactorDraft {
  return { id: nextDraftId(), source: CUSTOM_KEY, key: "", label: "", unit: "", levels: "" };
}

function createEmptyForm(): FormState {
  return {
    name: "",
    processLine: PROCESS_LINES[0].id,
    designType: DESIGN_TYPES[0].id,
    plannedRuns: "8",
    description: "",
    status: DOE_SERIES_STATUSES[0].id,
    responses: ["fiber_length_median_mm", "glass_content_pct", "energy_kwh_t"],
    factors: [emptyFactor()],
  };
}

function formFromSeries(series: DoeSeries): FormState {
  const factors = parseDoeFactors(series.factors);
  return {
    name: series.name,
    processLine: series.process_line,
    designType: series.design_type,
    plannedRuns: String(series.planned_runs ?? 0),
    description: series.description ?? "",
    status: series.status,
    responses: series.responses ?? [],
    factors: factors.length
      ? factors.map((factor) => ({
          id: nextDraftId(),
          source: TEST_RUN_PARAMETER_KEYS.some((entry) => entry.key === factor.key)
            ? factor.key
            : CUSTOM_KEY,
          key: factor.key,
          label: factor.label,
          unit: factor.unit ?? "",
          levels: levelsToInput(factor.levels),
        }))
      : [emptyFactor()],
  };
}

export default function DoeSeriesPageDialog({
  open,
  onOpenChange,
  mode,
  series,
  isSaving,
  onSubmit,
}: DoeSeriesPageDialogProps) {
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeAttempt, setCodeAttempt] = useState(0);
  const factorListRef = useRef<HTMLDivElement | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (mode === "edit" && series) {
      setForm(formFromSeries(series));
      setCode(series.code);
      setCodeError(null);
      setCodeLoading(false);
    } else {
      setForm(createEmptyForm());
      setCode("");
    }
  }, [open, mode, series]);

  useEffect(() => {
    if (!open || mode !== "create") return;
    let cancelled = false;
    setCodeLoading(true);
    setCodeError(null);
    nextProjectCode("doe_series")
      .then((generated) => {
        if (!cancelled) setCode(generated);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setCode("");
        setCodeError(error.message);
      })
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, codeAttempt]);

  /* -------------------------------------------------------- factor editing */

  const updateFactor = (id: string, patch: Partial<FactorDraft>) =>
    setForm((prev) => ({
      ...prev,
      factors: prev.factors.map((factor) =>
        factor.id === id ? { ...factor, ...patch } : factor,
      ),
    }));

  const chooseSource = (id: string, source: string) => {
    if (source === CUSTOM_KEY) {
      updateFactor(id, { source, key: "", label: "", unit: "" });
      return;
    }
    const known = TEST_RUN_PARAMETER_KEYS.find((entry) => entry.key === source);
    updateFactor(id, {
      source,
      key: source,
      label: known?.label ?? source,
      unit: known?.unit ?? "",
    });
  };

  const addFactor = () => {
    setForm((prev) => ({ ...prev, factors: [...prev.factors, emptyFactor()] }));
    window.requestAnimationFrame(() => {
      factorListRef.current?.scrollTo({ top: factorListRef.current.scrollHeight });
    });
  };

  const removeFactor = (id: string) =>
    setForm((prev) => ({ ...prev, factors: prev.factors.filter((factor) => factor.id !== id) }));

  const toggleResponse = (key: string, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      responses: checked
        ? [...prev.responses, key]
        : prev.responses.filter((entry) => entry !== key),
    }));

  /* ------------------------------------------------------------- preview */

  const draftFactors = useMemo<DoeFactor[]>(
    () =>
      form.factors
        .map((factor) => ({
          key: factor.key.trim(),
          label: factor.label.trim() || factor.key.trim(),
          unit: factor.unit.trim(),
          levels: parseLevelInput(factor.levels),
        }))
        .filter((factor) => factor.key.length > 0 && factor.levels.length > 0),
    [form.factors],
  );

  const plannedRunsValue = Number.parseInt(form.plannedRuns, 10);
  const preview = useMemo(
    () =>
      buildPlan(
        draftFactors,
        form.designType,
        Number.isFinite(plannedRunsValue) ? plannedRunsValue : 0,
      ),
    [draftFactors, form.designType, plannedRunsValue],
  );

  const processLine = PROCESS_LINES.find((line) => line.id === form.processLine);
  const designType = DESIGN_TYPES.find((entry) => entry.id === form.designType);

  /* -------------------------------------------------------------- submit */

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!code.trim()) nextErrors.code = "Seriencode konnte nicht erzeugt werden.";
    if (!form.name.trim()) nextErrors.name = "Bitte einen Namen vergeben.";

    if (!Number.isInteger(plannedRunsValue) || plannedRunsValue < 0) {
      nextErrors.plannedRuns = "Bitte eine ganze Zahl ≥ 0 eingeben.";
    } else if (form.designType === "fractional_factorial" && plannedRunsValue < 1) {
      nextErrors.plannedRuns =
        "Ein teilfaktorieller Plan braucht die Zielanzahl der Läufe (≥ 1).";
    }

    const seenKeys = new Set<string>();
    const factors: DoeFactor[] = [];
    form.factors.forEach((draft, index) => {
      const key = draft.key.trim();
      const levels = parseLevelInput(draft.levels);
      if (!key) {
        nextErrors[`factor-${index}-key`] = "Bitte einen Faktor-Schlüssel wählen oder eingeben.";
        return;
      }
      if (!/^[a-z0-9_]+$/i.test(key)) {
        nextErrors[`factor-${index}-key`] =
          "Nur Buchstaben, Ziffern und Unterstriche - der Schlüssel wird als Versuchsparameter gespeichert.";
        return;
      }
      if (seenKeys.has(key)) {
        nextErrors[`factor-${index}-key`] = `Der Faktor „${key}“ ist doppelt vergeben.`;
        return;
      }
      if (!levels.length) {
        nextErrors[`factor-${index}-levels`] = "Bitte mindestens eine Stufe angeben.";
        return;
      }
      seenKeys.add(key);
      factors.push({
        key,
        label: draft.label.trim() || key,
        unit: draft.unit.trim(),
        levels,
      });
    });

    if (!factors.length && !Object.keys(nextErrors).some((key) => key.startsWith("factor-"))) {
      nextErrors.factors = "Eine Versuchsreihe braucht mindestens einen Faktor mit Stufen.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      code: code.trim(),
      name: form.name.trim(),
      process_line: form.processLine,
      description: form.description.trim() ? form.description.trim() : null,
      design_type: form.designType,
      planned_runs: plannedRunsValue,
      responses: form.responses,
      factors,
      status: form.status,
    });
  };

  const submitDisabled = isSaving || codeLoading || !code.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Neue Versuchsreihe" : `Versuchsreihe ${series?.code ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            Faktoren, Stufen und Zielgrößen der statistischen Versuchsplanung. Aus den Faktoren
            wird anschließend der Versuchsplan erzeugt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doe-code">Seriencode</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="doe-code"
                  value={codeLoading ? "wird erzeugt …" : code}
                  readOnly
                  className="font-mono"
                  aria-invalid={Boolean(errors.code)}
                />
                {mode === "create" && codeError && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Seriencode erneut erzeugen"
                    onClick={() => setCodeAttempt((value) => value + 1)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {codeError && <p className="text-xs text-destructive">{codeError}</p>}
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doe-name">Name</Label>
              <Input
                id="doe-name"
                placeholder="z. B. Linie A — Faserlänge maximieren"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doe-line">Prozesslinie</Label>
              <Select value={form.processLine} onValueChange={(value) => set("processLine", value)}>
                <SelectTrigger id="doe-line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROCESS_LINES.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doe-status">Status</Label>
              <Select value={form.status} onValueChange={(value) => set("status", value)}>
                <SelectTrigger id="doe-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOE_SERIES_STATUSES.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {processLine && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">
                {processLine.label} — Ziel: {processLine.goal}
              </p>
              <p className="text-muted-foreground">
                Messer {processLine.blades} · Spalt {processLine.gap} · Sieb {processLine.screen} ·
                Drehzahl {processLine.rpm} · Kühlung {processLine.cooling}
              </p>
              <p className="text-muted-foreground">{PROCESS_RULE_OF_THUMB}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doe-design">Design-Typ</Label>
              <Select value={form.designType} onValueChange={(value) => set("designType", value)}>
                <SelectTrigger id="doe-design">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESIGN_TYPES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {designType && <p className="text-xs text-muted-foreground">{designType.note}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="doe-planned">Geplante Läufe</Label>
              <Input
                id="doe-planned"
                inputMode="numeric"
                value={form.plannedRuns}
                onChange={(event) => set("plannedRuns", event.target.value)}
                aria-invalid={Boolean(errors.plannedRuns)}
              />
              {errors.plannedRuns && (
                <p className="text-xs text-destructive">{errors.plannedRuns}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doe-description">Beschreibung</Label>
            <Textarea
              id="doe-description"
              rows={2}
              placeholder="Fragestellung, Randbedingungen, Material …"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>

          {/* ------------------------------------------------------ factors */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Faktoren und Stufen</Label>
              <Button type="button" variant="outline" size="sm" onClick={addFactor}>
                <Plus className="h-4 w-4 mr-1.5" />
                Faktor
              </Button>
            </div>

            {errors.factors && <p className="text-xs text-destructive">{errors.factors}</p>}

            <div ref={factorListRef} className="space-y-3 max-h-[22rem] overflow-y-auto pr-1">
              {form.factors.map((factor, index) => (
                <div key={factor.id} className="rounded-lg border border-border p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Faktor {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Faktor ${index + 1} entfernen`}
                      onClick={() => removeFactor(factor.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${factor.id}-source`} className="text-xs">
                        Versuchsparameter
                      </Label>
                      <Select
                        value={factor.source}
                        onValueChange={(value) => chooseSource(factor.id, value)}
                      >
                        <SelectTrigger id={`${factor.id}-source`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEST_RUN_PARAMETER_KEYS.map((entry) => (
                            <SelectItem key={entry.key} value={entry.key}>
                              {entry.label}
                              {entry.unit ? ` (${entry.unit})` : ""}
                            </SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_KEY}>Eigener Faktor …</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`${factor.id}-key`} className="text-xs">
                        Schlüssel
                      </Label>
                      <Input
                        id={`${factor.id}-key`}
                        className="font-mono text-xs"
                        placeholder="z. B. screen_size_mm"
                        value={factor.key}
                        readOnly={factor.source !== CUSTOM_KEY}
                        onChange={(event) => updateFactor(factor.id, { key: event.target.value })}
                        aria-invalid={Boolean(errors[`factor-${index}-key`])}
                      />
                      {errors[`factor-${index}-key`] && (
                        <p className="text-xs text-destructive">{errors[`factor-${index}-key`]}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${factor.id}-label`} className="text-xs">
                        Bezeichnung
                      </Label>
                      <Input
                        id={`${factor.id}-label`}
                        placeholder="z. B. Sieblochung"
                        value={factor.label}
                        onChange={(event) => updateFactor(factor.id, { label: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${factor.id}-unit`} className="text-xs">
                        Einheit
                      </Label>
                      <Input
                        id={`${factor.id}-unit`}
                        placeholder="z. B. mm"
                        value={factor.unit}
                        onChange={(event) => updateFactor(factor.id, { unit: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`${factor.id}-levels`} className="text-xs">
                      Stufen
                    </Label>
                    <Input
                      id={`${factor.id}-levels`}
                      placeholder="0.1, 0.2, 0.3   oder   scharf, leicht stumpf"
                      value={factor.levels}
                      onChange={(event) => updateFactor(factor.id, { levels: event.target.value })}
                      aria-invalid={Boolean(errors[`factor-${index}-levels`])}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mit Komma trennen, Dezimaltrennzeichen ist der Punkt. Erkannte Stufen:{" "}
                      {parseLevelInput(factor.levels).length}
                    </p>
                    {errors[`factor-${index}-levels`] && (
                      <p className="text-xs text-destructive">
                        {errors[`factor-${index}-levels`]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
              {draftFactors.length === 0 ? (
                <p className="text-muted-foreground">
                  Noch kein vollständiger Faktor — Schlüssel und mindestens eine Stufe angeben.
                </p>
              ) : (
                <>
                  <p className="text-foreground">
                    {draftFactors.map((factor) => factor.levels.length).join(" × ")} ={" "}
                    <strong>{formatNumber(preview.totalCombinations, 0)}</strong> Kombinationen
                    {preview.step > 1 && ` · jede ${preview.step}. Kombination`}
                  </p>
                  <p className="text-muted-foreground">
                    Der Plan umfasst {formatNumber(preview.requestedRows, 0)}{" "}
                    {preview.requestedRows === 1 ? "Lauf" : "Läufe"}
                    {preview.capped && ` (Anzeige auf ${MAX_PLAN_ROWS} Zeilen begrenzt)`}.
                  </p>
                </>
              )}
            </div>

            {preview.tooLarge && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Design zu groß</AlertTitle>
                <AlertDescription className="text-sm">
                  Die Faktorstufen ergeben mehr als eine Million Kombinationen. Reduzieren Sie
                  Faktoren oder Stufen.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* ---------------------------------------------------- responses */}
          <div className="space-y-2">
            <Label>Zielgrößen</Label>
            <p className="text-xs text-muted-foreground">
              Diese Analytikparameter werden in der Auswertung als Antwortgrößen ausgewertet.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 max-h-52 overflow-y-auto rounded-lg border border-border p-3">
              {ANALYSIS_PARAMETER_KEYS.map((parameter) => {
                const checked = form.responses.includes(parameter.key);
                return (
                  <label
                    key={parameter.key}
                    htmlFor={`response-${parameter.key}`}
                    className="flex items-start gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      id={`response-${parameter.key}`}
                      checked={checked}
                      onCheckedChange={(value) => toggleResponse(parameter.key, value === true)}
                      className="mt-0.5"
                    />
                    <span className="leading-tight">
                      {parameter.label}
                      {parameter.unit && (
                        <span className="text-muted-foreground"> ({parameter.unit})</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {form.responses.length} ausgewählt
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "create" ? "Versuchsreihe anlegen" : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
