import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  FlaskConical,
  Grid3x3,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Markdown,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDateTime,
  formatNumber,
} from "@/components/project/ProjectUI";
import DoeSeriesPageDialog, {
  type DoeSeriesFormPayload,
} from "@/components/project/DoeSeriesPageDialog";
import DoeSeriesPagePlan from "@/components/project/DoeSeriesPagePlan";
import DoeSeriesPageEvaluation from "@/components/project/DoeSeriesPageEvaluation";
import {
  DESIGN_TYPES,
  DOE_SERIES_STATUSES,
  buildPlan,
  buildRunData,
} from "@/components/project/DoeSeriesPageShared";
import { PROCESS_LINES, labelOf, toneOf } from "@/lib/project/constants";
import {
  useAiAnalyses,
  useAnalysisResults,
  useDoeSeries,
  useFractionAnalyses,
  useFractionSpecs,
  useOutputFractions,
  useProjectMutation,
  useTestRunParameters,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import { useAcknowledgeAiAnalysis, useRequestAiAnalysis } from "@/hooks/project/useProjectAi";
import { supabase } from "@/integrations/supabase/client";
import { parseDoeFactors, type DoeSeries, type TestRun } from "@/lib/project/types";
import { cn } from "@/lib/utils";

const ALL = "__all__";

interface SeriesProgress {
  created: number;
  completed: number;
  total: number;
  percent: number;
}

export default function DoeSeriesPage() {
  const seriesQuery = useDoeSeries();
  const runsQuery = useTestRuns();
  const parametersQuery = useTestRunParameters();
  const fractionsQuery = useOutputFractions();
  const analysesQuery = useFractionAnalyses();
  const resultsQuery = useAnalysisResults();
  const specsQuery = useFractionSpecs();
  const aiQuery = useAiAnalyses("doe_optimization");

  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("plan");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingSeries, setEditingSeries] = useState<DoeSeries | null>(null);
  const [seriesToDelete, setSeriesToDelete] = useState<DoeSeries | null>(null);

  const allSeries = useMemo(() => seriesQuery.data ?? [], [seriesQuery.data]);
  const allRuns = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const parameters = useMemo(() => parametersQuery.data ?? [], [parametersQuery.data]);
  const fractions = useMemo(() => fractionsQuery.data ?? [], [fractionsQuery.data]);
  const analyses = useMemo(() => analysesQuery.data ?? [], [analysesQuery.data]);
  const results = useMemo(() => resultsQuery.data ?? [], [resultsQuery.data]);
  const fractionSpecs = useMemo(() => specsQuery.data ?? [], [specsQuery.data]);

  const runsBySeries = useMemo(() => {
    const map = new Map<string, TestRun[]>();
    allRuns.forEach((run) => {
      if (!run.doe_series_id) return;
      const list = map.get(run.doe_series_id);
      if (list) list.push(run);
      else map.set(run.doe_series_id, [run]);
    });
    map.forEach((list) =>
      list.sort((a, b) => (a.doe_run_number ?? 0) - (b.doe_run_number ?? 0)),
    );
    return map;
  }, [allRuns]);

  const progressOf = (series: DoeSeries): SeriesProgress => {
    const runs = runsBySeries.get(series.id) ?? [];
    const completed = runs.filter((run) => run.status === "completed").length;
    const total = series.planned_runs > 0 ? series.planned_runs : runs.length;
    return {
      created: runs.length,
      completed,
      total,
      percent: total > 0 ? Math.min(100, (completed / total) * 100) : 0,
    };
  };

  /* --------------------------------------------------------------- filters */

  const isFiltered = search.trim().length > 0 || lineFilter !== ALL || statusFilter !== ALL;

  const resetFilters = () => {
    setSearch("");
    setLineFilter(ALL);
    setStatusFilter(ALL);
  };

  const filteredSeries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allSeries.filter((series) => {
      if (lineFilter !== ALL && series.process_line !== lineFilter) return false;
      if (statusFilter !== ALL && series.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [
        series.code,
        series.name,
        series.description ?? "",
        labelOf(PROCESS_LINES, series.process_line),
        labelOf(DESIGN_TYPES, series.design_type),
        parseDoeFactors(series.factors)
          .map((factor) => `${factor.key} ${factor.label}`)
          .join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [allSeries, lineFilter, statusFilter, search]);

  /**
   * Keep a valid selection while data loads, filters change or rows vanish.
   * The selection follows the filtered list: the detail card below the table
   * must never show a series that the filter hides.
   */
  useEffect(() => {
    setSelectedId((current) =>
      current && filteredSeries.some((series) => series.id === current)
        ? current
        : (filteredSeries[0]?.id ?? null),
    );
  }, [filteredSeries]);

  const selected = useMemo(
    () => filteredSeries.find((series) => series.id === selectedId) ?? null,
    [filteredSeries, selectedId],
  );

  const selectedFactors = useMemo(
    () => (selected ? parseDoeFactors(selected.factors) : []),
    [selected],
  );

  const selectedRuns = useMemo(
    () => (selected ? (runsBySeries.get(selected.id) ?? []) : []),
    [selected, runsBySeries],
  );

  const plan = useMemo(
    () =>
      selected
        ? buildPlan(selectedFactors, selected.design_type, selected.planned_runs)
        : null,
    [selected, selectedFactors],
  );

  /** All runs of the series - the plan also shows planned and running ones. */
  const runData = useMemo(
    () =>
      buildRunData({
        runs: selectedRuns,
        parameters,
        fractions,
        analyses,
        results,
        targetFractionId: null,
      }),
    [selectedRuns, parameters, fractions, analyses, results],
  );

  /* ---------------------------------------------------------------- stats */

  const stats = useMemo(() => {
    const doeRuns = allRuns.filter((run) => run.doe_series_id);
    return {
      series: allSeries.length,
      plannedRuns: allSeries.reduce((sum, series) => sum + (series.planned_runs ?? 0), 0),
      createdRuns: doeRuns.length,
      completedRuns: doeRuns.filter((run) => run.status === "completed").length,
    };
  }, [allSeries, allRuns]);

  /* --------------------------------------------------------------- writes */

  const saveMutation = useProjectMutation<{
    mode: "create" | "edit";
    series: DoeSeries | null;
    payload: DoeSeriesFormPayload;
  }>(
    async ({ mode, series, payload }) => {
      const factorsJson = payload.factors.map((factor) => ({
        key: factor.key,
        label: factor.label,
        unit: factor.unit ?? "",
        levels: [...factor.levels],
      }));

      if (mode === "create") {
        const { data, error } = await supabase
          .from("doe_series")
          .insert({
            code: payload.code,
            name: payload.name,
            process_line: payload.process_line,
            description: payload.description,
            design_type: payload.design_type,
            planned_runs: payload.planned_runs,
            responses: payload.responses,
            factors: factorsJson,
            status: payload.status,
          })
          .select("id");
        if (error) {
          throw new Error(
            error.code === "23505"
              ? `Seriencode „${payload.code}“ ist bereits vergeben. (${error.message})`
              : error.message,
          );
        }
        if (!data || data.length === 0) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
        setSelectedId(data[0].id);
        return;
      }

      if (!series) throw new Error("Keine Versuchsreihe zum Bearbeiten ausgewählt");
      const { data, error } = await supabase
        .from("doe_series")
        .update({
          name: payload.name,
          process_line: payload.process_line,
          description: payload.description,
          design_type: payload.design_type,
          planned_runs: payload.planned_runs,
          responses: payload.responses,
          factors: factorsJson,
          status: payload.status,
        })
        .eq("id", series.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Versuchsreihe gespeichert",
      errorMessage: "Versuchsreihe konnte nicht gespeichert werden",
      onDone: () => {
        setDialogOpen(false);
        setEditingSeries(null);
      },
    },
  );

  const deleteMutation = useProjectMutation<DoeSeries>(
    async (series) => {
      const { data, error } = await supabase
        .from("doe_series")
        .delete()
        .eq("id", series.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Versuchsreihe gelöscht",
      errorMessage: "Versuchsreihe konnte nicht gelöscht werden",
      onDone: () => setSeriesToDelete(null),
    },
  );

  const aiMutation = useRequestAiAnalysis();
  const acknowledgeMutation = useAcknowledgeAiAnalysis();

  const latestAi = useMemo(() => {
    if (!selected) return null;
    return (
      (aiQuery.data ?? []).find(
        (entry) => entry.scope_type === "doe_series" && entry.scope_id === selected.id,
      ) ?? null
    );
  }, [aiQuery.data, selected]);

  /* -------------------------------------------------------------- actions */

  const openCreate = () => {
    setDialogMode("create");
    setEditingSeries(null);
    setDialogOpen(true);
  };

  const openEdit = (series: DoeSeries) => {
    setDialogMode("edit");
    setEditingSeries(series);
    setDialogOpen(true);
  };

  const runsOfSeriesToDelete = seriesToDelete
    ? (runsBySeries.get(seriesToDelete.id)?.length ?? 0)
    : 0;

  const listLoading = seriesQuery.isLoading || runsQuery.isLoading;
  const listError = (seriesQuery.error as Error | null) ?? (runsQuery.error as Error | null);

  const detailLoading =
    parametersQuery.isLoading ||
    fractionsQuery.isLoading ||
    analysesQuery.isLoading ||
    resultsQuery.isLoading ||
    specsQuery.isLoading;
  const detailError =
    (parametersQuery.error as Error | null) ??
    (fractionsQuery.error as Error | null) ??
    (analysesQuery.error as Error | null) ??
    (resultsQuery.error as Error | null) ??
    (specsQuery.error as Error | null);

  const retryAll = () => {
    void seriesQuery.refetch();
    void runsQuery.refetch();
    void parametersQuery.refetch();
    void fractionsQuery.refetch();
    void analysesQuery.refetch();
    void resultsQuery.refetch();
    void specsQuery.refetch();
  };

  /* --------------------------------------------------------------- render */

  return (
    <div className="space-y-6 animate-fade-in">
      <ProjectPageHeader
        title="Versuchsplanung (DoE)"
        description="Faktoren, Versuchspläne und Haupteffekte der statistischen Versuchsplanung."
        icon={Grid3x3}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Versuchsreihe
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Versuchsreihen"
          value={stats.series}
          hint="angelegte DoE-Serien"
          icon={Grid3x3}
          accent="violet"
        />
        <StatCard
          label="Geplante Läufe"
          value={formatNumber(stats.plannedRuns, 0)}
          hint="Summe über alle Serien"
          icon={Sparkles}
          accent="sky"
        />
        <StatCard
          label="Angelegte Läufe"
          value={stats.createdRuns}
          hint="Versuche mit Serienbezug"
          icon={FlaskConical}
          accent="teal"
        />
        <StatCard
          label="Abgeschlossen"
          value={stats.completedRuns}
          hint="auswertbare Läufe"
          icon={CheckCircle2}
          accent="emerald"
        />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Versuchsreihen</CardTitle>
          <CardDescription>
            {isFiltered
              ? `${filteredSeries.length} von ${allSeries.length} Serien gefiltert`
              : `${allSeries.length} ${allSeries.length === 1 ? "Serie" : "Serien"} angelegt`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Code, Name, Faktor …"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Versuchsreihen durchsuchen"
              />
            </div>

            <Select value={lineFilter} onValueChange={setLineFilter}>
              <SelectTrigger className="w-full sm:w-[14rem]" aria-label="Nach Prozesslinie filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Prozesslinien</SelectItem>
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
                {DOE_SERIES_STATUSES.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isFiltered && (
              <Button variant="ghost" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Filter zurücksetzen
              </Button>
            )}
          </div>

          {listLoading ? (
            <LoadingRows rows={4} />
          ) : listError ? (
            <ErrorState error={listError} onRetry={retryAll} />
          ) : allSeries.length === 0 ? (
            <EmptyState
              title="Noch keine Versuchsreihe angelegt"
              description="Legen Sie eine Versuchsreihe mit Faktoren und Stufen an, um daraus einen Versuchsplan zu erzeugen und die Haupteffekte auszuwerten."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Versuchsreihe anlegen
                </Button>
              }
            />
          ) : filteredSeries.length === 0 ? (
            <EmptyState
              title="Keine Serie passt zum Filter"
              description="Passen Sie Suchbegriff, Prozesslinie oder Status an."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Filter zurücksetzen
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table className="min-w-[56rem]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Prozesslinie</TableHead>
                    <TableHead>Design</TableHead>
                    <TableHead>Faktoren</TableHead>
                    <TableHead className="min-w-[13rem]">Fortschritt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSeries.map((series) => {
                    const progress = progressOf(series);
                    const factors = parseDoeFactors(series.factors);
                    const isSelected = series.id === selectedId;
                    return (
                      <TableRow
                        key={series.id}
                        onClick={() => setSelectedId(series.id)}
                        className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                      >
                        <TableCell className="font-mono font-medium whitespace-nowrap">
                          {series.code}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate">{series.name}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="font-medium">
                            {labelOf(PROCESS_LINES, series.process_line)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {labelOf(DESIGN_TYPES, series.design_type)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {factors.length === 0
                            ? "keine"
                            : `${factors.length} · ${factors
                                .map((factor) => factor.levels.length)
                                .join("×")}`}
                        </TableCell>
                        <TableCell>
                          <div className="w-48 space-y-1">
                            <Progress
                              value={progress.percent}
                              className="h-2 [&>div]:bg-primary"
                              aria-label={`Fortschritt ${series.code}`}
                            />
                            <p className="text-xs text-muted-foreground">
                              {progress.completed} von {progress.total}{" "}
                              {progress.total === 1 ? "Lauf" : "Läufen"} abgeschlossen
                              {progress.created !== progress.total
                                ? ` · ${progress.created} angelegt`
                                : ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <ToneBadge tone={toneOf(DOE_SERIES_STATUSES, series.status)}>
                            {labelOf(DOE_SERIES_STATUSES, series.status)}
                          </ToneBadge>
                        </TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Aktionen für ${series.code}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => setSelectedId(series.id)}>
                                <Grid3x3 className="h-4 w-4 mr-2" />
                                Öffnen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(series)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setSeriesToDelete(series)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && plan && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  <span className="font-mono">{selected.code}</span>
                  <span className="truncate">{selected.name}</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  {labelOf(PROCESS_LINES, selected.process_line)} ·{" "}
                  {labelOf(DESIGN_TYPES, selected.design_type)} ·{" "}
                  {formatNumber(selected.planned_runs, 0)} geplante Läufe
                </CardDescription>
                {selected.description && (
                  <p className="text-sm text-muted-foreground mt-2">{selected.description}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <ToneBadge tone={toneOf(DOE_SERIES_STATUSES, selected.status)}>
                  {labelOf(DOE_SERIES_STATUSES, selected.status)}
                </ToneBadge>
                <Button variant="outline" size="sm" onClick={() => openEdit(selected)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <LoadingRows rows={5} />
            ) : detailError ? (
              <ErrorState error={detailError} onRetry={retryAll} />
            ) : (
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full grid-cols-3 h-auto">
                  <TabsTrigger value="plan" className="text-xs sm:text-sm py-2">
                    Versuchsplan
                  </TabsTrigger>
                  <TabsTrigger value="evaluation" className="text-xs sm:text-sm py-2">
                    Auswertung
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="text-xs sm:text-sm py-2">
                    KI-Optimierung
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="plan" className="mt-4">
                  <DoeSeriesPagePlan
                    series={selected}
                    plan={plan}
                    runs={selectedRuns}
                    runData={runData}
                    onEditSeries={() => openEdit(selected)}
                  />
                </TabsContent>

                <TabsContent value="evaluation" className="mt-4">
                  <DoeSeriesPageEvaluation
                    series={selected}
                    factors={selectedFactors}
                    runs={selectedRuns}
                    parameters={parameters}
                    fractions={fractions}
                    analyses={analyses}
                    results={results}
                    fractionSpecs={fractionSpecs}
                  />
                </TabsContent>

                <TabsContent value="ai" className="mt-4 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Die KI wertet Faktoren, Plan und vorhandene Messwerte dieser Serie aus und
                      schlägt die nächsten Einstellungen vor.
                    </p>
                    <Button
                      onClick={() =>
                        aiMutation.mutate({
                          analysisType: "doe_optimization",
                          scopeType: "doe_series",
                          scopeId: selected.id,
                        })
                      }
                      disabled={aiMutation.isPending}
                      className="shrink-0"
                    >
                      {aiMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <BrainCircuit className="h-4 w-4 mr-2" />
                      )}
                      KI-Optimierung anfordern
                    </Button>
                  </div>

                  {aiQuery.isLoading ? (
                    <LoadingRows rows={3} />
                  ) : aiQuery.error ? (
                    <ErrorState
                      error={aiQuery.error as Error}
                      onRetry={() => void aiQuery.refetch()}
                    />
                  ) : !latestAi ? (
                    <EmptyState
                      title="Noch keine KI-Auswertung"
                      description="Fordern Sie eine Optimierung an, sobald erste Läufe abgeschlossen und analysiert sind — ohne Messwerte kann die KI nur die Planung kommentieren."
                    />
                  ) : (
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className="text-sm">
                            Auswertung vom {formatDateTime(latestAi.created_at)}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            {latestAi.confidence && (
                              <Badge variant="outline">Konfidenz: {latestAi.confidence}</Badge>
                            )}
                            {latestAi.model && (
                              <Badge variant="outline" className="font-mono text-xs">
                                {latestAi.model}
                              </Badge>
                            )}
                            {latestAi.acknowledged_at ? (
                              <Badge
                                variant="outline"
                                className="border-success/20 bg-success/10 text-success"
                              >
                                gelesen
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={acknowledgeMutation.isPending}
                                onClick={() =>
                                  acknowledgeMutation.mutate({ id: latestAi.id, actedUpon: false })
                                }
                              >
                                {acknowledgeMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                )}
                                Zur Kenntnis genommen
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {latestAi.output_md ? (
                          <Markdown content={latestAi.output_md} />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Die Auswertung enthält keinen Text.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}

      <DoeSeriesPageDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingSeries(null);
        }}
        mode={dialogMode}
        series={editingSeries}
        isSaving={saveMutation.isPending}
        onSubmit={(payload) =>
          saveMutation.mutate({ mode: dialogMode, series: editingSeries, payload })
        }
      />

      <AlertDialog
        open={seriesToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setSeriesToDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Versuchsreihe endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Serie <strong>{seriesToDelete?.code}</strong> wird dauerhaft entfernt.
              {runsOfSeriesToDelete > 0 && (
                <>
                  {" "}
                  {runsOfSeriesToDelete}{" "}
                  {runsOfSeriesToDelete === 1 ? "Versuch verliert" : "Versuche verlieren"} dadurch
                  die Zuordnung zur Serie — die Versuche selbst und ihre Ergebnisse bleiben
                  erhalten.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleteMutation.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (!seriesToDelete) return;
                deleteMutation.mutate(seriesToDelete);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
