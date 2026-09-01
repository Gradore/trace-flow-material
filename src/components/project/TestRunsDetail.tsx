import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  FileText,
  FlaskConical,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConformityBadge,
  EmptyState,
  IpGateBanner,
  Markdown,
  ToneBadge,
  formatDate,
  formatDateTime,
  formatEur,
  formatKg,
  formatNumber,
} from "@/components/project/ProjectUI";
import {
  NONE,
  paramMeta,
  parseDecimal,
  processLineShort,
  sortParameters,
  toDateInput,
  toNumberInput,
  trimmedOrNull,
} from "@/components/project/TestRunsShared";
import { ProcessLineCard } from "@/components/project/TestRunsProcessLine";
import {
  ANALYSIS_STATUSES,
  FRACTION_STATUSES,
  MACHINE_TYPES,
  MATERIAL_CLASSES,
  PROCESS_LINES,
  TEST_RUN_PARAMETER_KEYS,
  TEST_RUN_STATUSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import { evaluateResult, goNoGoBreaches } from "@/lib/project/spec";
import {
  nextFractionCode,
  useProjectMutation,
  usePatentFiled,
} from "@/hooks/project/useProjectData";
import { useRequestAiAnalysis } from "@/hooks/project/useProjectAi";
import { supabase } from "@/integrations/supabase/client";
import type {
  AnalysisResult,
  DoeSeries,
  FractionAnalysis,
  FractionSpec,
  MaterialBatch,
  OutputFraction,
  Partner,
  TestRun,
  TestRunParameter,
} from "@/lib/project/types";

interface TestRunsDetailProps {
  run: TestRun;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: Partner[];
  batches: MaterialBatch[];
  doeSeries: DoeSeries[];
  /** Parameters, fractions, analyses and results of THIS run. */
  parameters: TestRunParameter[];
  fractions: OutputFraction[];
  analyses: FractionAnalysis[];
  results: AnalysisResult[];
  specs: FractionSpec[];
  onExportPdf: () => void;
}

interface OverviewForm {
  title: string;
  partnerId: string;
  machineName: string;
  machineType: string;
  processLine: string;
  plannedDate: string;
  actualDate: string;
  status: string;
  responsible: string;
  costEur: string;
  batchId: string;
  inputWeightKg: string;
  doeSeriesId: string;
  doeRunNumber: string;
  summary: string;
}

interface ParamRow {
  key: string;
  value: string;
  unit: string;
}

interface FractionForm {
  targetFractionId: string;
  weightKg: string;
  retainedSampleKg: string;
  storageLocation: string;
  status: string;
  notes: string;
  released: boolean;
}

function overviewFrom(run: TestRun): OverviewForm {
  return {
    title: run.title,
    partnerId: run.partner_id ?? NONE,
    machineName: run.machine_name ?? "",
    machineType: run.machine_type ?? NONE,
    processLine: run.process_line,
    plannedDate: toDateInput(run.planned_date),
    actualDate: toDateInput(run.actual_date),
    status: run.status,
    responsible: run.responsible ?? "",
    costEur: toNumberInput(run.cost_eur),
    batchId: run.input_batch_id ?? NONE,
    inputWeightKg: toNumberInput(run.input_weight_kg),
    doeSeriesId: run.doe_series_id ?? NONE,
    doeRunNumber: run.doe_run_number === null ? "" : String(run.doe_run_number),
    summary: run.summary ?? "",
  };
}

function paramRowsFrom(parameters: TestRunParameter[]): ParamRow[] {
  return sortParameters(parameters).map((param) => ({
    key: param.parameter_key,
    value:
      param.value_numeric !== null
        ? String(param.value_numeric).replace(".", ",")
        : (param.value_text ?? ""),
    unit: param.unit ?? paramMeta(param.parameter_key).unit,
  }));
}

function emptyFractionForm(): FractionForm {
  return {
    targetFractionId: NONE,
    weightKg: "",
    retainedSampleKg: "",
    storageLocation: "",
    status: "produced",
    notes: "",
    released: false,
  };
}

export default function TestRunsDetail({
  run,
  open,
  onOpenChange,
  partners,
  batches,
  doeSeries,
  parameters,
  fractions,
  analyses,
  results,
  specs,
  onExportPdf,
}: TestRunsDetailProps) {
  const { isFiled: patentFiled } = usePatentFiled();

  const [overview, setOverview] = useState<OverviewForm>(() => overviewFrom(run));
  const [overviewErrors, setOverviewErrors] = useState<Record<string, string>>({});
  const [ipConfirmed, setIpConfirmed] = useState(false);

  const [paramRows, setParamRows] = useState<ParamRow[]>(() => paramRowsFrom(parameters));
  const [paramErrors, setParamErrors] = useState<Record<string, string>>({});
  const [newParamKey, setNewParamKey] = useState<string>(NONE);

  const [fractionForm, setFractionForm] = useState<FractionForm>(emptyFractionForm);
  const [fractionErrors, setFractionErrors] = useState<Record<string, string>>({});
  const [fractionFormOpen, setFractionFormOpen] = useState(false);

  const aiRequest = useRequestAiAnalysis();

  const partnerById = useMemo(() => {
    const map = new Map<string, Partner>();
    partners.forEach((partner) => map.set(partner.id, partner));
    return map;
  }, [partners]);

  const specById = useMemo(() => {
    const map = new Map<string, FractionSpec>();
    specs.forEach((spec) => map.set(spec.id, spec));
    return map;
  }, [specs]);

  const batch = run.input_batch_id
    ? (batches.find((entry) => entry.id === run.input_batch_id) ?? null)
    : null;

  const usedParamKeys = useMemo(
    () => new Set(paramRows.map((row) => row.key)),
    [paramRows],
  );
  const availableParamKeys = TEST_RUN_PARAMETER_KEYS.filter(
    (entry) => !usedParamKeys.has(entry.key),
  );

  const breaches = useMemo(() => goNoGoBreaches(results), [results]);

  /* ---------------------------------------------------------------- writes */

  const statusChangeNeedsConfirmation =
    !patentFiled && overview.status !== "planned" && overview.status !== run.status;

  const saveOverview = useProjectMutation<OverviewForm>(
    async (values) => {
      const cost = parseDecimal(values.costEur);
      const weight = parseDecimal(values.inputWeightKg);
      const doeRunNumber = values.doeRunNumber.trim()
        ? Number.parseInt(values.doeRunNumber, 10)
        : null;

      const { data, error } = await supabase
        .from("test_runs")
        .update({
          title: values.title.trim(),
          partner_id: values.partnerId === NONE ? null : values.partnerId,
          machine_name: trimmedOrNull(values.machineName),
          machine_type: values.machineType === NONE ? null : values.machineType,
          process_line: values.processLine,
          planned_date: trimmedOrNull(values.plannedDate),
          actual_date: trimmedOrNull(values.actualDate),
          status: values.status,
          responsible: trimmedOrNull(values.responsible),
          cost_eur: cost.ok ? cost.value : null,
          input_batch_id: values.batchId === NONE ? null : values.batchId,
          input_weight_kg: weight.ok ? weight.value : null,
          doe_series_id: values.doeSeriesId === NONE ? null : values.doeSeriesId,
          doe_run_number:
            doeRunNumber !== null && Number.isFinite(doeRunNumber) ? doeRunNumber : null,
          summary: trimmedOrNull(values.summary),
        })
        .eq("id", run.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Versuch gespeichert",
      errorMessage: "Versuch konnte nicht gespeichert werden",
      onDone: () => setIpConfirmed(false),
    },
  );

  const handleSaveOverview = () => {
    const found: Record<string, string> = {};
    if (!overview.title.trim()) found.title = "Bitte einen Titel angeben.";
    if (!parseDecimal(overview.costEur).ok) found.costEur = "Bitte eine gültige Zahl eingeben.";
    if (!parseDecimal(overview.inputWeightKg).ok) {
      found.inputWeightKg = "Bitte eine gültige Menge in kg eingeben.";
    }
    if (overview.doeRunNumber.trim()) {
      const parsed = Number.parseInt(overview.doeRunNumber, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        found.doeRunNumber = "Laufnummer muss eine positive ganze Zahl sein.";
      }
    }
    setOverviewErrors(found);
    if (Object.keys(found).length) return;
    if (statusChangeNeedsConfirmation && !ipConfirmed) return;
    saveOverview.mutate(overview);
  };

  const saveParameters = useProjectMutation<ParamRow[]>(
    async (rows) => {
      const filled = rows.filter((row) => row.value.trim().length > 0);
      const payload = filled.map((row) => {
        const meta = paramMeta(row.key);
        if (meta.numeric) {
          const parsed = parseDecimal(row.value);
          return {
            test_run_id: run.id,
            parameter_key: row.key,
            value_numeric: parsed.ok ? parsed.value : null,
            value_text: null,
            unit: trimmedOrNull(row.unit),
          };
        }
        return {
          test_run_id: run.id,
          parameter_key: row.key,
          value_numeric: null,
          value_text: row.value.trim(),
          unit: trimmedOrNull(row.unit),
        };
      });

      if (payload.length) {
        const { data, error } = await supabase
          .from("test_run_parameters")
          .upsert(payload, { onConflict: "test_run_id,parameter_key" })
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length !== payload.length) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
      }

      const keptKeys = new Set(filled.map((row) => row.key));
      const keysToDelete = parameters
        .filter((param) => !keptKeys.has(param.parameter_key))
        .map((param) => param.parameter_key);

      if (keysToDelete.length) {
        const { data, error } = await supabase
          .from("test_run_parameters")
          .delete()
          .eq("test_run_id", run.id)
          .in("parameter_key", keysToDelete)
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length !== keysToDelete.length) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
      }
    },
    {
      successMessage: "Parameter gespeichert",
      errorMessage: "Parameter konnten nicht gespeichert werden",
    },
  );

  const handleSaveParameters = () => {
    const found: Record<string, string> = {};
    paramRows.forEach((row) => {
      if (!row.value.trim()) return;
      if (paramMeta(row.key).numeric) {
        const parsed = parseDecimal(row.value);
        if (!parsed.ok || parsed.value === null) {
          found[row.key] = "Bitte eine gültige Zahl eingeben.";
        }
      }
    });
    setParamErrors(found);
    if (Object.keys(found).length) return;
    saveParameters.mutate(paramRows);
  };

  const createFraction = useProjectMutation<FractionForm>(
    async (values) => {
      if (values.targetFractionId === NONE) {
        throw new Error("Bitte eine Zielfraktion wählen.");
      }
      const weight = parseDecimal(values.weightKg);
      if (!weight.ok || weight.value === null) {
        throw new Error("Bitte ein gültiges Gewicht in kg angeben.");
      }
      const retained = parseDecimal(values.retainedSampleKg);

      const code = await nextFractionCode(run.id, values.targetFractionId);
      const { data, error } = await supabase
        .from("output_fractions")
        .insert({
          fraction_code: code,
          test_run_id: run.id,
          target_fraction_id: values.targetFractionId,
          weight_kg: weight.value,
          retained_sample_kg: retained.ok ? retained.value : null,
          storage_location: trimmedOrNull(values.storageLocation),
          status: values.status,
          notes: trimmedOrNull(values.notes),
          released_for_product_test: values.released,
        })
        .select("id");
      if (error) {
        throw new Error(
          error.code === "23505"
            ? `Fraktionscode „${code}“ ist bereits vergeben. (${error.message})`
            : error.message,
        );
      }
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Fraktion angelegt",
      errorMessage: "Fraktion konnte nicht angelegt werden",
      onDone: () => {
        setFractionForm(emptyFractionForm());
        setFractionErrors({});
        setFractionFormOpen(false);
      },
    },
  );

  const handleCreateFraction = () => {
    const found: Record<string, string> = {};
    if (fractionForm.targetFractionId === NONE) {
      found.targetFractionId = "Bitte eine Zielfraktion wählen.";
    }
    const weight = parseDecimal(fractionForm.weightKg);
    if (!weight.ok || weight.value === null) {
      found.weightKg = "Bitte ein gültiges Gewicht in kg angeben.";
    }
    if (!parseDecimal(fractionForm.retainedSampleKg).ok) {
      found.retainedSampleKg = "Bitte eine gültige Menge in kg angeben.";
    }
    setFractionErrors(found);
    if (Object.keys(found).length) return;
    createFraction.mutate(fractionForm);
  };

  /* ------------------------------------------------------------------ views */

  const selectedSpec =
    fractionForm.targetFractionId === NONE
      ? null
      : (specById.get(fractionForm.targetFractionId) ?? null);

  const fractionTotalKg = fractions.reduce((sum, fraction) => sum + (fraction.weight_kg ?? 0), 0);

  const analysisRows = analyses.map((analysis) => {
    const fraction = fractions.find((entry) => entry.id === analysis.output_fraction_id) ?? null;
    const spec =
      fraction && fraction.target_fraction_id
        ? (specById.get(fraction.target_fraction_id) ?? null)
        : null;
    const analysisResults = results
      .filter((result) => result.analysis_id === analysis.id)
      .map((result) => ({ result, verdict: evaluateResult(result, spec) }))
      .sort((a, b) => a.verdict.label.localeCompare(b.verdict.label, "de"));
    return { analysis, fraction, analysisResults };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="space-y-2 border-b border-border p-4 text-left sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{run.run_code}</span>
            <ToneBadge tone={toneOf(TEST_RUN_STATUSES, run.status)}>
              {labelOf(TEST_RUN_STATUSES, run.status)}
            </ToneBadge>
            <ToneBadge tone="info">{processLineShort(run.process_line)}</ToneBadge>
          </div>
          <DialogTitle className="pr-8 text-lg leading-snug">{run.title}</DialogTitle>
          <DialogDescription className="text-xs">
            {run.machine_name ?? "Ohne Maschine"} ·{" "}
            {run.partner_id
              ? (partnerById.get(run.partner_id)?.name ?? "Unbekannter Partner")
              : "intern"}{" "}
            · geplant {formatDate(run.planned_date)}
          </DialogDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onExportPdf}>
              <FileText className="mr-2 h-4 w-4" />
              Versuchsprotokoll (PDF)
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-x-auto border-b border-border px-4 pt-3 sm:px-5">
            <TabsList className="w-max min-w-full justify-start">
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
              <TabsTrigger value="parameters">
                Parameter
                <span className="ml-1.5 text-xs text-muted-foreground">{parameters.length}</span>
              </TabsTrigger>
              <TabsTrigger value="output">
                Fraktionen
                <span className="ml-1.5 text-xs text-muted-foreground">{fractions.length}</span>
              </TabsTrigger>
              <TabsTrigger value="analytics">
                Analytik
                <span className="ml-1.5 text-xs text-muted-foreground">{analyses.length}</span>
              </TabsTrigger>
              <TabsTrigger value="ai">KI-Auswertung</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {/* --------------------------------------------------------- Übersicht */}
            <TabsContent value="overview" className="mt-0 space-y-4">
              <IpGateBanner compact />

              <div className="space-y-1.5">
                <Label htmlFor="detail-title">Titel</Label>
                <Input
                  id="detail-title"
                  value={overview.title}
                  onChange={(event) =>
                    setOverview((current) => ({ ...current, title: event.target.value }))
                  }
                  aria-invalid={Boolean(overviewErrors.title)}
                />
                {overviewErrors.title && (
                  <p className="text-xs text-destructive">{overviewErrors.title}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-status">Status</Label>
                  <Select
                    value={overview.status}
                    onValueChange={(value) =>
                      setOverview((current) => ({ ...current, status: value }))
                    }
                  >
                    <SelectTrigger id="detail-status">
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
                  <Label htmlFor="detail-partner">Partner / Technikum</Label>
                  <Select
                    value={overview.partnerId}
                    onValueChange={(value) =>
                      setOverview((current) => ({ ...current, partnerId: value }))
                    }
                  >
                    <SelectTrigger id="detail-partner">
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
                  <Label htmlFor="detail-machine">Maschine</Label>
                  <Input
                    id="detail-machine"
                    value={overview.machineName}
                    onChange={(event) =>
                      setOverview((current) => ({ ...current, machineName: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-machine-type">Maschinentyp</Label>
                  <Select
                    value={overview.machineType}
                    onValueChange={(value) =>
                      setOverview((current) => ({ ...current, machineType: value }))
                    }
                  >
                    <SelectTrigger id="detail-machine-type">
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

                <div className="space-y-1.5">
                  <Label htmlFor="detail-line">Prozesslinie</Label>
                  <Select
                    value={overview.processLine}
                    onValueChange={(value) =>
                      setOverview((current) => ({ ...current, processLine: value }))
                    }
                  >
                    <SelectTrigger id="detail-line">
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
                  <Label htmlFor="detail-responsible">Verantwortlich</Label>
                  <Input
                    id="detail-responsible"
                    value={overview.responsible}
                    onChange={(event) =>
                      setOverview((current) => ({ ...current, responsible: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-planned">Geplant am</Label>
                  <Input
                    id="detail-planned"
                    type="date"
                    value={overview.plannedDate}
                    onChange={(event) =>
                      setOverview((current) => ({ ...current, plannedDate: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-actual">Durchgeführt am</Label>
                  <Input
                    id="detail-actual"
                    type="date"
                    value={overview.actualDate}
                    onChange={(event) =>
                      setOverview((current) => ({ ...current, actualDate: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-cost">Kosten (EUR)</Label>
                  <Input
                    id="detail-cost"
                    inputMode="decimal"
                    value={overview.costEur}
                    onChange={(event) =>
                      setOverview((current) => ({ ...current, costEur: event.target.value }))
                    }
                    aria-invalid={Boolean(overviewErrors.costEur)}
                  />
                  {overviewErrors.costEur && (
                    <p className="text-xs text-destructive">{overviewErrors.costEur}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-input-kg">Eingesetzte Menge (kg)</Label>
                  <Input
                    id="detail-input-kg"
                    inputMode="decimal"
                    value={overview.inputWeightKg}
                    onChange={(event) =>
                      setOverview((current) => ({ ...current, inputWeightKg: event.target.value }))
                    }
                    aria-invalid={Boolean(overviewErrors.inputWeightKg)}
                  />
                  {overviewErrors.inputWeightKg && (
                    <p className="text-xs text-destructive">{overviewErrors.inputWeightKg}</p>
                  )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="detail-batch">Eingesetzte Charge</Label>
                  <Select
                    value={overview.batchId}
                    onValueChange={(value) =>
                      setOverview((current) => ({ ...current, batchId: value }))
                    }
                  >
                    <SelectTrigger id="detail-batch">
                      <SelectValue placeholder="Charge wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Keine Charge</SelectItem>
                      {batches.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.batch_code} · {entry.material_class} · {formatKg(entry.weight_kg)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {batch && (
                    <p className="text-xs text-muted-foreground">
                      {labelOf(MATERIAL_CLASSES, batch.material_class)}
                      {batch.resin_type ? ` · ${batch.resin_type}` : ""}
                      {batch.declared_fiber_content_pct !== null
                        ? ` · ${formatNumber(batch.declared_fiber_content_pct, 1)} % Faseranteil`
                        : ""}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-doe">DoE-Plan</Label>
                  <Select
                    value={overview.doeSeriesId}
                    onValueChange={(value) =>
                      setOverview((current) => ({ ...current, doeSeriesId: value }))
                    }
                  >
                    <SelectTrigger id="detail-doe">
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
                  <Label htmlFor="detail-doe-number">Lauf-Nr. im Plan</Label>
                  <Input
                    id="detail-doe-number"
                    inputMode="numeric"
                    value={overview.doeRunNumber}
                    onChange={(event) =>
                      setOverview((current) => ({ ...current, doeRunNumber: event.target.value }))
                    }
                    aria-invalid={Boolean(overviewErrors.doeRunNumber)}
                  />
                  {overviewErrors.doeRunNumber && (
                    <p className="text-xs text-destructive">{overviewErrors.doeRunNumber}</p>
                  )}
                </div>
              </div>

              <ProcessLineCard lineId={overview.processLine} />

              <div className="space-y-1.5">
                <Label htmlFor="detail-summary">Beobachtungen / Zusammenfassung</Label>
                <Textarea
                  id="detail-summary"
                  rows={5}
                  value={overview.summary}
                  onChange={(event) =>
                    setOverview((current) => ({ ...current, summary: event.target.value }))
                  }
                  placeholder="Was ist passiert? Auffälligkeiten an Messern, Sieb, Temperatur, Staub, Blockaden …"
                />
              </div>

              {statusChangeNeedsConfirmation && (
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
                        Der Status wechselt auf „{labelOf(TEST_RUN_STATUSES, overview.status)}“ —
                        eine gestartete Herstelleraktivität vor der Anmeldung gefährdet die Neuheit.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOverview(overviewFrom(run));
                    setOverviewErrors({});
                    setIpConfirmed(false);
                  }}
                  disabled={saveOverview.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Zurücksetzen
                </Button>
                <Button
                  onClick={handleSaveOverview}
                  disabled={
                    saveOverview.isPending || (statusChangeNeedsConfirmation && !ipConfirmed)
                  }
                >
                  {saveOverview.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Speichern
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Angelegt {formatDateTime(run.created_at)} · zuletzt geändert{" "}
                {formatDateTime(run.updated_at)}
              </p>
            </TabsContent>

            {/* --------------------------------------------------------- Parameter */}
            <TabsContent value="parameters" className="mt-0 space-y-4">
              {paramRows.length === 0 ? (
                <EmptyState
                  title="Noch keine Parameter erfasst"
                  description="Erfassen Sie Drehzahl, Schnittspalt, Sieblochung und Messerzustand — sie sind die Faktoren jeder späteren Auswertung."
                />
              ) : (
                <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
                  <Table className="min-w-[34rem]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[14rem]">Parameter</TableHead>
                        <TableHead>Wert</TableHead>
                        <TableHead className="w-[7rem]">Einheit</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paramRows.map((row, index) => {
                        const meta = paramMeta(row.key);
                        return (
                          <TableRow key={row.key}>
                            <TableCell className="align-top">
                              <p className="text-sm font-medium">{meta.label}</p>
                              <p className="font-mono text-xs text-muted-foreground">{row.key}</p>
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.value}
                                inputMode={meta.numeric ? "decimal" : "text"}
                                aria-label={`${meta.label} Wert`}
                                aria-invalid={Boolean(paramErrors[row.key])}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setParamRows((current) =>
                                    current.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, value } : entry,
                                    ),
                                  );
                                }}
                              />
                              {paramErrors[row.key] && (
                                <p className="mt-1 text-xs text-destructive">
                                  {paramErrors[row.key]}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.unit}
                                aria-label={`${meta.label} Einheit`}
                                onChange={(event) => {
                                  const unit = event.target.value;
                                  setParamRows((current) =>
                                    current.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, unit } : entry,
                                    ),
                                  );
                                }}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`${meta.label} entfernen`}
                                onClick={() =>
                                  setParamRows((current) =>
                                    current.filter((_, entryIndex) => entryIndex !== index),
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={newParamKey} onValueChange={setNewParamKey}>
                  <SelectTrigger className="sm:w-[18rem]" aria-label="Parameter hinzufügen">
                    <SelectValue placeholder="Parameter wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Parameter wählen …</SelectItem>
                    {availableParamKeys.map((entry) => (
                      <SelectItem key={entry.key} value={entry.key}>
                        {entry.label}
                        {entry.unit ? ` (${entry.unit})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={newParamKey === NONE}
                  onClick={() => {
                    if (newParamKey === NONE) return;
                    const meta = paramMeta(newParamKey);
                    setParamRows((current) => [
                      ...current,
                      { key: meta.key, value: "", unit: meta.unit },
                    ]);
                    setNewParamKey(NONE);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Zeile hinzufügen
                </Button>
              </div>

              {availableParamKeys.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Alle bekannten Maschinenparameter sind bereits erfasst.
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Leere Werte werden beim Speichern entfernt. Das Sieb steuert die Länge, nicht die
                Drehzahl — die Drehzahl ist der Hebel Durchsatz gegen Wärme und Feinanteil.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={saveParameters.isPending}
                  onClick={() => {
                    setParamRows(paramRowsFrom(parameters));
                    setParamErrors({});
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Zurücksetzen
                </Button>
                <Button onClick={handleSaveParameters} disabled={saveParameters.isPending}>
                  {saveParameters.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Parameter speichern
                </Button>
              </div>
            </TabsContent>

            {/* ------------------------------------------------------------ Output */}
            <TabsContent value="output" className="mt-0 space-y-4">
              {fractions.length === 0 ? (
                <EmptyState
                  title="Noch keine Ausgangsfraktionen"
                  description="Legen Sie die im Versuch erzeugten Fraktionen an — die Ausbeute wird automatisch aus der Einsatzmenge berechnet."
                />
              ) : (
                <>
                  <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
                    <Table className="min-w-[46rem]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Code</TableHead>
                          <TableHead>Zielfraktion</TableHead>
                          <TableHead className="text-right">Menge</TableHead>
                          <TableHead className="text-right">Ausbeute</TableHead>
                          <TableHead className="text-right">Rückstellmuster</TableHead>
                          <TableHead>Lagerort</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fractions.map((fraction) => (
                          <TableRow key={fraction.id}>
                            <TableCell className="whitespace-nowrap font-mono font-medium">
                              {fraction.fraction_code}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {fraction.target_fraction_id ? (
                                <>
                                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                                    {fraction.target_fraction_id}
                                  </span>
                                  {specById.get(fraction.target_fraction_id)?.name ?? ""}
                                </>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {formatKg(fraction.weight_kg)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {fraction.yield_pct === null
                                ? "—"
                                : `${formatNumber(fraction.yield_pct, 1)} %`}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {fraction.retained_sample_kg === null
                                ? "—"
                                : formatKg(fraction.retained_sample_kg)}
                            </TableCell>
                            <TableCell className="max-w-[10rem] truncate">
                              {fraction.storage_location ?? "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <ToneBadge tone={toneOf(FRACTION_STATUSES, fraction.status)}>
                                {labelOf(FRACTION_STATUSES, fraction.status)}
                              </ToneBadge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Summe Ausgang {formatKg(fractionTotalKg)}
                    {run.input_weight_kg
                      ? ` von ${formatKg(run.input_weight_kg)} Einsatz · ${formatNumber(
                          (fractionTotalKg / run.input_weight_kg) * 100,
                          1,
                        )} % Massenbilanz`
                      : " — ohne Einsatzmenge ist keine Bilanz möglich"}
                  </p>
                </>
              )}

              <Separator />

              {fractionFormOpen ? (
                <div className="space-y-4 rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold">Fraktion anlegen</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fraction-target">
                        Zielfraktion <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={fractionForm.targetFractionId}
                        onValueChange={(value) =>
                          setFractionForm((current) => ({ ...current, targetFractionId: value }))
                        }
                      >
                        <SelectTrigger id="fraction-target">
                          <SelectValue placeholder="Fraktion wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Fraktion wählen …</SelectItem>
                          {specs.map((spec) => (
                            <SelectItem key={spec.id} value={spec.id}>
                              {spec.id} · {spec.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fractionErrors.targetFractionId && (
                        <p className="text-xs text-destructive">
                          {fractionErrors.targetFractionId}
                        </p>
                      )}
                      {specs.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Es sind keine Zielfraktionen hinterlegt — ohne Spezifikation lässt sich
                          keine Fraktion anlegen.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="fraction-weight">
                        Menge (kg) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="fraction-weight"
                        inputMode="decimal"
                        value={fractionForm.weightKg}
                        onChange={(event) =>
                          setFractionForm((current) => ({
                            ...current,
                            weightKg: event.target.value,
                          }))
                        }
                        aria-invalid={Boolean(fractionErrors.weightKg)}
                      />
                      {fractionErrors.weightKg && (
                        <p className="text-xs text-destructive">{fractionErrors.weightKg}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="fraction-retained">Rückstellmuster (kg)</Label>
                      <Input
                        id="fraction-retained"
                        inputMode="decimal"
                        value={fractionForm.retainedSampleKg}
                        onChange={(event) =>
                          setFractionForm((current) => ({
                            ...current,
                            retainedSampleKg: event.target.value,
                          }))
                        }
                        aria-invalid={Boolean(fractionErrors.retainedSampleKg)}
                      />
                      {fractionErrors.retainedSampleKg && (
                        <p className="text-xs text-destructive">
                          {fractionErrors.retainedSampleKg}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="fraction-storage">Lagerort</Label>
                      <Input
                        id="fraction-storage"
                        value={fractionForm.storageLocation}
                        onChange={(event) =>
                          setFractionForm((current) => ({
                            ...current,
                            storageLocation: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="fraction-status">Status</Label>
                      <Select
                        value={fractionForm.status}
                        onValueChange={(value) =>
                          setFractionForm((current) => ({ ...current, status: value }))
                        }
                      >
                        <SelectTrigger id="fraction-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FRACTION_STATUSES.map((status) => (
                            <SelectItem key={status.id} value={status.id}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="fraction-notes">Notiz</Label>
                      <Textarea
                        id="fraction-notes"
                        rows={2}
                        value={fractionForm.notes}
                        onChange={(event) =>
                          setFractionForm((current) => ({ ...current, notes: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      checked={fractionForm.released}
                      onCheckedChange={(value) =>
                        setFractionForm((current) => ({ ...current, released: value === true }))
                      }
                      className="mt-0.5"
                    />
                    <span>Für Produkttests freigegeben</span>
                  </label>

                  {selectedSpec && (
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                      <p className="font-semibold">
                        {selectedSpec.id} · {selectedSpec.name}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Faserlänge{" "}
                        {selectedSpec.fiber_length_min_mm === null
                          ? "—"
                          : formatNumber(selectedSpec.fiber_length_min_mm, 2)}{" "}
                        –{" "}
                        {selectedSpec.fiber_length_max_mm === null
                          ? "—"
                          : formatNumber(selectedSpec.fiber_length_max_mm, 2)}{" "}
                        mm · Glasgehalt min.{" "}
                        {selectedSpec.glass_content_min_pct === null
                          ? "—"
                          : `${formatNumber(selectedSpec.glass_content_min_pct, 0)} %`}{" "}
                        · Feinanteil max.{" "}
                        {selectedSpec.fines_max_pct === null
                          ? "—"
                          : `${formatNumber(selectedSpec.fines_max_pct, 1)} %`}
                      </p>
                      {selectedSpec.application && (
                        <p className="mt-1 text-muted-foreground">{selectedSpec.application}</p>
                      )}
                      {selectedSpec.process_line &&
                        selectedSpec.process_line !== run.process_line && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-warning">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            Diese Fraktion gehört zu {processLineShort(
                              selectedSpec.process_line,
                            )}, der Versuch läuft auf {processLineShort(run.process_line)}.
                          </p>
                        )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Der Fraktionscode wird beim Speichern automatisch vergeben, die Ausbeute
                    berechnet die Datenbank aus der Einsatzmenge des Versuchs.
                  </p>

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      disabled={createFraction.isPending}
                      onClick={() => {
                        setFractionForm(emptyFractionForm());
                        setFractionErrors({});
                        setFractionFormOpen(false);
                      }}
                    >
                      Abbrechen
                    </Button>
                    <Button onClick={handleCreateFraction} disabled={createFraction.isPending}>
                      {createFraction.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Fraktion anlegen
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setFractionFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Fraktion anlegen
                </Button>
              )}
            </TabsContent>

            {/* ---------------------------------------------------------- Analytik */}
            <TabsContent value="analytics" className="mt-0 space-y-4">
              {breaches.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Go/No-Go verletzt</AlertTitle>
                  <AlertDescription className="text-sm">
                    <ul className="mt-1 space-y-1">
                      {breaches.map((breach, index) => (
                        <li key={`${index}-${breach}`}>• {breach}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {analysisRows.length === 0 ? (
                <EmptyState
                  title="Noch keine Analysen"
                  description="Sobald für eine Fraktion dieses Versuchs eine Laboranalyse beauftragt ist, erscheinen hier die Messwerte samt Spec-Bewertung."
                />
              ) : (
                analysisRows.map(({ analysis, fraction, analysisResults }) => (
                  <div key={analysis.id} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {analysis.analysis_code}
                      </span>
                      <ToneBadge tone={toneOf(ANALYSIS_STATUSES, analysis.status)}>
                        {labelOf(ANALYSIS_STATUSES, analysis.status)}
                      </ToneBadge>
                      {fraction && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {fraction.fraction_code}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analysis.lab_partner_id
                        ? (partnerById.get(analysis.lab_partner_id)?.name ?? "Unbekanntes Labor")
                        : "Ohne Labor"}{" "}
                      · {analysis.method ?? "ohne Methode"} · Probe versandt{" "}
                      {formatDate(analysis.sample_sent_date)} · Ergebnis{" "}
                      {formatDate(analysis.result_date)}
                      {analysis.cost_eur !== null ? ` · ${formatEur(analysis.cost_eur)}` : ""}
                    </p>

                    {analysisResults.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Noch keine Messwerte erfasst.
                      </p>
                    ) : (
                      <div className="-mx-3 overflow-x-auto px-3">
                        <Table className="min-w-[36rem]">
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Parameter</TableHead>
                              <TableHead className="text-right">Wert</TableHead>
                              <TableHead className="text-right">Sollfenster</TableHead>
                              <TableHead>Bewertung</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analysisResults.map(({ result, verdict }) => (
                              <TableRow key={result.id}>
                                <TableCell className="whitespace-nowrap">{verdict.label}</TableCell>
                                <TableCell className="whitespace-nowrap text-right font-medium">
                                  {result.value_numeric !== null
                                    ? `${formatNumber(result.value_numeric, 2)} ${
                                        result.unit ?? verdict.unit
                                      }`
                                    : (result.value_text ?? "—")}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                                  {verdict.specMin === null && verdict.specMax === null
                                    ? "—"
                                    : `${
                                        verdict.specMin === null
                                          ? "—"
                                          : formatNumber(verdict.specMin, 2)
                                      } … ${
                                        verdict.specMax === null
                                          ? "—"
                                          : formatNumber(verdict.specMax, 2)
                                      }`}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <ConformityBadge level={verdict.level} />
                                    <span className="text-xs text-muted-foreground">
                                      {verdict.note}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {analysis.notes && (
                      <p className="text-xs text-muted-foreground">{analysis.notes}</p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* --------------------------------------------------------------- KI */}
            <TabsContent value="ai" className="mt-0 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">KI-Interpretation</p>
                  <p className="text-xs text-muted-foreground">
                    Bewertet Parameter, Ausbeute und Analytik dieses Versuchs gegen die Spezifikation.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    aiRequest.mutate({
                      analysisType: "test_interpretation",
                      scopeType: "test_run",
                      scopeId: run.id,
                    })
                  }
                  disabled={aiRequest.isPending}
                >
                  {aiRequest.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="mr-2 h-4 w-4" />
                  )}
                  KI-Interpretation anfordern
                </Button>
              </div>

              {run.ai_interpretation ? (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Erstellt {formatDateTime(run.ai_interpreted_at)}
                  </p>
                  <Markdown content={run.ai_interpretation} />
                </div>
              ) : (
                <EmptyState
                  title="Noch keine KI-Interpretation"
                  description="Fordern Sie eine Auswertung an — sie berücksichtigt Maschinenparameter, Fraktionen, Analytik und die Go/No-Go-Schwellen."
                  action={
                    <Button
                      variant="outline"
                      disabled={aiRequest.isPending}
                      onClick={() =>
                        aiRequest.mutate({
                          analysisType: "test_interpretation",
                          scopeType: "test_run",
                          scopeId: run.id,
                        })
                      }
                    >
                      <FlaskConical className="mr-2 h-4 w-4" />
                      Jetzt auswerten
                    </Button>
                  }
                />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
