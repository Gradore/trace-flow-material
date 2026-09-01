import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Beaker,
  Boxes,
  CalendarClock,
  Check,
  Euro,
  FlaskConical,
  ListChecks,
  Loader2,
  Package,
  PackageCheck,
  Rocket,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { severityTone } from "@/components/project/ProjectRisksShared";

import {
  ConformityBadge,
  EmptyState,
  ErrorState,
  IpGateBanner,
  LoadingRows,
  Markdown,
  PhaseStepper,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDate,
  formatDateTime,
  formatEur,
  formatKg,
  formatNumber,
} from "@/components/project/ProjectUI";

import {
  useAiAnalyses,
  useAnalysisResults,
  useFractionAnalyses,
  useFractionSpecs,
  useMaterialBatches,
  useOutputFractions,
  usePartners,
  usePatentFiled,
  usePhases,
  useProjectRisks,
  useProjectTasks,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import {
  useAcknowledgeAiAnalysis,
  useRequestAiAnalysis,
} from "@/hooks/project/useProjectAi";

import {
  MATERIAL_CLASSES,
  PARTNER_STATUSES,
  PATENT_TASK_CODE,
  PROCESS_LINES,
  RISK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TEST_RUN_STATUSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import {
  conformityOf,
  evaluateResult,
  type ConformityLevel,
  type ParameterVerdict,
} from "@/lib/project/spec";
import type {
  AnalysisResult,
  FractionAnalysis,
  MaterialBatch,
  OutputFraction,
  Phase,
  ProjectRisk,
  ProjectTask,
  TestRun,
} from "@/lib/project/types";

/* ------------------------------------------------------------------ utils */

const OPEN_TASK_STATUSES = new Set(["todo", "doing", "blocked"]);
const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const RUN_HORIZON_DAYS = 30;

const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
  color: "hsl(var(--popover-foreground))",
};

/** Distinct donut colours per partner status - semantic where possible. */
const PARTNER_STATUS_COLOR: Record<string, string> = {
  prospect: "hsl(var(--muted-foreground))",
  contacted: "hsl(var(--info))",
  nda_signed: "hsl(var(--primary))",
  testing: "hsl(var(--warning))",
  active_partner: "hsl(var(--success))",
  rejected: "hsl(var(--destructive))",
  on_hold: "hsl(var(--muted-foreground) / 0.45)",
};

const CONFORMITY_DOT: Record<ConformityLevel, string> = {
  pass: "bg-success",
  borderline: "bg-warning",
  fail: "bg-destructive",
  unknown: "bg-muted-foreground",
};

/** ai_analyses.confidence stores the raw model verdict in English. */
const CONFIDENCE_LABELS: Record<string, string> = {
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
};

/** project_risks.status is free text (default 'open') - translate what we know. */
const RISK_STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  mitigating: "Maßnahme läuft",
  monitoring: "Beobachtung",
  accepted: "Akzeptiert",
  closed: "Geschlossen",
};

function timeOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * "Phase 2" is derived from the phase code (P0, P1, P2 ...) because task codes
 * such as P0-2 carry the same prefix. order_num is only the fallback.
 */
function phaseRank(phase: Phase | null): number | null {
  if (!phase) return null;
  const match = phase.code.match(/(\d+)/);
  if (match) return Number(match[1]);
  return phase.order_num;
}

function phaseWindow(phase: Phase): { start: number | null; end: number | null; hasWindow: boolean } {
  const start = timeOf(phase.actual_start ?? phase.planned_start);
  const end = timeOf(phase.actual_end ?? phase.planned_end);
  return { start, end, hasWindow: start !== null || end !== null };
}

function withinPhaseWindow(dateValue: string | null, phase: Phase): boolean {
  const { start, end, hasWindow } = phaseWindow(phase);
  if (!hasWindow) return false;
  const time = timeOf(dateValue);
  if (time === null) return false;
  if (start !== null && time < start) return false;
  if (end !== null && time > end) return false;
  return true;
}

function compareTasks(a: ProjectTask, b: ProjectTask): number {
  const rankA = PRIORITY_RANK[a.priority] ?? 99;
  const rankB = PRIORITY_RANK[b.priority] ?? 99;
  if (rankA !== rankB) return rankA - rankB;
  const dueA = timeOf(a.due_date) ?? Number.POSITIVE_INFINITY;
  const dueB = timeOf(b.due_date) ?? Number.POSITIVE_INFINITY;
  if (dueA !== dueB) return dueA - dueB;
  return a.code.localeCompare(b.code, "de");
}

/**
 * Sollfenster of a parameter. Most specs are one-sided (only a maximum for
 * moisture, fines and energy), so an open end has to read as "≤ x" / "≥ x"
 * instead of a half-empty range.
 */
function specWindowLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return "—";
  if (min !== null && max !== null) return `${formatNumber(min)} – ${formatNumber(max)}`;
  if (max !== null) return `≤ ${formatNumber(max)}`;
  return `≥ ${formatNumber(min)}`;
}

function runDateOf(run: TestRun): string | null {
  return run.actual_date ?? run.planned_date;
}

/** Marks the day the automatic briefing request was already fired. */
const AUTO_BRIEFING_KEY = "rekuflow.projekt.autoBriefing";

function riskSeverity(risk: ProjectRisk): number {
  return risk.severity ?? risk.probability * risk.impact;
}

/** Same thresholds as the risk register - severityTone() is the single source. */
const SEVERITY_BADGE_CLASSES: Record<string, string> = {
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  success: "bg-muted text-muted-foreground",
};

/**
 * ai_analyses.recommendations is free-form jsonb - it is nullable and the model
 * writes either plain strings or small objects. Read it defensively.
 */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return entry.trim() ? [entry.trim()] : [];
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      for (const key of ["title", "text", "recommendation", "action"]) {
        const candidate = record[key];
        if (typeof candidate === "string" && candidate.trim()) return [candidate.trim()];
      }
    }
    return [];
  });
}

/* ------------------------------------------------------------- primitives */

interface QueryLike {
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Loading / error / empty gate shared by every widget list. */
function AsyncSection({
  queries,
  rows = 3,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}: {
  queries: QueryLike[];
  rows?: number;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}) {
  if (queries.some((query) => query.isLoading)) return <LoadingRows rows={rows} />;

  const failed = queries.find((query) => query.error !== null);
  if (failed?.error) {
    return (
      <ErrorState
        error={failed.error}
        onRetry={() => queries.forEach((query) => query.refetch())}
      />
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }
  return <>{children}</>;
}

function WidgetCard({
  title,
  description,
  icon: Icon,
  to,
  linkLabel,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  to?: string;
  linkLabel?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{title}</span>
            </CardTitle>
            {description && <CardDescription className="mt-1 text-xs">{description}</CardDescription>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">{children}</CardContent>
      {to && (
        <CardFooter className="pt-0">
          <Button asChild variant="ghost" size="sm" className="ml-auto h-8 text-xs">
            <Link to={to}>
              {linkLabel ?? "Details"}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------- page */

export default function ProjectCockpit() {
  const [activePhaseCode, setActivePhaseCode] = useState<string | null>(null);

  const phasesQuery = usePhases();
  const tasksQuery = useProjectTasks();
  const briefingQuery = useAiAnalyses("daily_briefing");
  const batchesQuery = useMaterialBatches();
  const fractionsQuery = useOutputFractions();
  const specsQuery = useFractionSpecs();
  const analysesQuery = useFractionAnalyses();
  const resultsQuery = useAnalysisResults();
  const runsQuery = useTestRuns();
  const partnersQuery = usePartners();
  const risksQuery = useProjectRisks();
  const { isFiled: patentFiled } = usePatentFiled();

  const requestBriefing = useRequestAiAnalysis();
  const acknowledgeBriefing = useAcknowledgeAiAnalysis();

  const phases = useMemo<Phase[]>(() => phasesQuery.data ?? [], [phasesQuery.data]);
  const tasks = useMemo<ProjectTask[]>(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const batches = useMemo<MaterialBatch[]>(() => batchesQuery.data ?? [], [batchesQuery.data]);
  const fractions = useMemo<OutputFraction[]>(() => fractionsQuery.data ?? [], [fractionsQuery.data]);
  const specs = useMemo(() => specsQuery.data ?? [], [specsQuery.data]);
  const analyses = useMemo<FractionAnalysis[]>(() => analysesQuery.data ?? [], [analysesQuery.data]);
  const results = useMemo<AnalysisResult[]>(() => resultsQuery.data ?? [], [resultsQuery.data]);
  const runs = useMemo<TestRun[]>(() => runsQuery.data ?? [], [runsQuery.data]);
  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const risks = useMemo<ProjectRisk[]>(() => risksQuery.data ?? [], [risksQuery.data]);

  const activePhase = useMemo<Phase | null>(
    () => (activePhaseCode ? phases.find((phase) => phase.code === activePhaseCode) ?? null : null),
    [phases, activePhaseCode],
  );

  /** Resolve a task's phase - by FK, falling back to the code prefix (P2-3 -> P2). */
  const resolveTaskPhase = useMemo(() => {
    const byId = new Map(phases.map((phase) => [phase.id, phase]));
    const byCode = new Map(phases.map((phase) => [phase.code, phase]));
    return (task: ProjectTask): Phase | null => {
      if (task.phase_id) {
        const direct = byId.get(task.phase_id);
        if (direct) return direct;
      }
      const prefix = task.code.split("-")[0];
      return byCode.get(prefix) ?? null;
    };
  }, [phases]);

  /* ------------------------------------------------------------- IP gate */

  const ipBreachTasks = useMemo<ProjectTask[]>(() => {
    if (patentFiled) return [];
    return tasks
      .filter((task) => task.status === "doing")
      .filter((task) => {
        const rank = phaseRank(resolveTaskPhase(task));
        return rank !== null && rank >= 2;
      })
      .sort((a, b) => a.code.localeCompare(b.code, "de"));
  }, [patentFiled, tasks, resolveTaskPhase]);

  /* ------------------------------------------------------------ briefing */

  const latestBriefing = briefingQuery.data?.[0] ?? null;
  const briefingUnread = latestBriefing !== null && latestBriefing.acknowledged_at === null;
  const briefingRecommendations = stringList(latestBriefing?.recommendations);

  // The specification asks for a daily briefing without user action. It is
  // requested at most once per day: the newest stored briefing decides, and a
  // local marker keeps a reload from firing a second paid model call while the
  // first is still in flight.
  const todayKey = new Date().toISOString().slice(0, 10);
  const briefingIsFromToday =
    latestBriefing !== null && latestBriefing.created_at.slice(0, 10) === todayKey;

  useEffect(() => {
    if (briefingQuery.isLoading || briefingQuery.error) return;
    if (briefingIsFromToday || requestBriefing.isPending) return;

    let alreadyTried = false;
    try {
      alreadyTried = window.localStorage.getItem(AUTO_BRIEFING_KEY) === todayKey;
    } catch {
      // storage unavailable - fall back to requesting once per mount
    }
    if (alreadyTried) return;

    try {
      window.localStorage.setItem(AUTO_BRIEFING_KEY, todayKey);
    } catch {
      /* ignore */
    }
    requestBriefing.mutate({ analysisType: "daily_briefing" });
    // requestBriefing is a stable mutation object; re-running on its state
    // would re-trigger the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefingQuery.isLoading, briefingQuery.error, briefingIsFromToday, todayKey]);

  /* --------------------------------------------------------- next action */

  const openTasks = useMemo(
    () => tasks.filter((task) => OPEN_TASK_STATUSES.has(task.status)),
    [tasks],
  );

  const nextActions = useMemo(() => {
    const scoped = activePhase
      ? openTasks.filter((task) => resolveTaskPhase(task)?.id === activePhase.id)
      : openTasks;
    return [...scoped].sort(compareTasks).slice(0, 5);
  }, [openTasks, activePhase, resolveTaskPhase]);

  /* -------------------------------------------------------- material kg */

  const materialStock = useMemo(() => {
    const totals = new Map<string, number>();
    for (const batch of batches) {
      if (batch.status === "consumed") continue;
      totals.set(batch.material_class, (totals.get(batch.material_class) ?? 0) + (batch.weight_kg ?? 0));
    }
    const known = MATERIAL_CLASSES.map((entry) => ({
      id: entry.id as string,
      label: entry.label as string,
      kg: totals.get(entry.id) ?? 0,
    }));
    const knownIds = new Set(known.map((entry) => entry.id));
    const extra = [...totals.entries()]
      .filter(([id]) => !knownIds.has(id))
      .map(([id, kg]) => ({ id, label: id, kg }));
    return [...known, ...extra];
  }, [batches]);

  const materialTotalKg = useMemo(
    () => materialStock.reduce((sum, entry) => sum + entry.kg, 0),
    [materialStock],
  );

  /* -------------------------------------------------------- fraction kg */

  const fractionStock = useMemo(() => {
    const specById = new Map(specs.map((spec) => [spec.id, spec]));

    const analysisIdsByFraction = new Map<string, string[]>();
    for (const analysis of analyses) {
      if (!analysis.output_fraction_id) continue;
      const list = analysisIdsByFraction.get(analysis.output_fraction_id) ?? [];
      list.push(analysis.id);
      analysisIdsByFraction.set(analysis.output_fraction_id, list);
    }

    const resultsByAnalysis = new Map<string, AnalysisResult[]>();
    for (const result of results) {
      const list = resultsByAnalysis.get(result.analysis_id) ?? [];
      list.push(result);
      resultsByAnalysis.set(result.analysis_id, list);
    }

    const targetIds = new Set<string>();
    specs.forEach((spec) => targetIds.add(spec.id));
    fractions.forEach((fraction) => {
      if (fraction.target_fraction_id) targetIds.add(fraction.target_fraction_id);
    });

    const rows = [...targetIds]
      .sort((a, b) => a.localeCompare(b, "de"))
      .map((targetId) => {
        const spec = specById.get(targetId) ?? null;
        const own = fractions.filter((fraction) => fraction.target_fraction_id === targetId);
        const verdicts: ParameterVerdict[] = own.flatMap((fraction) =>
          (analysisIdsByFraction.get(fraction.id) ?? []).flatMap((analysisId) =>
            (resultsByAnalysis.get(analysisId) ?? []).map((result) => evaluateResult(result, spec)),
          ),
        );
        return {
          id: targetId,
          name: spec?.name ?? targetId,
          processLine: spec?.process_line ?? null,
          kg: own.reduce((sum, fraction) => sum + (fraction.weight_kg ?? 0), 0),
          count: own.length,
          conformity: conformityOf(verdicts),
        };
      });

    const unassigned = fractions.filter((fraction) => !fraction.target_fraction_id);
    if (unassigned.length > 0) {
      rows.push({
        id: "—",
        name: "Ohne Zielfraktion",
        processLine: null,
        kg: unassigned.reduce((sum, fraction) => sum + (fraction.weight_kg ?? 0), 0),
        count: unassigned.length,
        conformity: "unknown" as ConformityLevel,
      });
    }
    return rows;
  }, [specs, fractions, analyses, results]);

  const fractionMaxKg = useMemo(
    () => fractionStock.reduce((max, row) => Math.max(max, row.kg), 0),
    [fractionStock],
  );

  /* -------------------------------------------------------- test runs */

  /**
   * test_runs carry no phase FK. A run belongs to a phase when its partner is
   * booked on a task of that phase (P2 -> Siempelkamp, Vecoplan, ...) or when
   * its date falls into the phase's planned/actual window.
   */
  const partnerIdsByPhaseId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const task of tasks) {
      if (!task.partner_id) continue;
      const phase = resolveTaskPhase(task);
      if (!phase) continue;
      const set = map.get(phase.id) ?? new Set<string>();
      set.add(task.partner_id);
      map.set(phase.id, set);
    }
    return map;
  }, [tasks, resolveTaskPhase]);

  const runMatchesActivePhase = useMemo(() => {
    if (!activePhase) return () => true;
    const partnerIds = partnerIdsByPhaseId.get(activePhase.id) ?? new Set<string>();
    return (run: TestRun): boolean => {
      if (run.partner_id !== null && partnerIds.has(run.partner_id)) return true;
      return withinPhaseWindow(runDateOf(run), activePhase);
    };
  }, [activePhase, partnerIdsByPhaseId]);

  const upcomingRuns = useMemo(() => {
    const now = Date.now();
    const horizon = now + RUN_HORIZON_DAYS * 24 * 60 * 60 * 1000;
    const relevant = runs.filter((run) => {
      if (run.status === "running") return true;
      if (run.status !== "planned") return false;
      const time = timeOf(runDateOf(run));
      return time !== null && time <= horizon;
    });
    const scoped = activePhase ? relevant.filter(runMatchesActivePhase) : relevant;
    return [...scoped]
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "running" ? -1 : 1;
        const timeA = timeOf(runDateOf(a)) ?? Number.POSITIVE_INFINITY;
        const timeB = timeOf(runDateOf(b)) ?? Number.POSITIVE_INFINITY;
        return timeA - timeB;
      })
      .slice(0, 6);
  }, [runs, activePhase, runMatchesActivePhase]);

  /* -------------------------------------------------- analysis results */

  const latestResults = useMemo(() => {
    const analysisById = new Map(analyses.map((analysis) => [analysis.id, analysis]));
    const fractionById = new Map(fractions.map((fraction) => [fraction.id, fraction]));
    const specById = new Map(specs.map((spec) => [spec.id, spec]));

    return [...results]
      .sort((a, b) => (timeOf(b.measured_at) ?? 0) - (timeOf(a.measured_at) ?? 0))
      .slice(0, 8)
      .map((result) => {
        const analysis = analysisById.get(result.analysis_id) ?? null;
        const fraction = analysis?.output_fraction_id
          ? fractionById.get(analysis.output_fraction_id) ?? null
          : null;
        const spec = fraction?.target_fraction_id
          ? specById.get(fraction.target_fraction_id) ?? null
          : null;
        const verdict = evaluateResult(result, spec);
        const level: ConformityLevel = result.pass_fail === false ? "fail" : verdict.level;
        return { result, analysis, fraction, verdict, level };
      });
  }, [results, analyses, fractions, specs]);

  /* ----------------------------------------------------- partner donut */

  const partnerPipeline = useMemo(() => {
    const counts = new Map<string, number>();
    partners.forEach((partner) => counts.set(partner.status, (counts.get(partner.status) ?? 0) + 1));

    const known = PARTNER_STATUSES.map((status) => ({
      id: status.id as string,
      label: status.label as string,
      value: counts.get(status.id) ?? 0,
      color: PARTNER_STATUS_COLOR[status.id] ?? "hsl(var(--muted-foreground))",
    }));
    const knownIds = new Set(known.map((entry) => entry.id));
    const extra = [...counts.entries()]
      .filter(([id]) => !knownIds.has(id))
      .map(([id, value]) => ({ id, label: id, value, color: "hsl(var(--muted-foreground) / 0.7)" }));

    return [...known, ...extra].filter((entry) => entry.value > 0);
  }, [partners]);

  const partnerTotal = useMemo(
    () => partnerPipeline.reduce((sum, entry) => sum + entry.value, 0),
    [partnerPipeline],
  );

  /* ------------------------------------------------------------- risks */

  const topRisks = useMemo(() => {
    const scoped = activePhase ? risks.filter((risk) => risk.phase_id === activePhase.id) : risks;
    return [...scoped].sort((a, b) => riskSeverity(b) - riskSeverity(a)).slice(0, 3);
  }, [risks, activePhase]);

  /* --------------------------------------------------------------- KPI */

  const costTotals = useMemo(() => {
    let planned = 0;
    let actual = 0;
    for (const task of tasks) {
      planned += task.estimated_cost_eur ?? 0;
      actual += task.actual_cost_eur ?? 0;
    }
    return { planned, actual };
  }, [tasks]);

  const releasedFractionCount = fractions.filter((fraction) => fraction.status === "released").length;
  const releasedForProductTest = fractions.filter((fraction) => fraction.released_for_product_test).length;

  /** KPI tiles are not lists - show a placeholder while loading and on error. */
  const kpi = (query: QueryLike, value: string): string =>
    query.isLoading ? "…" : query.error ? "—" : value;

  /**
   * Totals in a tile hint or a card headline are derived from `data ?? []` and
   * would read as a factual "0" while the query is still loading or has failed.
   * They are only shown once the query really delivered.
   */
  const loaded = (query: QueryLike): boolean => !query.isLoading && query.error === null;

  const phaseNote = activePhase ? `Gefiltert auf Phase ${activePhase.code} — ${activePhase.name}` : null;
  const phaseRunWindow = activePhase ? phaseWindow(activePhase) : null;

  /* -------------------------------------------------------------- view */

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <ProjectPageHeader
        title="Projekt-Cockpit"
        description="GFK-Recycling — Planungs- und Versuchsphase auf einen Blick"
        icon={Rocket}
        actions={
          <Button
            size="sm"
            onClick={() => requestBriefing.mutate({ analysisType: "daily_briefing" })}
            disabled={requestBriefing.isPending}
          >
            {requestBriefing.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Briefing erzeugen
          </Button>
        }
      />

      {/* 2 — IP-Gate: Phase-2-Aktivitäten vor der Patentanmeldung sind unzulässig */}
      <IpGateBanner />

      {ipBreachTasks.length > 0 && (
        <Card className="mb-4 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Schutzrechtsverstoß droht — Phase-2-Aufgaben laufen bereits
            </CardTitle>
            <CardDescription className="text-xs">
              {PATENT_TASK_CODE} (Patentanmeldung) ist nicht abgeschlossen, es sind aber{" "}
              {ipBreachTasks.length} Aufgabe(n) aus Phase 2 oder höher in Arbeit. Jede Herstellerdemo
              vor der Einreichung zerstört die Neuheit des Verfahrens.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {ipBreachTasks.map((task) => {
                const phase = resolveTaskPhase(task);
                return (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-background/60 px-3 py-2"
                  >
                    <span className="font-mono text-xs font-semibold text-destructive">{task.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                    {phase && (
                      <span className="text-xs text-muted-foreground">
                        {phase.code} · {phase.name}
                      </span>
                    )}
                    <ToneBadge tone={toneOf(TASK_STATUSES, task.status)}>
                      {labelOf(TASK_STATUSES, task.status)}
                    </ToneBadge>
                  </li>
                );
              })}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-3 h-8 text-xs">
              <Link to="/projekt/aufgaben">
                Aufgaben stoppen oder umplanen
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 11 — KPI-Reihe */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Offene Aufgaben"
          value={kpi(tasksQuery, formatNumber(openTasks.length, 0))}
          hint={loaded(tasksQuery) ? `von ${formatNumber(tasks.length, 0)} gesamt` : undefined}
          icon={ListChecks}
          accent="violet"
          to="/projekt/aufgaben"
        />
        <StatCard
          label="Kosten Ist / Plan"
          value={kpi(tasksQuery, formatEur(costTotals.actual))}
          hint={loaded(tasksQuery) ? `geplant ${formatEur(costTotals.planned)}` : undefined}
          icon={Euro}
          accent="amber"
          to="/projekt/aufgaben"
        />
        <StatCard
          label="Materialbestand"
          value={kpi(batchesQuery, formatKg(materialTotalKg))}
          hint="ohne verbrauchte Chargen"
          icon={Boxes}
          accent="sky"
          to="/projekt/chargen"
        />
        <StatCard
          label="Freigegebene Fraktionen"
          value={kpi(fractionsQuery, formatNumber(releasedFractionCount, 0))}
          hint={
            loaded(fractionsQuery)
              ? `${formatNumber(releasedForProductTest, 0)} für Produkttests frei`
              : undefined
          }
          icon={PackageCheck}
          accent="emerald"
          to="/projekt/fraktionen"
        />
      </div>

      {/* 1 — Phasenfortschritt, filtert Aufgaben / Versuche / Risiken */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base">Projektphasen</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {phaseNote ?? "Phase antippen, um Aufgaben, Versuche und Risiken zu filtern"}
              </CardDescription>
            </div>
            {activePhase && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setActivePhaseCode(null)}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Filter aufheben
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <AsyncSection
            queries={[phasesQuery]}
            rows={2}
            isEmpty={phases.length === 0}
            emptyTitle="Keine Projektphasen angelegt"
            emptyDescription="Ohne Phasen lässt sich der Projektfortschritt nicht darstellen."
            emptyAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/projekt/aufgaben">Zu Phasen &amp; Aufgaben</Link>
              </Button>
            }
          >
            <PhaseStepper phases={phases} activeCode={activePhaseCode} onSelect={setActivePhaseCode} />
          </AsyncSection>
        </CardContent>
      </Card>

      {/* 3 — KI-Briefing des Tages */}
      <Card
        className={cn(
          "mb-4",
          briefingUnread && "border-primary/60 ring-1 ring-primary/40 bg-primary/[0.03]",
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
                KI-Briefing des Tages
                {briefingUnread && (
                  <ToneBadge tone="info" className="ml-1">
                    Neu
                  </ToneBadge>
                )}
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                {briefingQuery.isLoading
                  ? "Briefing wird geladen …"
                  : briefingQuery.error
                    ? "Briefing konnte nicht geladen werden"
                    : latestBriefing
                      ? `Erstellt ${formatDateTime(latestBriefing.created_at)}${
                          latestBriefing.model ? ` · ${latestBriefing.model}` : ""
                        }${
                          latestBriefing.confidence
                            ? ` · Konfidenz ${
                                CONFIDENCE_LABELS[latestBriefing.confidence] ?? latestBriefing.confidence
                              }`
                            : ""
                        }`
                      : "Noch kein Tages-Briefing vorhanden"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {latestBriefing && briefingUnread && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => acknowledgeBriefing.mutate({ id: latestBriefing.id })}
                  disabled={acknowledgeBriefing.isPending}
                >
                  {acknowledgeBriefing.isPending ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3.5 w-3.5" />
                  )}
                  Gelesen
                </Button>
              )}
              {latestBriefing && !briefingUnread && (
                <span className="text-xs text-muted-foreground">
                  Gelesen {formatDateTime(latestBriefing.acknowledged_at)}
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                onClick={() => requestBriefing.mutate({ analysisType: "daily_briefing" })}
                disabled={requestBriefing.isPending}
              >
                {requestBriefing.isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                )}
                Briefing erzeugen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <AsyncSection
            queries={[briefingQuery]}
            rows={4}
            isEmpty={latestBriefing === null}
            emptyTitle="Noch kein Tages-Briefing"
            emptyDescription="Die KI wertet Aufgaben, Versuche, Analytik und Partnerstatus aus und schlägt die nächsten Schritte vor."
            emptyAction={
              <Button
                size="sm"
                onClick={() => requestBriefing.mutate({ analysisType: "daily_briefing" })}
                disabled={requestBriefing.isPending}
              >
                {requestBriefing.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Briefing erzeugen
              </Button>
            }
          >
            {latestBriefing?.output_md ? (
              <Markdown content={latestBriefing.output_md} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Das Briefing enthält keinen Text. Bitte neu erzeugen.
              </p>
            )}

            {briefingRecommendations.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Empfehlungen
                </p>
                <ul className="space-y-1.5">
                  {briefingRecommendations.map((recommendation, index) => (
                    <li key={`${index}-${recommendation.slice(0, 16)}`} className="flex gap-2 text-sm">
                      <span className="text-muted-foreground">•</span>
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                <Link to="/projekt/ki">
                  Alle KI-Auswertungen
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </AsyncSection>
        </CardContent>
      </Card>

      {/* Bento-Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 4 — Nächste kritische Aktionen */}
        <WidgetCard
          title="Nächste kritische Aktionen"
          description={
            activePhase
              ? `Offene Aufgaben in Phase ${activePhase.code}, nach Priorität und Fälligkeit`
              : "Top-5 offene Aufgaben nach Priorität und Fälligkeit"
          }
          icon={ListChecks}
          to="/projekt/aufgaben"
          linkLabel="Alle Aufgaben"
          className="lg:col-span-2"
        >
          <AsyncSection
            queries={[tasksQuery, phasesQuery]}
            isEmpty={nextActions.length === 0}
            emptyTitle="Keine offenen Aufgaben"
            emptyDescription={
              activePhase
                ? `In Phase ${activePhase.code} ist derzeit keine Aufgabe offen.`
                : "Alle Aufgaben sind erledigt oder übersprungen."
            }
          >
            <div className="overflow-x-auto">
              <Table className="min-w-[36rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[5.5rem]">Code</TableHead>
                    <TableHead>Aufgabe</TableHead>
                    <TableHead className="w-[7rem]">Phase</TableHead>
                    <TableHead className="w-[6.5rem]">Fällig</TableHead>
                    <TableHead className="w-[6.5rem]">Priorität</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nextActions.map((task) => {
                    const phase = resolveTaskPhase(task);
                    const dueTime = timeOf(task.due_date);
                    const overdue = dueTime !== null && dueTime < Date.now();
                    return (
                      <TableRow key={task.id}>
                        <TableCell className="font-mono text-xs">{task.code}</TableCell>
                        <TableCell>
                          <div className="min-w-[12rem]">
                            <p className="text-sm font-medium leading-tight">{task.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {labelOf(TASK_STATUSES, task.status)}
                              {task.assignee ? ` · ${task.assignee}` : ""}
                              {task.status === "blocked" && task.blocker_reason
                                ? ` · ${task.blocker_reason}`
                                : ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {phase ? phase.code : "—"}
                        </TableCell>
                        <TableCell
                          className={cn("whitespace-nowrap text-xs", overdue && "font-semibold text-destructive")}
                        >
                          {formatDate(task.due_date)}
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={toneOf(TASK_PRIORITIES, task.priority)}>
                            {labelOf(TASK_PRIORITIES, task.priority)}
                          </ToneBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </AsyncSection>
        </WidgetCard>

        {/* 5 — Materialbestand je Materialklasse */}
        <WidgetCard
          title="Materialbestand"
          description={`Verfügbare Chargen je Materialklasse${
            loaded(batchesQuery) ? ` · ${formatKg(materialTotalKg)}` : ""
          }`}
          icon={Boxes}
          to="/projekt/chargen"
          linkLabel="Chargen"
        >
          <AsyncSection
            queries={[batchesQuery]}
            isEmpty={materialTotalKg === 0}
            emptyTitle="Kein Material auf Lager"
            emptyDescription="Es sind keine Chargen erfasst oder alle Chargen sind verbraucht."
            emptyAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/projekt/chargen">Charge erfassen</Link>
              </Button>
            }
          >
            <div className="h-[16rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={materialStock}
                  layout="vertical"
                  margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="id"
                    width={34}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value) => [formatKg(typeof value === "number" ? value : null), "Bestand"]}
                    labelFormatter={(label) => {
                      const entry = materialStock.find((row) => row.id === label);
                      return entry ? `${entry.id} — ${entry.label}` : String(label);
                    }}
                  />
                  <Bar dataKey="kg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AsyncSection>
        </WidgetCard>

        {/* 6 — Fraktionsbestand mit Spec-Ampel */}
        <WidgetCard
          title="Fraktionsbestand"
          description="Menge je Zielfraktion mit Spec-Konformität aus der Analytik"
          icon={Package}
          to="/projekt/fraktionen"
          linkLabel="Fraktionen"
        >
          <AsyncSection
            queries={[fractionsQuery, specsQuery, analysesQuery, resultsQuery]}
            isEmpty={fractions.length === 0 || fractionStock.length === 0}
            emptyTitle="Keine Fraktionen vorhanden"
            emptyDescription="Sobald ein Versuchslauf Ausgangsfraktionen erzeugt, erscheinen sie hier."
            emptyAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/projekt/versuche">Zu den Versuchen</Link>
              </Button>
            }
          >
            <ul className="space-y-3">
              {fractionStock.map((row) => (
                <li key={row.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", CONFORMITY_DOT[row.conformity])}
                        aria-hidden
                      />
                      <span className="font-mono text-xs font-semibold">{row.id}</span>
                      <span className="truncate text-sm">{row.name}</span>
                    </div>
                    <span className="whitespace-nowrap text-sm font-semibold">{formatKg(row.kg)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${fractionMaxKg > 0 ? Math.max((row.kg / fractionMaxKg) * 100, row.kg > 0 ? 3 : 0) : 0}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <ConformityBadge level={row.conformity} />
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(row.count, 0)} Charge(n)
                      {row.processLine ? ` · ${labelOf(PROCESS_LINES, row.processLine)}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </AsyncSection>
        </WidgetCard>

        {/* 7 — Laufende und anstehende Versuche */}
        <WidgetCard
          title="Laufende & anstehende Versuche"
          description={
            activePhase
              ? `Versuche der Phase ${activePhase.code} — zugeordnet über Partner oder Phasenzeitraum`
              : `Status „Läuft“ sowie geplante Termine der nächsten ${RUN_HORIZON_DAYS} Tage (inkl. überfälliger)`
          }
          icon={FlaskConical}
          to="/projekt/versuche"
          linkLabel="Alle Versuche"
          className="lg:col-span-2"
        >
          <AsyncSection
            queries={[runsQuery]}
            isEmpty={upcomingRuns.length === 0}
            emptyTitle="Keine laufenden oder anstehenden Versuche"
            emptyDescription={
              activePhase
                ? `Kein Versuch ist Phase ${activePhase.code} zugeordnet — weder über einen Partner aus dieser Phase${
                    phaseRunWindow?.hasWindow ? " noch über den hinterlegten Phasenzeitraum" : " (für die Phase ist kein Zeitraum hinterlegt)"
                  }.`
                : `In den nächsten ${RUN_HORIZON_DAYS} Tagen ist kein Versuch terminiert.`
            }
          >
            <div className="overflow-x-auto">
              <Table className="min-w-[38rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[7rem]">Lauf</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead className="w-[8rem]">Linie</TableHead>
                    <TableHead className="w-[7rem]">Termin</TableHead>
                    <TableHead className="w-[7rem]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingRuns.map((run) => {
                    const date = runDateOf(run);
                    const time = timeOf(date);
                    const overdue = run.status === "planned" && time !== null && time < Date.now();
                    return (
                      <TableRow key={run.id}>
                        <TableCell className="font-mono text-xs">{run.run_code}</TableCell>
                        <TableCell>
                          <div className="min-w-[12rem]">
                            <p className="text-sm font-medium leading-tight">{run.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {run.machine_name ?? "Maschine offen"}
                              {run.input_weight_kg !== null
                                ? ` · Einsatz ${formatKg(run.input_weight_kg)}`
                                : ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {labelOf(PROCESS_LINES, run.process_line)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <span className={cn(overdue && "font-semibold text-destructive")}>
                            {formatDate(date)}
                          </span>
                          {overdue && (
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-destructive">
                              <CalendarClock className="h-3 w-3" />
                              überfällig
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ToneBadge tone={toneOf(TEST_RUN_STATUSES, run.status)}>
                            {labelOf(TEST_RUN_STATUSES, run.status)}
                          </ToneBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </AsyncSection>
        </WidgetCard>

        {/* 8 — Neueste Analyseergebnisse */}
        <WidgetCard
          title="Neueste Analyseergebnisse"
          description="Die letzten 8 Messwerte mit Spec-Bewertung"
          icon={Beaker}
          to="/projekt/analytik"
          linkLabel="Analytik"
          className="lg:col-span-2"
        >
          <AsyncSection
            queries={[resultsQuery, analysesQuery, fractionsQuery, specsQuery]}
            isEmpty={latestResults.length === 0}
            emptyTitle="Noch keine Messwerte"
            emptyDescription="Sobald ein Labor Ergebnisse liefert, erscheinen die Werte hier mit Spec-Bewertung."
            emptyAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/projekt/analytik">Analyse beauftragen</Link>
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <Table className="min-w-[40rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[9rem]">Fraktion</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead className="w-[7rem] text-right">Wert</TableHead>
                    <TableHead className="w-[8rem]">Sollfenster</TableHead>
                    <TableHead className="w-[8rem]">Bewertung</TableHead>
                    <TableHead className="w-[6.5rem]">Gemessen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestResults.map(({ result, analysis, fraction, verdict, level }) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        <p className="font-mono text-xs">{fraction?.fraction_code ?? "—"}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {analysis?.analysis_code ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="min-w-[9rem] text-sm leading-tight">{verdict.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{verdict.note}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-semibold">
                        {result.value_numeric !== null
                          ? `${formatNumber(result.value_numeric)} ${result.unit ?? verdict.unit}`.trim()
                          : result.value_text ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {specWindowLabel(verdict.specMin, verdict.specMax)}
                      </TableCell>
                      <TableCell>
                        <ConformityBadge level={level} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(result.measured_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AsyncSection>
        </WidgetCard>

        {/* 9 — Partner-Pipeline */}
        <WidgetCard
          title="Partner-Pipeline"
          description={
            loaded(partnersQuery) ? `${formatNumber(partnerTotal, 0)} Partner nach Status` : "Partner nach Status"
          }
          icon={Users}
          to="/projekt/partner"
          linkLabel="Partner"
        >
          <AsyncSection
            queries={[partnersQuery]}
            isEmpty={partnerPipeline.length === 0}
            emptyTitle="Keine Partner erfasst"
            emptyDescription="Maschinenhersteller, Labore und Materiallieferanten werden hier zusammengefasst."
            emptyAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/projekt/partner">Partner anlegen</Link>
              </Button>
            }
          >
            <div className="h-[11rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={partnerPipeline}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {partnerPipeline.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      `${formatNumber(typeof value === "number" ? value : null, 0)} Partner`,
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1.5">
              {partnerPipeline.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: entry.color }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  <span className="font-semibold">{formatNumber(entry.value, 0)}</span>
                  <span className="w-10 text-right text-muted-foreground">
                    {partnerTotal > 0 ? `${Math.round((entry.value / partnerTotal) * 100)} %` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </AsyncSection>
        </WidgetCard>

        {/* 10 — Top-Risiken */}
        <WidgetCard
          title="Top-Risiken"
          description={
            activePhase
              ? `Höchste Schwere in Phase ${activePhase.code}`
              : "Die drei Risiken mit der höchsten Schwere (Eintritt × Auswirkung)"
          }
          icon={AlertTriangle}
          to="/projekt/risiken"
          linkLabel="Alle Risiken"
          className="lg:col-span-3"
        >
          <AsyncSection
            queries={[risksQuery]}
            isEmpty={topRisks.length === 0}
            emptyTitle="Keine Risiken erfasst"
            emptyDescription={
              activePhase
                ? `Für Phase ${activePhase.code} ist kein Risiko hinterlegt.`
                : "Technische, wirtschaftliche und Schutzrechtsrisiken werden hier priorisiert."
            }
            emptyAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/projekt/risiken">Risiko anlegen</Link>
              </Button>
            }
          >
            <div className="grid gap-3 md:grid-cols-3">
              {topRisks.map((risk) => (
                <div key={risk.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold leading-tight">{risk.title}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-xs font-bold",
                        SEVERITY_BADGE_CLASSES[severityTone(riskSeverity(risk))],
                      )}
                    >
                      {formatNumber(riskSeverity(risk), 0)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labelOf(RISK_CATEGORIES, risk.category)} · Eintritt{" "}
                    {formatNumber(risk.probability, 0)} · Auswirkung {formatNumber(risk.impact, 0)}
                  </p>
                  {risk.description && (
                    <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{risk.description}</p>
                  )}
                  {risk.mitigation_plan && (
                    <p className="mt-2 line-clamp-2 text-xs">
                      <span className="font-medium">Maßnahme: </span>
                      {risk.mitigation_plan}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Status: {RISK_STATUS_LABELS[risk.status] ?? risk.status}
                    {risk.owner ? ` · ${risk.owner}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </AsyncSection>
        </WidgetCard>
      </div>
    </div>
  );
}
