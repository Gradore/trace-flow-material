/**
 * Strength development over the test age, one line per dosage rate.
 *
 * The whole point of a dosage series is the overlay: does 10 % recycled fibre
 * beat 5 %, and does either beat the plain baseline recipe? The 0 % series is
 * drawn dashed; if no explicit baseline test exists, the average of the stored
 * baseline_value column is drawn as a dashed reference line instead.
 */
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_TEST_PARAMETER_KEYS } from "@/lib/project/constants";
import { formatNumber } from "@/components/project/ProjectUI";
import {
  BASELINE_COLOR,
  DOSAGE_SERIES_COLORS,
  dosageLabel,
  productParameterMeta,
} from "@/components/project/ProductTestsShared";
import type { ProductTest, ProductTestResult } from "@/lib/project/types";

interface DosageSeries {
  key: string;
  name: string;
  color: string;
  dashed: boolean;
}

function meanOf(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function ProductTestComparisonChart({
  tests,
  results,
}: {
  /** The tests currently in scope — the page filters feed straight into this. */
  tests: ProductTest[];
  /** All product test results; rows outside `tests` are ignored. */
  results: ProductTestResult[];
}) {
  const [selectedParameter, setSelectedParameter] = useState<string>("");

  const testById = useMemo(() => new Map(tests.map((test) => [test.id, test])), [tests]);

  const scopedResults = useMemo(
    () => results.filter((row) => testById.has(row.product_test_id)),
    [results, testById],
  );

  const availableParameters = useMemo(
    () =>
      PRODUCT_TEST_PARAMETER_KEYS.filter((parameter) =>
        scopedResults.some(
          (row) =>
            row.parameter_key === parameter.key &&
            row.value_numeric !== null &&
            row.age_days !== null,
        ),
      ),
    [scopedResults],
  );

  const activeParameter =
    availableParameters.find((parameter) => parameter.key === selectedParameter)?.key ??
    availableParameters[0]?.key ??
    "";

  const { chartData, series, baselineAverage, unit } = useMemo(() => {
    const meta = productParameterMeta(activeParameter);
    const groups = new Map<string, { dosage: number | null; byAge: Map<number, number[]> }>();
    const baselineValues: number[] = [];

    for (const row of scopedResults) {
      if (row.parameter_key !== activeParameter) continue;
      const value = row.value_numeric;
      const age = row.age_days;
      if (value === null || age === null) continue;
      const test = testById.get(row.product_test_id);
      if (!test) continue;
      if (row.baseline_value !== null) baselineValues.push(row.baseline_value);

      const dosage = test.dosage_pct ?? null;
      const groupKey = dosage === null ? "s_na" : `s_${dosage}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = { dosage, byAge: new Map<number, number[]>() };
        groups.set(groupKey, group);
      }
      const bucket = group.byAge.get(age) ?? [];
      bucket.push(value);
      group.byAge.set(age, bucket);
    }

    const ordered = [...groups.entries()].sort((a, b) => {
      const left = a[1].dosage;
      const right = b[1].dosage;
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    });

    let colorIndex = 0;
    const builtSeries: DosageSeries[] = ordered.map(([key, group]) => {
      const isBaseline = group.dosage === 0;
      const color = isBaseline
        ? BASELINE_COLOR
        : DOSAGE_SERIES_COLORS[colorIndex++ % DOSAGE_SERIES_COLORS.length];
      return {
        key,
        name: dosageLabel(group.dosage),
        color,
        dashed: isBaseline,
      };
    });

    const ages = [...new Set(ordered.flatMap(([, group]) => [...group.byAge.keys()]))].sort(
      (a, b) => a - b,
    );

    const rows = ages.map((age) => {
      const point: Record<string, number | null> = { age };
      for (const [key, group] of ordered) {
        const bucket = group.byAge.get(age);
        point[key] = bucket && bucket.length ? meanOf(bucket) : null;
      }
      return point;
    });

    const hasExplicitBaseline = ordered.some(([, group]) => group.dosage === 0);

    return {
      chartData: rows,
      series: builtSeries,
      baselineAverage:
        !hasExplicitBaseline && baselineValues.length ? meanOf(baselineValues) : null,
      unit: meta.unit,
    };
  }, [activeParameter, scopedResults, testById]);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChartIcon className="h-4 w-4 text-primary" aria-hidden />
              Festigkeitsentwicklung nach Prüfalter
            </CardTitle>
            <CardDescription>
              Eine Linie je Dosierstufe über alle aktuell gefilterten Produkttests. Die Baseline (0 %)
              ist gestrichelt dargestellt.
            </CardDescription>
          </div>
          <div className="space-y-1.5 sm:w-56 shrink-0">
            <Label htmlFor="pt-chart-parameter" className="text-xs">
              Parameter
            </Label>
            <Select
              value={activeParameter}
              onValueChange={setSelectedParameter}
              disabled={availableParameters.length === 0}
            >
              <SelectTrigger id="pt-chart-parameter">
                <SelectValue placeholder="Kein Parameter mit Messwerten" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {availableParameters.map((parameter) => (
                  <SelectItem key={parameter.key} value={parameter.key}>
                    {parameter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 || series.length === 0 ? (
          <div className="flex h-[260px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-center px-4">
            <p className="text-sm font-medium">Noch keine vergleichbaren Messwerte</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Für den Vergleich werden Messwerte mit Prüfalter benötigt. Erfassen Sie Ergebnisse über
              „Ergebnisse erfassen“ in der Tabelle — oder lockern Sie die Filter.
            </p>
          </div>
        ) : (
          <>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="age"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    ticks={chartData.map((point) => Number(point.age))}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    tickFormatter={(value: number) => `${value} d`}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    stroke="hsl(var(--border))"
                    width={56}
                    tickFormatter={(value: number) => formatNumber(value, 1)}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    labelFormatter={(value: number) => `Prüfalter ${value} Tage`}
                    formatter={(value: number, name: string) => [
                      `${formatNumber(value, 2)}${unit ? ` ${unit}` : ""}`,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  {baselineAverage !== null && (
                    <ReferenceLine
                      y={baselineAverage}
                      stroke={BASELINE_COLOR}
                      strokeDasharray="6 4"
                      label={{
                        value: `Baseline ${formatNumber(baselineAverage, 1)}${unit ? ` ${unit}` : ""}`,
                        position: "insideTopLeft",
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                    />
                  )}
                  {series.map((entry) => (
                    <Line
                      key={entry.key}
                      type="monotone"
                      dataKey={entry.key}
                      name={entry.name}
                      stroke={entry.color}
                      strokeWidth={2}
                      strokeDasharray={entry.dashed ? "6 4" : undefined}
                      dot={{ r: 3, strokeWidth: 0, fill: entry.color }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Mehrfachmessungen desselben Prüfalters und derselben Dosierung werden gemittelt.
              {baselineAverage !== null
                ? " Ohne eigenen 0-%-Test dient der Mittelwert der hinterlegten Baseline-Werte als Referenzlinie."
                : ""}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
