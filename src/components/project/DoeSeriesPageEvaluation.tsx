import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info, LineChart as LineChartIcon, Sigma } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EmptyState, formatNumber } from "@/components/project/ProjectUI";
import type {
  AnalysisResult,
  DoeFactor,
  DoeSeries,
  FractionAnalysis,
  FractionSpec,
  OutputFraction,
  TestRun,
  TestRunParameter,
} from "@/lib/project/types";
import {
  MIN_RUNS_PER_LEVEL,
  RESPONSE_LIMITS,
  buildRunData,
  factorTitle,
  formatLevel,
  levelKey,
  resolveResponseKeys,
  responseTitle,
  responseUnit,
  type LevelValue,
  type RunData,
} from "@/components/project/DoeSeriesPageShared";
import { cn } from "@/lib/utils";

const ALL_FRACTIONS = "__all__";
const MAX_INTERACTION_PAIRS = 12;

/**
 * Level labels may contain blanks ("leicht stumpf"), so a blank must not join
 * the two halves of an interaction cell key - "a b"+"c" and "a"+"b c" would
 * collapse onto the same cell.
 */
const CELL_SEPARATOR = "\u0000";
const cellKeyOf = (rowKey: string, columnKey: string) =>
  `${rowKey}${CELL_SEPARATOR}${columnKey}`;

interface DoeSeriesPageEvaluationProps {
  series: DoeSeries;
  factors: DoeFactor[];
  /** Every test run of the series - only completed ones are evaluated. */
  runs: TestRun[];
  parameters: TestRunParameter[];
  fractions: OutputFraction[];
  analyses: FractionAnalysis[];
  results: AnalysisResult[];
  fractionSpecs: FractionSpec[];
}

interface LevelPoint {
  key: string;
  label: string;
  mean: number;
  count: number;
}

interface FactorEffect {
  factor: DoeFactor;
  charted: LevelPoint[];
  thin: LevelPoint[];
  runsWithoutLevel: number;
}

interface InteractionCell {
  mean: number;
  count: number;
}

interface InteractionPair {
  a: DoeFactor;
  b: DoeFactor;
  rowKeys: string[];
  rowLabels: Map<string, string>;
  columnKeys: string[];
  columnLabels: Map<string, string>;
  cells: Map<string, InteractionCell>;
}

interface EffectTooltipProps {
  active?: boolean;
  payload?: { payload: LevelPoint }[];
  unit: string;
}

function EffectTooltip({ active, payload, unit }: EffectTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{point.label}</p>
      <p className="text-popover-foreground">
        Mittelwert {formatNumber(point.mean, 3)}
        {unit ? ` ${unit}` : ""}
      </p>
      <p className="text-muted-foreground">
        {point.count} {point.count === 1 ? "Lauf" : "Läufe"}
      </p>
    </div>
  );
}

/** Declared level order first, then levels that only show up in the data. */
function orderedLevels(factor: DoeFactor, observed: Map<string, string>): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  factor.levels.forEach((level) => {
    const key = levelKey(level);
    if (seen.has(key)) return;
    seen.add(key);
    if (observed.has(key)) order.push(key);
  });
  observed.forEach((_label, key) => {
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
  });
  return order;
}

export default function DoeSeriesPageEvaluation({
  series,
  factors,
  runs,
  parameters,
  fractions,
  analyses,
  results,
  fractionSpecs,
}: DoeSeriesPageEvaluationProps) {
  const [responseKey, setResponseKey] = useState<string>("");
  const [fractionFilter, setFractionFilter] = useState<string>(ALL_FRACTIONS);

  const completedRuns = useMemo(() => runs.filter((run) => run.status === "completed"), [runs]);

  const fractionOptions = useMemo(() => {
    const runIds = new Set(runs.map((run) => run.id));
    const ids = new Set<string>();
    fractions.forEach((fraction) => {
      if (!fraction.test_run_id || !runIds.has(fraction.test_run_id)) return;
      if (fraction.target_fraction_id) ids.add(fraction.target_fraction_id);
    });
    return Array.from(ids)
      .sort((a, b) => a.localeCompare(b, "de"))
      .map((id) => ({ id, name: fractionSpecs.find((spec) => spec.id === id)?.name ?? id }));
  }, [fractions, runs, fractionSpecs]);

  /**
   * Keeps the fraction filter valid: a fraction that disappears from the data
   * must fall back to "all", otherwise the join silently returns nothing.
   */
  const activeFraction =
    fractionFilter !== ALL_FRACTIONS &&
    fractionOptions.some((option) => option.id === fractionFilter)
      ? fractionFilter
      : ALL_FRACTIONS;

  const activeFractionName =
    fractionOptions.find((option) => option.id === activeFraction)?.name ?? null;

  const allRunData = useMemo(
    () =>
      buildRunData({
        runs: completedRuns,
        parameters,
        fractions,
        analyses,
        results,
        targetFractionId: null,
      }),
    [completedRuns, parameters, fractions, analyses, results],
  );

  const runData = useMemo(
    () =>
      activeFraction === ALL_FRACTIONS
        ? allRunData
        : buildRunData({
            runs: completedRuns,
            parameters,
            fractions,
            analyses,
            results,
            targetFractionId: activeFraction,
          }),
    [activeFraction, allRunData, completedRuns, parameters, fractions, analyses, results],
  );

  const responseKeys = useMemo(
    () => resolveResponseKeys(series.responses, allRunData),
    [series.responses, allRunData],
  );

  /** Keeps the selection valid while the series or its responses change. */
  const activeResponse =
    responseKey && responseKeys.includes(responseKey) ? responseKey : (responseKeys[0] ?? "");

  const runsWithResponse = useMemo(() => {
    if (!activeResponse) return 0;
    let count = 0;
    runData.forEach((entry) => {
      if (entry.responses.has(activeResponse)) count += 1;
    });
    return count;
  }, [runData, activeResponse]);

  /* -------------------------------------------------------------- effects */

  const effects = useMemo<FactorEffect[]>(() => {
    if (!activeResponse) return [];
    return factors
      .filter((factor) => factor.levels.length > 0)
      .map((factor) => {
        const groups = new Map<string, { label: string; sum: number; count: number }>();
        const labels = new Map<string, string>();
        let runsWithoutLevel = 0;

        runData.forEach((entry: RunData) => {
          const response = entry.responses.get(activeResponse);
          if (!response) return;
          const level = entry.levels.get(factor.key);
          if (level === undefined || level === null) {
            runsWithoutLevel += 1;
            return;
          }
          const key = levelKey(level);
          const label = formatLevel(level);
          labels.set(key, label);
          const current = groups.get(key) ?? { label, sum: 0, count: 0 };
          groups.set(key, { label, sum: current.sum + response.mean, count: current.count + 1 });
        });

        const points: LevelPoint[] = orderedLevels(factor, labels).map((key) => {
          const group = groups.get(key);
          return {
            key,
            label: group?.label ?? key,
            mean: group && group.count > 0 ? group.sum / group.count : 0,
            count: group?.count ?? 0,
          };
        });

        return {
          factor,
          charted: points.filter((point) => point.count >= MIN_RUNS_PER_LEVEL),
          thin: points.filter((point) => point.count > 0 && point.count < MIN_RUNS_PER_LEVEL),
          runsWithoutLevel,
        };
      });
  }, [factors, runData, activeResponse]);

  /* --------------------------------------------------------- interactions */

  const interactions = useMemo<InteractionPair[]>(() => {
    if (!activeResponse) return [];
    const usable = factors.filter((factor) => factor.levels.length > 0);
    const pairs: InteractionPair[] = [];

    for (let i = 0; i < usable.length; i += 1) {
      for (let j = i + 1; j < usable.length; j += 1) {
        const a = usable[i];
        const b = usable[j];
        const rowLabels = new Map<string, string>();
        const columnLabels = new Map<string, string>();
        const sums = new Map<string, { sum: number; count: number }>();

        runData.forEach((entry) => {
          const response = entry.responses.get(activeResponse);
          if (!response) return;
          const levelA: LevelValue | undefined = entry.levels.get(a.key);
          const levelB: LevelValue | undefined = entry.levels.get(b.key);
          if (levelA === undefined || levelB === undefined) return;
          const keyA = levelKey(levelA);
          const keyB = levelKey(levelB);
          rowLabels.set(keyA, formatLevel(levelA));
          columnLabels.set(keyB, formatLevel(levelB));
          const cellKey = cellKeyOf(keyA, keyB);
          const current = sums.get(cellKey) ?? { sum: 0, count: 0 };
          sums.set(cellKey, { sum: current.sum + response.mean, count: current.count + 1 });
        });

        const cells = new Map<string, InteractionCell>();
        sums.forEach((value, key) => {
          if (value.count > 0) cells.set(key, { mean: value.sum / value.count, count: value.count });
        });

        if (cells.size < 2) continue;

        pairs.push({
          a,
          b,
          rowKeys: orderedLevels(a, rowLabels),
          rowLabels,
          columnKeys: orderedLevels(b, columnLabels),
          columnLabels,
          cells,
        });
      }
    }
    return pairs;
  }, [factors, runData, activeResponse]);

  const shownInteractions = interactions.slice(0, MAX_INTERACTION_PAIRS);
  const unit = activeResponse ? responseUnit(activeResponse) : "";
  const limit = activeResponse ? RESPONSE_LIMITS[activeResponse] : undefined;

  /* --------------------------------------------------------------- render */

  if (completedRuns.length === 0) {
    return (
      <EmptyState
        title="Noch keine abgeschlossenen Läufe"
        description="Die Auswertung nutzt ausschließlich Versuche mit dem Status „Abgeschlossen“ und die Analyseergebnisse der daraus erzeugten Fraktionen."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5 flex-1 min-w-0">
          <Label htmlFor="doe-response">Zielgröße</Label>
          <Select
            value={activeResponse}
            onValueChange={setResponseKey}
            disabled={responseKeys.length === 0}
          >
            <SelectTrigger id="doe-response">
              <SelectValue placeholder="Keine Zielgröße hinterlegt" />
            </SelectTrigger>
            <SelectContent>
              {responseKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {responseTitle(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:w-[16rem]">
          <Label htmlFor="doe-fraction">Fraktion</Label>
          <Select value={activeFraction} onValueChange={setFractionFilter}>
            <SelectTrigger id="doe-fraction">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FRACTIONS}>Alle Fraktionen</SelectItem>
              {fractionOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.id} · {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Datenbasis</AlertTitle>
        <AlertDescription className="text-sm">
          {completedRuns.length} abgeschlossene {completedRuns.length === 1 ? "Lauf" : "Läufe"} in
          dieser Serie, davon {runsWithResponse} mit Messwerten
          {activeResponse ? ` für ${responseTitle(activeResponse)}` : ""}
          {activeFraction !== ALL_FRACTIONS
            ? ` (nur Fraktion ${activeFraction}${activeFractionName ? ` — ${activeFractionName}` : ""})`
            : ""}
          . Liegen je
          Lauf mehrere analysierte Fraktionen vor, wird deren Mittelwert verwendet.
        </AlertDescription>
      </Alert>

      {responseKeys.length === 0 ? (
        <EmptyState
          title="Keine Zielgrößen auswertbar"
          description="Für diese Serie sind keine Zielgrößen hinterlegt und es liegen weder Analyseergebnisse der erzeugten Fraktionen noch auswertbare Maschinenparameter vor."
        />
      ) : runsWithResponse === 0 ? (
        <EmptyState
          title="Keine Messwerte für diese Zielgröße"
          description={`Für ${responseTitle(activeResponse)} liegen in den abgeschlossenen Läufen dieser Serie noch keine Messwerte vor. Prüfen Sie die erzeugten Fraktionen und deren Analysen bzw. die am Versuch erfassten Maschinenparameter.`}
        />
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <LineChartIcon className="h-4 w-4" />
              Haupteffekte — {responseTitle(activeResponse)}
            </h3>
            {effects.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  In dieser Serie ist kein Faktor mit Stufen hinterlegt. Haupteffekte lassen sich
                  erst berechnen, wenn die Serie Faktoren mit mindestens einer Stufe führt.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {effects.map((effect) => {
                  const sufficient = effect.charted.length >= 2;
                  return (
                    <Card key={effect.factor.key}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{factorTitle(effect.factor)}</CardTitle>
                        <CardDescription className="text-xs">
                          Mittelwert je Stufe über die abgeschlossenen Läufe
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {sufficient ? (
                          <>
                            <div className="h-[200px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={effect.charted}
                                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                  <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11 }}
                                    stroke="hsl(var(--muted-foreground))"
                                  />
                                  <YAxis
                                    width={46}
                                    tick={{ fontSize: 11 }}
                                    stroke="hsl(var(--muted-foreground))"
                                  />
                                  <Tooltip content={<EffectTooltip unit={unit} />} />
                                  {limit && (
                                    <ReferenceLine
                                      y={limit.value}
                                      stroke="hsl(var(--destructive))"
                                      strokeDasharray="4 4"
                                      label={{
                                        value: limit.label,
                                        position: "insideTopRight",
                                        fontSize: 10,
                                        fill: "hsl(var(--destructive))",
                                      }}
                                    />
                                  )}
                                  <Line
                                    type="monotone"
                                    dataKey="mean"
                                    name="Mittelwert"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                                    activeDot={{ r: 6 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {effect.charted
                                .map((point) => `${point.label}: n=${point.count}`)
                                .join(" | ")}
                            </p>
                            {effect.thin.length > 0 && (
                              <p className="text-xs text-warning mt-1">
                                Nicht dargestellt, zu wenig Läufe:{" "}
                                {effect.thin
                                  .map((point) => `${point.label} (n=${point.count})`)
                                  .join(", ")}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border p-4 text-sm space-y-1">
                            <p className="font-medium">Noch nicht auswertbar</p>
                            <p className="text-muted-foreground text-xs">
                              Mindestens 2 abgeschlossene Läufe je Stufe erforderlich, und das für
                              mindestens zwei Stufen. Aktuell:{" "}
                              {effect.charted.length + effect.thin.length === 0
                                ? "keine Stufe mit Messwerten"
                                : [...effect.charted, ...effect.thin]
                                    .map((point) => `${point.label} (n=${point.count})`)
                                    .join(", ")}
                              .
                            </p>
                            {effect.runsWithoutLevel > 0 && (
                              <p className="text-muted-foreground text-xs">
                                {effect.runsWithoutLevel}{" "}
                                {effect.runsWithoutLevel === 1 ? "Lauf hat" : "Läufe haben"} keinen
                                Wert für diesen Faktor hinterlegt.
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Sigma className="h-4 w-4" />
              Wechselwirkungen — {responseTitle(activeResponse)}
            </h3>
            {shownInteractions.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Für keine Faktorkombination liegen bisher mindestens zwei besetzte
                  Stufenkombinationen vor. Wechselwirkungen lassen sich erst beurteilen, wenn
                  mehrere Kombinationen gefahren und analysiert wurden.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {shownInteractions.map((pair) => (
                  <Card key={`${pair.a.key}-${pair.b.key}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {pair.a.label} × {pair.b.label}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Mittelwert {responseTitle(activeResponse)} je Stufenkombination, n = Anzahl
                        Läufe
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full min-w-[20rem] text-sm border-collapse">
                          <thead>
                            <tr>
                              <th className="text-left font-medium text-muted-foreground p-2 whitespace-nowrap">
                                {pair.a.label} / {pair.b.label}
                              </th>
                              {pair.columnKeys.map((columnKey) => (
                                <th
                                  key={columnKey}
                                  className="text-right font-medium text-muted-foreground p-2 whitespace-nowrap"
                                >
                                  {pair.columnLabels.get(columnKey) ?? columnKey}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pair.rowKeys.map((rowKey) => (
                              <tr key={rowKey} className="border-t border-border">
                                <td className="p-2 font-medium whitespace-nowrap">
                                  {pair.rowLabels.get(rowKey) ?? rowKey}
                                </td>
                                {pair.columnKeys.map((columnKey) => {
                                  const cell = pair.cells.get(cellKeyOf(rowKey, columnKey));
                                  return (
                                    <td
                                      key={columnKey}
                                      className={cn(
                                        "p-2 text-right whitespace-nowrap tabular-nums",
                                        (!cell || cell.count < MIN_RUNS_PER_LEVEL) &&
                                          "text-muted-foreground",
                                      )}
                                    >
                                      {cell ? (
                                        <>
                                          {formatNumber(cell.mean, 2)}
                                          <span className="ml-1 text-xs text-muted-foreground">
                                            n={cell.count}
                                          </span>
                                        </>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {interactions.length > shownInteractions.length && (
                  <p className="text-xs text-muted-foreground">
                    {interactions.length - shownInteractions.length} weitere Faktorpaare sind
                    ausgeblendet. Werten Sie diese über den CSV-Export aus.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Zellen mit n = 1 sind Einzelwerte und grau dargestellt, sie belegen keine
                  Wechselwirkung.
                </p>
              </div>
            )}
          </div>

          {limit && (
            <Badge
              variant="outline"
              className="border-destructive/20 bg-destructive/10 text-destructive"
            >
              {limit.kind === "min" ? "Untergrenze" : "Obergrenze"} {limit.label}
            </Badge>
          )}
        </>
      )}
    </div>
  );
}
