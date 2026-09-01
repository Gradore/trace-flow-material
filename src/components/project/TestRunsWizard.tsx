import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw, Wand2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IpGateBanner } from "@/components/project/ProjectUI";
import {
  NONE,
  doeLevelsForRun,
  parseDecimal,
  trimmedOrNull,
} from "@/components/project/TestRunsShared";
import { ProcessLineCard } from "@/components/project/TestRunsProcessLine";
import {
  BATCH_STATUSES,
  MACHINE_TYPES,
  MATERIAL_CLASSES,
  PROCESS_LINES,
  TEST_RUN_PARAMETER_KEYS,
  TEST_RUN_STATUSES,
  labelOf,
} from "@/lib/project/constants";
import { nextProjectCode, usePatentFiled } from "@/hooks/project/useProjectData";
import { parseDoeFactors } from "@/lib/project/types";
import type { DoeSeries, MaterialBatch, Partner } from "@/lib/project/types";
import { cn } from "@/lib/utils";

export interface TestRunParameterInput {
  parameter_key: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
}

export interface TestRunWizardPayload {
  run: {
    run_code: string;
    title: string;
    partner_id: string | null;
    machine_name: string | null;
    machine_type: string | null;
    input_batch_id: string | null;
    input_weight_kg: number | null;
    process_line: string;
    planned_date: string | null;
    status: string;
    responsible: string | null;
    cost_eur: number | null;
    doe_series_id: string | null;
    doe_run_number: number | null;
  };
  parameters: TestRunParameterInput[];
}

interface TestRunsWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: Partner[];
  batches: MaterialBatch[];
  doeSeries: DoeSeries[];
  /** kg already fed into other test runs, per batch id. */
  batchUsage: Map<string, number>;
  isSaving: boolean;
  onSubmit: (payload: TestRunWizardPayload) => void;
}

interface FormState {
  title: string;
  partnerId: string;
  machineName: string;
  machineType: string;
  processLine: string;
  plannedDate: string;
  responsible: string;
  costEur: string;
  status: string;
  batchId: string;
  inputWeightKg: string;
  doeSeriesId: string;
  doeRunNumber: string;
  parameters: Record<string, string>;
}

const STEPS = [
  { index: 1, label: "Stammdaten" },
  { index: 2, label: "Input" },
  { index: 3, label: "Parameter" },
] as const;

/** Feldreihenfolge im Dialog - so wird immer der oberste Fehler angesprungen. */
const ERROR_FIELD_ORDER = ["title", "processLine", "costEur", "inputWeightKg", "doeRunNumber"];

/** Id des Eingabefelds, das zu einem Validierungsfehler gehört. */
function focusIdForError(key: string): string | null {
  if (key === "title") return "run-title";
  if (key === "processLine") return `line-${PROCESS_LINES[0]?.id ?? ""}`;
  if (key === "costEur") return "run-cost";
  if (key === "inputWeightKg") return "run-input-kg";
  if (key === "doeRunNumber") return "run-doe-number";
  if (key.startsWith("param_")) return `param-${key.slice("param_".length)}`;
  return null;
}

/**
 * Der Dialogkörper ist der Scroller. Ohne Sprung zum Fehler wirkt "Weiter" auf
 * dem Handy tot, weil die Meldung weit über dem sichtbaren Bereich steht.
 */
function focusFirstError(found: Record<string, string>) {
  const keys = Object.keys(found);
  if (!keys.length) return;
  const ordered = [
    ...ERROR_FIELD_ORDER.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !ERROR_FIELD_ORDER.includes(key)),
  ];
  const id = focusIdForError(ordered[0]);
  if (!id) return;
  // Erst nach dem Render des Schritts suchen, sonst existiert das Feld noch nicht.
  window.requestAnimationFrame(() => {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.focus({ preventScroll: true });
  });
}

function emptyForm(): FormState {
  return {
    title: "",
    partnerId: NONE,
    machineName: "",
    machineType: NONE,
    processLine: PROCESS_LINES[0].id,
    plannedDate: new Date().toISOString().slice(0, 10),
    responsible: "",
    costEur: "",
    status: "planned",
    batchId: NONE,
    inputWeightKg: "",
    doeSeriesId: NONE,
    doeRunNumber: "",
    parameters: {},
  };
}

export default function TestRunsWizard({
  open,
  onOpenChange,
  partners,
  batches,
  doeSeries,
  batchUsage,
  isSaving,
  onSubmit,
}: TestRunsWizardProps) {
  const { isFiled: patentFiled } = usePatentFiled();

  // Der Dialogkörper scrollt selbst - der Ref hält ihn für Sprünge greifbar.
  const bodyRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ipConfirmed, setIpConfirmed] = useState(false);

  const [runCode, setRunCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [templateSeriesId, setTemplateSeriesId] = useState<string>(NONE);
  const [templateRunNumber, setTemplateRunNumber] = useState("1");
  const [templateNote, setTemplateNote] = useState<string | null>(null);

  const loadRunCode = useCallback(async () => {
    setCodeLoading(true);
    setCodeError(null);
    try {
      setRunCode(await nextProjectCode("test_run"));
    } catch (error) {
      setRunCode("");
      setCodeError(error instanceof Error ? error.message : "Versuchscode nicht verfügbar");
    } finally {
      setCodeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm(emptyForm());
    setErrors({});
    setIpConfirmed(false);
    setTemplateSeriesId(NONE);
    setTemplateRunNumber("1");
    setTemplateNote(null);
    void loadRunCode();
  }, [open, loadRunCode]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setParameter = (key: string, value: string) => {
    setForm((current) => ({ ...current, parameters: { ...current.parameters, [key]: value } }));
  };

  /* --------------------------------------------------------------- lookups */

  const batchById = useMemo(() => {
    const map = new Map<string, MaterialBatch>();
    batches.forEach((batch) => map.set(batch.id, batch));
    return map;
  }, [batches]);

  const remainingKg = useCallback(
    (batch: MaterialBatch) => (batch.weight_kg ?? 0) - (batchUsage.get(batch.id) ?? 0),
    [batchUsage],
  );

  const selectedBatch = form.batchId === NONE ? null : (batchById.get(form.batchId) ?? null);

  const templateSeries =
    templateSeriesId === NONE ? null : (doeSeries.find((s) => s.id === templateSeriesId) ?? null);
  const templateFactors = useMemo(
    () => (templateSeries ? parseDoeFactors(templateSeries.factors) : []),
    [templateSeries],
  );

  const templatePreview = useMemo(() => {
    if (!templateSeries || !templateFactors.length) return [];
    const runNumber = Number.parseInt(templateRunNumber, 10);
    if (!Number.isFinite(runNumber) || runNumber < 1) return [];
    const levels = doeLevelsForRun(templateFactors, runNumber);
    return templateFactors.map((factor) => ({
      key: factor.key,
      label: factor.label,
      unit: factor.unit ?? "",
      value: levels.get(factor.key),
      mapped: TEST_RUN_PARAMETER_KEYS.some((entry) => entry.key === factor.key),
    }));
  }, [templateSeries, templateFactors, templateRunNumber]);

  /* ------------------------------------------------------------ validation */

  const validateStep = (target: number): Record<string, string> => {
    const found: Record<string, string> = {};
    if (target === 1) {
      if (!form.title.trim()) found.title = "Bitte einen Titel angeben.";
      if (!PROCESS_LINES.some((line) => line.id === form.processLine)) {
        found.processLine = "Bitte eine Prozesslinie wählen.";
      }
      const cost = parseDecimal(form.costEur);
      if (!cost.ok) found.costEur = "Bitte eine gültige Zahl eingeben.";
    }
    if (target === 2) {
      const weight = parseDecimal(form.inputWeightKg);
      if (!weight.ok) found.inputWeightKg = "Bitte eine gültige Menge in kg eingeben.";
    }
    if (target === 3) {
      TEST_RUN_PARAMETER_KEYS.forEach((entry) => {
        if (!entry.numeric) return;
        const raw = form.parameters[entry.key] ?? "";
        if (!raw.trim()) return;
        const parsed = parseDecimal(raw);
        if (!parsed.ok || parsed.value === null) {
          found[`param_${entry.key}`] = "Bitte eine gültige Zahl eingeben.";
        }
      });
      if (form.doeRunNumber.trim()) {
        const runNumber = Number.parseInt(form.doeRunNumber, 10);
        if (!Number.isFinite(runNumber) || runNumber < 1) {
          found.doeRunNumber = "Laufnummer muss eine positive ganze Zahl sein.";
        }
      }
    }
    return found;
  };

  const scrollBodyToTop = () => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep = (target: number) => {
    if (target === step) return;
    if (target < step) {
      setErrors({});
      setStep(target);
      scrollBodyToTop();
      return;
    }
    for (let current = step; current < target; current += 1) {
      const found = validateStep(current);
      if (Object.keys(found).length) {
        setErrors(found);
        setStep(current);
        focusFirstError(found);
        return;
      }
    }
    setErrors({});
    setStep(target);
    scrollBodyToTop();
  };

  /* --------------------------------------------------------- DoE template */

  const applyTemplate = () => {
    if (!templateSeries) {
      setTemplateNote("Bitte zuerst einen DoE-Plan wählen.");
      return;
    }
    const runNumber = Number.parseInt(templateRunNumber, 10);
    if (!Number.isFinite(runNumber) || runNumber < 1) {
      setTemplateNote("Bitte eine gültige Laufnummer (ab 1) angeben.");
      return;
    }
    if (!templateFactors.length) {
      setTemplateNote(`Der Plan ${templateSeries.code} enthält keine auswertbaren Faktoren.`);
      return;
    }

    const levels = doeLevelsForRun(templateFactors, runNumber);
    const applied: string[] = [];
    const skipped: string[] = [];
    const appliedValues: Record<string, string> = {};

    // Vor setForm auswerten: der State-Updater muss frei von Seiteneffekten sein,
    // sonst wäre die Meldung unten leer, weil React ihn erst beim Rendern ausführt.
    templateFactors.forEach((factor) => {
      const level = levels.get(factor.key);
      if (level === undefined) return;
      const known = TEST_RUN_PARAMETER_KEYS.some((entry) => entry.key === factor.key);
      if (!known) {
        skipped.push(factor.label);
        return;
      }
      appliedValues[factor.key] = String(level).replace(".", ",");
      applied.push(factor.label);
    });

    setForm((current) => ({
      ...current,
      parameters: { ...current.parameters, ...appliedValues },
      doeSeriesId: templateSeries.id,
      doeRunNumber: String(runNumber),
      processLine: PROCESS_LINES.some((line) => line.id === templateSeries.process_line)
        ? templateSeries.process_line
        : current.processLine,
    }));

    setTemplateNote(
      [
        `${applied.length} Faktor${applied.length === 1 ? "" : "en"} aus ${templateSeries.code}, Lauf ${runNumber} übernommen.`,
        skipped.length
          ? `Nicht übernommen (kein Maschinenparameter): ${skipped.join(", ")}.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
    setErrors((current) => {
      const next = { ...current };
      delete next.doeRunNumber;
      return next;
    });
  };

  /* ------------------------------------------------------------- submitting */

  const requiresIpConfirmation = !patentFiled && form.status !== "planned";
  const canSubmit = Boolean(runCode) && !codeLoading && (!requiresIpConfirmation || ipConfirmed);

  const handleSubmit = () => {
    const perStep = [validateStep(1), validateStep(2), validateStep(3)];
    const firstFailing = perStep.findIndex((found) => Object.keys(found).length > 0);
    if (firstFailing >= 0) {
      setErrors({ ...perStep[0], ...perStep[1], ...perStep[2] });
      setStep(firstFailing + 1);
      // Der Fehler kann auf einem früheren Schritt liegen. Ohne Sprung zum Feld
      // wirkt "Versuch anlegen" auf dem Handy tot: der Schritt wechselt weit
      // über dem sichtbaren Bereich, die Meldung bleibt ungesehen.
      focusFirstError(perStep[firstFailing]);
      return;
    }
    if (!runCode) {
      setCodeError("Es wurde noch kein Versuchscode vergeben.");
      return;
    }
    if (requiresIpConfirmation && !ipConfirmed) return;

    const cost = parseDecimal(form.costEur);
    const weight = parseDecimal(form.inputWeightKg);
    const parameters: TestRunParameterInput[] = [];

    TEST_RUN_PARAMETER_KEYS.forEach((entry) => {
      const raw = form.parameters[entry.key] ?? "";
      if (!raw.trim()) return;
      if (entry.numeric) {
        const parsed = parseDecimal(raw);
        if (!parsed.ok || parsed.value === null) return;
        parameters.push({
          parameter_key: entry.key,
          value_numeric: parsed.value,
          value_text: null,
          unit: entry.unit || null,
        });
      } else {
        parameters.push({
          parameter_key: entry.key,
          value_numeric: null,
          value_text: raw.trim(),
          unit: entry.unit || null,
        });
      }
    });

    const doeRunNumber = form.doeRunNumber.trim()
      ? Number.parseInt(form.doeRunNumber, 10)
      : null;

    onSubmit({
      run: {
        run_code: runCode,
        title: form.title.trim(),
        partner_id: form.partnerId === NONE ? null : form.partnerId,
        machine_name: trimmedOrNull(form.machineName),
        machine_type: form.machineType === NONE ? null : form.machineType,
        input_batch_id: form.batchId === NONE ? null : form.batchId,
        input_weight_kg: weight.ok ? weight.value : null,
        process_line: form.processLine,
        planned_date: trimmedOrNull(form.plannedDate),
        status: form.status,
        responsible: trimmedOrNull(form.responsible),
        cost_eur: cost.ok ? cost.value : null,
        doe_series_id: form.doeSeriesId === NONE ? null : form.doeSeriesId,
        doe_run_number: doeRunNumber !== null && Number.isFinite(doeRunNumber) ? doeRunNumber : null,
      },
      parameters,
    });
  };

  /* ------------------------------------------------------------------ views */

  const parsedInputWeight = parseDecimal(form.inputWeightKg);
  const inputWeightValue = parsedInputWeight.ok ? parsedInputWeight.value : null;
  const overdrawWarning =
    selectedBatch !== null &&
    inputWeightValue !== null &&
    inputWeightValue > remainingKg(selectedBatch);

  return (
    <Dialog open={open} onOpenChange={(next) => (!isSaving ? onOpenChange(next) : undefined)}>
      <DialogContent
        ref={bodyRef}
        className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Neuen Versuch anlegen</DialogTitle>
          <DialogDescription>
            Schritt {step} von 3 — {STEPS[step - 1].label}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5">
          {STEPS.map((entry) => (
            <button
              key={entry.index}
              type="button"
              onClick={() => goToStep(entry.index)}
              aria-current={entry.index === step ? "step" : undefined}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
                entry.index === step
                  ? "border-primary bg-primary/5 font-semibold"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                  entry.index < step
                    ? "border-success bg-success/15 text-success"
                    : entry.index === step
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                )}
              >
                {entry.index < step ? <Check className="h-3 w-3" /> : entry.index}
              </span>
              <span className="truncate">{entry.label}</span>
            </button>
          ))}
        </div>

        <IpGateBanner />

        {codeError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Versuchscode konnte nicht vergeben werden</AlertTitle>
            <AlertDescription className="text-sm">
              {codeError}
              <Button
                variant="link"
                className="h-auto p-0 pl-1 text-destructive underline"
                onClick={() => void loadRunCode()}
              >
                Erneut versuchen
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ------------------------------------------------------------ step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="run-code">Versuchscode</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="run-code"
                  value={codeLoading ? "wird vergeben …" : runCode}
                  readOnly
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Versuchscode neu vergeben"
                  disabled={codeLoading}
                  onClick={() => void loadRunCode()}
                >
                  {codeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Wird automatisch vergeben und kann nicht geändert werden.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="run-title">
                Titel <span className="text-destructive">*</span>
              </Label>
              <Input
                id="run-title"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="z. B. Schermühle stumpf, weiter Spalt, M1"
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="run-partner">Partner / Technikum</Label>
                <Select value={form.partnerId} onValueChange={(value) => update("partnerId", value)}>
                  <SelectTrigger id="run-partner">
                    <SelectValue placeholder="Partner wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ohne Partner (intern)</SelectItem>
                    {partners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="run-machine-type">Maschinentyp</Label>
                <Select
                  value={form.machineType}
                  onValueChange={(value) => update("machineType", value)}
                >
                  <SelectTrigger id="run-machine-type">
                    <SelectValue placeholder="Typ wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Kein Typ</SelectItem>
                    {MACHINE_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="run-machine">Maschine</Label>
              <Input
                id="run-machine"
                value={form.machineName}
                onChange={(event) => update("machineName", event.target.value)}
                placeholder="Herstellerbezeichnung, z. B. Typ SM 60/100"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Prozesslinie <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={form.processLine}
                onValueChange={(value) => update("processLine", value)}
                className="grid gap-2 sm:grid-cols-2"
              >
                {PROCESS_LINES.map((line) => (
                  <label
                    key={line.id}
                    htmlFor={`line-${line.id}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors",
                      form.processLine === line.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <RadioGroupItem id={`line-${line.id}`} value={line.id} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{line.label}</span>
                      <span className="block text-xs text-muted-foreground">{line.goal}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {errors.processLine && (
                <p className="text-xs text-destructive">{errors.processLine}</p>
              )}
              <ProcessLineCard lineId={form.processLine} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="run-planned">Geplantes Datum</Label>
                <Input
                  id="run-planned"
                  type="date"
                  value={form.plannedDate}
                  onChange={(event) => update("plannedDate", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="run-status">Status</Label>
                <Select value={form.status} onValueChange={(value) => update("status", value)}>
                  <SelectTrigger id="run-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEST_RUN_STATUSES.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="run-responsible">Verantwortlich</Label>
                <Input
                  id="run-responsible"
                  value={form.responsible}
                  onChange={(event) => update("responsible", event.target.value)}
                  placeholder="Name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="run-cost">Kosten (EUR)</Label>
                <Input
                  id="run-cost"
                  inputMode="decimal"
                  value={form.costEur}
                  onChange={(event) => update("costEur", event.target.value)}
                  placeholder="z. B. 1.850"
                  aria-invalid={Boolean(errors.costEur)}
                />
                {errors.costEur && <p className="text-xs text-destructive">{errors.costEur}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="run-batch">Eingesetzte Charge</Label>
              <Select value={form.batchId} onValueChange={(value) => update("batchId", value)}>
                <SelectTrigger id="run-batch">
                  <SelectValue placeholder="Charge wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Keine Charge zuordnen</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.batch_code} · {batch.material_class} ·{" "}
                      {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(
                        Math.max(0, remainingKg(batch)),
                      )}{" "}
                      kg frei
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {batches.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Es sind noch keine Chargen erfasst — der Versuch kann auch ohne Charge angelegt
                  und später ergänzt werden.
                </p>
              )}
            </div>

            {selectedBatch && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-mono font-semibold">{selectedBatch.batch_code}</p>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Materialklasse</dt>
                    <dd className="font-medium">
                      {selectedBatch.material_class} ·{" "}
                      {labelOf(MATERIAL_CLASSES, selectedBatch.material_class)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Harztyp</dt>
                    <dd className="font-medium">{selectedBatch.resin_type ?? "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Chargengewicht</dt>
                    <dd className="font-medium">
                      {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(
                        selectedBatch.weight_kg ?? 0,
                      )}{" "}
                      kg
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Noch frei</dt>
                    <dd className="font-medium">
                      {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(
                        Math.max(0, remainingKg(selectedBatch)),
                      )}{" "}
                      kg
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Status</dt>
                    <dd className="font-medium">
                      {labelOf(BATCH_STATUSES, selectedBatch.status)}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Lagerort</dt>
                    <dd className="font-medium">{selectedBatch.storage_location ?? "—"}</dd>
                  </div>
                </dl>
                {selectedBatch.contamination_notes && (
                  <p className="mt-2 flex items-start gap-1.5 border-t border-border pt-2 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Störstoffe: {selectedBatch.contamination_notes}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="run-input-kg">Eingesetzte Menge (kg)</Label>
              <Input
                id="run-input-kg"
                inputMode="decimal"
                value={form.inputWeightKg}
                onChange={(event) => update("inputWeightKg", event.target.value)}
                placeholder="z. B. 120"
                aria-invalid={Boolean(errors.inputWeightKg)}
              />
              {errors.inputWeightKg && (
                <p className="text-xs text-destructive">{errors.inputWeightKg}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Grundlage für die Ausbeute der Ausgangsfraktionen — bitte die tatsächlich
                aufgegebene Menge erfassen.
              </p>
            </div>

            {overdrawWarning && selectedBatch && (
              <Alert className="border-warning/30 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning">Menge übersteigt den Chargenbestand</AlertTitle>
                <AlertDescription className="text-sm">
                  Für {selectedBatch.batch_code} sind rechnerisch nur{" "}
                  {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(
                    Math.max(0, remainingKg(selectedBatch)),
                  )}{" "}
                  kg frei. Der Versuch kann trotzdem angelegt werden — bitte den Bestand prüfen.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Vorlage aus DoE-Plan</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Übernimmt die Faktorstufen des gewählten Laufs in die Parameterfelder und verknüpft
                den Versuch mit dem Plan.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
                <Select value={templateSeriesId} onValueChange={setTemplateSeriesId}>
                  <SelectTrigger aria-label="DoE-Plan wählen">
                    <SelectValue placeholder="DoE-Plan wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Kein DoE-Plan</SelectItem>
                    {doeSeries.map((series) => (
                      <SelectItem key={series.id} value={series.id}>
                        {series.code} · {series.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  inputMode="numeric"
                  value={templateRunNumber}
                  onChange={(event) => setTemplateRunNumber(event.target.value)}
                  placeholder="Lauf-Nr."
                  aria-label="Laufnummer im DoE-Plan"
                />
                <Button type="button" variant="outline" onClick={applyTemplate}>
                  Übernehmen
                </Button>
              </div>

              {doeSeries.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Es ist noch kein DoE-Plan angelegt.
                </p>
              )}

              {templateSeries && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {templateSeries.design_type} · {templateSeries.planned_runs} geplante Läufe ·{" "}
                  {labelOf(PROCESS_LINES, templateSeries.process_line)}
                </p>
              )}

              {templatePreview.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {templatePreview.map((entry) => (
                    <li key={entry.key} className="flex items-center justify-between gap-2">
                      <span className={cn(!entry.mapped && "text-muted-foreground line-through")}>
                        {entry.label}
                      </span>
                      <span className="font-mono">
                        {entry.value === undefined ? "—" : String(entry.value)} {entry.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {templateNote && <p className="mt-2 text-xs text-info">{templateNote}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="run-doe-series">Verknüpfter DoE-Plan</Label>
                <Select
                  value={form.doeSeriesId}
                  onValueChange={(value) => update("doeSeriesId", value)}
                >
                  <SelectTrigger id="run-doe-series">
                    <SelectValue placeholder="Kein DoE-Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Kein DoE-Plan</SelectItem>
                    {doeSeries.map((series) => (
                      <SelectItem key={series.id} value={series.id}>
                        {series.code} · {series.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="run-doe-number">Lauf-Nr. im Plan</Label>
                <Input
                  id="run-doe-number"
                  inputMode="numeric"
                  value={form.doeRunNumber}
                  onChange={(event) => update("doeRunNumber", event.target.value)}
                  placeholder="z. B. 4"
                  aria-invalid={Boolean(errors.doeRunNumber)}
                />
                {errors.doeRunNumber && (
                  <p className="text-xs text-destructive">{errors.doeRunNumber}</p>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-semibold">Maschinenparameter</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEST_RUN_PARAMETER_KEYS.map((entry) => {
                  const errorKey = `param_${entry.key}`;
                  return (
                    <div key={entry.key} className="space-y-1.5">
                      <Label htmlFor={`param-${entry.key}`}>{entry.label}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`param-${entry.key}`}
                          inputMode={entry.numeric ? "decimal" : "text"}
                          value={form.parameters[entry.key] ?? ""}
                          onChange={(event) => setParameter(entry.key, event.target.value)}
                          aria-invalid={Boolean(errors[errorKey])}
                        />
                        {entry.unit && (
                          <span className="w-14 shrink-0 text-xs text-muted-foreground">
                            {entry.unit}
                          </span>
                        )}
                      </div>
                      {errors[errorKey] && (
                        <p className="text-xs text-destructive">{errors[errorKey]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <ProcessLineCard lineId={form.processLine} compact />
          </div>
        )}

        {requiresIpConfirmation && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={ipConfirmed}
                onCheckedChange={(value) => setIpConfirmed(value === true)}
                className="mt-0.5"
                aria-label="Patentanmeldung noch nicht eingereicht — bestätigen"
              />
              <span>
                Mir ist bewusst, dass die Patentanmeldung noch nicht eingereicht ist.
                <span className="mt-1 block text-xs text-muted-foreground">
                  Ein Versuch mit dem Status „{labelOf(TEST_RUN_STATUSES, form.status)}“ gilt als
                  gestartete Aktivität. Ohne eingereichte Anmeldung gefährdet eine Herstellerdemo
                  die Neuheit des Verfahrens.
                </span>
              </span>
            </label>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="sm:mr-auto"
            disabled={step === 1 || isSaving}
            onClick={() => goToStep(step - 1)}
          >
            Zurück
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={() => goToStep(step + 1)}>
                Weiter
              </Button>
            ) : (
              <Button type="button" disabled={isSaving || !canSubmit} onClick={handleSubmit}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Versuch anlegen
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
