/**
 * Materialfluss — the traceability core of the app.
 *
 * One question drives this page: where does the material in a big bag come
 * from, and where did it go? The chain Lieferant → Materialcharge →
 * Versuchslauf → Ausgangsfraktion → Analytik → Produkttest → Kunde is drawn as
 * a mass-proportional sankey (vertical timeline on a phone), can be traced
 * backwards from any code, and is closed by a mass balance that shows how much
 * material was lost in the mill.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  Factory,
  FlaskConical,
  Percent,
  RotateCcw,
  Route as RouteIcon,
  Scale,
  Search,
  Workflow,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDate,
  formatKg,
} from "@/components/project/ProjectUI";
import { MaterialFlowDiagram, MaterialFlowLegend } from "@/components/project/MaterialFlowDiagram";
import { MaterialFlowTimeline } from "@/components/project/MaterialFlowTimeline";
import { MaterialFlowDetail } from "@/components/project/MaterialFlowDetail";
import {
  EMPTY_FILTERS,
  LOSS_WARNING_PCT,
  activeFilterCount,
  applyFilters,
  buildFlowGraph,
  buildSearchEntries,
  computeRunBalances,
  computeStageBalances,
  computeTrace,
  formatMass,
  formatPct,
  lossTextClass,
  searchEntries,
  totalRunBalance,
  type FlowFilters,
} from "@/components/project/MaterialFlowShared";
import {
  useFractionAnalyses,
  useFractionSpecs,
  useMaterialBatches,
  useOutputFractions,
  usePartners,
  useProductTests,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import { MATERIAL_CLASSES, PROCESS_LINES, labelOf } from "@/lib/project/constants";

export default function MaterialFlow() {
  const isMobile = useIsMobile();

  const partnersQuery = usePartners();
  const batchesQuery = useMaterialBatches();
  const runsQuery = useTestRuns();
  const fractionsQuery = useOutputFractions();
  const analysesQuery = useFractionAnalyses();
  const productTestsQuery = useProductTests();
  const specsQuery = useFractionSpecs();

  const isLoading =
    partnersQuery.isLoading ||
    batchesQuery.isLoading ||
    runsQuery.isLoading ||
    fractionsQuery.isLoading ||
    analysesQuery.isLoading ||
    productTestsQuery.isLoading ||
    specsQuery.isLoading;

  const loadError =
    (partnersQuery.error ??
      batchesQuery.error ??
      runsQuery.error ??
      fractionsQuery.error ??
      analysesQuery.error ??
      productTestsQuery.error ??
      specsQuery.error) as Error | null;

  const refetchAll = () => {
    void partnersQuery.refetch();
    void batchesQuery.refetch();
    void runsQuery.refetch();
    void fractionsQuery.refetch();
    void analysesQuery.refetch();
    void productTestsQuery.refetch();
    void specsQuery.refetch();
  };

  const [filters, setFilters] = useState<FlowFilters>(EMPTY_FILTERS);
  const [traceRootId, setTraceRootId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [term, setTerm] = useState("");

  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const batches = useMemo(() => batchesQuery.data ?? [], [batchesQuery.data]);
  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const fractions = useMemo(() => fractionsQuery.data ?? [], [fractionsQuery.data]);
  const analyses = useMemo(() => analysesQuery.data ?? [], [analysesQuery.data]);
  const productTests = useMemo(() => productTestsQuery.data ?? [], [productTestsQuery.data]);
  const specs = useMemo(() => specsQuery.data ?? [], [specsQuery.data]);

  const graph = useMemo(
    () => buildFlowGraph({ partners, batches, runs, fractions, analyses, productTests, specs }),
    [partners, batches, runs, fractions, analyses, productTests, specs],
  );

  const visible = useMemo(() => applyFilters(graph, filters), [graph, filters]);
  const trace = useMemo(() => (traceRootId ? computeTrace(graph, traceRootId) : null), [graph, traceRootId]);
  const searchIndex = useMemo(() => buildSearchEntries(graph), [graph]);
  const results = useMemo(() => searchEntries(searchIndex, term), [searchIndex, term]);

  const runBalances = useMemo(
    () => computeRunBalances(graph, visible, runs, batches, fractions, partners),
    [graph, visible, runs, batches, fractions, partners],
  );
  const totals = useMemo(() => totalRunBalance(runBalances), [runBalances]);
  const stageBalances = useMemo(() => computeStageBalances(graph, visible), [graph, visible]);

  const partnerOptions = useMemo(() => {
    const ids = new Set<string>();
    graph.nodes.forEach((node) => node.partnerIds.forEach((id) => ids.add(id)));
    return partners
      .filter((partner) => ids.has(partner.id))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [graph, partners]);

  const materialClassOptions = useMemo(() => {
    const present = new Set(batches.map((batch) => batch.material_class));
    return MATERIAL_CLASSES.filter((entry) => present.has(entry.id));
  }, [batches]);

  const targetOptions = useMemo(() => {
    const present = new Set(
      fractions.map((fraction) => fraction.target_fraction_id).filter((id): id is string => Boolean(id)),
    );
    const fromSpecs = specs.filter((spec) => present.has(spec.id));
    return fromSpecs.length ? fromSpecs : specs;
  }, [fractions, specs]);

  const filterCount = activeFilterCount(filters);
  const resetFilters = () => setFilters(EMPTY_FILTERS);

  const selectNode = (nodeId: string) => setSelectedId(nodeId);

  /**
   * Rückverfolgung starten. Filter, die einen Teil der Kette ausblenden, werden
   * aufgehoben — sonst zeigt die Leiste die vollständige Kette, das Diagramm
   * darunter aber nur Bruchstücke davon.
   */
  const traceNode = (nodeId: string) => {
    const chain = computeTrace(graph, nodeId);
    const chainIds = chain ? [...chain.nodeIds] : [nodeId];
    const partiallyHidden = chainIds.some((id) => !visible.nodeIds.has(id));
    if (partiallyHidden && filterCount > 0) {
      resetFilters();
      toast({
        title: "Filter zurückgesetzt",
        description: "Die Kette lag teilweise außerhalb der Filter — sie wird jetzt vollständig angezeigt.",
      });
    }
    setTraceRootId(nodeId);
  };

  const handleSearchSelect = (nodeId: string) => {
    traceNode(nodeId);
    setSelectedId(nodeId);
    setTerm("");
  };

  const stageInKg = (stageId: string) => stageBalances.find((entry) => entry.stage.id === stageId)?.inKg ?? 0;
  const runStage = stageBalances.find((entry) => entry.stage.id === "run");
  const fractionCount = graph.nodes.filter((node) => node.stage === "fraction" && visible.nodeIds.has(node.id)).length;
  /** Läufe hinter der Kennzahl „In Versuchen verarbeitet“ — mit Ausgangsfraktion, Einsatzmenge auch geschätzt. */
  const processedRuns = runBalances.filter((balance) => balance.fractionCount > 0).length;

  const hasData = graph.nodes.length > 0;
  const hasVisible = visible.nodeIds.size > 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ProjectPageHeader
        title="Materialfluss"
        description="Lückenlose Rückverfolgung: Lieferant → Charge → Versuch → Fraktion → Analytik → Produkttest → Kunde"
        icon={Workflow}
        actions={
          trace ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setTraceRootId(null)}>
              <X className="h-4 w-4" />
              Rückverfolgung aufheben
            </Button>
          ) : undefined
        }
      />

      {loadError ? (
        <ErrorState error={loadError} onRetry={refetchAll} />
      ) : isLoading ? (
        <div className="space-y-4">
          <LoadingRows rows={3} />
          <LoadingRows rows={8} />
        </div>
      ) : !hasData ? (
        <EmptyState
          title="Noch keine Materialdaten erfasst"
          description="Sobald eine Materialcharge, ein Versuchslauf oder eine Fraktion angelegt ist, entsteht hier die vollständige Flusskette."
        />
      ) : (
        <div className="space-y-4">
          {/* ------------------------------------------------ backward trace */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <RouteIcon className="h-4 w-4 text-muted-foreground" />
                Rückverfolgung
              </CardTitle>
              <CardDescription>
                Chargen-, Versuchs-, Fraktions-, Analytik- oder Produkttest-Code eingeben — die komplette Kette bis zur
                Ursprungscharge und vorwärts bis zum Produkttest wird hervorgehoben.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && results.length > 0) {
                      event.preventDefault();
                      handleSearchSelect(results[0].nodeId);
                    }
                    if (event.key === "Escape") setTerm("");
                  }}
                  placeholder="z. B. VL-0007, CH-0003, F4-VL-0007-1, PT-0002"
                  aria-label="Datensatz suchen"
                  className="pl-9 pr-9"
                />
                {term && (
                  <button
                    type="button"
                    onClick={() => setTerm("")}
                    aria-label="Suche leeren"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
                {term.trim() && (
                  <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                    {results.length ? (
                      results.map((entry) => (
                        <button
                          key={entry.nodeId}
                          type="button"
                          onClick={() => handleSearchSelect(entry.nodeId)}
                          className="w-full text-left px-3 py-2 hover:bg-muted/70 transition-colors border-b border-border last:border-b-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: entry.stage.color }}
                              aria-hidden
                            />
                            <span className="text-sm font-semibold truncate">{entry.code}</span>
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground ml-auto shrink-0">
                              {entry.stage.short}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.title}</p>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-sm text-muted-foreground">
                        Kein Datensatz mit „{term.trim()}“ gefunden.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {trace && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Kette von {graph.byId.get(trace.rootId)?.code ?? "—"}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setTraceRootId(null)}
                    >
                      Aufheben
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 mt-2">
                    {trace.chain.map((group, groupIndex) => (
                      <div key={group.stage.id} className="flex flex-wrap items-center gap-1.5">
                        {groupIndex > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        {group.nodes.map((node) => (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => selectNode(node.id)}
                            title={`${group.stage.label}: ${node.title}`}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                              node.id === trace.rootId
                                ? "border-primary bg-primary/10 font-semibold"
                                : "border-border hover:bg-muted/60",
                            )}
                          >
                            <span
                              className="h-2 w-2 rounded-sm shrink-0"
                              style={{ backgroundColor: group.stage.color }}
                              aria-hidden
                            />
                            <span className="max-w-[10rem] truncate">{node.code}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {formatMass(node.massKg, node.massEstimated)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ----------------------------------------------------- filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filter</CardTitle>
              <CardDescription>
                Ein Datensatz bleibt sichtbar, wenn seine eigene Kette (Vorgänger und Nachfolger) alle aktiven Filter
                erfüllt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label htmlFor="flow-material-class" className="text-xs">Materialklasse</Label>
                  <Select
                    value={filters.materialClass}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, materialClass: value }))}
                  >
                    <SelectTrigger id="flow-material-class">
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Materialklassen</SelectItem>
                      {materialClassOptions.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {entry.id} — {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="flow-target" className="text-xs">Zielfraktion</Label>
                  <Select
                    value={filters.targetFraction}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, targetFraction: value }))}
                  >
                    <SelectTrigger id="flow-target">
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Zielfraktionen</SelectItem>
                      {targetOptions.map((spec) => (
                        <SelectItem key={spec.id} value={spec.id}>
                          {spec.id} — {spec.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="flow-partner" className="text-xs">Partner</Label>
                  <Select
                    value={filters.partnerId}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, partnerId: value }))}
                  >
                    <SelectTrigger id="flow-partner">
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Partner</SelectItem>
                      {partnerOptions.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="flow-from" className="text-xs">Von</Label>
                  <Input
                    id="flow-from"
                    type="date"
                    value={filters.from}
                    max={filters.to || undefined}
                    onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="flow-to" className="text-xs">Bis</Label>
                  <Input
                    id="flow-to"
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
                  />
                </div>
              </div>

              {filterCount > 0 && (
                <div className="flex items-center justify-between gap-2 mt-3">
                  <p className="text-xs text-muted-foreground">
                    {filterCount} Filter aktiv · {visible.nodeIds.size} von {graph.nodes.length} Datensätzen sichtbar
                  </p>
                  <Button variant="ghost" size="sm" className="gap-2" onClick={resetFilters}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Zurücksetzen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* -------------------------------------------------------- KPIs */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Material eingegangen"
              value={formatKg(stageInKg("batch"))}
              hint={`${graph.nodes.filter((n) => n.stage === "batch" && visible.nodeIds.has(n.id)).length} Chargen`}
              icon={Boxes}
              accent="amber"
            />
            <StatCard
              label="In Versuchen verarbeitet"
              value={formatKg(runStage?.processedKg ?? 0)}
              hint={`${processedRuns} ${processedRuns === 1 ? "Versuch" : "Versuche"} mit Ausgangsfraktion`}
              icon={Factory}
              accent="violet"
            />
            <StatCard
              label="Fraktionen erzeugt"
              value={formatKg(stageInKg("fraction"))}
              hint={`${fractionCount} Fraktionen`}
              icon={Scale}
              accent="emerald"
            />
            <StatCard
              label="Verlust Zerkleinerung"
              value={<span className={lossTextClass(totals.lossPct)}>{formatPct(totals.lossPct)}</span>}
              hint={totals.countedRuns ? formatKg(totals.lossKg) : "keine bilanzierbaren Versuche"}
              icon={Percent}
              accent={totals.lossPct !== null && totals.lossPct > LOSS_WARNING_PCT ? "rose" : "teal"}
            />
          </div>

          {/* ---------------------------------------------------- diagram */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Flussdiagramm</CardTitle>
              <CardDescription>
                {isMobile
                  ? "Knoten antippen für Details. Die Menge in kg steht unter jedem Datensatz."
                  : "Knotenhöhe und Bandbreite sind proportional zur Menge in kg. Knoten anklicken für Details."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasVisible ? (
                <EmptyState
                  title="Keine Datensätze für diese Filter"
                  description="Setzen Sie die Filter zurück, um die vollständige Kette zu sehen."
                  action={
                    filterCount > 0 ? (
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        Filter zurücksetzen
                      </Button>
                    ) : undefined
                  }
                />
              ) : isMobile ? (
                <MaterialFlowTimeline
                  graph={graph}
                  visible={visible}
                  trace={trace}
                  selectedId={selectedId}
                  onSelect={selectNode}
                />
              ) : (
                <>
                  <MaterialFlowDiagram
                    graph={graph}
                    visible={visible}
                    trace={trace}
                    selectedId={selectedId}
                    onSelect={selectNode}
                  />
                  <MaterialFlowLegend className="mt-3" />
                </>
              )}
            </CardContent>
          </Card>

          {/* ----------------------------------------------- stage balance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mengenbilanz je Stufe</CardTitle>
              <CardDescription>
                Verarbeitet = Menge, die tatsächlich an die nächste Stufe übergeben wurde. Die Differenz zu
                „eingegangen“ liegt noch als Bestand vor. Geschätzte Mengen (≈) sind enthalten. Der Filter bestimmt,
                welche Datensätze gezählt werden — gerechnet wird mit deren vollständigen Mengen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasVisible ? (
                <EmptyState
                  title="Keine Datensätze für diese Filter"
                  description="Ohne sichtbare Datensätze lässt sich keine Mengenbilanz je Stufe rechnen."
                  action={
                    filterCount > 0 ? (
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        Filter zurücksetzen
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  {/* --------------------------------------------- mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {stageBalances.map((entry) => (
                      <div key={entry.stage.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: entry.stage.color }}
                            aria-hidden
                          />
                          <span className="text-sm font-semibold">{entry.stage.label}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {entry.nodeCount} {entry.nodeCount === 1 ? "Eintrag" : "Einträge"}
                          </span>
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Eingegangen</dt>
                            <dd className="font-medium">{formatKg(entry.inKg)}</dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Verarbeitet</dt>
                            <dd className="font-medium">
                              {entry.terminal ? "—" : formatKg(entry.processedKg)}
                            </dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Ausgegeben</dt>
                            <dd className="font-medium">
                              {entry.terminal ? "— Kettenende" : formatKg(entry.outKg)}
                            </dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Verlust</dt>
                            <dd className={cn("font-medium", lossTextClass(entry.lossPct))}>
                              {entry.lossKg === null ? "—" : formatKg(entry.lossKg)}
                              {!entry.terminal && ` · ${formatPct(entry.lossPct)}`}
                            </dd>
                          </div>
                          {!entry.terminal && entry.stockKg > 0.05 && (
                            <div className="flex min-w-0 gap-1.5">
                              <dt className="text-muted-foreground">Bestand</dt>
                              <dd className="font-medium">{formatKg(entry.stockKg)}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    ))}
                  </div>

                  {/* ------------------------------------------------- md table */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table className="min-w-[46rem]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Stufe</TableHead>
                          <TableHead className="text-right">Einträge</TableHead>
                          <TableHead className="text-right">Eingegangen</TableHead>
                          <TableHead className="text-right">Verarbeitet</TableHead>
                          <TableHead className="text-right">Ausgegeben</TableHead>
                          <TableHead className="text-right">Verlust</TableHead>
                          <TableHead className="text-right">Verlust %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stageBalances.map((entry) => (
                          <TableRow key={entry.stage.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                                  style={{ backgroundColor: entry.stage.color }}
                                  aria-hidden
                                />
                                <span className="font-medium whitespace-nowrap">{entry.stage.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{entry.nodeCount}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatKg(entry.inKg)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {entry.terminal ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <>
                                  {formatKg(entry.processedKg)}
                                  {entry.stockKg > 0.05 && (
                                    <span className="block text-[11px] text-muted-foreground">
                                      Bestand {formatKg(entry.stockKg)}
                                    </span>
                                  )}
                                </>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {entry.terminal ? (
                                <span className="text-muted-foreground whitespace-nowrap">— Kettenende</span>
                              ) : (
                                formatKg(entry.outKg)
                              )}
                            </TableCell>
                            <TableCell className={cn("text-right tabular-nums", lossTextClass(entry.lossPct))}>
                              {entry.lossKg === null ? "—" : formatKg(entry.lossKg)}
                            </TableCell>
                            <TableCell className={cn("text-right tabular-nums", lossTextClass(entry.lossPct))}>
                              {entry.terminal ? "—" : formatPct(entry.lossPct)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------------------------- run balance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mengenbilanz je Versuchslauf</CardTitle>
              <CardDescription>
                Einsatzmenge gegen Summe der Ausgangsfraktionen. Verluste über {LOSS_WARNING_PCT} % (Feinanteil,
                Staub, Restmengen in der Mühle) sind farblich markiert. Bilanziert wird immer der vollständige Lauf —
                auch Fraktionen, die der Filter ausblendet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!runBalances.length ? (
                <EmptyState
                  title="Keine Versuchsläufe im Filter"
                  description="Ohne Versuchslauf lässt sich keine Massenbilanz rechnen."
                  action={
                    filterCount > 0 ? (
                      <Button variant="outline" size="sm" onClick={resetFilters}>
                        Filter zurücksetzen
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  {/* --------------------------------------------- mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {runBalances.map((balance) => (
                      <button
                        key={balance.runId}
                        type="button"
                        onClick={() => selectNode(balance.nodeId)}
                        className={cn(
                          "block w-full rounded-lg border border-border p-3 text-left",
                          trace && !trace.nodeIds.has(balance.nodeId) && "opacity-50",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sm font-semibold">{balance.runCode}</span>
                          <ToneBadge tone={balance.statusTone}>{balance.statusLabel}</ToneBadge>
                          {balance.lossPct !== null && balance.lossPct > LOSS_WARNING_PCT && (
                            <span className={cn("inline-flex items-center gap-1 text-xs", lossTextClass(balance.lossPct))}>
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {formatPct(balance.lossPct)} Verlust
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium leading-snug">{balance.title}</p>

                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Charge</dt>
                            <dd className="truncate font-medium">{balance.batchCode ?? "—"}</dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Linie</dt>
                            <dd className="truncate font-medium">
                              {labelOf(PROCESS_LINES, balance.processLine)}
                            </dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Termin</dt>
                            <dd className="font-medium">{formatDate(balance.date)}</dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Fraktionen</dt>
                            <dd className="font-medium">{balance.fractionCount}</dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Eingang</dt>
                            <dd className="font-medium">
                              {balance.inputKg !== null
                                ? formatKg(balance.inputKg)
                                : balance.derivedInputKg !== null
                                  ? `≈ ${formatKg(balance.derivedInputKg)}`
                                  : "—"}
                            </dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Ausgang</dt>
                            <dd className="font-medium">{formatKg(balance.outputKg)}</dd>
                          </div>
                          <div className="flex min-w-0 gap-1.5">
                            <dt className="text-muted-foreground">Verlust</dt>
                            <dd className={cn("font-medium", lossTextClass(balance.lossPct))}>
                              {balance.lossKg !== null ? formatKg(balance.lossKg) : "—"} ·{" "}
                              {formatPct(balance.lossPct)}
                            </dd>
                          </div>
                        </dl>
                      </button>
                    ))}

                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                      <p className="font-semibold">
                        Summe ({totals.countedRuns} bilanzierte{" "}
                        {totals.countedRuns === 1 ? "Lauf" : "Läufe"}
                        {totals.skippedRuns > 0 ? `, ${totals.skippedRuns} ohne Bilanz` : ""})
                      </p>
                      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="flex min-w-0 gap-1.5">
                          <dt className="text-muted-foreground">Eingang</dt>
                          <dd className="font-medium">{formatKg(totals.inputKg)}</dd>
                        </div>
                        <div className="flex min-w-0 gap-1.5">
                          <dt className="text-muted-foreground">Ausgang</dt>
                          <dd className="font-medium">{formatKg(totals.outputKg)}</dd>
                        </div>
                        <div className="flex min-w-0 gap-1.5">
                          <dt className="text-muted-foreground">Verlust</dt>
                          <dd className={cn("font-medium", lossTextClass(totals.lossPct))}>
                            {totals.countedRuns ? formatKg(totals.lossKg) : "—"}
                          </dd>
                        </div>
                        <div className="flex min-w-0 gap-1.5">
                          <dt className="text-muted-foreground">Verlust %</dt>
                          <dd className={cn("font-medium", lossTextClass(totals.lossPct))}>
                            {formatPct(totals.lossPct)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* ------------------------------------------------- md table */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table className="min-w-[62rem]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Versuch</TableHead>
                          <TableHead>Charge</TableHead>
                          <TableHead>Linie</TableHead>
                          <TableHead>Termin</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Eingang</TableHead>
                          <TableHead className="text-right">Ausgang</TableHead>
                          <TableHead className="text-right">Verlust</TableHead>
                          <TableHead className="text-right">Verlust %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runBalances.map((balance) => (
                          <TableRow
                            key={balance.runId}
                            className={cn(
                              "cursor-pointer",
                              trace && !trace.nodeIds.has(balance.nodeId) && "opacity-50",
                            )}
                            onClick={() => selectNode(balance.nodeId)}
                          >
                            <TableCell className="max-w-[16rem]">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectNode(balance.nodeId);
                                }}
                                className="text-left hover:underline underline-offset-2"
                              >
                                <span className="block font-semibold whitespace-nowrap">{balance.runCode}</span>
                                <span className="block text-xs text-muted-foreground truncate">{balance.title}</span>
                              </button>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {balance.batchCode ?? <span className="text-muted-foreground">—</span>}
                              {balance.materialClass && (
                                <span className="block text-xs text-muted-foreground">
                                  {labelOf(MATERIAL_CLASSES, balance.materialClass)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {labelOf(PROCESS_LINES, balance.processLine)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{formatDate(balance.date)}</TableCell>
                            <TableCell>
                              <ToneBadge tone={balance.statusTone}>{balance.statusLabel}</ToneBadge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums whitespace-nowrap">
                              {balance.inputKg !== null ? (
                                formatKg(balance.inputKg)
                              ) : (
                                <span className="text-muted-foreground">
                                  {balance.derivedInputKg !== null ? `≈ ${formatKg(balance.derivedInputKg)}` : "—"}
                                  <span className="block text-[11px]">nicht erfasst</span>
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums whitespace-nowrap">
                              {formatKg(balance.outputKg)}
                              <span className="block text-[11px] text-muted-foreground">
                                {balance.fractionCount} {balance.fractionCount === 1 ? "Fraktion" : "Fraktionen"}
                              </span>
                            </TableCell>
                            <TableCell
                              className={cn("text-right tabular-nums whitespace-nowrap", lossTextClass(balance.lossPct))}
                            >
                              {balance.lossKg !== null ? formatKg(balance.lossKg) : "—"}
                            </TableCell>
                            <TableCell
                              className={cn("text-right tabular-nums whitespace-nowrap", lossTextClass(balance.lossPct))}
                            >
                              <span className="inline-flex items-center gap-1 justify-end">
                                {balance.lossPct !== null && balance.lossPct > LOSS_WARNING_PCT && (
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                )}
                                {formatPct(balance.lossPct)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={5} className="font-semibold">
                            Summe ({totals.countedRuns} bilanzierte {totals.countedRuns === 1 ? "Lauf" : "Läufe"}
                            {totals.skippedRuns > 0 ? `, ${totals.skippedRuns} ohne Bilanz` : ""})
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatKg(totals.inputKg)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatKg(totals.outputKg)}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", lossTextClass(totals.lossPct))}>
                            {totals.countedRuns ? formatKg(totals.lossKg) : "—"}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", lossTextClass(totals.lossPct))}>
                            {formatPct(totals.lossPct)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Bilanziert werden nur Läufe mit erfasster Einsatzmenge und mindestens einer Ausgangsfraktion.
                    Ein negativer Verlust bedeutet, dass die Fraktionen mehr wiegen als die Einsatzmenge — dann stimmen
                    die erfassten Gewichte nicht.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <FlaskConical className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Die Analytik zieht die Rückstellprobe der Fraktion ab; die restliche Menge wird gleichmäßig auf die
            Produkttests der Fraktion verteilt (mit ≈ gekennzeichnet), solange keine Einwaage erfasst ist.
          </p>
        </div>
      )}

      <MaterialFlowDetail
        graph={graph}
        nodeId={selectedId}
        isMobile={isMobile}
        isTraced={Boolean(selectedId && trace?.rootId === selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onSelect={selectNode}
        onTrace={(id) => traceNode(id)}
        onClearTrace={() => setTraceRootId(null)}
      />
    </div>
  );
}
