/**
 * Produkttests — validation of recycled GFRP fractions in construction
 * materials and plastic compounds.
 *
 * A fraction only earns its gate fee if it improves a real recipe. This page
 * plans those tests (single tests and whole dosage ladders), records the
 * measured values against the baseline recipe without recycled fibre, and
 * overlays the strength development of every dosage rate in one chart.
 *
 * A trial at a manufacturer is a phase-2 activity — the IP gate banner is
 * shown here and inside both create dialogs.
 */
import { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  FlaskConical,
  Layers,
  MoreVertical,
  Plus,
  Ruler,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import {
  useOutputFractions,
  usePartners,
  useProductTestResults,
  useProductTests,
  useProjectMutation,
} from "@/hooks/project/useProjectData";
import { PRODUCT_TEST_CATEGORIES, labelOf, toneOf } from "@/lib/project/constants";
import {
  EmptyState,
  ErrorState,
  IpGateBanner,
  LoadingRows,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDate,
  formatEur,
  formatNumber,
} from "@/components/project/ProjectUI";
import {
  DeltaBadge,
  NO_SELECTION,
  PRODUCT_TEST_STATUSES,
  REFERENCE_TEST_CODE,
  dosageLabel,
  fractionLabel,
} from "@/components/project/ProductTestsShared";
import {
  DosageSeriesDialog,
  ProductTestCreateDialog,
} from "@/components/project/ProductTestsDialogs";
import { ProductTestResultsDialog } from "@/components/project/ProductTestsResults";
import { ProductTestComparisonChart } from "@/components/project/ProductTestsChart";
import { ProductTestReferenceCard } from "@/components/project/ProductTestsReference";
import type { ProductTest, ProductTestResult } from "@/lib/project/types";

const ALL = "all";

interface StatusUpdate {
  id: string;
  status: string;
  actualDate: string | null;
}

/** The 0 % test of the same series — same category, partner and fraction. */
function findBaselineTest(test: ProductTest, tests: ProductTest[]): ProductTest | null {
  if (test.dosage_pct === 0) return null;
  return (
    tests.find(
      (candidate) =>
        candidate.id !== test.id &&
        candidate.dosage_pct === 0 &&
        candidate.category === test.category &&
        candidate.output_fraction_id === test.output_fraction_id &&
        candidate.partner_id === test.partner_id,
    ) ?? null
  );
}

export default function ProductTests() {
  const testsQuery = useProductTests();
  const resultsQuery = useProductTestResults();
  const partnersQuery = usePartners();
  const fractionsQuery = useOutputFractions();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [partnerFilter, setPartnerFilter] = useState(ALL);
  const [fractionFilter, setFractionFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const [createOpen, setCreateOpen] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [resultsTestId, setResultsTestId] = useState<string | null>(null);
  const [deleteTest, setDeleteTest] = useState<ProductTest | null>(null);

  const tests = useMemo<ProductTest[]>(() => testsQuery.data ?? [], [testsQuery.data]);
  const results = useMemo<ProductTestResult[]>(() => resultsQuery.data ?? [], [resultsQuery.data]);
  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const fractions = useMemo(() => fractionsQuery.data ?? [], [fractionsQuery.data]);

  const partnerById = useMemo(
    () => new Map(partners.map((partner) => [partner.id, partner])),
    [partners],
  );
  const fractionById = useMemo(
    () => new Map(fractions.map((fraction) => [fraction.id, fraction])),
    [fractions],
  );

  const resultsByTest = useMemo(() => {
    const map = new Map<string, ProductTestResult[]>();
    for (const row of results) {
      const bucket = map.get(row.product_test_id);
      if (bucket) bucket.push(row);
      else map.set(row.product_test_id, [row]);
    }
    return map;
  }, [results]);

  /* --------------------------------------------------------------- filters */

  const filteredTests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tests.filter((test) => {
      const matchesSearch =
        !term ||
        test.test_code.toLowerCase().includes(term) ||
        test.title.toLowerCase().includes(term) ||
        (test.recipe_notes ?? "").toLowerCase().includes(term) ||
        (test.summary ?? "").toLowerCase().includes(term);
      const matchesCategory = categoryFilter === ALL || test.category === categoryFilter;
      const matchesPartner =
        partnerFilter === ALL ||
        (partnerFilter === NO_SELECTION ? test.partner_id === null : test.partner_id === partnerFilter);
      const matchesFraction =
        fractionFilter === ALL ||
        (fractionFilter === NO_SELECTION
          ? test.output_fraction_id === null
          : test.output_fraction_id === fractionFilter);
      const matchesStatus = statusFilter === ALL || test.status === statusFilter;
      return matchesSearch && matchesCategory && matchesPartner && matchesFraction && matchesStatus;
    });
  }, [tests, searchTerm, categoryFilter, partnerFilter, fractionFilter, statusFilter]);

  const activeFilterCount =
    (searchTerm.trim() ? 1 : 0) +
    (categoryFilter !== ALL ? 1 : 0) +
    (partnerFilter !== ALL ? 1 : 0) +
    (fractionFilter !== ALL ? 1 : 0) +
    (statusFilter !== ALL ? 1 : 0);

  const resetFilters = () => {
    setSearchTerm("");
    setCategoryFilter(ALL);
    setPartnerFilter(ALL);
    setFractionFilter(ALL);
    setStatusFilter(ALL);
  };

  /* ----------------------------------------------------------------- stats */

  const completedCount = tests.filter((test) => test.status === "completed").length;
  const bestGain = useMemo(() => {
    const deltas = results
      .map((row) => row.delta_pct)
      .filter((value): value is number => value !== null);
    return deltas.length ? Math.max(...deltas) : null;
  }, [results]);

  /* ------------------------------------------------------------ reference */

  const referenceTest = useMemo(
    () => tests.find((test) => test.test_code === REFERENCE_TEST_CODE) ?? null,
    [tests],
  );
  const referenceResults = referenceTest ? resultsByTest.get(referenceTest.id) ?? [] : [];

  /* ------------------------------------------------------------- mutations */

  const updateStatus = useProjectMutation<StatusUpdate>(
    async (values) => {
      const { data, error } = await supabase
        .from("product_tests")
        .update({ status: values.status, actual_date: values.actualDate })
        .eq("id", values.id)
        .select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
      return data[0];
    },
    { successMessage: "Status aktualisiert", errorMessage: "Status konnte nicht geändert werden" },
  );

  const removeTest = useProjectMutation<string>(
    async (testId) => {
      const { data, error } = await supabase
        .from("product_tests")
        .delete()
        .eq("id", testId)
        .select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
      return data[0];
    },
    {
      successMessage: "Produkttest gelöscht",
      errorMessage: "Produkttest konnte nicht gelöscht werden",
      onDone: () => setDeleteTest(null),
    },
  );

  const handleStatusChange = (test: ProductTest, status: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const actualDate =
      (status === "completed" || status === "running") && !test.actual_date ? today : test.actual_date;
    updateStatus.mutate({ id: test.id, status, actualDate });
  };

  /* ----------------------------------------------------------- results view */

  const resultsTest = resultsTestId ? tests.find((test) => test.id === resultsTestId) ?? null : null;
  const baselineTest = resultsTest ? findBaselineTest(resultsTest, tests) : null;

  const listError = testsQuery.error instanceof Error ? testsQuery.error : null;
  const chartError = resultsQuery.error instanceof Error ? resultsQuery.error : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <ProjectPageHeader
        title="Produkttests"
        description="Validierung der Rezyklatfraktionen in Baustoff- und Compound-Rezepturen"
        icon={FlaskConical}
        actions={
          <>
            <Button variant="outline" onClick={() => setSeriesOpen(true)}>
              <Layers className="h-4 w-4" />
              Dosierreihe anlegen
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Neuer Produkttest
            </Button>
          </>
        }
      />

      <IpGateBanner />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Produkttests"
          value={formatNumber(tests.length, 0)}
          hint={`${filteredTests.length} nach Filter sichtbar`}
          icon={FlaskConical}
          accent="violet"
        />
        <StatCard
          label="Abgeschlossen"
          value={formatNumber(completedCount, 0)}
          hint="mit Ergebnisbericht"
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Messwerte"
          value={formatNumber(results.length, 0)}
          hint="erfasste Einzelwerte"
          icon={Ruler}
          accent="sky"
        />
        <StatCard
          label="Bester Zuwachs"
          value={bestGain === null ? "—" : `+${formatNumber(bestGain, 1)} %`}
          hint="gegenüber Baseline"
          icon={TrendingUp}
          accent="amber"
        />
      </div>

      <ProductTestReferenceCard
        test={referenceTest}
        results={referenceResults}
        onOpenResults={() => referenceTest && setResultsTestId(referenceTest.id)}
      />

      {/* ------------------------------------------------------------ filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 flex-1 min-w-0">
              <Label htmlFor="pt-search" className="text-xs">
                Suche
              </Label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="pt-search"
                  className="pl-9"
                  placeholder="Code, Titel, Rezeptur …"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={resetFilters}
              disabled={activeFilterCount === 0}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
              Filter zurücksetzen
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="pt-filter-category" className="text-xs">
                Kategorie
              </Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="pt-filter-category">
                  <SelectValue placeholder="Alle Kategorien" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={ALL}>Alle Kategorien</SelectItem>
                  {PRODUCT_TEST_CATEGORIES.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt-filter-partner" className="text-xs">
                Partner
              </Label>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger id="pt-filter-partner">
                  <SelectValue placeholder="Alle Partner" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={ALL}>Alle Partner</SelectItem>
                  <SelectItem value={NO_SELECTION}>Ohne Partner</SelectItem>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt-filter-fraction" className="text-xs">
                Fraktion
              </Label>
              <Select value={fractionFilter} onValueChange={setFractionFilter}>
                <SelectTrigger id="pt-filter-fraction">
                  <SelectValue placeholder="Alle Fraktionen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={ALL}>Alle Fraktionen</SelectItem>
                  <SelectItem value={NO_SELECTION}>Ohne Fraktion</SelectItem>
                  {fractions.map((fraction) => (
                    <SelectItem key={fraction.id} value={fraction.id}>
                      {fractionLabel(fraction)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt-filter-status" className="text-xs">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="pt-filter-status">
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={ALL}>Alle Status</SelectItem>
                  {PRODUCT_TEST_STATUSES.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Die Filter wirken auf das Vergleichsdiagramm und die Tabelle.
          </p>
        </CardContent>
      </Card>

      {/* -------------------------------------------------------------- chart */}
      {chartError ? (
        <ErrorState error={chartError} onRetry={() => void resultsQuery.refetch()} />
      ) : (
        <ProductTestComparisonChart tests={filteredTests} results={results} />
      )}

      {/* -------------------------------------------------------------- table */}
      <Card>
        <CardContent className="p-0">
          {testsQuery.isLoading ? (
            <div className="p-4">
              <LoadingRows rows={6} />
            </div>
          ) : listError ? (
            <div className="p-4">
              <ErrorState error={listError} onRetry={() => void testsQuery.refetch()} />
            </div>
          ) : tests.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Noch keine Produkttests"
                description="Legen Sie einen einzelnen Test an oder direkt eine komplette Dosierreihe mit Baseline und 5/10/15/20 % Dosierung."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Neuer Produkttest
                    </Button>
                    <Button variant="outline" onClick={() => setSeriesOpen(true)}>
                      <Layers className="h-4 w-4" />
                      Dosierreihe anlegen
                    </Button>
                  </div>
                }
              />
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Kein Produkttest passt zu den Filtern"
                description="Setzen Sie die Filter zurück, um wieder alle Tests zu sehen."
                action={
                  <Button variant="outline" onClick={resetFilters}>
                    <X className="h-4 w-4" />
                    Filter zurücksetzen
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Code</TableHead>
                    <TableHead className="whitespace-nowrap">Titel</TableHead>
                    <TableHead className="whitespace-nowrap">Kategorie</TableHead>
                    <TableHead className="whitespace-nowrap">Partner</TableHead>
                    <TableHead className="whitespace-nowrap">Fraktion</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Dosierung</TableHead>
                    <TableHead className="whitespace-nowrap">Geplant</TableHead>
                    <TableHead className="whitespace-nowrap">Durchgeführt</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Kosten</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Messwerte</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Bestes Δ</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTests.map((test) => {
                    const testResults = resultsByTest.get(test.id) ?? [];
                    const deltas = testResults
                      .map((row) => row.delta_pct)
                      .filter((value): value is number => value !== null);
                    const bestDelta = deltas.length ? Math.max(...deltas) : null;
                    const fraction = test.output_fraction_id
                      ? fractionById.get(test.output_fraction_id) ?? null
                      : null;
                    const partner = test.partner_id ? partnerById.get(test.partner_id) ?? null : null;

                    return (
                      <TableRow key={test.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {test.test_code}
                        </TableCell>
                        <TableCell className="min-w-[14rem] font-medium">{test.title}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {labelOf(PRODUCT_TEST_CATEGORIES, test.category)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{partner?.name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {fractionLabel(fraction)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {dosageLabel(test.dosage_pct)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(test.planned_date)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(test.actual_date)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <ToneBadge tone={toneOf(PRODUCT_TEST_STATUSES, test.status)}>
                            {labelOf(PRODUCT_TEST_STATUSES, test.status)}
                          </ToneBadge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {formatEur(test.cost_eur)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {testResults.length}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <DeltaBadge value={bestDelta} className="justify-end" />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Aktionen für ${test.test_code}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover w-56">
                              <DropdownMenuItem onSelect={() => setResultsTestId(test.id)}>
                                <BarChart3 className="h-4 w-4" />
                                Ergebnisse erfassen
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                Status setzen
                              </DropdownMenuLabel>
                              {PRODUCT_TEST_STATUSES.map((status) => (
                                <DropdownMenuItem
                                  key={status.id}
                                  disabled={test.status === status.id || updateStatus.isPending}
                                  onSelect={() => handleStatusChange(test, status.id)}
                                >
                                  {status.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setDeleteTest(test)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Produkttest löschen
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

      {/* ------------------------------------------------------------ dialogs */}
      <ProductTestCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        partners={partners}
        fractions={fractions}
      />

      <DosageSeriesDialog
        open={seriesOpen}
        onOpenChange={setSeriesOpen}
        partners={partners}
        fractions={fractions}
      />

      {resultsTest && (
        <ProductTestResultsDialog
          test={resultsTest}
          results={resultsByTest.get(resultsTest.id) ?? []}
          baselineResults={baselineTest ? resultsByTest.get(baselineTest.id) ?? [] : []}
          open
          onOpenChange={(open) => {
            if (!open) setResultsTestId(null);
          }}
        />
      )}

      <AlertDialog
        open={deleteTest !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTest(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Produkttest löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTest
                ? `${deleteTest.test_code} — „${deleteTest.title}“ wird mit allen erfassten Messwerten unwiderruflich gelöscht.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeTest.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeTest.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTest) removeTest.mutate(deleteTest.id);
              }}
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
