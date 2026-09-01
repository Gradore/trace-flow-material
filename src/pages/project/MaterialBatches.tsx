import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  FlaskConical,
  Layers,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDate,
  formatKg,
  formatNumber,
} from "@/components/project/ProjectUI";
import MaterialBatchesDialog, {
  type BatchFormPayload,
} from "@/components/project/MaterialBatchesDialog";
import {
  BATCH_STATUSES,
  MATERIAL_CLASSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import {
  useMaterialBatches,
  usePartners,
  useProjectMutation,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import { linkBatchToMaterialInput } from "@/lib/project/bridges";
import { supabase } from "@/integrations/supabase/client";
import type { MaterialBatch, Partner } from "@/lib/project/types";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const WITHOUT_SUPPLIER = "__none__";

const STAT_ACCENTS = ["sky", "teal", "emerald"] as const;

interface Consumption {
  kg: number;
  runs: number;
}

export default function MaterialBatches() {
  const batchesQuery = useMaterialBatches();
  const partnersQuery = usePartners();
  const testRunsQuery = useTestRuns();

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [supplierFilter, setSupplierFilter] = useState<string>(ALL);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingBatch, setEditingBatch] = useState<MaterialBatch | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<MaterialBatch | null>(null);

  const batches = useMemo(() => batchesQuery.data ?? [], [batchesQuery.data]);
  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const testRuns = useMemo(() => testRunsQuery.data ?? [], [testRunsQuery.data]);

  const partnerById = useMemo(() => {
    const map = new Map<string, Partner>();
    partners.forEach((partner) => map.set(partner.id, partner));
    return map;
  }, [partners]);

  const supplierName = (batch: MaterialBatch): string =>
    batch.supplier_partner_id ? (partnerById.get(batch.supplier_partner_id)?.name ?? "") : "";

  /** kg already fed into test runs, per batch. */
  const consumption = useMemo(() => {
    const map = new Map<string, Consumption>();
    testRuns.forEach((run) => {
      if (!run.input_batch_id) return;
      const current = map.get(run.input_batch_id) ?? { kg: 0, runs: 0 };
      map.set(run.input_batch_id, {
        kg: current.kg + (run.input_weight_kg ?? 0),
        runs: current.runs + 1,
      });
    });
    return map;
  }, [testRuns]);

  /* --------------------------------------------------------------- filters */

  /**
   * Suppliers that occur in the batch list, plus the currently selected one so
   * the filter never loses its own value while data is refreshed.
   */
  const supplierOptions = useMemo(() => {
    const ids = new Set<string>();
    batches.forEach((batch) => {
      if (batch.supplier_partner_id) ids.add(batch.supplier_partner_id);
    });
    if (supplierFilter !== ALL && supplierFilter !== WITHOUT_SUPPLIER) {
      ids.add(supplierFilter);
    }
    return Array.from(ids)
      .map((id) => ({ id, name: partnerById.get(id)?.name ?? "Unbekannter Partner" }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [batches, partnerById, supplierFilter]);

  const isFiltered =
    search.trim().length > 0 ||
    classFilter !== ALL ||
    statusFilter !== ALL ||
    supplierFilter !== ALL;

  const resetFilters = () => {
    setSearch("");
    setClassFilter(ALL);
    setStatusFilter(ALL);
    setSupplierFilter(ALL);
  };

  const filteredBatches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return batches.filter((batch) => {
      if (classFilter !== ALL && batch.material_class !== classFilter) return false;
      if (statusFilter !== ALL && batch.status !== statusFilter) return false;
      if (supplierFilter === WITHOUT_SUPPLIER) {
        if (batch.supplier_partner_id) return false;
      } else if (supplierFilter !== ALL && batch.supplier_partner_id !== supplierFilter) {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        batch.batch_code,
        supplierName(batch),
        batch.material_class,
        labelOf(MATERIAL_CLASSES, batch.material_class),
        batch.resin_type ?? "",
        batch.declared_filler ?? "",
        batch.storage_location ?? "",
        batch.contamination_notes ?? "",
        batch.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
    // supplierName reads partnerById, which is part of the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, classFilter, statusFilter, supplierFilter, search, partnerById]);

  /* ----------------------------------------------------------------- stats */

  const totalKg = useMemo(
    () => batches.reduce((sum, batch) => sum + (batch.weight_kg ?? 0), 0),
    [batches],
  );

  const topClasses = useMemo(() => {
    const totals = new Map<string, number>();
    batches.forEach((batch) => {
      totals.set(batch.material_class, (totals.get(batch.material_class) ?? 0) + (batch.weight_kg ?? 0));
    });
    return Array.from(totals.entries())
      .filter(([, kg]) => kg > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, kg]) => ({ id, kg, label: labelOf(MATERIAL_CLASSES, id) }));
  }, [batches]);

  const inTestCount = useMemo(
    () => batches.filter((batch) => batch.status === "in_test").length,
    [batches],
  );

  /* ---------------------------------------------------------------- writes */

  const saveMutation = useProjectMutation<{
    mode: "create" | "edit";
    batch: MaterialBatch | null;
    payload: BatchFormPayload;
  }>(
    async ({ mode, batch, payload }) => {
      if (mode === "create") {
        const { data, error } = await supabase
          .from("material_batches")
          .insert({
            batch_code: payload.batch_code,
            supplier_partner_id: payload.supplier_partner_id,
            material_class: payload.material_class,
            resin_type: payload.resin_type,
            weight_kg: payload.weight_kg,
            received_date: payload.received_date,
            declared_fiber_content_pct: payload.declared_fiber_content_pct,
            declared_filler: payload.declared_filler,
            contamination_notes: payload.contamination_notes,
            storage_location: payload.storage_location,
            status: payload.status,
            notes: payload.notes,
          })
          .select("id");
        if (error) {
          throw new Error(
            error.code === "23505"
              ? `Chargencode „${payload.batch_code}“ ist bereits vergeben. (${error.message})`
              : error.message,
          );
        }
        if (!data || data.length === 0) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
        return;
      }

      if (!batch) throw new Error("Keine Charge zum Bearbeiten ausgewählt");
      const { data, error } = await supabase
        .from("material_batches")
        .update({
          supplier_partner_id: payload.supplier_partner_id,
          material_class: payload.material_class,
          resin_type: payload.resin_type,
          weight_kg: payload.weight_kg,
          received_date: payload.received_date,
          declared_fiber_content_pct: payload.declared_fiber_content_pct,
          declared_filler: payload.declared_filler,
          contamination_notes: payload.contamination_notes,
          storage_location: payload.storage_location,
          status: payload.status,
          notes: payload.notes,
        })
        .eq("id", batch.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Charge gespeichert",
      errorMessage: "Charge konnte nicht gespeichert werden",
      onDone: () => {
        setDialogOpen(false);
        setEditingBatch(null);
      },
    },
  );

  const deleteMutation = useProjectMutation<MaterialBatch>(
    async (batch) => {
      const { data, error } = await supabase
        .from("material_batches")
        .delete()
        .eq("id", batch.id)
        .select("id");
      if (error) {
        throw new Error(
          error.code === "23503"
            ? "Die Charge ist noch mit Versuchen oder Wareneingängen verknüpft und kann nicht gelöscht werden."
            : error.message,
        );
      }
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Charge gelöscht",
      errorMessage: "Charge konnte nicht gelöscht werden",
      onDone: () => setBatchToDelete(null),
    },
  );

  const intakeMutation = useProjectMutation<MaterialBatch>(
    async (batch) => {
      await linkBatchToMaterialInput(batch, supplierName(batch));
    },
    {
      successMessage: "Charge in den Wareneingang übernommen",
      errorMessage: "Übernahme in den Wareneingang fehlgeschlagen",
    },
  );

  /* --------------------------------------------------------------- actions */

  const openCreate = () => {
    setDialogMode("create");
    setEditingBatch(null);
    setDialogOpen(true);
  };

  const openEdit = (batch: MaterialBatch) => {
    setDialogMode("edit");
    setEditingBatch(batch);
    setDialogOpen(true);
  };

  const linkedRunsForDeletion = batchToDelete
    ? (consumption.get(batchToDelete.id)?.runs ?? 0)
    : 0;

  /* ----------------------------------------------------------------- views */

  const renderConsumption = (batch: MaterialBatch) => {
    const used = consumption.get(batch.id);
    const usedKg = used?.kg ?? 0;
    const total = batch.weight_kg ?? 0;
    const pct = total > 0 ? Math.min(100, (usedKg / total) * 100) : 0;
    const over = total > 0 && usedKg > total;
    return (
      <div className="w-40 space-y-1">
        <Progress
          value={pct}
          className={cn("h-2", over ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")}
          aria-label={`Verbrauch von ${batch.batch_code}`}
        />
        <p className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>
          {formatNumber(usedKg, 1)} / {formatKg(total)} verbraucht
          {used ? ` · ${used.runs} ${used.runs === 1 ? "Versuch" : "Versuche"}` : ""}
        </p>
      </div>
    );
  };

  const renderIntakeCell = (batch: MaterialBatch) => {
    if (batch.material_input_id) {
      return (
        <Link to="/intake" className="inline-flex">
          <Badge
            variant="outline"
            className="border-success/20 bg-success/10 text-success font-medium gap-1.5 hover:bg-success/20"
          >
            <Truck className="h-3 w-3" />
            Im Wareneingang
          </Badge>
        </Link>
      );
    }
    const isPending = intakeMutation.isPending && intakeMutation.variables?.id === batch.id;
    return (
      <Button
        variant="outline"
        size="sm"
        className="whitespace-nowrap"
        disabled={intakeMutation.isPending}
        onClick={() => intakeMutation.mutate(batch)}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ArrowRightLeft className="h-4 w-4 mr-2" />
        )}
        In Wareneingang übernehmen
      </Button>
    );
  };

  const isLoading = batchesQuery.isLoading || partnersQuery.isLoading || testRunsQuery.isLoading;
  const loadError =
    (batchesQuery.error as Error | null) ??
    (partnersQuery.error as Error | null) ??
    (testRunsQuery.error as Error | null);

  return (
    <div className="space-y-6 animate-fade-in">
      <ProjectPageHeader
        title="Chargen"
        description="Eingangsmaterial für die Zerkleinerungsversuche — Herkunft, Menge, Klasse und Verbrauch."
        icon={Boxes}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Charge
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Gesamtmenge"
          value={formatKg(totalKg)}
          hint={`${batches.length} ${batches.length === 1 ? "Charge" : "Chargen"}`}
          icon={Scale}
          accent="violet"
        />
        {topClasses.map((entry, index) => (
          <StatCard
            key={entry.id}
            label={`${entry.id} · ${entry.label}`}
            value={formatKg(entry.kg)}
            hint={totalKg > 0 ? `${formatNumber((entry.kg / totalKg) * 100, 0)} % der Menge` : undefined}
            icon={Layers}
            accent={STAT_ACCENTS[index] ?? "sky"}
          />
        ))}
        <StatCard
          label="Im Versuch"
          value={inTestCount}
          hint={`Status „${labelOf(BATCH_STATUSES, "in_test")}“`}
          icon={FlaskConical}
          accent="amber"
        />
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Chargenübersicht</CardTitle>
            <CardDescription>
              {isFiltered
                ? `${filteredBatches.length} von ${batches.length} Chargen gefiltert`
                : `${batches.length} ${batches.length === 1 ? "Charge" : "Chargen"} erfasst`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Code, Lieferant, Füllstoff, Lagerort …"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Chargen durchsuchen"
              />
            </div>

            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-[13rem]" aria-label="Nach Materialklasse filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Materialklassen</SelectItem>
                {MATERIAL_CLASSES.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.id} · {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[11rem]" aria-label="Nach Status filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Status</SelectItem>
                {BATCH_STATUSES.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-full sm:w-[13rem]" aria-label="Nach Lieferant filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Lieferanten</SelectItem>
                {supplierOptions.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
                <SelectItem value={WITHOUT_SUPPLIER}>Ohne Lieferant</SelectItem>
              </SelectContent>
            </Select>

            {isFiltered && (
              <Button variant="ghost" onClick={resetFilters} className="sm:w-auto">
                <RotateCcw className="h-4 w-4 mr-2" />
                Filter zurücksetzen
              </Button>
            )}
          </div>

          {isLoading ? (
            <LoadingRows rows={6} />
          ) : loadError ? (
            <ErrorState
              error={loadError}
              onRetry={() => {
                void batchesQuery.refetch();
                void partnersQuery.refetch();
                void testRunsQuery.refetch();
              }}
            />
          ) : batches.length === 0 ? (
            <EmptyState
              title="Noch keine Chargen erfasst"
              description="Erfassen Sie das angelieferte GFK-Material mit Klasse, Gewicht und Lieferant, um es Versuchen zuordnen zu können."
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Charge anlegen
                </Button>
              }
            />
          ) : filteredBatches.length === 0 ? (
            <EmptyState
              title="Keine Charge passt zum Filter"
              description="Passen Sie Suchbegriff, Materialklasse, Status oder Lieferant an."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Filter zurücksetzen
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table className="min-w-[80rem]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Chargencode</TableHead>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Materialklasse</TableHead>
                    <TableHead>Harztyp</TableHead>
                    <TableHead className="text-right">kg</TableHead>
                    <TableHead>Eingang</TableHead>
                    <TableHead className="text-right">Faseranteil</TableHead>
                    <TableHead>Füllstoff</TableHead>
                    <TableHead>Lagerort</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verbrauch</TableHead>
                    <TableHead>Wareneingang</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((batch) => {
                    const materialClass = MATERIAL_CLASSES.find(
                      (entry) => entry.id === batch.material_class,
                    );
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {batch.batch_code}
                            {batch.contamination_notes && (
                              <span
                                title={`Störstoffe: ${batch.contamination_notes}`}
                                aria-label={`Störstoffe: ${batch.contamination_notes}`}
                                className="inline-flex"
                              >
                                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {batch.supplier_partner_id
                            ? (partnerById.get(batch.supplier_partner_id)?.name ?? "Unbekannter Partner")
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="font-mono text-xs text-muted-foreground mr-1.5">
                            {batch.material_class}
                          </span>
                          {materialClass?.label ?? "Unbekannte Klasse"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{batch.resin_type ?? "—"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatKg(batch.weight_kg)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(batch.received_date)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {batch.declared_fiber_content_pct === null
                            ? "—"
                            : `${formatNumber(batch.declared_fiber_content_pct, 1)} %`}
                        </TableCell>
                        <TableCell className="max-w-[10rem] truncate">
                          {batch.declared_filler ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[10rem] truncate">
                          {batch.storage_location ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <ToneBadge tone={toneOf(BATCH_STATUSES, batch.status)}>
                            {labelOf(BATCH_STATUSES, batch.status)}
                          </ToneBadge>
                        </TableCell>
                        <TableCell>{renderConsumption(batch)}</TableCell>
                        <TableCell>{renderIntakeCell(batch)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Aktionen für ${batch.batch_code}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => openEdit(batch)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setBatchToDelete(batch)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
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
            </div>
          )}
        </CardContent>
      </Card>

      <MaterialBatchesDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingBatch(null);
        }}
        mode={dialogMode}
        batch={editingBatch}
        partners={partners}
        isSaving={saveMutation.isPending}
        onSubmit={(payload) =>
          saveMutation.mutate({ mode: dialogMode, batch: editingBatch, payload })
        }
      />

      <AlertDialog
        open={batchToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setBatchToDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Charge endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Charge <strong>{batchToDelete?.batch_code}</strong> wird dauerhaft entfernt. Diese
              Aktion kann nicht rückgängig gemacht werden.
              {linkedRunsForDeletion > 0 && (
                <>
                  {" "}
                  Die Charge ist als Einsatzmaterial in {linkedRunsForDeletion}{" "}
                  {linkedRunsForDeletion === 1 ? "Versuch" : "Versuchen"} hinterlegt und kann daher
                  nicht gelöscht werden. Lösen Sie zuerst die Verknüpfung in den Versuchen.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleteMutation.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending || linkedRunsForDeletion > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (!batchToDelete || linkedRunsForDeletion > 0) return;
                deleteMutation.mutate(batchToDelete);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
