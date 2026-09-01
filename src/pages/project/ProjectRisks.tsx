/**
 * /projekt/risiken — Risikoregister des GFK-Projekts.
 *
 * Severity is a GENERATED column (probability * impact) in project_risks and is
 * therefore never written from here.
 */
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useAiAnalyses,
  usePhases,
  useProjectMutation,
  useProjectRisks,
} from "@/hooks/project/useProjectData";
import { useAcknowledgeAiAnalysis, useRequestAiAnalysis } from "@/hooks/project/useProjectAi";
import { RISK_CATEGORIES, labelOf, toneOf } from "@/lib/project/constants";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Markdown,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDateTime,
} from "@/components/project/ProjectUI";
import {
  RISK_STATUSES,
  SeverityBadge,
  severityOf,
} from "@/components/project/ProjectRisksShared";
import { ProjectRisksMatrix, type MatrixCell } from "@/components/project/ProjectRisksMatrix";
import {
  ProjectRisksDialog,
  type RiskFormValues,
} from "@/components/project/ProjectRisksDialog";
import type { Database } from "@/integrations/supabase/types";
import type { ProjectRisk } from "@/lib/project/types";

type RiskWrite = Database["public"]["Tables"]["project_risks"]["Insert"];

/** ai_analyses.confidence stores the raw model verdict in English. */
const CONFIDENCE_LABELS: Record<string, string> = {
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
};

const MIN_SEVERITY_OPTIONS = [
  { value: "0", label: "Jede Schwere" },
  { value: "5", label: "Schwere ≥ 5" },
  { value: "10", label: "Schwere ≥ 10" },
  { value: "15", label: "Schwere ≥ 15" },
  { value: "20", label: "Schwere ≥ 20" },
];

/** ai_analyses.recommendations is free-form jsonb - read it defensively. */
function parseRecommendations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return entry.trim() ? [entry.trim()] : [];
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      for (const key of ["title", "text", "recommendation", "risk", "action"]) {
        const candidate = record[key];
        if (typeof candidate === "string" && candidate.trim()) return [candidate.trim()];
      }
    }
    return [];
  });
}

function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function ProjectRisks() {
  const risksQuery = useProjectRisks();
  const phasesQuery = usePhases();
  const scansQuery = useAiAnalyses("risk_scan");

  const requestAi = useRequestAiAnalysis();
  const acknowledgeAi = useAcknowledgeAiAnalysis();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minSeverity, setMinSeverity] = useState("0");
  const [onlyAi, setOnlyAi] = useState(false);
  const [matrixCell, setMatrixCell] = useState<MatrixCell | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<ProjectRisk | null>(null);
  const [prefill, setPrefill] = useState<Partial<RiskFormValues> | null>(null);
  const [riskToDelete, setRiskToDelete] = useState<ProjectRisk | null>(null);

  /** Set while the open dialog was started from the AI risk scan panel. */
  const aiSourceRef = useRef<string | null>(null);

  const risks = useMemo(() => risksQuery.data ?? [], [risksQuery.data]);
  const phases = useMemo(() => phasesQuery.data ?? [], [phasesQuery.data]);
  const latestScan = scansQuery.data?.[0] ?? null;
  const recommendations = useMemo(
    () => parseRecommendations(latestScan?.recommendations),
    [latestScan?.recommendations],
  );

  const phaseById = useMemo(() => {
    const map = new Map<string, string>();
    phases.forEach((phase) => map.set(phase.id, `${phase.code} · ${phase.name}`));
    return map;
  }, [phases]);

  const saveRisk = useProjectMutation<{ id: string | null; values: RiskFormValues }>(
    async ({ id, values }) => {
      // severity is GENERATED in the database - never part of the payload.
      const payload: RiskWrite = {
        title: values.title.trim(),
        description: toNullable(values.description),
        category: values.category,
        probability: values.probability,
        impact: values.impact,
        mitigation_plan: toNullable(values.mitigation_plan),
        owner: toNullable(values.owner),
        status: values.status,
        phase_id: values.phase_id,
        ai_suggested: values.ai_suggested,
      };

      if (id) {
        const { data, error } = await supabase
          .from("project_risks")
          .update(payload)
          .eq("id", id)
          .select();
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
        return data;
      }

      const { data, error } = await supabase.from("project_risks").insert(payload).select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
      return data;
    },
    {
      successMessage: "Risiko gespeichert",
      errorMessage: "Risiko konnte nicht gespeichert werden",
      onDone: () => {
        setDialogOpen(false);
        setEditingRisk(null);
        setPrefill(null);
        const sourceId = aiSourceRef.current;
        aiSourceRef.current = null;
        if (sourceId) acknowledgeAi.mutate({ id: sourceId, actedUpon: true });
      },
    },
  );

  const deleteRisk = useProjectMutation<ProjectRisk>(
    async (risk) => {
      const { data, error } = await supabase
        .from("project_risks")
        .delete()
        .eq("id", risk.id)
        .select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
      return data;
    },
    {
      successMessage: "Risiko gelöscht",
      errorMessage: "Risiko konnte nicht gelöscht werden",
      onDone: () => setRiskToDelete(null),
    },
  );

  const filteredRisks = useMemo(() => {
    const term = search.trim().toLowerCase();
    const threshold = Number(minSeverity);
    return risks
      .filter((risk) => {
        if (categoryFilter !== "all" && risk.category !== categoryFilter) return false;
        if (statusFilter !== "all" && risk.status !== statusFilter) return false;
        if (onlyAi && !risk.ai_suggested) return false;
        if (severityOf(risk) < threshold) return false;
        if (
          matrixCell &&
          (risk.probability !== matrixCell.probability || risk.impact !== matrixCell.impact)
        ) {
          return false;
        }
        if (!term) return true;
        return [risk.title, risk.description, risk.owner, risk.mitigation_plan]
          .filter((field): field is string => typeof field === "string")
          .some((field) => field.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const diff = severityOf(b) - severityOf(a);
        if (diff !== 0) return diff;
        return a.title.localeCompare(b.title, "de");
      });
  }, [risks, search, categoryFilter, statusFilter, onlyAi, minSeverity, matrixCell]);

  const activeFilterCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (minSeverity !== "0" ? 1 : 0) +
    (onlyAi ? 1 : 0) +
    (matrixCell ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setMinSeverity("0");
    setOnlyAi(false);
    setMatrixCell(null);
  };

  /**
   * The register's phase column and the dialog's phase picker both come from
   * usePhases(); a failing phase query must surface instead of silently
   * rendering "—" for every row.
   */
  const registerLoading = risksQuery.isLoading || phasesQuery.isLoading;
  const registerError =
    (risksQuery.error as Error | null) ?? (phasesQuery.error as Error | null);
  const retryRegister = () => {
    void risksQuery.refetch();
    void phasesQuery.refetch();
  };

  const openCreateDialog = () => {
    aiSourceRef.current = null;
    setEditingRisk(null);
    setPrefill(null);
    setDialogOpen(true);
  };

  const openEditDialog = (risk: ProjectRisk) => {
    aiSourceRef.current = null;
    setEditingRisk(risk);
    setPrefill(null);
    setDialogOpen(true);
  };

  const openAiPrefilledDialog = (title: string) => {
    if (!latestScan) return;
    aiSourceRef.current = latestScan.id;
    setEditingRisk(null);
    setPrefill({
      title,
      ai_suggested: true,
      description: `Übernommen aus dem KI-Risikoscan vom ${formatDateTime(latestScan.created_at)}.`,
    });
    setDialogOpen(true);
  };

  const handleScan = () => {
    requestAi.mutate({ analysisType: "risk_scan", scopeType: "global", scopeId: null });
  };

  /**
   * The confirmation must not fire before the write came back - the hook toasts
   * its own error, so an unconditional toast would contradict it.
   */
  const handleAcknowledge = () => {
    if (!latestScan) return;
    acknowledgeAi.mutate(
      { id: latestScan.id },
      { onSuccess: () => toast({ title: "Scan als gelesen markiert" }) },
    );
  };

  const stats = useMemo(() => {
    const high = risks.filter((risk) => severityOf(risk) >= 15).length;
    const open = risks.filter((risk) => risk.status === "open" || risk.status === "mitigating").length;
    const ai = risks.filter((risk) => risk.ai_suggested).length;
    return { total: risks.length, high, open, ai };
  }, [risks]);

  /** Counters must not claim "0" while the register is still loading or failed. */
  const statValue = (value: number) => {
    if (risksQuery.isLoading) return <Skeleton className="h-6 w-10" />;
    if (risksQuery.isError) return "—";
    return value;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ProjectPageHeader
        title="Risiken"
        description="Risikoregister: Bewertung nach Wahrscheinlichkeit × Auswirkung, Maßnahmen und KI-Risikoscan."
        icon={ShieldAlert}
        actions={
          <>
            <Button variant="outline" onClick={handleScan} disabled={requestAi.isPending}>
              {requestAi.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              KI-Risikoscan
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Neues Risiko
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Risiken gesamt"
          value={statValue(stats.total)}
          icon={ShieldAlert}
          accent="violet"
        />
        <StatCard
          label="Hohe Schwere (≥ 15)"
          value={statValue(stats.high)}
          icon={AlertTriangle}
          accent="rose"
          hint="Sofortige Maßnahmen nötig"
        />
        <StatCard
          label="Offen / in Bearbeitung"
          value={statValue(stats.open)}
          icon={ShieldCheck}
          accent="amber"
        />
        <StatCard label="KI-Vorschläge" value={statValue(stats.ai)} icon={Sparkles} accent="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Risikomatrix</CardTitle>
            <CardDescription>
              Zelle antippen, um die Tabelle auf diese Kombination zu filtern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {risksQuery.isLoading ? (
              <LoadingRows rows={4} />
            ) : risksQuery.isError ? (
              <ErrorState
                error={risksQuery.error as Error}
                onRetry={() => void risksQuery.refetch()}
              />
            ) : (
              <ProjectRisksMatrix risks={risks} selected={matrixCell} onSelect={setMatrixCell} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              KI-Risikoscan
            </CardTitle>
            <CardDescription>
              {latestScan
                ? `Letzter Scan: ${formatDateTime(latestScan.created_at)}${
                    latestScan.confidence
                      ? ` · Konfidenz: ${
                          CONFIDENCE_LABELS[latestScan.confidence] ?? latestScan.confidence
                        }`
                      : ""
                  }`
                : "Noch kein Risikoscan vorhanden."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scansQuery.isLoading ? (
              <LoadingRows rows={3} />
            ) : scansQuery.isError ? (
              <ErrorState
                error={scansQuery.error as Error}
                onRetry={() => void scansQuery.refetch()}
              />
            ) : !latestScan ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Der Scan prüft das bestehende Risikoregister, die Aufgaben und die Versuchsläufe
                  auf neue oder verschärfte Risiken — etwa Werkzeugverschleiß, Energiebedarf über
                  350 kWh/t oder eine noch nicht eingereichte Patentanmeldung.
                </p>
                <Button variant="outline" size="sm" onClick={handleScan} disabled={requestAi.isPending}>
                  {requestAi.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Scan starten
                </Button>
              </div>
            ) : (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Vorschläge werden nicht automatisch gespeichert</AlertTitle>
                  <AlertDescription className="text-xs">
                    Vorgeschlagene Risiken müssen manuell ins Register übernommen werden. Über
                    „Als Risiko übernehmen“ wird der Eintrag als KI-Vorschlag markiert.
                  </AlertDescription>
                </Alert>

                <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
                  {latestScan.output_md ? (
                    <Markdown content={latestScan.output_md} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Der Scan hat keinen Text zurückgegeben.
                    </p>
                  )}
                </div>

                {recommendations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Vorgeschlagene Risiken
                    </p>
                    {recommendations.map((recommendation, index) => (
                      <div
                        key={`${index}-${recommendation.slice(0, 24)}`}
                        className="flex flex-col gap-2 rounded-md border border-border p-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-sm">{recommendation}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => openAiPrefilledDialog(recommendation)}
                        >
                          <Plus className="h-4 w-4" />
                          Übernehmen
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openAiPrefilledDialog("")}>
                    <Plus className="h-4 w-4" />
                    Als Risiko übernehmen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleScan} disabled={requestAi.isPending}>
                    {requestAi.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Neuen Scan starten
                  </Button>
                  {!latestScan.acknowledged_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleAcknowledge}
                      disabled={acknowledgeAi.isPending}
                    >
                      <Check className="h-4 w-4" />
                      Als gelesen markieren
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Risikoregister</CardTitle>
              <CardDescription>
                {registerLoading
                  ? "Risiken werden geladen…"
                  : `${filteredRisks.length} von ${risks.length} Risiken · absteigend nach Schwere`}
              </CardDescription>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4" />
                Filter zurücksetzen ({activeFilterCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Titel, Beschreibung, Maßnahme, Verantwortlich…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {RISK_CATEGORIES.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Alle Status</SelectItem>
                {RISK_STATUSES.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={minSeverity} onValueChange={setMinSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Mindestschwere" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {MIN_SEVERITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={onlyAi ? "default" : "outline"}
              aria-pressed={onlyAi}
              onClick={() => setOnlyAi((value) => !value)}
            >
              <Sparkles className="h-4 w-4" />
              Nur KI-Vorschläge
            </Button>
            {matrixCell && (
              <Button type="button" size="sm" variant="secondary" onClick={() => setMatrixCell(null)}>
                <X className="h-4 w-4" />
                Matrix: W {matrixCell.probability} × A {matrixCell.impact}
              </Button>
            )}
          </div>

          {registerLoading ? (
            <LoadingRows rows={6} />
          ) : registerError ? (
            <ErrorState error={registerError} onRetry={retryRegister} />
          ) : risks.length === 0 ? (
            <EmptyState
              title="Noch keine Risiken erfasst"
              description="Legen Sie technische, wirtschaftliche und Schutzrechtsrisiken an, um sie nach Schwere zu priorisieren."
              action={
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  Erstes Risiko anlegen
                </Button>
              }
            />
          ) : filteredRisks.length === 0 ? (
            <EmptyState
              title="Keine Risiken für diese Filter"
              description="Passen Sie Suche, Kategorie, Status, Mindestschwere oder die gewählte Matrixzelle an."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  <X className="h-4 w-4" />
                  Filter zurücksetzen
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[16rem]">Risiko</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="text-center">W</TableHead>
                    <TableHead className="text-center">A</TableHead>
                    <TableHead>Schwere</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verantwortlich</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead className="text-center">KI</TableHead>
                    <TableHead className="w-24 text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRisks.map((risk) => {
                    const severity = severityOf(risk);
                    return (
                      <TableRow key={risk.id}>
                        <TableCell className="align-top">
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-1.5 h-2 w-2 rounded-full shrink-0",
                                severity >= 15
                                  ? "bg-destructive"
                                  : severity >= 7
                                    ? "bg-warning"
                                    : "bg-success",
                              )}
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <p className="font-medium leading-tight">{risk.title}</p>
                              {risk.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {risk.description}
                                </p>
                              )}
                              {risk.mitigation_plan && (
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <ShieldCheck className="h-3 w-3 text-success shrink-0" />
                                  Maßnahme hinterlegt
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap">
                          {labelOf(RISK_CATEGORIES, risk.category)}
                        </TableCell>
                        <TableCell className="align-top text-center tabular-nums">
                          {risk.probability}
                        </TableCell>
                        <TableCell className="align-top text-center tabular-nums">
                          {risk.impact}
                        </TableCell>
                        <TableCell className="align-top">
                          <SeverityBadge severity={severity} />
                        </TableCell>
                        <TableCell className="align-top">
                          <ToneBadge tone={toneOf(RISK_STATUSES, risk.status)}>
                            {labelOf(RISK_STATUSES, risk.status)}
                          </ToneBadge>
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap">
                          {risk.owner ?? "—"}
                        </TableCell>
                        <TableCell className="align-top whitespace-nowrap text-sm text-muted-foreground">
                          {risk.phase_id ? (phaseById.get(risk.phase_id) ?? "—") : "—"}
                        </TableCell>
                        <TableCell className="align-top text-center">
                          {risk.ai_suggested ? (
                            <ToneBadge tone="info" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              KI
                            </ToneBadge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Risiko „${risk.title}“ bearbeiten`}
                              onClick={() => openEditDialog(risk)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Risiko „${risk.title}“ löschen`}
                              onClick={() => setRiskToDelete(risk)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
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

      <ProjectRisksDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingRisk(null);
            setPrefill(null);
            aiSourceRef.current = null;
          }
        }}
        risk={editingRisk}
        prefill={prefill}
        phases={phases}
        isSaving={saveRisk.isPending}
        onSubmit={(values) => saveRisk.mutate({ id: editingRisk?.id ?? null, values })}
      />

      <AlertDialog
        open={riskToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setRiskToDelete(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Risiko löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {riskToDelete
                ? `„${riskToDelete.title}“ wird dauerhaft aus dem Risikoregister entfernt. Diese Aktion kann nicht rückgängig gemacht werden.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleteRisk.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteRisk.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (riskToDelete) deleteRisk.mutate(riskToDelete);
              }}
            >
              {deleteRisk.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
