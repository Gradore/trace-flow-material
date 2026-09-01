import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  ClipboardList,
  Euro,
  FlaskConical,
  ListChecks,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Badge } from "@/components/ui/badge";
import {
  ConformityBadge,
  EmptyState,
  ErrorState,
  LoadingRows,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDate,
  formatEur,
} from "@/components/project/ProjectUI";
import {
  ANALYSIS_METHODS,
  ANALYSIS_STATUSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import {
  useAnalysisResults,
  useFractionAnalyses,
  useFractionSpecs,
  useOutputFractions,
  usePartners,
  useProjectMutation,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import { useRequestAiAnalysis } from "@/hooks/project/useProjectAi";
import { AnalyticsComparison } from "@/components/project/AnalyticsComparison";
import { AnalyticsDetail } from "@/components/project/AnalyticsDetail";
import { AnalyticsDialog } from "@/components/project/AnalyticsDialog";
import { AnalyticsResults } from "@/components/project/AnalyticsResults";
import { buildAnalysisViews, fractionLabel, type AnalysisView } from "@/components/project/AnalyticsShared";

const ALL = "__all__";
const WITHOUT = "__without__";

export default function Analytics() {
  const analysesQuery = useFractionAnalyses();
  const resultsQuery = useAnalysisResults();
  const fractionsQuery = useOutputFractions();
  const specsQuery = useFractionSpecs();
  const partnersQuery = usePartners();
  const runsQuery = useTestRuns();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [labFilter, setLabFilter] = useState(ALL);
  const [methodFilter, setMethodFilter] = useState(ALL);
  const [fractionFilter, setFractionFilter] = useState(ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [resultsId, setResultsId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const requestAi = useRequestAiAnalysis();

  const isLoading =
    analysesQuery.isLoading ||
    resultsQuery.isLoading ||
    fractionsQuery.isLoading ||
    specsQuery.isLoading ||
    partnersQuery.isLoading ||
    runsQuery.isLoading;

  const loadError =
    analysesQuery.error ??
    resultsQuery.error ??
    fractionsQuery.error ??
    specsQuery.error ??
    partnersQuery.error ??
    runsQuery.error ??
    null;

  const views = useMemo(
    () =>
      buildAnalysisViews({
        analyses: analysesQuery.data ?? [],
        fractions: fractionsQuery.data ?? [],
        specs: specsQuery.data ?? [],
        partners: partnersQuery.data ?? [],
        runs: runsQuery.data ?? [],
        results: resultsQuery.data ?? [],
      }),
    [analysesQuery.data, fractionsQuery.data, specsQuery.data, partnersQuery.data, runsQuery.data, resultsQuery.data],
  );

  const viewById = useMemo(() => new Map(views.map((view) => [view.analysis.id, view])), [views]);

  const labOptions = useMemo(() => {
    const map = new Map<string, string>();
    views.forEach((view) => {
      if (view.lab) map.set(view.lab.id, view.lab.name);
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [views]);

  const methodOptions = useMemo(() => {
    const set = new Set<string>(ANALYSIS_METHODS);
    views.forEach((view) => {
      if (view.analysis.method) set.add(view.analysis.method);
    });
    return [...set].sort((a, b) => a.localeCompare(b, "de"));
  }, [views]);

  const fractionOptions = useMemo(() => {
    const map = new Map<string, string>();
    views.forEach((view) => {
      if (view.fraction) map.set(view.fraction.id, fractionLabel(view.fraction));
    });
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [views]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return views.filter((view) => {
      const analysis = view.analysis;
      if (statusFilter !== ALL && analysis.status !== statusFilter) return false;
      if (labFilter !== ALL) {
        if (labFilter === WITHOUT ? analysis.lab_partner_id !== null : analysis.lab_partner_id !== labFilter) {
          return false;
        }
      }
      if (methodFilter !== ALL) {
        if (methodFilter === WITHOUT ? analysis.method !== null : analysis.method !== methodFilter) return false;
      }
      if (fractionFilter !== ALL) {
        if (
          fractionFilter === WITHOUT
            ? analysis.output_fraction_id !== null
            : analysis.output_fraction_id !== fractionFilter
        ) {
          return false;
        }
      }
      if (!term) return true;
      const haystack = [
        analysis.analysis_code,
        analysis.method,
        analysis.notes,
        view.fraction?.fraction_code,
        view.fraction?.target_fraction_id,
        view.spec?.name,
        view.lab?.name,
        view.run?.run_code,
      ]
        .filter((entry): entry is string => Boolean(entry))
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [views, search, statusFilter, labFilter, methodFilter, fractionFilter]);

  const activeFilterCount =
    (statusFilter !== ALL ? 1 : 0) +
    (labFilter !== ALL ? 1 : 0) +
    (methodFilter !== ALL ? 1 : 0) +
    (fractionFilter !== ALL ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter(ALL);
    setLabFilter(ALL);
    setMethodFilter(ALL);
    setFractionFilter(ALL);
  };

  const openCount = views.filter((view) => ["ordered", "in_progress"].includes(view.analysis.status)).length;
  const completeSets = views.filter((view) => view.missingMandatory.length === 0).length;
  const breachCount = views.filter((view) => view.breaches.length > 0).length;
  const totalCost = views.reduce((sum, view) => sum + (view.analysis.cost_eur ?? 0), 0);

  const removeAnalysis = useProjectMutation(
    async (vars: { id: string; resultIds: string[] }) => {
      if (vars.resultIds.length) {
        const { data: removedResults, error: resultsError } = await supabase
          .from("fraction_analysis_results")
          .delete()
          .in("id", vars.resultIds)
          .select("id");
        if (resultsError) throw new Error(resultsError.message);
        if (!removedResults || removedResults.length !== vars.resultIds.length) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
      }

      const { data, error } = await supabase
        .from("fraction_analyses")
        .delete()
        .eq("id", vars.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
    },
    {
      successMessage: "Analyse gelöscht",
      errorMessage: "Analyse konnte nicht gelöscht werden",
      onDone: () => setDeleteId(null),
    },
  );

  const detailView = detailId ? viewById.get(detailId) ?? null : null;
  const resultsView = resultsId ? viewById.get(resultsId) ?? null : null;
  const editView = editId ? viewById.get(editId) ?? null : null;
  const deleteView = deleteId ? viewById.get(deleteId) ?? null : null;

  const requestSpecAi = (view: AnalysisView) => {
    if (!view.analysis.output_fraction_id) return;
    requestAi.mutate({
      analysisType: "spec_conformity",
      scopeType: "output_fraction",
      scopeId: view.analysis.output_fraction_id,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ProjectPageHeader
        title="Analytik"
        description="Laboranalysen der Fraktionen — Pflichtparameter, Spec-Konformität und Go/No-Go-Kriterien."
        icon={FlaskConical}
        actions={
          <Button
            onClick={() => {
              setEditId(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Neue Analyse
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Analysen" value={views.length} icon={FlaskConical} accent="violet" />
        <StatCard label="Offen" value={openCount} icon={ClipboardList} accent="sky" hint="beauftragt / in Arbeit" />
        <StatCard
          label="Pflichtsatz komplett"
          value={completeSets}
          icon={ListChecks}
          accent="emerald"
          hint="alle 8 Parameter"
        />
        <StatCard
          label="Go/No-Go-Verstöße"
          value={breachCount}
          icon={AlertTriangle}
          accent="rose"
          hint="Analysen mit Grenzwertbruch"
        />
        <StatCard label="Analytikkosten" value={formatEur(totalCost)} icon={Euro} accent="amber" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              className="pl-10"
              placeholder="Analysenummer, Fraktion, Labor, Methode, Notiz …"
              aria-label="Analysen durchsuchen"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="filter-status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={ALL}>Alle Status</SelectItem>
                  {ANALYSIS_STATUSES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-lab">Labor</Label>
              <Select value={labFilter} onValueChange={setLabFilter}>
                <SelectTrigger id="filter-lab">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={ALL}>Alle Labore</SelectItem>
                  <SelectItem value={WITHOUT}>Ohne Labor</SelectItem>
                  {labOptions.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-method">Methode</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger id="filter-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={ALL}>Alle Methoden</SelectItem>
                  <SelectItem value={WITHOUT}>Ohne Methode</SelectItem>
                  {methodOptions.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-fraction">Fraktion</Label>
              <Select value={fractionFilter} onValueChange={setFractionFilter}>
                <SelectTrigger id="filter-fraction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={ALL}>Alle Fraktionen</SelectItem>
                  <SelectItem value={WITHOUT}>Ohne Fraktion</SelectItem>
                  {fractionOptions.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} von {views.length} Analysen
            </p>
            <Button variant="ghost" size="sm" onClick={resetFilters} disabled={activeFilterCount === 0}>
              <RotateCcw className="h-4 w-4" />
              Filter zurücksetzen
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingRows rows={6} />
      ) : loadError ? (
        <ErrorState
          error={loadError}
          onRetry={() => {
            void analysesQuery.refetch();
            void resultsQuery.refetch();
            void fractionsQuery.refetch();
            void specsQuery.refetch();
            void partnersQuery.refetch();
            void runsQuery.refetch();
          }}
        />
      ) : views.length === 0 ? (
        <EmptyState
          title="Noch keine Laboranalysen"
          description="Beauftrage eine Analyse für eine Fraktion — Faserlänge, Glasgehalt, Restfeuchte, Schüttdichte, Feinanteil, Energiebedarf, Werkzeugverschleiß und Fremdstoffe sind Pflicht."
          action={
            <Button
              onClick={() => {
                setEditId(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Neue Analyse
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Keine Analyse passt zum Filter"
          description="Suchbegriff oder Filter anpassen."
          action={
            <Button variant="outline" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
              Filter zurücksetzen
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Analyse</TableHead>
                  <TableHead>Fraktion</TableHead>
                  <TableHead>Labor</TableHead>
                  <TableHead>Methode</TableHead>
                  <TableHead>Versand</TableHead>
                  <TableHead>Ergebnis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Kosten</TableHead>
                  <TableHead>Spec</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((view) => {
                  const analysis = view.analysis;
                  return (
                    <TableRow
                      key={analysis.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailId(analysis.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{analysis.analysis_code}</span>
                          {view.breaches.length > 0 && (
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" aria-hidden />
                          )}
                          {analysis.sample_id && (
                            <Beaker className="h-3.5 w-3.5 text-success shrink-0" aria-hidden />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {view.missingMandatory.length === 0
                            ? "Pflichtsatz vollständig"
                            : `${view.missingMandatory.length} Pflichtwerte offen`}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fractionLabel(view.fraction)}</TableCell>
                      <TableCell className="max-w-[12rem] truncate">{view.lab?.name ?? "—"}</TableCell>
                      <TableCell className="max-w-[12rem] truncate">{analysis.method ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(analysis.sample_sent_date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(analysis.result_date)}</TableCell>
                      <TableCell>
                        <ToneBadge tone={toneOf(ANALYSIS_STATUSES, analysis.status)}>
                          {labelOf(ANALYSIS_STATUSES, analysis.status)}
                        </ToneBadge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatEur(analysis.cost_eur)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <ConformityBadge level={view.level} />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {view.evaluableCount > 0
                              ? `${view.inSpecCount} von ${view.evaluableCount} Parametern in Spec`
                              : "keine Sollwerte"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Aktionen für ${analysis.analysis_code}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => setResultsId(analysis.id)}>
                              <ClipboardList className="h-4 w-4" />
                              Messwerte erfassen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDetailId(analysis.id)}>
                              <FlaskConical className="h-4 w-4" />
                              Details &amp; Probe
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditId(analysis.id);
                                setFormOpen(true);
                              }}
                            >
                              <ListChecks className="h-4 w-4" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!analysis.output_fraction_id || requestAi.isPending}
                              onClick={() => requestSpecAi(view)}
                            >
                              <Sparkles className="h-4 w-4" />
                              KI-Spec-Bewertung
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(analysis.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
          </CardContent>
        </Card>
      )}

      {!isLoading && !loadError && (
        <AnalyticsComparison views={views} specs={specsQuery.data ?? []} />
      )}

      <AnalyticsDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditId(null);
        }}
        analysis={editView?.analysis ?? null}
        fractions={fractionsQuery.data ?? []}
        partners={partnersQuery.data ?? []}
        specs={specsQuery.data ?? []}
      />

      <AnalyticsResults
        view={resultsView}
        open={resultsId !== null}
        onOpenChange={(open) => {
          if (!open) setResultsId(null);
        }}
      />

      <AnalyticsDetail
        view={detailView}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onEnterResults={() => {
          if (!detailId) return;
          setResultsId(detailId);
          setDetailId(null);
        }}
        onEdit={() => {
          if (!detailId) return;
          setEditId(detailId);
          setDetailId(null);
          setFormOpen(true);
        }}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Analyse löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteView
                ? `${deleteView.analysis.analysis_code} und ${deleteView.results.length} erfasste Messwerte werden dauerhaft entfernt.`
                : "Die Analyse und alle erfassten Messwerte werden dauerhaft entfernt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={removeAnalysis.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeAnalysis.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteView) {
                  removeAnalysis.mutate({
                    id: deleteView.analysis.id,
                    resultIds: deleteView.results.map((result) => result.id),
                  });
                }
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {views.some((view) => view.analysis.sample_id) && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            <Beaker className="h-3 w-3" />
          </Badge>
          Analysen mit diesem Symbol sind als Probe in der Probenverwaltung angelegt.
        </p>
      )}
    </div>
  );
}
