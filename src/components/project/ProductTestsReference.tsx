/**
 * The seeded reference dataset PT-REF-VELOSIT-503.
 *
 * These numbers come from the process development and are the yardstick every
 * new dosage series is measured against — do not soften them.
 */
import { BookMarked, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/components/project/ProjectUI";
import { REFERENCE_TEST_CODE } from "@/components/project/ProductTestsShared";
import type { ProductTest, ProductTestResult } from "@/lib/project/types";

/** Documented ground truth — used when the seeded row is not (yet) present. */
const DOCUMENTED = {
  baselineMpa: 8.4,
  withFibreMinMpa: 12.8,
  withFibreMaxMpa: 13.2,
  ageDays: 80,
};

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold leading-tight tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
    </div>
  );
}

export function ProductTestReferenceCard({
  test,
  results,
  onOpenResults,
}: {
  /** The seeded reference test, or null when it is not in the database. */
  test: ProductTest | null;
  results: ProductTestResult[];
  onOpenResults: () => void;
}) {
  const flexural = results.filter(
    (row) => row.parameter_key === "flexural_strength_mpa" && row.value_numeric !== null,
  );

  const baselineFromData =
    flexural.find((row) => row.baseline_value !== null)?.baseline_value ?? null;
  const baseline = baselineFromData ?? DOCUMENTED.baselineMpa;

  const fibreValues = flexural
    .map((row) => row.value_numeric)
    .filter((value): value is number => value !== null && value > baseline);

  const withFibreMin = fibreValues.length ? Math.min(...fibreValues) : DOCUMENTED.withFibreMinMpa;
  const withFibreMax = fibreValues.length ? Math.max(...fibreValues) : DOCUMENTED.withFibreMaxMpa;
  const ageDays =
    flexural.find((row) => row.age_days !== null)?.age_days ?? DOCUMENTED.ageDays;

  const gainMin = ((withFibreMin - baseline) / baseline) * 100;
  const gainMax = ((withFibreMax - baseline) / baseline) * 100;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookMarked className="h-4 w-4 text-primary" aria-hidden />
              Referenzdaten — {REFERENCE_TEST_CODE}
            </CardTitle>
            <CardDescription>
              Mörtel VELOSIT 503 mit Rezyklat-Glasfaser. Nachgewiesene Referenz aus der
              Verfahrensentwicklung.
            </CardDescription>
          </div>
          {test && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={onOpenResults}>
              <ExternalLink className="h-4 w-4" />
              Messwerte ansehen
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Figure
            label="Baseline ohne Faser"
            value={`${formatNumber(baseline, 1)} MPa`}
            hint="Biegezugfestigkeit der Grundrezeptur"
          />
          <Figure
            label={`Mit Rezyklat-Glasfaser (${ageDays} Tage)`}
            value={`${formatNumber(withFibreMin, 1)}–${formatNumber(withFibreMax, 1)} MPa`}
            hint="Biegezugfestigkeit im Referenzversuch"
          />
          <Figure
            label="Zuwachs gegenüber Baseline"
            value={`+${formatNumber(gainMin, 0)} bis +${formatNumber(gainMax, 0)} %`}
            hint="konkurrenzfähig zu Carbon- und PVA-Fasern"
          />
        </div>

        <p className="text-sm leading-relaxed">
          Die Biegezugfestigkeit steigt von <strong>{formatNumber(baseline, 1)} MPa</strong> in der
          Baseline ohne Faser auf{" "}
          <strong>
            {formatNumber(withFibreMin, 1)}–{formatNumber(withFibreMax, 1)} MPa
          </strong>{" "}
          bei {ageDays} Tagen mit Rezyklat-Glasfaser. Damit ist die Rezyklatfaser gegenüber Carbon-
          und PVA-Fasern konkurrenzfähig — bei deutlich niedrigeren Materialkosten. Neue Dosierreihen
          werden an diesem Referenzwert gemessen.
        </p>

        {!test && (
          <p className="text-xs text-muted-foreground">
            Der Referenzdatensatz {REFERENCE_TEST_CODE} ist in dieser Datenbank nicht vorhanden. Die
            gezeigten Werte stammen aus der dokumentierten Verfahrensentwicklung.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
