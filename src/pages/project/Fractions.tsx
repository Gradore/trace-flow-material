/**
 * Zielfraktionen — output fraction management with spec conformity.
 *
 * Everything on this page hangs off one question: does the material in the
 * big bag match the target specification it was produced for? The traffic
 * light, the release workflow, the customer datasheet and the stock value all
 * read the same derived view (see FractionsShared.tsx).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Boxes,
  CheckCircle2,
  Euro,
  ExternalLink,
  FileDown,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  Search,
  Warehouse,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConformityBadge,
  EmptyState,
  ErrorState,
  IpGateBanner,
  LoadingRows,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatEur,
  formatKg,
  formatNumber,
} from "@/components/project/ProjectUI";
import { FractionsDetailDialog } from "@/components/project/FractionsDetailDialog";
import { FractionsReleaseDialog } from "@/components/project/FractionsReleaseDialog";
import { FractionsSpecDialog } from "@/components/project/FractionsSpecDialog";
import { downloadFractionDatasheet } from "@/components/project/FractionsDatasheet";
import { buildFractionViews, type FractionView } from "@/components/project/FractionsShared";
import {
  useFractionAnalyses,
  useFractionSpecs,
  useOutputFractions,
  useProductTests,
  useProductTestResults,
  useAnalysisResults,
  useProjectMutation,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { linkFractionToOutputMaterial } from "@/lib/project/bridges";
import {
  FRACTION_STATUSES,
  PROCESS_LINES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import type { ConformityLevel } from "@/lib/project/spec";
import type { FractionSpec, OutputFraction } from "@/lib/project/types";
import { toast } from "@/hooks/use-toast";

const CONFORMITY_FILTERS: { id: ConformityLevel; label: string }[] = [
  { id: "pass", label: "In Spec" },
  { id: "borderline", label: "Grenzwertig" },
  { id: "fail", label: "Außerhalb" },
  { id: "unknown", label: "Keine Daten" },
];

const CHART_COLOR: Record<string, string> = {
  F1: "hsl(var(--primary))",
  F2: "hsl(var(--info))",
  F3: "hsl(var(--success))",
  F4: "hsl(var(--warning))",
  F5: "hsl(var(--muted-foreground))",
};

export default function Fractions() {
  const fractionsQuery = useOutputFractions();
  const specsQuery = useFractionSpecs();
  const runsQuery = useTestRuns();
  const analysesQuery = useFractionAnalyses();
  const resultsQuery = useAnalysisResults();
  const productTestsQuery = useProductTests();
  const productTestResultsQuery = useProductTestResults();
  const { isAdmin, isBetriebsleiter } = useUserRole();
  const mayEditSpecs = isAdmin || isBetriebsleiter;

  const [search, setSearch] = useState("");
  const [targetFilter, setTargetFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conformityFilter, setConformityFilter] = useState("all");
  const [releasedFilter, setReleasedFilter] = useState("all");

  const [specToEdit, setSpecToEdit] = useState<FractionSpec | null>(null);
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [releaseId, setReleaseId] = useState<string | null>(null);

  const specs = useMemo(() => specsQuery.data ?? [], [specsQuery.data]);
  const productTestResults = useMemo(
    () => productTestResultsQuery.data ?? [],
    [productTestResultsQuery.data],
  );

  const views = useMemo(
    () =>
      buildFractionViews({
        fractions: fractionsQuery.data ?? [],
        specs,
        runs: runsQuery.data ?? [],
        analyses: analysesQuery.data ?? [],
        analysisResults: resultsQuery.data ?? [],
        productTests: productTestsQuery.data ?? [],
      }),
    [fractionsQuery.data, specs, runsQuery.data, analysesQuery.data, resultsQuery.data, productTestsQuery.data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return views.filter((view) => {
      const { fraction, spec, run } = view;
      const matchesSearch =
        !term ||
        fraction.fraction_code.toLowerCase().includes(term) ||
        (fraction.storage_location ?? "").toLowerCase().includes(term) ||
        (fraction.notes ?? "").toLowerCase().includes(term) ||
        (spec?.name ?? "").toLowerCase().includes(term) ||
        (spec?.application ?? "").toLowerCase().includes(term) ||
        (run?.run_code ?? "").toLowerCase().includes(term) ||
        (run?.title ?? "").toLowerCase().includes(term);

      const matchesTarget =
        targetFilter === "all" ||
        (targetFilter === "none" ? !fraction.target_fraction_id : fraction.target_fraction_id === targetFilter);
      const matchesStatus = statusFilter === "all" || fraction.status === statusFilter;
      const matchesConformity = conformityFilter === "all" || view.conformity === conformityFilter;
      const matchesReleased =
        releasedFilter === "all" ||
        (releasedFilter === "yes" ? fraction.released_for_product_test : !fraction.released_for_product_test);

      return matchesSearch && matchesTarget && matchesStatus && matchesConformity && matchesReleased;
    });
  }, [views, search, targetFilter, statusFilter, conformityFilter, releasedFilter]);

  const activeFilterCount =
    (targetFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (conformityFilter !== "all" ? 1 : 0) +
    (releasedFilter !== "all" ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setTargetFilter("all");
    setStatusFilter("all");
    setConformityFilter("all");
    setReleasedFilter("all");
  };

  /** kg / value per target fraction - the stock summary. */
  const stock = useMemo(() => {
    const rows = specs.map((spec) => {
      const own = views.filter((view) => view.fraction.target_fraction_id === spec.id);
      const kg = own.reduce((sum, view) => sum + view.fraction.weight_kg, 0);
      const price = spec.target_price_eur_t;
      return {
        id: spec.id,
        name: spec.name,
        processLine: spec.process_line,
        count: own.length,
        kg,
        price,
        value: price === null ? null : (kg / 1000) * price,
      };
    });
    const unassignedViews = views.filter((view) => !view.fraction.target_fraction_id);
    if (unassignedViews.length > 0) {
      rows.push({
        id: "—",
        name: "Ohne Zielfraktion",
        processLine: null,
        count: unassignedViews.length,
        kg: unassignedViews.reduce((sum, view) => sum + view.fraction.weight_kg, 0),
        price: null,
        value: null,
      });
    }
    return rows;
  }, [specs, views]);

  const totals = useMemo(() => {
    const totalKg = views.reduce((sum, view) => sum + view.fraction.weight_kg, 0);
    const releasedKg = views
      .filter((view) => view.fraction.released_for_product_test)
      .reduce((sum, view) => sum + view.fraction.weight_kg, 0);
    const value = stock.reduce((sum, row) => sum + (row.value ?? 0), 0);
    const bookedCount = views.filter((view) => view.fraction.output_material_id).length;
    return { totalKg, releasedKg, value, bookedCount };
  }, [views, stock]);

  const chartData = useMemo(
    () => stock.filter((row) => row.kg > 0).map((row) => ({ name: row.id, kg: Math.round(row.kg * 10) / 10 })),
    [stock],
  );

  const bookToStock = useProjectMutation<OutputFraction>(
    async (fraction) => {
      // Die gecachte Zeile kann veraltet sein. Vor dem Anlegen eines
      // Lagerpostens den aktuellen Stand lesen, sonst bucht ein zweiter Klick
      // dieselbe Fraktion doppelt ein.
      const { data: current, error: readError } = await supabase
        .from("output_fractions")
        .select("output_material_id")
        .eq("id", fraction.id)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!current) throw new Error("Keine Berechtigung oder Fraktion nicht gefunden");
      if (current.output_material_id) return;

      const outputMaterialId = await linkFractionToOutputMaterial(fraction);

      // Die Verknüpfung wird per UPDATE gesetzt und kann von RLS still
      // gefiltert werden - ohne Prüfung meldeten wir einen Erfolg, der die
      // Fraktion unverknüpft zurücklässt.
      const { data: linked, error: verifyError } = await supabase
        .from("output_fractions")
        .select("output_material_id")
        .eq("id", fraction.id)
        .maybeSingle();
      if (verifyError) throw new Error(verifyError.message);
      if (!linked || linked.output_material_id !== outputMaterialId) {
        throw new Error(
          "Der Lagerposten wurde angelegt, konnte der Fraktion aber nicht zugeordnet werden (fehlende Berechtigung).",
        );
      }
    },
    {
      successMessage: "Fraktion in den Lagerbestand gebucht",
      errorMessage: "Buchung in den Lagerbestand fehlgeschlagen",
    },
  );

  const detailView = detailId ? views.find((view) => view.fraction.id === detailId) ?? null : null;
  const releaseView = releaseId ? views.find((view) => view.fraction.id === releaseId) ?? null : null;

  const handleDatasheet = (view: FractionView) => {
    try {
      downloadFractionDatasheet(view, productTestResults);
      toast({ title: `Datenblatt ${view.fraction.fraction_code} erstellt` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Datenblatt konnte nicht erstellt werden",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  };

  const asError = (value: unknown): Error | null => (value instanceof Error ? value : null);

  const listError =
    asError(fractionsQuery.error) ??
    asError(analysesQuery.error) ??
    asError(resultsQuery.error) ??
    asError(runsQuery.error);

  const listLoading =
    fractionsQuery.isLoading || analysesQuery.isLoading || resultsQuery.isLoading || runsQuery.isLoading;

  /**
   * Produkttests speisen nur den Detail-Tab und das Datenblatt. Ein Fehler darf
   * die Fraktionstabelle nicht ersetzen - er muss aber sichtbar sein, sonst
   * liest sich ein Ladefehler wie „keine Produkttests vorhanden“.
   */
  const productDataError = asError(productTestsQuery.error) ?? asError(productTestResultsQuery.error);

  const retryList = () => {
    void fractionsQuery.refetch();
    void analysesQuery.refetch();
    void resultsQuery.refetch();
    void runsQuery.refetch();
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <ProjectPageHeader
        title="Zielfraktionen"
        description="Ausgangsfraktionen F1–F5, Spec-Konformität, Freigabe und Datenblätter"
        icon={Package}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/projekt/analytik">
              <ExternalLink className="h-4 w-4 mr-2" />
              Analytik
            </Link>
          </Button>
        }
      />

      <IpGateBanner compact />

      {/* ------------------------------------------------------------ KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Fraktionen" value={listLoading ? "…" : views.length} icon={Package} accent="violet"
          hint={`${totals.bookedCount} im Lagerbestand gebucht`} />
        <StatCard label="Bestand" value={listLoading ? "…" : formatKg(totals.totalKg)} icon={Boxes} accent="sky" />
        <StatCard label="Freigegeben" value={listLoading ? "…" : formatKg(totals.releasedKg)} icon={CheckCircle2} accent="emerald"
          hint="für Produkttests" />
        <StatCard label="Bestandswert" value={listLoading ? "…" : formatEur(totals.value)} icon={Euro} accent="amber"
          hint="nach Zielpreis der Spec" />
      </div>

      {/* -------------------------------------------------- specifications */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zielspezifikationen F1–F5</CardTitle>
          <CardDescription className="text-xs">
            Der Maßstab jeder Analytik. Linie A maximiert die Faserlänge, Linie B liefert die definierte
            Kurzfaser für das Compounding — das Sieb steuert die Länge, nicht die Drehzahl.
            {!mayEditSpecs && " Bearbeitung nur durch Admin oder Betriebsleiter."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {specsQuery.isLoading ? (
            <LoadingRows rows={5} />
          ) : specsQuery.isError ? (
            <ErrorState error={specsQuery.error as Error} onRetry={() => specsQuery.refetch()} />
          ) : specs.length === 0 ? (
            <EmptyState
              title="Keine Zielspezifikationen hinterlegt"
              description="Ohne Spezifikation kann keine Fraktion bewertet werden."
            />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <Table className="min-w-[52rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead className="text-right">Faserlänge</TableHead>
                    <TableHead className="text-right">Glas min.</TableHead>
                    <TableHead className="text-right">Feuchte max.</TableHead>
                    <TableHead className="text-right">Feinanteil max.</TableHead>
                    <TableHead>Anwendung</TableHead>
                    <TableHead className="text-right">Zielpreis</TableHead>
                    <TableHead>Linie</TableHead>
                    {mayEditSpecs && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {specs.map((spec) => (
                    <TableRow key={spec.id}>
                      <TableCell className="font-mono font-semibold">{spec.id}</TableCell>
                      <TableCell className="font-medium">{spec.name}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {spec.fiber_length_min_mm === null && spec.fiber_length_max_mm === null
                          ? "—"
                          : `${formatNumber(spec.fiber_length_min_mm, 2)}–${formatNumber(spec.fiber_length_max_mm, 2)} mm`}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {spec.glass_content_min_pct === null ? "—" : `${formatNumber(spec.glass_content_min_pct, 1)} %`}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {spec.moisture_max_pct === null ? "—" : `${formatNumber(spec.moisture_max_pct, 2)} %`}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {spec.fines_max_pct === null ? "—" : `${formatNumber(spec.fines_max_pct, 1)} %`}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[16rem] truncate">
                        {spec.application ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {spec.target_price_eur_t === null ? "—" : `${formatEur(spec.target_price_eur_t)}/t`}
                      </TableCell>
                      <TableCell className="text-xs">
                        {spec.process_line ? labelOf(PROCESS_LINES, spec.process_line) : "—"}
                      </TableCell>
                      {mayEditSpecs && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Zielspezifikation ${spec.id} bearbeiten`}
                            onClick={() => {
                              setSpecToEdit(spec);
                              setSpecDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* -------------------------------------------------- stock summary */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bestand je Zielfraktion</CardTitle>
          <CardDescription className="text-xs">
            Menge, Zielpreis aus der Spezifikation und daraus resultierender Wert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <LoadingRows rows={4} />
          ) : listError ? (
            <ErrorState error={listError} onRetry={retryList} />
          ) : views.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Noch keine Fraktionen erfasst.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <Table className="min-w-[28rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zielfraktion</TableHead>
                      <TableHead className="text-right">Chargen</TableHead>
                      <TableHead className="text-right">Bestand</TableHead>
                      <TableHead className="text-right">Zielpreis</TableHead>
                      <TableHead className="text-right">Wert</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stock.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <span className="font-mono font-semibold">{row.id}</span>
                          <span className="block text-xs text-muted-foreground">{row.name}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{row.count}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatKg(row.kg)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {row.price === null ? "—" : `${formatEur(row.price)}/t`}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          {row.value === null ? "—" : formatEur(row.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40">
                      <TableCell className="font-semibold">Gesamt</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">{views.length}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {formatKg(totals.totalKg)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {formatEur(totals.value)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {chartData.length > 0 && (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={48} />
                      <RechartsTooltip
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                          fontSize: "12px",
                          color: "hsl(var(--popover-foreground))",
                        }}
                        formatter={(value: number) => [formatKg(value), "Bestand"]}
                      />
                      <Bar dataKey="kg" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell key={entry.name} fill={CHART_COLOR[entry.name] ?? "hsl(var(--primary))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- fractions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ausgangsfraktionen</CardTitle>
          <CardDescription className="text-xs">
            Fraktionen entstehen an den Versuchsläufen. Die Konformität ergibt sich aus den jeweils
            jüngsten Messwerten der zugehörigen Analytik.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ------------------------------------------------------ filters */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="fraction-search" className="text-xs">Suche</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fraction-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Code, Lager, Versuch …"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-target" className="text-xs">Zielfraktion</Label>
              <Select value={targetFilter} onValueChange={setTargetFilter}>
                <SelectTrigger id="filter-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Zielfraktionen</SelectItem>
                  {specs.map((spec) => (
                    <SelectItem key={spec.id} value={spec.id}>{spec.id} — {spec.name}</SelectItem>
                  ))}
                  <SelectItem value="none">Ohne Zielfraktion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-status" className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {FRACTION_STATUSES.map((status) => (
                    <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-conformity" className="text-xs">Konformität</Label>
              <Select value={conformityFilter} onValueChange={setConformityFilter}>
                <SelectTrigger id="filter-conformity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Bewertungen</SelectItem>
                  {CONFORMITY_FILTERS.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-released" className="text-xs">Freigabe</Label>
              <Select value={releasedFilter} onValueChange={setReleasedFilter}>
                <SelectTrigger id="filter-released"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="yes">Freigegeben</SelectItem>
                  <SelectItem value="no">Nicht freigegeben</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{filtered.length} von {views.length} Fraktionen</span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={resetFilters}>
                <X className="h-3.5 w-3.5 mr-1" />
                Filter zurücksetzen
              </Button>
            </div>
          )}

          {/* -------------------------------------------------------- table */}
          {productDataError && (
            <p className="text-xs text-destructive">
              Produkttestdaten konnten nicht geladen werden ({productDataError.message}). Der Reiter
              „Produkttests“ und das Datenblatt bleiben so lange unvollständig.
            </p>
          )}

          {listLoading ? (
            <LoadingRows rows={6} />
          ) : listError ? (
            <ErrorState error={listError} onRetry={retryList} />
          ) : views.length === 0 ? (
            <EmptyState
              title="Noch keine Fraktionen"
              description="Fraktionen werden am Versuchslauf angelegt, sobald das Material gesichtet und verwogen ist."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/projekt/versuche">Zu den Versuchsläufen</Link>
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Keine Fraktion passt zu den Filtern"
              description="Setze die Filter zurück, um alle Fraktionen zu sehen."
              action={<Button variant="outline" size="sm" onClick={resetFilters}>Filter zurücksetzen</Button>}
            />
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <Table className="min-w-[68rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fraktion</TableHead>
                    <TableHead>Versuch</TableHead>
                    <TableHead>Zielfraktion</TableHead>
                    <TableHead className="text-right">Menge</TableHead>
                    <TableHead className="text-right">Ausbeute</TableHead>
                    <TableHead>Lagerort</TableHead>
                    <TableHead className="text-right">Rückstellmuster</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Konformität</TableHead>
                    <TableHead>Freigabe</TableHead>
                    <TableHead>Lagerbestand</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((view) => {
                    const { fraction, spec, run } = view;
                    const isBooking = bookToStock.isPending && bookToStock.variables?.id === fraction.id;
                    return (
                      <TableRow key={fraction.id} className="hover:bg-muted/40">
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setDetailId(fraction.id)}
                            className="font-mono font-medium text-primary hover:underline underline-offset-2 text-left"
                          >
                            {fraction.fraction_code}
                          </button>
                          {view.breaches.length > 0 && (
                            <span className="block text-[11px] text-destructive">
                              {view.breaches.length} Grenzwertverletzung
                              {view.breaches.length === 1 ? "" : "en"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {run ? (
                            <>
                              <span className="font-mono">{run.run_code}</span>
                              <span className="block text-muted-foreground max-w-[12rem] truncate">{run.title}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {spec ? (
                            <>
                              <span className="font-mono font-semibold">{spec.id}</span>
                              <span className="block text-muted-foreground max-w-[12rem] truncate">{spec.name}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">nicht zugeordnet</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatKg(fraction.weight_kg)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {fraction.yield_pct === null ? "—" : `${formatNumber(fraction.yield_pct)} %`}
                        </TableCell>
                        <TableCell className="text-xs max-w-[10rem] truncate">
                          {fraction.storage_location ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {fraction.retained_sample_kg === null ? "—" : formatKg(fraction.retained_sample_kg)}
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={toneOf(FRACTION_STATUSES, fraction.status)}>
                            {labelOf(FRACTION_STATUSES, fraction.status)}
                          </ToneBadge>
                        </TableCell>
                        <TableCell>
                          <ConformityBadge level={view.conformity} />
                        </TableCell>
                        <TableCell>
                          {fraction.released_for_product_test ? (
                            <ToneBadge tone="success">Freigegeben</ToneBadge>
                          ) : (
                            <ToneBadge tone="muted">Offen</ToneBadge>
                          )}
                        </TableCell>
                        <TableCell>
                          {fraction.output_material_id ? (
                            <Link
                              to="/output"
                              className="inline-flex items-center gap-1 text-xs text-info underline underline-offset-2"
                            >
                              <Warehouse className="h-3.5 w-3.5" />
                              Gebucht
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`Aktionen für ${fraction.fraction_code}`}>
                                {isBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => setDetailId(fraction.id)}>
                                <Package className="h-4 w-4 mr-2" />
                                Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setReleaseId(fraction.id)}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {fraction.released_for_product_test ? "Freigabe verwalten" : "Für Produkttest freigeben"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDatasheet(view)}>
                                <FileDown className="h-4 w-4 mr-2" />
                                Datenblatt (PDF)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={Boolean(fraction.output_material_id) || bookToStock.isPending}
                                onClick={() => bookToStock.mutate(fraction)}
                              >
                                <Warehouse className="h-4 w-4 mr-2" />
                                {fraction.output_material_id ? "Bereits gebucht" : "In Lagerbestand buchen"}
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

      <FractionsSpecDialog spec={specToEdit} open={specDialogOpen} onOpenChange={setSpecDialogOpen} />

      <FractionsDetailDialog
        view={detailView}
        specs={specs}
        productTestResults={productTestResults}
        open={detailView !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      />

      <FractionsReleaseDialog
        view={releaseView}
        open={releaseView !== null}
        onOpenChange={(open) => {
          if (!open) setReleaseId(null);
        }}
      />
    </div>
  );
}
