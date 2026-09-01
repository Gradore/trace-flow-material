import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ANALYSIS_PARAMETER_KEYS, GO_NO_GO } from "@/lib/project/constants";
import { specWindow, type ConformityLevel } from "@/lib/project/spec";
import { EmptyState, formatNumber } from "@/components/project/ProjectUI";
import type { FractionSpec } from "@/lib/project/types";
import { type AnalysisView, formatSpecWindow, parameterMeta } from "./AnalyticsShared";

const ALL = "__all__";

const LEVEL_COLORS: Record<ConformityLevel, string> = {
  pass: "hsl(var(--success))",
  borderline: "hsl(var(--warning))",
  fail: "hsl(var(--destructive))",
  unknown: "hsl(var(--info))",
};

const LEVEL_LABELS: Record<ConformityLevel, string> = {
  pass: "In Spec",
  borderline: "Grenzwertig",
  fail: "Außerhalb",
  unknown: "Ohne Sollwert",
};

/** The hard project thresholds, drawn as a red line wherever they apply. */
const GO_NO_GO_LINES: Record<string, { value: number; label: string }> = {
  fiber_length_median_mm: {
    value: GO_NO_GO.fiberLengthMedianMinMm,
    label: `Go/No-Go ${GO_NO_GO.fiberLengthMedianMinMm} mm`,
  },
  energy_kwh_t: {
    value: GO_NO_GO.energyMaxKwhPerTon,
    label: `Go/No-Go ${GO_NO_GO.energyMaxKwhPerTon} kWh/t`,
  },
  glass_content_pct: {
    value: GO_NO_GO.glassContentMinPct,
    label: `Go/No-Go ${GO_NO_GO.glassContentMinPct} %`,
  },
};

interface ChartPoint {
  id: string;
  code: string;
  value: number;
  level: ConformityLevel;
  fraction: string;
  lab: string;
}

interface ComparisonTooltipProps {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  unit: string;
}

function ComparisonTooltip({ active, payload, unit }: ComparisonTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground font-mono">{point.code}</p>
      <p className="text-popover-foreground">
        {formatNumber(point.value, 3)}
        {unit ? ` ${unit}` : ""} · {LEVEL_LABELS[point.level]}
      </p>
      <p className="text-muted-foreground">{point.fraction}</p>
      {point.lab && <p className="text-muted-foreground">{point.lab}</p>}
    </div>
  );
}

export function AnalyticsComparison({ views, specs }: { views: AnalysisView[]; specs: FractionSpec[] }) {
  const [parameterKey, setParameterKey] = useState<string>(ANALYSIS_PARAMETER_KEYS[0].key);
  const [specFilter, setSpecFilter] = useState<string>(ALL);

  const meta = parameterMeta(parameterKey);

  const points = useMemo<ChartPoint[]>(() => {
    return views
      .filter((view) => specFilter === ALL || view.fraction?.target_fraction_id === specFilter)
      .flatMap((view) => {
        const result = view.results.find((row) => row.parameter_key === parameterKey);
        if (!result || result.value_numeric === null) return [];
        const verdict = view.verdicts.find((entry) => entry.parameterKey === parameterKey);
        return [
          {
            id: view.analysis.id,
            code: view.analysis.analysis_code,
            value: result.value_numeric,
            level: verdict?.level ?? "unknown",
            fraction: view.fraction
              ? `${view.fraction.fraction_code}${view.fraction.target_fraction_id ? ` · ${view.fraction.target_fraction_id}` : ""}`
              : "Ohne Fraktion",
            lab: view.lab?.name ?? "",
          },
        ];
      })
      .sort((a, b) => a.code.localeCompare(b.code, "de"));
  }, [views, parameterKey, specFilter]);

  /** The window to draw. Only unambiguous when every bar shares one spec. */
  const window = useMemo(() => {
    if (specFilter !== ALL) {
      const spec = specs.find((entry) => entry.id === specFilter) ?? null;
      return { ...specWindow(parameterKey, spec), ambiguous: false };
    }
    const involved = new Set(
      views
        .filter((view) => view.results.some((row) => row.parameter_key === parameterKey && row.value_numeric !== null))
        .map((view) => view.fraction?.target_fraction_id ?? ""),
    );
    if (involved.size === 1) {
      const only = [...involved][0];
      const spec = only ? specs.find((entry) => entry.id === only) ?? null : null;
      return { ...specWindow(parameterKey, spec), ambiguous: false };
    }
    return { min: null, max: null, ambiguous: involved.size > 1 };
  }, [specFilter, specs, parameterKey, views]);

  const goNoGoLine = GO_NO_GO_LINES[parameterKey] ?? null;

  const yMax = useMemo(() => {
    const candidates = points.map((point) => point.value);
    if (window.max !== null) candidates.push(window.max);
    if (window.min !== null) candidates.push(window.min);
    if (goNoGoLine) candidates.push(goNoGoLine.value);
    const top = candidates.length ? Math.max(...candidates) : 1;
    return top > 0 ? Number((top * 1.2).toPrecision(3)) : 1;
  }, [points, window, goNoGoLine]);

  const stats = useMemo(() => {
    if (!points.length) return null;
    const values = points.map((point) => point.value);
    const sum = values.reduce((acc, value) => acc + value, 0);
    return { n: values.length, mean: sum / values.length, min: Math.min(...values), max: Math.max(...values) };
  }, [points]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-violet-400" aria-hidden />
          Parametervergleich
        </CardTitle>
        <CardDescription>
          Ein Parameter über alle Analysen — das Sollfenster der Zielfraktion ist grün hinterlegt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="comparison-parameter">Parameter</Label>
            <Select value={parameterKey} onValueChange={setParameterKey}>
              <SelectTrigger id="comparison-parameter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {ANALYSIS_PARAMETER_KEYS.map((entry) => (
                  <SelectItem key={entry.key} value={entry.key}>
                    {entry.label}
                    {entry.unit ? ` (${entry.unit})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comparison-spec">Zielfraktion</Label>
            <Select value={specFilter} onValueChange={setSpecFilter}>
              <SelectTrigger id="comparison-spec">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value={ALL}>Alle Zielfraktionen</SelectItem>
                {specs.map((spec) => (
                  <SelectItem key={spec.id} value={spec.id}>
                    {spec.id} — {spec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {points.length === 0 ? (
          <EmptyState
            title="Keine Messwerte für diesen Parameter"
            description="Sobald Analysen mit Werten für den gewählten Parameter vorliegen, erscheint hier der Vergleich."
          />
        ) : (
          <>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="code"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={68}
                  />
                  <YAxis
                    width={52}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    domain={[0, yMax]}
                    allowDecimals
                  />
                  <Tooltip
                    content={<ComparisonTooltip unit={meta.unit} />}
                    cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.3 }}
                  />
                  {(window.min !== null || window.max !== null) && (
                    <ReferenceArea
                      y1={window.min ?? 0}
                      y2={window.max ?? yMax}
                      fill="hsl(var(--success))"
                      fillOpacity={0.12}
                      stroke="hsl(var(--success))"
                      strokeOpacity={0.3}
                    />
                  )}
                  {window.min !== null && (
                    <ReferenceLine
                      y={window.min}
                      stroke="hsl(var(--success))"
                      strokeDasharray="4 4"
                      label={{
                        value: `Min ${formatNumber(window.min, 3)}`,
                        position: "insideBottomRight",
                        fontSize: 10,
                        fill: "hsl(var(--success))",
                      }}
                    />
                  )}
                  {window.max !== null && (
                    <ReferenceLine
                      y={window.max}
                      stroke="hsl(var(--success))"
                      strokeDasharray="4 4"
                      label={{
                        value: `Max ${formatNumber(window.max, 3)}`,
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "hsl(var(--success))",
                      }}
                    />
                  )}
                  {goNoGoLine && (
                    <ReferenceLine
                      y={goNoGoLine.value}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="6 3"
                      label={{
                        value: goNoGoLine.label,
                        position: "insideTopLeft",
                        fontSize: 10,
                        fill: "hsl(var(--destructive))",
                      }}
                    />
                  )}
                  <Bar dataKey="value" name={meta.label} radius={[4, 4, 0, 0]}>
                    {points.map((point) => (
                      <Cell key={point.id} fill={LEVEL_COLORS[point.level]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(["pass", "borderline", "fail", "unknown"] as ConformityLevel[]).map((level) => (
                <span key={level} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: LEVEL_COLORS[level] }}
                    aria-hidden
                  />
                  {LEVEL_LABELS[level]}
                </span>
              ))}
            </div>

            {stats && (
              <p className="text-xs text-muted-foreground">
                {stats.n} {stats.n === 1 ? "Analyse" : "Analysen"} · Mittelwert {formatNumber(stats.mean, 3)}
                {meta.unit ? ` ${meta.unit}` : ""} · Spanne {formatNumber(stats.min, 3)} – {formatNumber(stats.max, 3)}
                {meta.unit ? ` ${meta.unit}` : ""}
                {window.min !== null || window.max !== null
                  ? ` · Sollfenster ${formatSpecWindow(window.min, window.max, meta.unit)}`
                  : ""}
              </p>
            )}

            {window.ambiguous && (
              <p className="text-xs text-warning">
                Die angezeigten Analysen gehören zu unterschiedlichen Zielfraktionen — für ein eindeutiges
                Sollfenster bitte eine Zielfraktion wählen.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
