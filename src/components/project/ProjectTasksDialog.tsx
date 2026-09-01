import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IpGateBanner, ToneBadge } from "@/components/project/ProjectUI";
import { TASK_PRIORITIES, TASK_STATUSES, labelOf, toneOf } from "@/lib/project/constants";
import type { Partner, Phase, ProjectTask } from "@/lib/project/types";

/** Sentinel for "no selection" - Radix Select forbids an empty string value. */
const NONE = "__none__";

export interface TaskFormPayload {
  code: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  phase_id: string | null;
  due_date: string | null;
  assignee: string | null;
  partner_id: string | null;
  estimated_cost_eur: number | null;
  actual_cost_eur: number | null;
  blocker_reason: string | null;
}

interface ProjectTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  task: ProjectTask | null;
  phases: Phase[];
  partners: Partner[];
  predecessors: ProjectTask[];
  successors: ProjectTask[];
  /** True when the given phase belongs to the IP-gated phases P2..P7. */
  isPhaseTwoPlus: (phaseId: string | null) => boolean;
  isSaving: boolean;
  onSubmit: (payload: TaskFormPayload) => void;
}

type ParseResult = { ok: true; value: number | null } | { ok: false };

/** Accepts German (1.234,50) and plain (1234.5) decimal input. */
function parseDecimal(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const normalised = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalised);
  if (!Number.isFinite(parsed) || parsed < 0) return { ok: false };
  return { ok: true, value: parsed };
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

interface FormState {
  code: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  phaseId: string;
  dueDate: string;
  assignee: string;
  partnerId: string;
  estimatedCost: string;
  actualCost: string;
  blockerReason: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  phaseId: NONE,
  dueDate: "",
  assignee: "",
  partnerId: NONE,
  estimatedCost: "",
  actualCost: "",
  blockerReason: "",
};

function DependencyList({
  title,
  icon: Icon,
  tasks,
  emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tasks: ProjectTask[];
  emptyText: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">({tasks.length})</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-2">
              <span className="text-xs min-w-0">
                <span className="font-mono font-medium">{entry.code}</span>{" "}
                <span className="text-muted-foreground break-words">{entry.title}</span>
              </span>
              <ToneBadge tone={toneOf(TASK_STATUSES, entry.status)} className="shrink-0 text-[10px]">
                {labelOf(TASK_STATUSES, entry.status)}
              </ToneBadge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProjectTasksDialog({
  open,
  onOpenChange,
  mode,
  task,
  phases,
  partners,
  predecessors,
  successors,
  isPhaseTwoPlus,
  isSaving,
  onSubmit,
}: ProjectTasksDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (mode === "edit" && task) {
      setForm({
        code: task.code,
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        phaseId: task.phase_id ?? NONE,
        dueDate: toDateInput(task.due_date),
        assignee: task.assignee ?? "",
        partnerId: task.partner_id ?? NONE,
        estimatedCost: task.estimated_cost_eur === null ? "" : String(task.estimated_cost_eur),
        actualCost: task.actual_cost_eur === null ? "" : String(task.actual_cost_eur),
        blockerReason: task.blocker_reason ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, mode, task]);

  const selectedPhaseId = form.phaseId === NONE ? null : form.phaseId;
  const ipRelevant = useMemo(
    () => isPhaseTwoPlus(selectedPhaseId),
    [isPhaseTwoPlus, selectedPhaseId],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (mode === "create" && !form.code.trim()) {
      nextErrors.code = "Code ist erforderlich (z. B. P1-4).";
    }
    if (!form.title.trim()) {
      nextErrors.title = "Titel ist erforderlich.";
    }

    const estimated = parseDecimal(form.estimatedCost);
    if (!estimated.ok) nextErrors.estimatedCost = "Bitte eine gültige Zahl ≥ 0 eingeben.";
    const actual = parseDecimal(form.actualCost);
    if (!actual.ok) nextErrors.actualCost = "Bitte eine gültige Zahl ≥ 0 eingeben.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    onSubmit({
      code: mode === "create" ? form.code.trim() : (task?.code ?? form.code.trim()),
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      phase_id: selectedPhaseId,
      due_date: form.dueDate || null,
      assignee: form.assignee.trim() || null,
      partner_id: form.partnerId === NONE ? null : form.partnerId,
      estimated_cost_eur: estimated.ok ? estimated.value : null,
      actual_cost_eur: actual.ok ? actual.value : null,
      blocker_reason: form.blockerReason.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Neue Aufgabe" : `Aufgabe ${task?.code ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Der Code muss projektweit eindeutig sein."
              : "Änderungen wirken sich sofort auf Abhängigkeiten und Kostenrollup aus."}
          </DialogDescription>
        </DialogHeader>

        {ipRelevant && <IpGateBanner compact />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-code">Code {mode === "create" && <span className="text-destructive">*</span>}</Label>
              {mode === "create" ? (
                <>
                  <Input
                    id="task-code"
                    value={form.code}
                    onChange={(event) => update("code", event.target.value)}
                    placeholder="P1-4"
                    autoComplete="off"
                    className="font-mono"
                  />
                  {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
                </>
              ) : (
                <Input id="task-code" value={form.code} readOnly disabled className="font-mono" />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-phase">Phase</Label>
              <Select value={form.phaseId} onValueChange={(value) => update("phaseId", value)}>
                <SelectTrigger id="task-phase">
                  <SelectValue placeholder="Phase wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ohne Phase</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.code} — {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-title">Titel <span className="text-destructive">*</span></Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Kurzbeschreibung der Aufgabe"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-description">Beschreibung</Label>
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              rows={3}
              placeholder="Was ist konkret zu tun?"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Status</Label>
              <Select value={form.status} onValueChange={(value) => update("status", value)}>
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priorität</Label>
              <Select value={form.priority} onValueChange={(value) => update("priority", value)}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((priority) => (
                    <SelectItem key={priority.id} value={priority.id}>{priority.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due">Fällig am</Label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(event) => update("dueDate", event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">Verantwortlich</Label>
              <Input
                id="task-assignee"
                value={form.assignee}
                onChange={(event) => update("assignee", event.target.value)}
                placeholder="Name"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-partner">Partner</Label>
            <Select value={form.partnerId} onValueChange={(value) => update("partnerId", value)}>
              <SelectTrigger id="task-partner">
                <SelectValue placeholder="Partner wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Kein Partner</SelectItem>
                {partners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-est-cost">Kosten geplant (EUR)</Label>
              <Input
                id="task-est-cost"
                inputMode="decimal"
                value={form.estimatedCost}
                onChange={(event) => update("estimatedCost", event.target.value)}
                placeholder="z. B. 2500"
              />
              {errors.estimatedCost && <p className="text-xs text-destructive">{errors.estimatedCost}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-act-cost">Kosten ist (EUR)</Label>
              <Input
                id="task-act-cost"
                inputMode="decimal"
                value={form.actualCost}
                onChange={(event) => update("actualCost", event.target.value)}
                placeholder="z. B. 2380"
              />
              {errors.actualCost && <p className="text-xs text-destructive">{errors.actualCost}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-blocker">Blockade-Grund</Label>
            <Textarea
              id="task-blocker"
              value={form.blockerReason}
              onChange={(event) => update("blockerReason", event.target.value)}
              rows={2}
              placeholder="Warum steht die Aufgabe still?"
            />
          </div>

          {mode === "edit" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DependencyList
                title="Vorgänger"
                icon={ArrowUpFromLine}
                tasks={predecessors}
                emptyText="Keine Vorgänger — die Aufgabe kann jederzeit starten."
              />
              <DependencyList
                title="Nachfolger"
                icon={ArrowDownToLine}
                tasks={successors}
                emptyText="Keine Nachfolger hinterlegt."
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "create" ? "Aufgabe anlegen" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
