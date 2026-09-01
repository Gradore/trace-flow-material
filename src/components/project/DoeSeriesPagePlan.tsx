import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Download, FlaskConical, Info, Loader2, Plus, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  ToneBadge,
  formatDate,
  formatNumber,
} from "@/components/project/ProjectUI";
import { TEST_RUN_STATUSES, labelOf, toneOf } from "@/lib/project/constants";
import {
  nextProjectCode,
  useInvalidateProject,
  useProjectMutation,
} from "@/hooks/project/useProjectData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { DoeSeries, TestRun } from "@/lib/project/types";
import {
  MAX_PLAN_ROWS,
  buildCsv,
  csvLevel,
  csvNumber,
  downloadCsv,
  factorTitle,
  formatLevel,
  levelKey,
  resolveResponseKeys,
  responseTitle,
  type PlanResult,
  type PlanRow,
  type RunData,
} from "@/components/project/DoeSeriesPageShared";
import { cn } from "@/lib/utils";

interface DoeSeriesPagePlanProps {
  series: DoeSeries;
  plan: PlanResult;
  /** Every test run that belongs to this series. */
  runs: TestRun[];
  /** Levels and measured responses per run, keyed by run id. */
  runData: Map<string, RunData>;
  onEditSeries: () => void;
}

interface ParameterInsert {
  test_run_id: string;
  parameter_key: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
}

export default function DoeSeriesPagePlan({
  series,
  plan,
  runs,
  runData,
  onEditSeries,
}: DoeSeriesPagePlanProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runByNumber = useMemo(() => {
    const map = new Map<number, TestRun>();
    runs.forEach((run) => {
      if (run.doe_run_number === null || run.doe_run_number === undefined) return;
      if (!map.has(run.doe_run_number)) map.set(run.doe_run_number, run);
    });
    return map;
  }, [runs]);

  const missingRows = useMemo(
    () => plan.rows.filter((row) => !runByNumber.has(row.runNumber)),
    [plan.rows, runByNumber],
  );

  /** Runs of the series that no plan row claims - kept visible, never hidden. */
  const unplannedRuns = useMemo(() => {
    const planned = new Set(plan.rows.map((row) => row.runNumber));
    return runs.filter(
      (run) =>
        run.doe_run_number === null ||
        run.doe_run_number === undefined ||
        !planned.has(run.doe_run_number),
    );
  }, [plan.rows, runs]);

  const responseKeys = useMemo(
    () => resolveResponseKeys(series.responses, runData),
    [series.responses, runData],
  );

  /* -------------------------------------------------------- create runs */

  const invalidateProject = useInvalidateProject();

  const createRunsMutation = useProjectMutation<PlanRow[]>(
    async (rows) => {
      let created = 0;
      try {
        for (const row of rows) {
          const runCode = await nextProjectCode("test_run");
          const { data, error } = await supabase
            .from("test_runs")
            .insert({
              run_code: runCode,
              title: `${series.code} Lauf ${row.runNumber}`,
              process_line: series.process_line,
              status: "planned",
              doe_series_id: series.id,
              doe_run_number: row.runNumber,
            })
            .select("id");
          if (error) throw new Error(error.message);
          if (!data || data.length === 0) {
            throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
          }

          const testRunId = data[0].id;
          const parameterRows: ParameterInsert[] = plan.factors.map((factor, index) => {
            const level = row.levels[index];
            return {
              test_run_id: testRunId,
              parameter_key: factor.key,
              value_numeric: typeof level === "number" ? level : null,
              value_text: typeof level === "number" ? null : (level ?? null),
              unit: factor.unit && factor.unit.trim().length ? factor.unit.trim() : null,
            };
          });

          if (parameterRows.length) {
            const { data: parameterData, error: parameterError } = await supabase
              .from("test_run_parameters")
              .insert(parameterRows)
              .select("id");
            if (parameterError) throw new Error(parameterError.message);
            if (!parameterData || parameterData.length !== parameterRows.length) {
              throw new Error(
                "Versuchsparameter konnten nicht vollständig gespeichert werden (keine Berechtigung oder Datensatz nicht gefunden)",
              );
            }
          }
          created += 1;
        }
      } catch (error) {
        // A run created before the abort must still show up in the plan -
        // useProjectMutation only refreshes the cache on success.
        if (created > 0) invalidateProject();
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${created} von ${rows.length} Läufen angelegt, dann abgebrochen: ${message}`,
        );
      }
      // Reached only when every insert above was verified.
      toast({
        title: `${created} ${created === 1 ? "Lauf" : "Läufe"} angelegt`,
        description: `Status „${labelOf(TEST_RUN_STATUSES, "planned")}“, Parameter aus dem Versuchsplan übernommen.`,
      });
    },
    {
      errorMessage: "Läufe konnten nicht angelegt werden",
      onDone: () => setConfirmOpen(false),
    },
  );

  /* ------------------------------------------------------------- export */

  const handleExport = () => {
    const header = [
      "Lauf",
      "Versuchscode",
      "Titel",
      "Status",
      "Geplant am",
      "Durchgeführt am",
      ...plan.factors.map((factor) => factorTitle(factor)),
      ...responseKeys.map((key) => responseTitle(key)),
      "Analysen",
    ];

    const rows: string[][] = [header];

    plan.rows.forEach((row) => {
      const run = runByNumber.get(row.runNumber) ?? null;
      const data = run ? runData.get(run.id) : undefined;
      rows.push([
        String(row.runNumber),
        run?.run_code ?? "",
        run?.title ?? `${series.code} Lauf ${row.runNumber}`,
        run ? labelOf(TEST_RUN_STATUSES, run.status) : "nicht angelegt",
        run?.planned_date ? formatDate(run.planned_date) : "",
        run?.actual_date ? formatDate(run.actual_date) : "",
        ...plan.factors.map((factor, index) => {
          const actual = data?.levels.get(factor.key);
          return csvLevel(actual !== undefined ? actual : row.levels[index]);
        }),
        ...responseKeys.map((key) => csvNumber(data?.responses.get(key)?.mean ?? null)),
        data ? String(data.analysisCount) : "0",
      ]);
    });

    unplannedRuns.forEach((run) => {
      const data = runData.get(run.id);
      rows.push([
        run.doe_run_number === null || run.doe_run_number === undefined
          ? ""
          : String(run.doe_run_number),
        run.run_code,
        run.title,
        labelOf(TEST_RUN_STATUSES, run.status),
        run.planned_date ? formatDate(run.planned_date) : "",
        run.actual_date ? formatDate(run.actual_date) : "",
        ...plan.factors.map((factor) => csvLevel(data?.levels.get(factor.key) ?? null)),
        ...responseKeys.map((key) => csvNumber(data?.responses.get(key)?.mean ?? null)),
        data ? String(data.analysisCount) : "0",
      ]);
    });

    downloadCsv(`doe-${series.code}.csv`, buildCsv(rows));
    toast({
      title: "CSV exportiert",
      description: `doe-${series.code}.csv — ${rows.length - 1} Datenzeilen, Semikolon getrennt.`,
    });
  };

  /* -------------------------------------------------------------- render */

  if (plan.tooLarge) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Versuchsplan zu groß</AlertTitle>
        <AlertDescription className="text-sm">
          Die hinterlegten Faktoren ergeben {formatNumber(plan.totalCombinations, 0)} Kombinationen.
          Reduzieren Sie Faktoren oder Stufen, damit ein Plan erzeugt werden kann.{" "}
          <button type="button" onClick={onEditSeries} className="underline underline-offset-2">
            Serie bearbeiten
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!plan.rows.length) {
    return (
      <EmptyState
        title="Kein Versuchsplan vorhanden"
        description="Für diese Serie sind noch keine Faktoren mit Stufen hinterlegt. Ohne Faktoren lässt sich kein Versuchsplan erzeugen."
        action={
          <Button onClick={onEditSeries}>
            <Plus className="h-4 w-4 mr-2" />
            Faktoren hinterlegen
          </Button>
        }
      />
    );
  }

  const plannedMismatch =
    series.planned_runs > 0 && series.planned_runs !== plan.requestedRows;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Kombinationen gesamt</p>
          <p className="text-lg font-bold">{formatNumber(plan.totalCombinations, 0)}</p>
          <p className="text-xs text-muted-foreground">
            {plan.factors.map((factor) => factor.levels.length).join(" × ")}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Läufe im Plan</p>
          <p className="text-lg font-bold">{formatNumber(plan.requestedRows, 0)}</p>
          <p className="text-xs text-muted-foreground">
            {plan.step > 1 ? `jede ${plan.step}. Kombination` : "vollfaktoriell"}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Bereits angelegt</p>
          <p className="text-lg font-bold">
            {plan.rows.length - missingRows.length} / {plan.rows.length}
          </p>
          <p className="text-xs text-muted-foreground">
            {missingRows.length === 0
              ? "Plan vollständig angelegt"
              : `${missingRows.length} ${missingRows.length === 1 ? "Lauf fehlt" : "Läufe fehlen"}`}
          </p>
        </div>
      </div>

      {plan.capped && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Anzeige begrenzt</AlertTitle>
          <AlertDescription className="text-sm">
            Der Plan umfasst {formatNumber(plan.requestedRows, 0)} Läufe. Angezeigt und anlegbar
            sind die ersten {MAX_PLAN_ROWS} Zeilen. Stellen Sie den Design-Typ auf teilfaktoriell
            und reduzieren Sie die geplante Laufzahl, um einen handhabbaren Plan zu erhalten.
          </AlertDescription>
        </Alert>
      )}

      {plannedMismatch && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Plan weicht von der geplanten Laufzahl ab</AlertTitle>
          <AlertDescription className="text-sm">
            In der Serie sind {formatNumber(series.planned_runs, 0)} Läufe geplant, der erzeugte
            Plan enthält {formatNumber(plan.requestedRows, 0)}. Bei einem vollfaktoriellen Design
            ergibt sich die Laufzahl aus den Faktorstufen — für genau{" "}
            {formatNumber(series.planned_runs, 0)} Läufe den Design-Typ auf teilfaktoriell stellen.
          </AlertDescription>
        </Alert>
      )}


      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={missingRows.length === 0 || createRunsMutation.isPending}
        >
          {createRunsMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FlaskConical className="h-4 w-4 mr-2" />
          )}
          Fehlende Läufe anlegen
          {missingRows.length > 0 ? ` (${missingRows.length})` : ""}
        </Button>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          CSV exportieren
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Table2 className="h-4 w-4" />
            Versuchsplan
          </CardTitle>
          <CardDescription>
            Automatisch aus den Faktorstufen generiert — eine Zeile je Lauf. Abweichende Werte
            durchgeführter Versuche werden gelb markiert; angezeigt wird dann der tatsächlich
            eingestellte Wert statt des Planwerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Der Plan wird am Automaten gelesen - unter md eine Karte je Lauf. */}
          <div className="space-y-3 md:hidden">
            {plan.rows.map((row) => {
              const run = runByNumber.get(row.runNumber) ?? null;
              const data = run ? runData.get(run.id) : undefined;
              return (
                <div
                  key={row.runNumber}
                  className={cn("rounded-lg border border-border p-3", !run && "bg-muted/30")}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold">Lauf {row.runNumber}</span>
                    {run ? (
                      <>
                        <Link
                          to="/projekt/versuche"
                          className="font-mono text-sm underline underline-offset-2"
                        >
                          {run.run_code}
                        </Link>
                        <ToneBadge tone={toneOf(TEST_RUN_STATUSES, run.status)}>
                          {labelOf(TEST_RUN_STATUSES, run.status)}
                        </ToneBadge>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        nicht angelegt
                      </Badge>
                    )}
                  </div>

                  <dl className="mt-2 space-y-1 text-xs">
                    {plan.factors.map((factor, index) => {
                      const planned = row.levels[index];
                      const actual = data?.levels.get(factor.key);
                      const deviates =
                        actual !== undefined && levelKey(actual) !== levelKey(planned);
                      return (
                        <div key={factor.key} className="flex items-baseline justify-between gap-3">
                          <dt className="min-w-0 text-muted-foreground">
                            {factor.label}
                            {factor.unit ? ` [${factor.unit}]` : ""}
                          </dt>
                          <dd
                            className={cn(
                              "shrink-0 text-right font-medium",
                              deviates && "text-warning",
                            )}
                          >
                            {deviates ? formatLevel(actual) : formatLevel(planned)}
                            {deviates && (
                              <span className="ml-1">≠ Plan {formatLevel(planned)}</span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
          </div>

          <div className="-mx-6 hidden overflow-x-auto px-6 md:block">
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16">Lauf</TableHead>
                  <TableHead>Versuch</TableHead>
                  <TableHead>Status</TableHead>
                  {plan.factors.map((factor) => (
                    <TableHead key={factor.key} className="whitespace-nowrap">
                      {factor.label}
                      {factor.unit ? (
                        <span className="text-muted-foreground font-normal"> [{factor.unit}]</span>
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.rows.map((row) => {
                  const run = runByNumber.get(row.runNumber) ?? null;
                  const data = run ? runData.get(run.id) : undefined;
                  return (
                    <TableRow key={row.runNumber} className={cn(!run && "bg-muted/30")}>
                      <TableCell className="font-mono font-medium">{row.runNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {run ? (
                          <Link
                            to="/projekt/versuche"
                            className="font-mono text-sm underline underline-offset-2"
                          >
                            {run.run_code}
                          </Link>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            nicht angelegt
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {run ? (
                          <ToneBadge tone={toneOf(TEST_RUN_STATUSES, run.status)}>
                            {labelOf(TEST_RUN_STATUSES, run.status)}
                          </ToneBadge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      {plan.factors.map((factor, index) => {
                        const planned = row.levels[index];
                        const actual = data?.levels.get(factor.key);
                        const deviates =
                          actual !== undefined && levelKey(actual) !== levelKey(planned);
                        return (
                          <TableCell
                            key={factor.key}
                            className={cn("whitespace-nowrap", deviates && "text-warning")}
                            title={
                              deviates ? `Plan: ${formatLevel(planned)}` : undefined
                            }
                          >
                            {deviates ? formatLevel(actual) : formatLevel(planned)}
                            {deviates && <span className="ml-1 text-xs">≠ Plan</span>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {unplannedRuns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Läufe außerhalb des Plans</CardTitle>
            <CardDescription>
              Diese Versuche gehören zur Serie, tragen aber keine passende Plannummer. Sie werden
              mit exportiert und in der Auswertung berücksichtigt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <Table className="min-w-[32rem]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Versuchscode</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Durchgeführt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unplannedRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono whitespace-nowrap">
                        <Link to="/projekt/versuche" className="underline underline-offset-2">
                          {run.run_code}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate">{run.title}</TableCell>
                      <TableCell className="font-mono">
                        {run.doe_run_number ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <ToneBadge tone={toneOf(TEST_RUN_STATUSES, run.status)}>
                          {labelOf(TEST_RUN_STATUSES, run.status)}
                        </ToneBadge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(run.actual_date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!createRunsMutation.isPending) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {missingRows.length} {missingRows.length === 1 ? "Lauf" : "Läufe"} anlegen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Es {missingRows.length === 1 ? "wird ein Versuch" : "werden Versuche"} mit dem Status
              „{labelOf(TEST_RUN_STATUSES, "planned")}“ und der Prozesslinie der Serie angelegt.
              Die Faktorstufen werden als Versuchsparameter gespeichert. Bereits vorhandene Läufe
              bleiben unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={createRunsMutation.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={createRunsMutation.isPending || missingRows.length === 0}
              onClick={(event) => {
                event.preventDefault();
                if (!missingRows.length) return;
                createRunsMutation.mutate(missingRows);
              }}
            >
              {createRunsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Anlegen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
