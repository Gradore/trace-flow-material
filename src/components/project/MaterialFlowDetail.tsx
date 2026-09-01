/**
 * Detail panel for a single node of the material flow: the record itself, its
 * direct neighbours (one click away) and a link to the page that manages it.
 */
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, ExternalLink, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ToneBadge, formatDate } from "@/components/project/ProjectUI";
import {
  STAGE_META,
  formatMass,
  type FlowGraph,
  type FlowNode,
} from "@/components/project/MaterialFlowShared";

interface DetailProps {
  graph: FlowGraph;
  nodeId: string | null;
  isMobile: boolean;
  isTraced: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (nodeId: string) => void;
  onTrace: (nodeId: string) => void;
  onClearTrace: () => void;
}

function NeighbourButton({
  node,
  direction,
  onSelect,
}: {
  node: FlowNode;
  direction: "up" | "down";
  onSelect: (nodeId: string) => void;
}) {
  const stage = STAGE_META[node.stage];
  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="w-full text-left rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: stage.color }} aria-hidden />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">{stage.short}</span>
        <span className="text-sm font-semibold truncate">{node.code}</span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <span className="text-xs text-muted-foreground truncate">{node.title}</span>
        <span className="text-xs tabular-nums shrink-0">{formatMass(node.massKg, node.massEstimated)}</span>
      </div>
    </button>
  );
}

export function MaterialFlowDetail({
  graph,
  nodeId,
  isMobile,
  isTraced,
  onOpenChange,
  onSelect,
  onTrace,
  onClearTrace,
}: DetailProps) {
  const node = nodeId ? graph.byId.get(nodeId) ?? null : null;
  const stage = node ? STAGE_META[node.stage] : null;

  const parent = node?.parentId ? graph.byId.get(node.parentId) ?? null : null;
  const children = node
    ? node.childIds
        .map((id) => graph.byId.get(id))
        .filter((child): child is FlowNode => Boolean(child))
        .sort((a, b) => a.seq - b.seq)
    : [];

  return (
    <Sheet open={Boolean(node)} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "overflow-y-auto p-4 sm:p-6",
          isMobile ? "h-[88vh] rounded-t-xl" : "w-full sm:max-w-md",
        )}
      >
        {node && stage && (
          <>
            <SheetHeader className="text-left pr-8">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: stage.color }} aria-hidden />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{stage.label}</span>
              </div>
              <SheetTitle className="text-lg break-words">{node.code}</SheetTitle>
              <SheetDescription className="break-words">{node.title}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {node.statusLabel && <ToneBadge tone={node.statusTone}>{node.statusLabel}</ToneBadge>}
              <ToneBadge tone="muted">{formatMass(node.massKg, node.massEstimated)}</ToneBadge>
              {node.date && <ToneBadge tone="muted">{formatDate(node.date)}</ToneBadge>}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button
                type="button"
                size="sm"
                variant={isTraced ? "secondary" : "default"}
                className="gap-2"
                onClick={() => (isTraced ? onClearTrace() : onTrace(node.id))}
              >
                <Route className="h-4 w-4" />
                {isTraced ? "Rückverfolgung aufheben" : "Kette zurückverfolgen"}
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link to={stage.route}>
                  <ExternalLink className="h-4 w-4" />
                  {stage.routeLabel}
                </Link>
              </Button>
            </div>

            <Separator className="my-4" />

            <dl className="space-y-2">
              {node.meta.map((row) => (
                <div key={row.label} className="grid grid-cols-[9rem_1fr] gap-2 text-sm">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="break-words">{row.value}</dd>
                </div>
              ))}
            </dl>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vorgänger</p>
                {parent ? (
                  <NeighbourButton node={parent} direction="up" onSelect={onSelect} />
                ) : (
                  <p className="text-sm text-muted-foreground">Kein Vorgänger erfasst — Kettenanfang.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Nachfolger {children.length > 0 && `(${children.length})`}
                </p>
                {children.length ? (
                  <div className="space-y-2">
                    {children.map((child) => (
                      <NeighbourButton key={child.id} node={child} direction="down" onSelect={onSelect} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Nachfolger erfasst — Kettenende.</p>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
