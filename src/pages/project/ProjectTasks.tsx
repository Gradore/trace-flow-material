import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Coins,
  KanbanSquare,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PhaseStepper,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDate,
  formatEur,
} from "@/components/project/ProjectUI";
import ProjectTasksDialog, { type TaskFormPayload } from "@/components/project/ProjectTasksDialog";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import {
  usePartners,
  usePhases,
  useProjectMutation,
  useProjectTasks,
  useTaskDependencies,
} from "@/hooks/project/useProjectData";
import type { Partner, Phase, ProjectTask } from "@/lib/project/types";
import { cn } from "@/lib/utils";

const ALL = "__all__";

type ViewMode = "list" | "kanban";
type SortKey = "code" | "due_date";
type SortDirection = "asc" | "desc";

/** Statuses that mean "this task has been started or finished". */
const STARTING_STATUSES = new Set(["doing", "done"]);

/**
 * A predecessor in one of these statuses no longer holds its successors back:
 * "übersprungen" tasks are deliberately never completed, so treating them as
 * open would block the rest of the plan for good.
 */
const SATISFIED_STATUSES = new Set(["done", "skipped"]);

interface Violation {
  blockers: ProjectTask[];
}

interface PendingAction extends Violation {
  taskLabel: string;
  nextStatusLabel: string;
  run: () => void;
}

interface StatusColumn {
  id: string;
  label: string;
  tone: string;
}

/** Phase codes are P0 … P7; everything from P2 upwards is gated by the patent filing. */
function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function isOverdue(task: ProjectTask, today: number): boolean {
  if (!task.due_date) return false;
  if (task.status === "done" || task.status === "skipped") return false;
  const due = new Date(task.due_date).getTime();
  if (Number.isNaN(due)) return false;
  return due < today;
}

export default function ProjectTasks() {
  const tasksQuery = useProjectTasks();
  const phasesQuery = usePhases();
  const depsQuery = useTaskDependencies();
  const partnersQuery = usePartners();

  const [phaseCode, setPhaseCode] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const tasks = useMemo<ProjectTask[]>(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const phases = useMemo<Phase[]>(() => phasesQuery.data ?? [], [phasesQuery.data]);
  const partners = useMemo<Partner[]>(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const dependencies = useMemo(() => depsQuery.data ?? [], [depsQuery.data]);

  const today = useMemo(() => startOfToday(), []);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const phaseById = useMemo(() => new Map(phases.map((phase) => [phase.id, phase])), [phases]);
  const partnerById = useMemo(() => new Map(partners.map((partner) => [partner.id, partner])), [partners]);

  /** task -> tasks it depends on (predecessors) and tasks depending on it (successors). */
  const { predecessorIds, successorIds } = useMemo(() => {
    const predecessors = new Map<string, string[]>();
    const successors = new Map<string, string[]>();
    dependencies.forEach((dep) => {
      predecessors.set(dep.task_id, [...(predecessors.get(dep.task_id) ?? []), dep.depends_on_task_id]);
      successors.set(dep.depends_on_task_id, [...(successors.get(dep.depends_on_task_id) ?? []), dep.task_id]);
    });
    return { predecessorIds: predecessors, successorIds: successors };
  }, [dependencies]);

  const resolve = (ids: string[] | undefined): ProjectTask[] =>
    (ids ?? [])
      .map((id) => taskById.get(id))
      .filter((task): task is ProjectTask => Boolean(task))
      .sort((a, b) => a.code.localeCompare(b.code, "de", { numeric: true }));

  /** A task must not be started or completed while a predecessor is unfinished. */
  const evaluateViolation = (taskId: string | null, nextStatus: string): Violation | null => {
    if (!STARTING_STATUSES.has(nextStatus)) return null;
    const blockers = taskId
      ? resolve(predecessorIds.get(taskId)).filter((entry) => !SATISFIED_STATUSES.has(entry.status))
      : [];
    if (blockers.length === 0) return null;
    return { blockers };
  };

  /* ---------------------------------------------------------------- writes */

  /**
   * completed_at is stamped by the BEFORE UPDATE trigger stamp_task_completion()
   * and is therefore never part of an update payload - writing it from here
   * would only overwrite the database value with a possibly stale cached one.
   */
  const statusMutation = useProjectMutation<{ task: ProjectTask; status: string }>(
    async ({ task, status }) => {
      const { data, error } = await supabase
        .from("project_tasks")
        .update({ status })
        .eq("id", task.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    { successMessage: "Status aktualisiert", errorMessage: "Status konnte nicht geändert werden" },
  );

  const saveMutation = useProjectMutation<{
    mode: "create" | "edit";
    task: ProjectTask | null;
    payload: TaskFormPayload;
  }>(
    async ({ mode, task, payload }) => {
      if (mode === "create") {
        const { data, error } = await supabase
          .from("project_tasks")
          .insert({
            code: payload.code,
            title: payload.title,
            description: payload.description,
            status: payload.status,
            priority: payload.priority,
            phase_id: payload.phase_id,
            due_date: payload.due_date,
            assignee: payload.assignee,
            partner_id: payload.partner_id,
            estimated_cost_eur: payload.estimated_cost_eur,
            actual_cost_eur: payload.actual_cost_eur,
            blocker_reason: payload.blocker_reason,
            // The completion trigger only fires on UPDATE, so a task that is
            // created as "done" has to carry its timestamp itself.
            completed_at: payload.status === "done" ? new Date().toISOString() : null,
          })
          .select("id");
        if (error) {
          throw new Error(
            error.code === "23505"
              ? `Code „${payload.code}“ ist bereits vergeben. (${error.message})`
              : error.message,
          );
        }
        if (!data || data.length === 0) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
        return;
      }

      if (!task) throw new Error("Keine Aufgabe zum Bearbeiten ausgewählt");
      const { data, error } = await supabase
        .from("project_tasks")
        .update({
          title: payload.title,
          description: payload.description,
          status: payload.status,
          priority: payload.priority,
          phase_id: payload.phase_id,
          due_date: payload.due_date,
          assignee: payload.assignee,
          partner_id: payload.partner_id,
          estimated_cost_eur: payload.estimated_cost_eur,
          actual_cost_eur: payload.actual_cost_eur,
          blocker_reason: payload.blocker_reason,
        })
        .eq("id", task.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Aufgabe gespeichert",
      errorMessage: "Aufgabe konnte nicht gespeichert werden",
      onDone: () => {
        setDialogOpen(false);
        setEditingTask(null);
      },
    },
  );

  /* --------------------------------------------------------------- actions */

  const requestStatusChange = (task: ProjectTask, nextStatus: string) => {
    if (nextStatus === task.status) return;
    const run = () => statusMutation.mutate({ task, status: nextStatus });
    const violation = evaluateViolation(task.id, nextStatus);
    if (!violation) {
      run();
      return;
    }
    setPending({
      ...violation,
      taskLabel: `${task.code} — ${task.title}`,
      nextStatusLabel: labelOf(TASK_STATUSES, nextStatus),
      run,
    });
  };

  const handleDialogSubmit = (payload: TaskFormPayload) => {
    const run = () => saveMutation.mutate({ mode: dialogMode, task: editingTask, payload });
    // Re-check whenever the task starts/finishes or moves into another phase.
    const statusChanged = dialogMode === "create" || editingTask?.status !== payload.status;
    const phaseChanged = dialogMode === "edit" && editingTask?.phase_id !== payload.phase_id;
    const violation =
      statusChanged || phaseChanged
        ? evaluateViolation(editingTask?.id ?? null, payload.status)
        : null;
    if (!violation) {
      run();
      return;
    }
    setPending({
      ...violation,
      taskLabel: `${payload.code} — ${payload.title}`,
      nextStatusLabel: labelOf(TASK_STATUSES, payload.status),
      run,
    });
  };

  const openCreate = () => {
    setDialogMode("create");
    setEditingTask(null);
    setDialogOpen(true);
  };

  const openEdit = (task: ProjectTask) => {
    setDialogMode("edit");
    setEditingTask(task);
    setDialogOpen(true);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter(ALL);
    setPriorityFilter(ALL);
    setPhaseCode(null);
    toast({ title: "Filter zurückgesetzt" });
  };

  /* --------------------------------------------------------- derived lists */

  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const activePhase = phaseCode ? phases.find((phase) => phase.code === phaseCode) ?? null : null;

    const result = tasks.filter((task) => {
      if (activePhase && task.phase_id !== activePhase.id) return false;
      if (phaseCode && !activePhase) return false;
      if (statusFilter !== ALL && task.status !== statusFilter) return false;
      if (priorityFilter !== ALL && task.priority !== priorityFilter) return false;
      if (!needle) return true;
      const partnerName = task.partner_id ? partnerById.get(task.partner_id)?.name ?? "" : "";
      const haystack = [
        task.code,
        task.title,
        task.description ?? "",
        task.assignee ?? "",
        task.blocker_reason ?? "",
        partnerName,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    const factor = sortDirection === "asc" ? 1 : -1;
    return [...result].sort((a, b) => {
      if (sortKey === "code") {
        return a.code.localeCompare(b.code, "de", { numeric: true }) * factor;
      }
      // Tasks without a due date always sort last, regardless of direction.
      if (!a.due_date && !b.due_date) return a.code.localeCompare(b.code, "de", { numeric: true });
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (diff !== 0) return diff * factor;
      return a.code.localeCompare(b.code, "de", { numeric: true });
    });
  }, [tasks, search, phaseCode, phases, statusFilter, priorityFilter, partnerById, sortKey, sortDirection]);

  const columns = useMemo<StatusColumn[]>(() => {
    const known: StatusColumn[] = TASK_STATUSES.map((status) => ({
      id: status.id,
      label: status.label,
      tone: status.tone,
    }));
    const present = new Set(filteredTasks.map((task) => task.status));
    const base = known.filter((column) => column.id !== "skipped" || present.has("skipped"));
    const extra: StatusColumn[] = Array.from(present)
      .filter((status) => !known.some((column) => column.id === status))
      .map((status) => ({ id: status, label: status, tone: "muted" }));
    return [...base, ...extra];
  }, [filteredTasks]);

  const costRows = useMemo(() => {
    const rows = phases.map((phase) => {
      const phaseTasks = tasks.filter((task) => task.phase_id === phase.id);
      return {
        key: phase.id,
        label: `${phase.code} — ${phase.name}`,
        count: phaseTasks.length,
        planned: phaseTasks.reduce((sum, task) => sum + (task.estimated_cost_eur ?? 0), 0),
        actual: phaseTasks.reduce((sum, task) => sum + (task.actual_cost_eur ?? 0), 0),
      };
    });
    const orphans = tasks.filter((task) => !task.phase_id);
    if (orphans.length > 0) {
      rows.push({
        key: "__none__",
        label: "Ohne Phase",
        count: orphans.length,
        planned: orphans.reduce((sum, task) => sum + (task.estimated_cost_eur ?? 0), 0),
        actual: orphans.reduce((sum, task) => sum + (task.actual_cost_eur ?? 0), 0),
      });
    }
    return rows;
  }, [phases, tasks]);

  const costTotals = useMemo(
    () => ({
      count: costRows.reduce((sum, row) => sum + row.count, 0),
      planned: costRows.reduce((sum, row) => sum + row.planned, 0),
      actual: costRows.reduce((sum, row) => sum + row.actual, 0),
    }),
    [costRows],
  );

  const stats = useMemo(
    () => ({
      doing: tasks.filter((task) => task.status === "doing").length,
      blocked: tasks.filter((task) => task.status === "blocked").length,
      overdue: tasks.filter((task) => isOverdue(task, today)).length,
      done: tasks.filter((task) => task.status === "done").length,
    }),
    [tasks, today],
  );

  const isLoading =
    tasksQuery.isLoading || phasesQuery.isLoading || depsQuery.isLoading || partnersQuery.isLoading;
  const loadError =
    (tasksQuery.error as Error | null) ??
    (phasesQuery.error as Error | null) ??
    (depsQuery.error as Error | null) ??
    (partnersQuery.error as Error | null);
  const filtersActive =
    search.trim() !== "" || statusFilter !== ALL || priorityFilter !== ALL || phaseCode !== null;

  const retry = () => {
    void tasksQuery.refetch();
    void phasesQuery.refetch();
    void depsQuery.refetch();
    void partnersQuery.refetch();
  };

  /* ---------------------------------------------------------------- render */

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  /** Only the row whose status is currently being written is locked, not the whole table. */
  const statusPendingTaskId = statusMutation.isPending
    ? statusMutation.variables?.task.id ?? null
    : null;

  const renderStatusSelect = (task: ProjectTask, className?: string) => (
    <Select
      value={task.status}
      onValueChange={(value) => requestStatusChange(task, value)}
      disabled={statusPendingTaskId === task.id}
    >
      <SelectTrigger className={cn("h-8 text-xs", className)} aria-label={`Status von ${task.code}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.map((status) => (
          <SelectItem key={status.id} value={status.id} className="text-xs">
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <ProjectPageHeader
        title="Aufgaben & Phasen"
        description="Phasenplan mit Abhängigkeitsprüfung, IP-Sperre und Kostenrollup."
        icon={ListChecks}
        actions={
          <Button onClick={openCreate} size="sm" disabled={isLoading || loadError !== null}>
            <Plus className="h-4 w-4 mr-1.5" />
            Neue Aufgabe
          </Button>
        }
      />

      {loadError ? (
        <ErrorState error={loadError} onRetry={retry} />
      ) : isLoading ? (
        <LoadingRows rows={8} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="In Arbeit" value={stats.doing} icon={CircleDot} accent="sky" />
            <StatCard label="Blockiert" value={stats.blocked} icon={AlertTriangle} accent="rose" />
            <StatCard label="Überfällig" value={stats.overdue} icon={CalendarClock} accent="amber" />
            <StatCard
              label="Erledigt"
              value={stats.done}
              hint={`von ${tasks.length} Aufgaben`}
              icon={ListChecks}
              accent="emerald"
            />
          </div>

          {phases.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Phasen</CardTitle>
                <CardDescription>
                  {phaseCode
                    ? `Gefiltert auf Phase ${phaseCode} — erneut tippen hebt den Filter auf.`
                    : "Phase antippen, um die Aufgabenliste zu filtern."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PhaseStepper phases={phases} activeCode={phaseCode} onSelect={setPhaseCode} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Aufgaben</CardTitle>
                  <CardDescription>
                    {filteredTasks.length} von {tasks.length} Aufgaben
                  </CardDescription>
                </div>
                <ToggleGroup
                  type="single"
                  value={view}
                  onValueChange={(value) => {
                    if (value === "list" || value === "kanban") setView(value);
                  }}
                  variant="outline"
                  size="sm"
                  className="self-start"
                >
                  <ToggleGroupItem value="list" aria-label="Listenansicht" className="gap-1.5">
                    <Table2 className="h-4 w-4" />
                    Liste
                  </ToggleGroupItem>
                  <ToggleGroupItem value="kanban" aria-label="Kanban-Ansicht" className="gap-1.5">
                    <KanbanSquare className="h-4 w-4" />
                    Kanban
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Code, Titel, Partner, Verantwortlich …"
                    className="pl-9"
                    aria-label="Aufgaben durchsuchen"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[10.5rem]" aria-label="Nach Status filtern">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Alle Status</SelectItem>
                      {TASK_STATUSES.map((status) => (
                        <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-full sm:w-[10.5rem]" aria-label="Nach Priorität filtern">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Alle Prioritäten</SelectItem>
                      {TASK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority.id} value={priority.id}>{priority.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {filtersActive && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="self-start shrink-0">
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Zurücksetzen
                  </Button>
                )}
              </div>

              {tasks.length === 0 ? (
                <EmptyState
                  title="Noch keine Aufgaben angelegt"
                  description="Lege die Aufgaben des Phasenplans an, um Abhängigkeiten und Kosten zu verfolgen."
                  action={
                    <Button onClick={openCreate} size="sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Neue Aufgabe
                    </Button>
                  }
                />
              ) : filteredTasks.length === 0 ? (
                <EmptyState
                  title="Keine Aufgabe passt zum Filter"
                  description="Suchbegriff, Status, Priorität oder Phasenauswahl anpassen."
                  action={
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      <RotateCcw className="h-4 w-4 mr-1.5" />
                      Filter zurücksetzen
                    </Button>
                  }
                />
              ) : view === "list" ? (
                <>
                  {/* ----------------------------------------------- mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {filteredTasks.map((task) => {
                      const phase = task.phase_id ? phaseById.get(task.phase_id) ?? null : null;
                      const partner = task.partner_id ? partnerById.get(task.partner_id) ?? null : null;
                      const overdue = isOverdue(task, today);
                      const openPredecessors = resolve(predecessorIds.get(task.id)).filter(
                        (entry) => !SATISFIED_STATUSES.has(entry.status),
                      );
                      return (
                        <div
                          key={task.id}
                          className="rounded-lg border border-border p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => openEdit(task)}
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-sm font-semibold">{task.code}</span>
                                <ToneBadge tone={toneOf(TASK_PRIORITIES, task.priority)}>
                                  {labelOf(TASK_PRIORITIES, task.priority)}
                                </ToneBadge>
                              </div>
                              <p className="mt-1 text-sm font-medium leading-snug">{task.title}</p>
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(task)}
                              aria-label={`Aufgabe ${task.code} bearbeiten`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>

                          {openPredecessors.length > 0 && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Wartet auf: {openPredecessors.map((entry) => entry.code).join(", ")}
                            </p>
                          )}
                          {task.status === "blocked" && task.blocker_reason && (
                            <p className="mt-1 text-[11px] text-destructive">{task.blocker_reason}</p>
                          )}

                          <div className="mt-2">{renderStatusSelect(task, "h-10 w-full text-sm")}</div>

                          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <div className="flex min-w-0 gap-1.5">
                              <dt className="text-muted-foreground">Phase</dt>
                              <dd className="font-medium">{phase ? phase.code : "—"}</dd>
                            </div>
                            <div className="flex min-w-0 gap-1.5">
                              <dt className="text-muted-foreground">Fällig</dt>
                              <dd className={cn("font-medium", overdue && "text-destructive")}>
                                {formatDate(task.due_date)}
                              </dd>
                            </div>
                            <div className="flex min-w-0 gap-1.5">
                              <dt className="text-muted-foreground">Partner</dt>
                              <dd className="truncate font-medium">{partner ? partner.name : "—"}</dd>
                            </div>
                            <div className="flex min-w-0 gap-1.5">
                              <dt className="text-muted-foreground">Kosten</dt>
                              <dd className="font-medium">
                                {formatEur(task.estimated_cost_eur)} / {formatEur(task.actual_cost_eur)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      );
                    })}
                  </div>

                  {/* ---------------------------------------------------- md table */}
                  <div className="-mx-6 hidden overflow-x-auto px-6 md:block">
                    <Table className="min-w-[68rem]">
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            className="w-[7.5rem]"
                            aria-sort={
                              sortKey === "code"
                                ? sortDirection === "asc" ? "ascending" : "descending"
                                : "none"
                            }
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort("code")}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              Code <SortIcon column="code" />
                            </button>
                          </TableHead>
                          <TableHead className="min-w-[16rem]">Titel</TableHead>
                          <TableHead className="w-[7rem]">Phase</TableHead>
                          <TableHead className="w-[10rem]">Status</TableHead>
                          <TableHead className="w-[7rem]">Priorität</TableHead>
                          <TableHead
                            className="w-[8rem]"
                            aria-sort={
                              sortKey === "due_date"
                                ? sortDirection === "asc" ? "ascending" : "descending"
                                : "none"
                            }
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort("due_date")}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              Fällig <SortIcon column="due_date" />
                            </button>
                          </TableHead>
                          <TableHead className="min-w-[10rem]">Partner</TableHead>
                          <TableHead className="w-[11rem] text-right">Kosten geplant/ist</TableHead>
                          <TableHead className="w-[4rem]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTasks.map((task) => {
                          const phase = task.phase_id ? phaseById.get(task.phase_id) ?? null : null;
                          const partner = task.partner_id ? partnerById.get(task.partner_id) ?? null : null;
                          const overdue = isOverdue(task, today);
                          const openPredecessors = resolve(predecessorIds.get(task.id)).filter(
                            (entry) => !SATISFIED_STATUSES.has(entry.status),
                          );
                          return (
                            <TableRow key={task.id}>
                              <TableCell className="font-mono font-medium align-top">{task.code}</TableCell>
                              <TableCell className="align-top">
                                <button
                                  type="button"
                                  onClick={() => openEdit(task)}
                                  className="text-left font-medium hover:underline underline-offset-2"
                                >
                                  {task.title}
                                </button>
                                {openPredecessors.length > 0 && (
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    Wartet auf: {openPredecessors.map((entry) => entry.code).join(", ")}
                                  </p>
                                )}
                                {task.status === "blocked" && task.blocker_reason && (
                                  <p className="mt-1 text-[11px] text-destructive">{task.blocker_reason}</p>
                                )}
                              </TableCell>
                              <TableCell className="align-top text-xs text-muted-foreground">
                                {phase ? phase.code : "—"}
                              </TableCell>
                              <TableCell className="align-top">{renderStatusSelect(task)}</TableCell>
                              <TableCell className="align-top">
                                <ToneBadge tone={toneOf(TASK_PRIORITIES, task.priority)}>
                                  {labelOf(TASK_PRIORITIES, task.priority)}
                                </ToneBadge>
                              </TableCell>
                              <TableCell
                                className={cn("align-top text-sm", overdue && "text-destructive font-medium")}
                              >
                                {formatDate(task.due_date)}
                              </TableCell>
                              <TableCell className="align-top text-sm">
                                {partner ? partner.name : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="align-top text-right text-sm tabular-nums">
                                <div className="text-muted-foreground text-xs">
                                  Plan {formatEur(task.estimated_cost_eur)}
                                </div>
                                <div className="font-medium">Ist {formatEur(task.actual_cost_eur)}</div>
                              </TableCell>
                              <TableCell className="align-top text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEdit(task)}
                                  aria-label={`Aufgabe ${task.code} bearbeiten`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 pb-2">
                  <div className="flex gap-3 min-w-max items-start">
                    {columns.map((column) => {
                      const columnTasks = filteredTasks.filter((task) => task.status === column.id);
                      return (
                        <div
                          key={column.id}
                          className="w-[16.5rem] shrink-0 rounded-lg border border-border bg-muted/20 p-2"
                        >
                          <div className="flex items-center justify-between gap-2 px-1 pb-2">
                            <ToneBadge tone={column.tone}>{column.label}</ToneBadge>
                            <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
                          </div>

                          <div className="space-y-2">
                            {columnTasks.length === 0 ? (
                              <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                                Keine Aufgabe
                              </p>
                            ) : (
                              columnTasks.map((task) => {
                                const phase = task.phase_id ? phaseById.get(task.phase_id) ?? null : null;
                                const partner = task.partner_id
                                  ? partnerById.get(task.partner_id) ?? null
                                  : null;
                                const overdue = isOverdue(task, today);
                                return (
                                  <div
                                    key={task.id}
                                    className={cn(
                                      "rounded-lg border border-border bg-card p-2.5 space-y-2",
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openEdit(task)}
                                        className="text-left min-w-0"
                                      >
                                        <span className="block font-mono text-[11px] text-muted-foreground">
                                          {task.code}
                                          {phase ? ` · ${phase.code}` : ""}
                                        </span>
                                        <span className="block text-sm font-medium leading-snug hover:underline underline-offset-2">
                                          {task.title}
                                        </span>
                                      </button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0"
                                        onClick={() => openEdit(task)}
                                        aria-label={`Aufgabe ${task.code} bearbeiten`}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <ToneBadge
                                        tone={toneOf(TASK_PRIORITIES, task.priority)}
                                        className="text-[10px]"
                                      >
                                        {labelOf(TASK_PRIORITIES, task.priority)}
                                      </ToneBadge>
                                      {task.due_date && (
                                        <span
                                          className={cn(
                                            "text-[11px]",
                                            overdue ? "text-destructive font-medium" : "text-muted-foreground",
                                          )}
                                        >
                                          {formatDate(task.due_date)}
                                        </span>
                                      )}
                                    </div>

                                    {partner && (
                                      <p className="text-[11px] text-muted-foreground truncate">{partner.name}</p>
                                    )}

                                    <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
                                      <span>Plan {formatEur(task.estimated_cost_eur)}</span>
                                      <span>Ist {formatEur(task.actual_cost_eur)}</span>
                                    </div>

                                    {renderStatusSelect(task, "w-full")}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                Kosten je Phase
              </CardTitle>
              <CardDescription>Geplante gegen tatsächlich angefallene Kosten aller Aufgaben.</CardDescription>
            </CardHeader>
            <CardContent>
              {costRows.length === 0 ? (
                <EmptyState
                  title="Keine Phasen vorhanden"
                  description="Ohne Phasen kann kein Kostenrollup berechnet werden."
                />
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table className="min-w-[34rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[12rem]">Phase</TableHead>
                        <TableHead className="w-[6rem] text-right">Aufgaben</TableHead>
                        <TableHead className="w-[8rem] text-right">Geplant</TableHead>
                        <TableHead className="w-[8rem] text-right">Ist</TableHead>
                        <TableHead className="w-[8rem] text-right">Differenz</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costRows.map((row) => {
                        const delta = row.actual - row.planned;
                        return (
                          <TableRow key={row.key}>
                            <TableCell className="font-medium">{row.label}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEur(row.planned)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEur(row.actual)}</TableCell>
                            <TableCell
                              className={cn(
                                "text-right tabular-nums",
                                delta > 0 ? "text-destructive" : delta < 0 ? "text-success" : "text-muted-foreground",
                              )}
                            >
                              {delta > 0 ? "+" : ""}
                              {formatEur(delta)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="font-semibold">
                        <TableCell>Gesamt</TableCell>
                        <TableCell className="text-right tabular-nums">{costTotals.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEur(costTotals.planned)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEur(costTotals.actual)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {costTotals.actual - costTotals.planned > 0 ? "+" : ""}
                          {formatEur(costTotals.actual - costTotals.planned)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ProjectTasksDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        mode={dialogMode}
        task={editingTask}
        phases={phases}
        partners={partners}
        predecessors={editingTask ? resolve(predecessorIds.get(editingTask.id)) : []}
        successors={editingTask ? resolve(successorIds.get(editingTask.id)) : []}
        isSaving={saveMutation.isPending}
        onSubmit={handleDialogSubmit}
      />

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              Reihenfolge nicht eingehalten
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `„${pending.taskLabel}“ soll auf „${pending.nextStatusLabel}“ gesetzt werden, obwohl Voraussetzungen offen sind.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pending && pending.blockers.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-semibold mb-2">Offene Vorgänger</p>
              <ul className="space-y-1.5">
                {pending.blockers.map((blocker) => (
                  <li key={blocker.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-mono font-medium">{blocker.code}</span>{" "}
                      <span className="text-muted-foreground break-words">{blocker.title}</span>
                    </span>
                    <ToneBadge tone={toneOf(TASK_STATUSES, blocker.status)} className="shrink-0 text-[10px]">
                      {labelOf(TASK_STATUSES, blocker.status)}
                    </ToneBadge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pending?.run();
                setPending(null);
              }}
            >
              Trotzdem fortfahren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
