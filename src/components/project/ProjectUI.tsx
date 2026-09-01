import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { CONFORMITY_META, type ConformityLevel } from "@/lib/project/spec";
import type { Phase } from "@/lib/project/types";

const TONE_CLASSES: Record<string, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  info: "bg-info/10 text-info border-info/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  muted: "bg-muted text-muted-foreground border-border",
};

export function ToneBadge({ tone, children, className }: { tone: string; children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn(TONE_CLASSES[tone] ?? TONE_CLASSES.muted, "font-medium", className)}>
      {children}
    </Badge>
  );
}

export function ConformityBadge({ level, className }: { level: ConformityLevel; className?: string }) {
  const meta = CONFORMITY_META[level];
  return (
    <Badge variant="outline" className={cn(meta.className, "font-medium gap-1.5", className)}>
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </Badge>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
}

export function ProjectPageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="h-10 w-10 rounded-lg bg-violet-400/15 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-violet-400" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function PhaseStepper({
  phases,
  activeCode,
  onSelect,
}: {
  phases: Phase[];
  activeCode: string | null;
  onSelect: (code: string | null) => void;
}) {
  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success text-success-foreground border-success";
      case "in_progress": return "bg-info text-info-foreground border-info";
      case "blocked": return "bg-destructive text-destructive-foreground border-destructive";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex items-stretch gap-1 min-w-max pb-1">
        {phases.map((phase, index) => {
          const isActive = activeCode === phase.code;
          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => onSelect(isActive ? null : phase.code)}
              aria-pressed={isActive}
              className={cn(
                "group flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-left transition-all min-w-[8.5rem]",
                isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-6 w-6 rounded-full border flex items-center justify-center text-[11px] font-bold", statusColor(phase.status))}>
                  {index}
                </span>
                <span className="text-xs font-semibold">{phase.code}</span>
              </div>
              <span className="text-xs text-muted-foreground leading-tight line-clamp-2">{phase.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground max-w-md">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </CardContent>
    </Card>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Daten konnten nicht geladen werden</AlertTitle>
      <AlertDescription className="text-sm">
        {error.message}
        {onRetry && (
          <button type="button" onClick={onRetry} className="ml-2 underline underline-offset-2">
            Erneut versuchen
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "violet",
  to,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "violet" | "emerald" | "amber" | "sky" | "rose" | "teal";
  to?: string;
}) {
  const accents: Record<string, string> = {
    violet: "bg-violet-400/15 text-violet-400",
    emerald: "bg-emerald-400/15 text-emerald-400",
    amber: "bg-amber-400/15 text-amber-400",
    sky: "bg-sky-400/15 text-sky-400",
    rose: "bg-rose-400/15 text-rose-400",
    teal: "bg-teal-400/15 text-teal-400",
  };

  const body = (
    <Card className={cn("h-full transition-shadow", to && "hover:shadow-md")}>
      <CardContent className="p-4 flex items-start gap-3">
        {Icon && (
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", accents[accent])}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {/* div, not p: callers pass a Skeleton (a div) while loading */}
          <div className="text-xl font-bold leading-tight">{value}</div>
          {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );

  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} kg`;
}

export function formatEur(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Minimal markdown rendering for AI output - headings, lists, bold, code. */
export function Markdown({ content, className }: { content: string; className?: string }) {
  const blocks = content.split("\n");
  return (
    <div className={cn("space-y-1.5 text-sm leading-relaxed", className)}>
      {blocks.map((line, i) => {
        const key = `${i}-${line.slice(0, 12)}`;
        if (!line.trim()) return <div key={key} className="h-1.5" />;
        if (line.startsWith("### ")) return <h4 key={key} className="font-semibold mt-3">{inline(line.slice(4))}</h4>;
        if (line.startsWith("## ")) return <h3 key={key} className="font-semibold text-base mt-3">{inline(line.slice(3))}</h3>;
        if (line.startsWith("# ")) return <h2 key={key} className="font-bold text-lg mt-3">{inline(line.slice(2))}</h2>;
        if (/^\s*[-*]\s+/.test(line)) {
          return (
            <div key={key} className="flex gap-2 pl-1">
              <span className="text-muted-foreground shrink-0">•</span>
              <span>{inline(line.replace(/^\s*[-*]\s+/, ""))}</span>
            </div>
          );
        }
        if (/^\s*\d+\.\s+/.test(line)) {
          const [, num, rest] = line.match(/^\s*(\d+)\.\s+(.*)$/) ?? [];
          return (
            <div key={key} className="flex gap-2 pl-1">
              <span className="text-muted-foreground shrink-0 font-medium">{num}.</span>
              <span>{inline(rest ?? "")}</span>
            </div>
          );
        }
        if (line.trim().startsWith("|")) {
          return <div key={key} className="font-mono text-xs text-muted-foreground overflow-x-auto">{line}</div>;
        }
        return <p key={key}>{inline(line)}</p>;
      })}
    </div>
  );
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${i}-${part.slice(0, 8)}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return <span key={key}>{part}</span>;
  });
}
