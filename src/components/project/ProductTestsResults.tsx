/**
 * Result entry for a single product test.
 *
 * product_test_results.delta_pct is computed by a database trigger from
 * baseline_value — this dialog never sends it, it only renders it.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectDocuments } from "@/components/project/ProjectDocuments";
import { useProjectMutation } from "@/hooks/project/useProjectData";
import {
  CONCRETE_TEST_AGES_DAYS,
  PRODUCT_TEST_CATEGORIES,
  PRODUCT_TEST_PARAMETER_KEYS,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import { ToneBadge, formatDateTime, formatNumber } from "@/components/project/ProjectUI";
import {
  DeltaBadge,
  PRODUCT_TEST_STATUSES,
  dosageLabel,
  isConstructionCategory,
  parseDecimal,
  parseWholeNumber,
  productParameterMeta,
} from "@/components/project/ProductTestsShared";
import type { ProductTest, ProductTestResult } from "@/lib/project/types";

interface ResultValues {
  parameterKey: string;
  valueNumeric: number;
  unit: string | null;
  ageDays: number | null;
  baselineValue: number | null;
}

export function ProductTestResultsDialog({
  test,
  results,
  baselineResults,
  open,
  onOpenChange,
}: {
  test: ProductTest;
  results: ProductTestResult[];
  /** Results of the matching 0 % baseline test, used to prefill baseline_value. */
  baselineResults: ProductTestResult[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [parameterKey, setParameterKey] = useState<string>(PRODUCT_TEST_PARAMETER_KEYS[0].key);
  const [unit, setUnit] = useState<string>(PRODUCT_TEST_PARAMETER_KEYS[0].unit);
  const [value, setValue] = useState("");
  const [ageDays, setAgeDays] = useState("");
  const [baseline, setBaseline] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const showAgePicks = isConstructionCategory(test.category);

  const resetForm = () => {
    setValue("");
    setBaseline("");
  };

  useEffect(() => {
    if (!open) return;
    const first = PRODUCT_TEST_PARAMETER_KEYS[0];
    setParameterKey(first.key);
    setUnit(first.unit);
    setValue("");
    setAgeDays(showAgePicks ? String(CONCRETE_TEST_AGES_DAYS[1]) : "");
    setBaseline("");
    setPendingDeleteId(null);
  }, [open, test.id, showAgePicks]);

  const handleParameterChange = (key: string) => {
    setParameterKey(key);
    setUnit(productParameterMeta(key).unit);
  };

  const parsedAge = parseWholeNumber(ageDays);

  /** The matching measurement from the 0 % test — the honest baseline. */
  const baselineSuggestion = useMemo(() => {
    const match = baselineResults.find(
      (row) =>
        row.parameter_key === parameterKey &&
        (row.age_days ?? null) === parsedAge &&
        row.value_numeric !== null,
    );
    return match?.value_numeric ?? null;
  }, [baselineResults, parameterKey, parsedAge]);

  const addResult = useProjectMutation<ResultValues>(
    async (values) => {
      const { data, error } = await supabase
        .from("product_test_results")
        .insert({
          product_test_id: test.id,
          parameter_key: values.parameterKey,
          value_numeric: values.valueNumeric,
          unit: values.unit,
          age_days: values.ageDays,
          baseline_value: values.baselineValue,
        })
        .select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
      return data[0];
    },
    {
      successMessage: "Messwert gespeichert",
      errorMessage: "Messwert konnte nicht gespeichert werden",
      onDone: resetForm,
    },
  );

  const deleteResult = useProjectMutation<string>(
    async (resultId) => {
      const { data, error } = await supabase
        .from("product_test_results")
        .delete()
        .eq("id", resultId)
        .select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
      return data[0];
    },
    {
      successMessage: "Messwert gelöscht",
      errorMessage: "Messwert konnte nicht gelöscht werden",
      onDone: () => setPendingDeleteId(null),
    },
  );

  const parsedValue = parseDecimal(value);
  const canSubmit = parsedValue !== null && !addResult.isPending;

  const handleSubmit = () => {
    if (parsedValue === null || addResult.isPending) return;
    addResult.mutate({
      parameterKey,
      valueNumeric: parsedValue,
      unit: unit.trim() || null,
      ageDays: parsedAge,
      baselineValue: parseDecimal(baseline),
    });
  };

  const sortedResults = useMemo(
    () =>
      [...results].sort((a, b) => {
        if (a.parameter_key !== b.parameter_key) return a.parameter_key.localeCompare(b.parameter_key);
        return (a.age_days ?? 0) - (b.age_days ?? 0);
      }),
    [results],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-3xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
            <span className="font-mono text-sm text-muted-foreground">{test.test_code}</span>
            <span className="break-words">{test.title}</span>
          </DialogTitle>
          <DialogDescription>
            Messwerte erfassen und gegen die Baseline-Rezeptur ohne Rezyklatfaser vergleichen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <ToneBadge tone={toneOf(PRODUCT_TEST_STATUSES, test.status)}>
            {labelOf(PRODUCT_TEST_STATUSES, test.status)}
          </ToneBadge>
          <span>{labelOf(PRODUCT_TEST_CATEGORIES, test.category)}</span>
          <span aria-hidden>·</span>
          <span>Dosierung {dosageLabel(test.dosage_pct)}</span>
        </div>

        {test.recipe_notes && (
          <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 p-3 break-words">
            {test.recipe_notes}
          </p>
        )}

        <Tabs defaultValue="results">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="results" className="text-xs py-1.5">Messwerte</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs py-1.5">Dokumente</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4 mt-4">
        {/* ------------------------------------------------ existing results */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Erfasste Messwerte ({sortedResults.length})</h3>
          {sortedResults.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-4 text-center">
              Noch keine Messwerte erfasst.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Parameter</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Alter</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Messwert</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Baseline</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Δ</TableHead>
                    <TableHead className="whitespace-nowrap">Erfasst</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedResults.map((row) => {
                    const meta = productParameterMeta(row.parameter_key);
                    const rowUnit = row.unit ?? meta.unit;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap font-medium">{meta.label}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {row.age_days === null ? "—" : `${row.age_days} d`}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {row.value_numeric === null
                            ? "—"
                            : `${formatNumber(row.value_numeric, 2)}${rowUnit ? ` ${rowUnit}` : ""}`}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                          {row.baseline_value === null
                            ? "—"
                            : `${formatNumber(row.baseline_value, 2)}${rowUnit ? ` ${rowUnit}` : ""}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <DeltaBadge value={row.delta_pct} className="justify-end" />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(row.measured_at)}
                        </TableCell>
                        <TableCell>
                          {pendingDeleteId === row.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-xs"
                                disabled={deleteResult.isPending}
                                onClick={() => deleteResult.mutate(row.id)}
                              >
                                {deleteResult.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : null}
                                Löschen
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setPendingDeleteId(null)}
                              >
                                Abbrechen
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              aria-label={`${meta.label} löschen`}
                              onClick={() => setPendingDeleteId(row.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------- entry form */}
        <div className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
          <h3 className="text-sm font-semibold">Messwert erfassen</h3>

          <div className="space-y-1.5">
            <Label htmlFor="ptr-parameter">Parameter *</Label>
            <Select value={parameterKey} onValueChange={handleParameterChange}>
              <SelectTrigger id="ptr-parameter">
                <SelectValue placeholder="Parameter wählen" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {PRODUCT_TEST_PARAMETER_KEYS.map((parameter) => (
                  <SelectItem key={parameter.key} value={parameter.key}>
                    {parameter.label}
                    {parameter.unit ? ` (${parameter.unit})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ptr-value">Messwert *</Label>
              <Input
                id="ptr-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="z. B. 12,8"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ptr-unit">Einheit</Label>
              <Input
                id="ptr-unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="MPa"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ptr-age">Prüfalter (Tage)</Label>
            <Input
              id="ptr-age"
              inputMode="numeric"
              value={ageDays}
              onChange={(event) => setAgeDays(event.target.value)}
              placeholder="z. B. 28"
            />
            {showAgePicks && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Schnellauswahl:</span>
                {CONCRETE_TEST_AGES_DAYS.map((age) => (
                  <Button
                    key={age}
                    type="button"
                    size="sm"
                    variant={parsedAge === age ? "default" : "outline"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setAgeDays(String(age))}
                  >
                    {age} d
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ptr-baseline">Baseline-Wert (Rezeptur ohne Rezyklatfaser)</Label>
            <Input
              id="ptr-baseline"
              inputMode="decimal"
              value={baseline}
              onChange={(event) => setBaseline(event.target.value)}
              placeholder="z. B. 8,4"
            />
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Δ % wird von der Datenbank aus dem Baseline-Wert berechnet.
              </p>
              {baselineSuggestion !== null && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setBaseline(String(baselineSuggestion))}
                >
                  Aus 0-%-Test: {formatNumber(baselineSuggestion, 2)}
                  {unit ? ` ${unit}` : ""}
                </Button>
              )}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full sm:w-auto">
            {addResult.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Messwert hinzufügen
          </Button>
        </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <ProjectDocuments
              entityType="product_test"
              entityId={test.id}
              title="Dokumente zum Produkttest"
              description="Prüfberichte, Rezepturblätter und Fotos der Prüfkörper."
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
