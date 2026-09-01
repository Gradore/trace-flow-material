import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Euro,
  FileText,
  FlaskConical,
  Loader2,
  MoreVertical,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDate,
  formatEur,
  formatKg,
  formatNumber,
} from "@/components/project/ProjectUI";
import TestRunsWizard, {
  type TestRunWizardPayload,
} from "@/components/project/TestRunsWizard";
import TestRunsDetail from "@/components/project/TestRunsDetail";
import {
  buildTestRunProtocolPdf,
  protocolFileName,
} from "@/components/project/TestRunsProtocol";
import { ALL, NONE, processLineShort } from "@/components/project/TestRunsShared";
import {
  MACHINE_TYPES,
  PROCESS_LINES,
  TEST_RUN_STATUSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import {
  useAnalysisResults,
  useDoeSeries,
  useFractionAnalyses,
  useFractionSpecs,
  useMaterialBatches,
  useOutputFractions,
  usePartners,
  useProjectMutation,
  useTestRunParameters,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import { supabase } from "@/integrations/supabase/client";
import { downloadPDF } from "@/lib/pdf";
import { toast } from "@/hooks/use-toast";
import type { MaterialBatch, Partner, TestRun } from "@/lib/project/types";

export default function TestRuns() {
  const runsQuery = useTestRuns();
  const partnersQuery = usePartners();
  const batchesQuery = useMaterialBatches();
  const doeQuery = useDoeSeries();
  const parametersQuery = useTestRunParameters();
  const fractionsQuery = useOutputFractions();
  const analysesQuery = useFractionAnalyses();
  const resultsQuery = useAnalysisResults();
  const specsQuery = useFractionSpecs();

  const [search, setSearch] = useState("");
  const [partnerFilter, setPartnerFilter] = useState(ALL);
  const [machineTypeFilter, setMachineTypeFilter] = useState(ALL);
  const [lineFilter, setLineFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [doeFilter, setDoeFilter] = useState(ALL);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runToDelete, setRunToDelete] = useState<TestRun | null>(null);

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const batches = useMemo(() => batchesQuery.data ?? [], [batchesQuery.data]);
  const doeSeries = useMemo(() => doeQuery.data ?? [], [doeQuery.data]);
  const parameters = useMemo(() => parametersQuery.data ?? [], [parametersQuery.data]);
  const fractions = useMemo(() => fractionsQuery.data ?? [], [fractionsQuery.data]);
  const analyses = useMemo(() => analysesQuery.data ?? [], [analysesQuery.data]);
  const results = useMemo(() => resultsQuery.data ?? [], [resultsQuery.data]);
  const specs = useMemo(() => specsQuery.data ?? [], [specsQuery.data]);

  const partnerById = useMemo(() => {
    const map = new Map<string, Partner>();
    partners.forEach((partner) => map.set(partner.id, partner));
    return map;
  }, [partners]);

  const batchById = useMemo(() => {
    const map = new Map<string, MaterialBatch>();
    batches.forEach((batch) => map.set(batch.id, batch));
    return map;
  }, [batches]);

  /** kg already fed into test runs, per batch id. */
  const batchUsage = useMemo(() => {
    const map = new Map<string, number>();
    runs.forEach((run) => {
      if (!run.input_batch_id) return;
      map.set(run.input_batch_id, (map.get(run.input_batch_id) ?? 0) + (run.input_weight_kg ?? 0));
    });
    return map;
  }, [runs]);

  const parameterCount = useMemo(() => {
    const map = new Map<string, number>();
    parameters.forEach((param) => {
      map.set(param.test_run_id, (map.get(param.test_run_id) ?? 0) + 1);
    });
    return map;
  }, [parameters]);

  const fractionCount = useMemo(() => {
    const map = new Map<string, number>();
    fractions.forEach((fraction) => {
      if (!fraction.test_run_id) return;
      map.set(fraction.test_run_id, (map.get(fraction.test_run_id) ?? 0) + 1);
    });
    return map;
  }, [fractions]);

  const partnerName = (run: TestRun): string =>
    run.partner_id ? (partnerById.get(run.partner_id)?.name ?? "Unbekannter Partner") : "";

  /* --------------------------------------------------------------- filters */

  const partnerOptions = useMemo(() => {
    const ids = new Set<string>();
    runs.forEach((run) => {
      if (run.partner_id) ids.add(run.partner_id);
    });
    if (partnerFilter !== ALL && partnerFilter !== NONE) ids.add(partnerFilter);
    return Array.from(ids)
      .map((id) => ({ id, name: partnerById.get(id)?.name ?? "Unbekannter Partner" }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [runs, partnerById, partnerFilter]);

  const isFiltered =
    search.trim().length > 0 ||
    partnerFilter !== ALL ||
    machineTypeFilter !== ALL ||
    lineFilter !== ALL ||
    statusFilter !== ALL ||
    doeFilter !== ALL;

  const resetFilters = () => {
    setSearch("");
    setPartnerFilter(ALL);
    setMachineTypeFilter(ALL);
    setLineFilter(ALL);
    setStatusFilter(ALL);
    setDoeFilter(ALL);
  };

  const filteredRuns = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return runs.filter((run) => {
      if (partnerFilter === NONE) {
        if (run.partner_id) return false;
      } else if (partnerFilter !== ALL && run.partner_id !== partnerFilter) {
        return false;
      }
      if (machineTypeFilter !== ALL && run.machine_type !== machineTypeFilter) return false;
      if (lineFilter !== ALL && run.process_line !== lineFilter) return false;
      if (statusFilter !== ALL && run.status !== statusFilter) return false;
      if (doeFilter === NONE) {
        if (run.doe_series_id) return false;
      } else if (doeFilter !== ALL && run.doe_series_id !== doeFilter) {
        return false;
      }
      if (!needle) return true;
      const batch = run.input_batch_id ? batchById.get(run.input_batch_id) : null;
      const haystack = [
        run.run_code,
        run.title,
        partnerName(run),
        run.machine_name ?? "",
        run.machine_type ? labelOf(MACHINE_TYPES, run.machine_type) : "",
        processLineShort(run.process_line),
        run.responsible ?? "",
        run.summary ?? "",
        batch?.batch_code ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
    // partnerName reads partnerById, which is part of the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    runs,
    search,
    partnerFilter,
    machineTypeFilter,
    lineFilter,
    statusFilter,
    doeFilter,
    partnerById,
    batchById,
  ]);

  /* ----------------------------------------------------------------- stats */

  const runningCount = runs.filter((run) => run.status === "running").length;
  const completedCount = runs.filter((run) => run.status === "completed").length;
  const totalInputKg = runs.reduce((sum, run) => sum + (run.input_weight_kg ?? 0), 0);
  const totalCost = runs.reduce((sum, run) => sum + (run.cost_eur ?? 0), 0);

  /* ---------------------------------------------------------------- writes */

  const createRun = useProjectMutation<TestRunWizardPayload>(
    async ({ run, parameters: parameterRows }) => {
      const { data, error } = await supabase.from("test_runs").insert(run).select("id");
      if (error) {
        throw new Error(
          error.code === "23505"
            ? `Versuchscode „${run.run_code}“ ist bereits vergeben. (${error.message})`
            : error.message,
        );
      }
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
      const runId = data[0].id;

      if (parameterRows.length === 0) return;

      const { data: paramData, error: paramError } = await supabase
        .from("test_run_parameters")
        .insert(parameterRows.map((row) => ({ test_run_id: runId, ...row })))
        .select("id");

      if (paramError || !paramData || paramData.length !== parameterRows.length) {
        const reason = paramError?.message ?? "Keine Berechtigung oder Datensatz nicht gefunden";
        // Löschen ist Admins/Betriebsleitern vorbehalten: ohne .select() würde RLS
        // die Zeile still herausfiltern und der Rollback fälschlich als Erfolg gelten.
        const { data: rollbackData, error: rollbackError } = await supabase
          .from("test_runs")
          .delete()
          .eq("id", runId)
          .select("id");
        const rollbackFailed = Boolean(rollbackError) || !rollbackData || rollbackData.length === 0;
        throw new Error(
          rollbackFailed
            ? `Parameter konnten nicht gespeichert werden (${reason}). Der halb angelegte Versuch ${run.run_code} konnte nicht automatisch entfernt werden (${rollbackError?.message ?? "keine Löschberechtigung"}) — bitte manuell prüfen.`
            : `Parameter konnten nicht gespeichert werden (${reason}). Der Versuch wurde wieder entfernt.`,
        );
      }
    },
    {
      successMessage: "Versuch angelegt",
      errorMessage: "Versuch konnte nicht angelegt werden",
      onDone: () => setWizardOpen(false),
    },
  );

  const deleteRun = useProjectMutation<TestRun>(
    async (run) => {
      const { data, error } = await supabase
        .from("test_runs")
        .delete()
        .eq("id", run.id)
        .select("id");
      if (error) {
        throw new Error(
          error.code === "23503"
            ? "Der Versuch ist noch mit Fraktionen oder Analysen verknüpft und kann nicht gelöscht werden."
            : error.message,
        );
      }
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Versuch gelöscht",
      errorMessage: "Versuch konnte nicht gelöscht werden",
      onDone: () => setRunToDelete(null),
    },
  );

  /* ---------------------------------------------------------------- export */

  const handleExport = (run: TestRun) => {
    try {
      const blob = buildTestRunProtocolPdf({
        run,
        partners,
        batches,
        doeSeries,
        parameters,
        fractions,
        specs,
        analyses,
        results,
      });
      downloadPDF(blob, protocolFileName(run));
      toast({
        title: "Versuchsprotokoll erstellt",
        description: protocolFileName(run),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Protokoll konnte nicht erstellt werden",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  };

  /* ------------------------------------------------------------------ views */

  const selectedRun = selectedRunId
    ? (runs.find((run) => run.id === selectedRunId) ?? null)
    : null;

  const detailFractions = useMemo(
    () => (selectedRun ? fractions.filter((f) => f.test_run_id === selectedRun.id) : []),
    [fractions, selectedRun],
  );
  const detailFractionIds = useMemo(
    () => new Set(detailFractions.map((fraction) => fraction.id)),
    [detailFractions],
  );
  const detailAnalyses = useMemo(
    () =>
      analyses.filter(
        (analysis) =>
          analysis.output_fraction_id && detailFractionIds.has(analysis.output_fraction_id),
      ),
    [analyses, detailFractionIds],
  );
  const detailAnalysisIds = useMemo(
    () => new Set(detailAnalyses.map((analysis) => analysis.id)),
    [detailAnalyses],
  );
  const detailResults = useMemo(
    () => results.filter((result) => detailAnalysisIds.has(result.analysis_id)),
    [results, detailAnalysisIds],
  );
  const detailParameters = useMemo(
    () => (selectedRun ? parameters.filter((p) => p.test_run_id === selectedRun.id) : []),
    [parameters, selectedRun],
  );

  const fractionsOfRunToDelete = runToDelete ? (fractionCount.get(runToDelete.id) ?? 0) : 0;

  const isLoading =
    runsQuery.isLoading ||
    partnersQuery.isLoading ||
    batchesQuery.isLoading ||
    doeQuery.isLoading ||
    parametersQuery.isLoading ||
    fractionsQuery.isLoading ||
    analysesQuery.isLoading ||
    resultsQuery.isLoading ||
    specsQuery.isLoading;

  const loadError =
    (runsQuery.error as Error | null) ??
    (partnersQuery.error as Error | null) ??
    (batchesQuery.error as Error | null) ??
    (doeQuery.error as Error | null) ??
    (parametersQuery.error as Error | null) ??
    (fractionsQuery.error as Error | null) ??
    (analysesQuery.error as Error | null) ??
    (resultsQuery.error as Error | null) ??
    (specsQuery.error as Error | null);

  const retryAll = () => {
    void runsQuery.refetch();
    void partnersQuery.refetch();
    void batchesQuery.refetch();
    void doeQuery.refetch();
    void parametersQuery.refetch();
    void fractionsQuery.refetch();
    void analysesQuery.refetch();
    void resultsQuery.refetch();
    void specsQuery.refetch();
  };

  const renderActions = (run: TestRun) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Aktionen für ${run.run_code}`}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem onClick={() => setSelectedRunId(run.id)}>
          <FlaskConical className="mr-2 h-4 w-4" />
          Details öffnen
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport(run)}>
          <FileText className="mr-2 h-4 w-4" />
          Versuchsprotokoll (PDF)
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => setRunToDelete(run)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <ProjectPageHeader
        title="Versuche"
        description="Zerkleinerungsversuche erfassen — Maschine, Parameter, Einsatzmaterial und Ergebnis."
        icon={FlaskConical}
        actions={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Versuch
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Versuche"
          value={runs.length}
          hint={`${filteredRuns.length} angezeigt`}
          icon={FlaskConical}
          accent="violet"
        />
        <StatCard label="Läuft" value={runningCount} icon={Activity} accent="amber" />
        <StatCard
          label="Abgeschlossen"
          value={completedCount}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Einsatzmenge"
          value={formatKg(totalInputKg)}
          icon={Scale}
          accent="sky"
        />
        <StatCard label="Versuchskosten" value={formatEur(totalCost)} icon={Euro} accent="teal" />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Versuchsübersicht</CardTitle>
          <CardDescription>
            {isFiltered
              ? `${filteredRuns.length} von ${runs.length} Versuchen gefiltert`
              : `${runs.length} ${runs.length === 1 ? "Versuch" : "Versuche"} erfasst`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Code, Titel, Maschine, Charge …"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Versuche durchsuchen"
              />
            </div>

            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger className="w-full sm:w-[12rem]" aria-label="Nach Partner filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Partner</SelectItem>
                {partnerOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>Ohne Partner</SelectItem>
              </SelectContent>
            </Select>

            <Select value={machineTypeFilter} onValueChange={setMachineTypeFilter}>
              <SelectTrigger className="w-full sm:w-[12rem]" aria-label="Nach Maschinentyp filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Maschinentypen</SelectItem>
                {MACHINE_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={lineFilter} onValueChange={setLineFilter}>
              <SelectTrigger className="w-full sm:w-[12rem]" aria-label="Nach Prozesslinie filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Beide Linien</SelectItem>
                {PROCESS_LINES.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[11rem]" aria-label="Nach Status filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Status</SelectItem>
                {TEST_RUN_STATUSES.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={doeFilter} onValueChange={setDoeFilter}>
              <SelectTrigger className="w-full sm:w-[12rem]" aria-label="Nach DoE-Plan filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle DoE-Pläne</SelectItem>
                {doeSeries.map((series) => (
                  <SelectItem key={series.id} value={series.id}>
                    {series.code} · {series.name}
                  </SelectItem>
                ))}
                <SelectItem value={NONE}>Ohne DoE-Plan</SelectItem>
              </SelectContent>
            </Select>

            {isFiltered && (
              <Button variant="ghost" onClick={resetFilters} className="sm:w-auto">
                <RotateCcw className="mr-2 h-4 w-4" />
                Filter zurücksetzen
              </Button>
            )}
          </div>

          {isLoading ? (
            <LoadingRows rows={6} />
          ) : loadError ? (
            <ErrorState error={loadError} onRetry={retryAll} />
          ) : runs.length === 0 ? (
            <EmptyState
              title="Noch keine Versuche erfasst"
              description="Legen Sie den ersten Zerkleinerungsversuch an — Stammdaten, Einsatzmaterial und Maschinenparameter in drei Schritten."
              action={
                <Button onClick={() => setWizardOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ersten Versuch anlegen
                </Button>
              }
            />
          ) : filteredRuns.length === 0 ? (
            <EmptyState
              title="Kein Versuch passt zum Filter"
              description="Passen Sie Suchbegriff, Partner, Maschinentyp, Linie, Status oder DoE-Plan an."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Filter zurücksetzen
                </Button>
              }
            />
          ) : (
            <>
              {/* --------------------------------------------------- mobile cards */}
              <div className="space-y-3 md:hidden">
                {filteredRuns.map((run) => {
                  const batch = run.input_batch_id ? batchById.get(run.input_batch_id) : null;
                  return (
                    <div key={run.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setSelectedRunId(run.id)}
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-semibold">{run.run_code}</span>
                            <ToneBadge tone={toneOf(TEST_RUN_STATUSES, run.status)}>
                              {labelOf(TEST_RUN_STATUSES, run.status)}
                            </ToneBadge>
                            <ToneBadge tone="info">{processLineShort(run.process_line)}</ToneBadge>
                          </div>
                          <p className="mt-1 text-sm font-medium leading-snug">{run.title}</p>
                        </button>
                        {renderActions(run)}
                      </div>

                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">Partner</dt>
                          <dd className="truncate font-medium">{partnerName(run) || "intern"}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">Datum</dt>
                          <dd className="font-medium">
                            {formatDate(run.actual_date ?? run.planned_date)}
                          </dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">Maschine</dt>
                          <dd className="truncate font-medium">{run.machine_name ?? "—"}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">Einsatz</dt>
                          <dd className="font-medium">
                            {run.input_weight_kg === null ? "—" : formatKg(run.input_weight_kg)}
                          </dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">Charge</dt>
                          <dd className="truncate font-mono font-medium">
                            {batch?.batch_code ?? "—"}
                          </dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">Fraktionen</dt>
                          <dd className="font-medium">{fractionCount.get(run.id) ?? 0}</dd>
                        </div>
                      </dl>

                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setSelectedRunId(run.id)}
                        >
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleExport(run)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Protokoll
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* -------------------------------------------------------- md table */}
              <div className="-mx-6 hidden overflow-x-auto px-6 md:block">
                <Table className="min-w-[76rem]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Code</TableHead>
                      <TableHead>Titel</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Maschine</TableHead>
                      <TableHead>Linie</TableHead>
                      <TableHead>Charge</TableHead>
                      <TableHead className="text-right">Einsatz</TableHead>
                      <TableHead className="text-right">Param.</TableHead>
                      <TableHead className="text-right">Fraktionen</TableHead>
                      <TableHead className="text-right">Kosten</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRuns.map((run) => {
                      const batch = run.input_batch_id ? batchById.get(run.input_batch_id) : null;
                      const series = run.doe_series_id
                        ? doeSeries.find((entry) => entry.id === run.doe_series_id)
                        : null;
                      return (
                        <TableRow
                          key={run.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedRunId(run.id)}
                        >
                          <TableCell className="whitespace-nowrap font-mono font-medium">
                            {run.run_code}
                          </TableCell>
                          <TableCell className="max-w-[16rem]">
                            <p className="truncate font-medium">{run.title}</p>
                            {series && (
                              <p className="truncate text-xs text-muted-foreground">
                                {series.code}
                                {run.doe_run_number !== null ? ` · Lauf ${run.doe_run_number}` : ""}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(run.actual_date ?? run.planned_date)}
                            {run.actual_date === null && run.planned_date !== null && (
                              <span className="ml-1 text-xs text-muted-foreground">(geplant)</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[12rem] truncate">
                            {partnerName(run) || "—"}
                          </TableCell>
                          <TableCell className="max-w-[12rem]">
                            <p className="truncate">{run.machine_name ?? "—"}</p>
                            {run.machine_type && (
                              <p className="truncate text-xs text-muted-foreground">
                                {labelOf(MACHINE_TYPES, run.machine_type)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <ToneBadge tone="info">{processLineShort(run.process_line)}</ToneBadge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs">
                            {batch?.batch_code ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {run.input_weight_kg === null ? "—" : formatKg(run.input_weight_kg)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(parameterCount.get(run.id) ?? 0, 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(fractionCount.get(run.id) ?? 0, 0)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {formatEur(run.cost_eur)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <ToneBadge tone={toneOf(TEST_RUN_STATUSES, run.status)}>
                              {labelOf(TEST_RUN_STATUSES, run.status)}
                            </ToneBadge>
                          </TableCell>
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            {renderActions(run)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <TestRunsWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        partners={partners}
        batches={batches}
        doeSeries={doeSeries}
        batchUsage={batchUsage}
        isSaving={createRun.isPending}
        onSubmit={(payload) => createRun.mutate(payload)}
      />

      {selectedRun && (
        <TestRunsDetail
          key={selectedRun.id}
          run={selectedRun}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedRunId(null);
          }}
          partners={partners}
          batches={batches}
          doeSeries={doeSeries}
          parameters={detailParameters}
          fractions={detailFractions}
          analyses={detailAnalyses}
          results={detailResults}
          specs={specs}
          onExportPdf={() => handleExport(selectedRun)}
        />
      )}

      <AlertDialog
        open={runToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteRun.isPending) setRunToDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Versuch endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Versuch <strong>{runToDelete?.run_code}</strong> wird mit allen erfassten
              Maschinenparametern dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht
              werden.
              {fractionsOfRunToDelete > 0 && (
                <>
                  {" "}
                  Zu diesem Versuch {fractionsOfRunToDelete === 1
                    ? "ist eine Fraktion"
                    : `sind ${fractionsOfRunToDelete} Fraktionen`}{" "}
                  erfasst — löschen Sie diese zuerst.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleteRun.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteRun.isPending || fractionsOfRunToDelete > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (!runToDelete || fractionsOfRunToDelete > 0) return;
                deleteRun.mutate(runToDelete);
              }}
            >
              {deleteRun.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
