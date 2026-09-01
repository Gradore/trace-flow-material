/**
 * Mobile fallback for the sankey diagram: the same chains as a vertical
 * timeline. One card per chain root (usually a supplier), the descendants
 * indented below it - readable at 360 px without any horizontal scrolling.
 */
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ToneBadge, formatDate } from "@/components/project/ProjectUI";
import {
  STAGE_META,
  formatMass,
  type FlowGraph,
  type FlowNode,
  type FlowVisibility,
  type TraceResult,
} from "@/components/project/MaterialFlowShared";

interface TimelineProps {
  graph: FlowGraph;
  visible: FlowVisibility;
  trace: TraceResult | null;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}

export function MaterialFlowTimeline({ graph, visible, trace, selectedId, onSelect }: TimelineProps) {
  const isVisible = (node: FlowNode) => visible.nodeIds.has(node.id);

  const childrenOf = (node: FlowNode): FlowNode[] =>
    node.childIds
      .map((id) => graph.byId.get(id))
      .filter((child): child is FlowNode => Boolean(child) && child.parentId === node.id && isVisible(child))
      .sort((a, b) => a.seq - b.seq);

  const roots = graph.nodes
    .filter((node) => {
      if (!isVisible(node)) return false;
      if (!node.parentId) return true;
      const parent = graph.byId.get(node.parentId);
      return !parent || !isVisible(parent);
    })
    .sort((a, b) => a.seq - b.seq);

  const renderRow = (node: FlowNode, depth: number) => {
    const stage = STAGE_META[node.stage];
    const dimmed = Boolean(trace) && !trace?.nodeIds.has(node.id);
    const selected = selectedId === node.id;
    const children = childrenOf(node);

    return (
      <div key={node.id} style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
        <div className={cn(depth > 0 && "border-l border-border pl-3")}>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            aria-label={`${stage.label} ${node.code} öffnen`}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2 transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              dimmed && "opacity-40",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: stage.color }} aria-hidden />
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">{stage.short}</span>
              <span className="font-semibold text-sm truncate">{node.code}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{node.title}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs font-medium tabular-nums">{formatMass(node.massKg, node.massEstimated)}</span>
              {node.statusLabel && (
                <ToneBadge tone={node.statusTone} className="text-[10px] px-1.5 py-0">
                  {node.statusLabel}
                </ToneBadge>
              )}
              {node.date && <span className="text-[11px] text-muted-foreground">{formatDate(node.date)}</span>}
            </div>
          </button>
          {children.length > 0 && <div className="mt-2 space-y-2">{children.map((child) => renderRow(child, depth + 1))}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {roots.map((root) => (
        <Card key={root.id}>
          <CardContent className="p-3">{renderRow(root, 0)}</CardContent>
        </Card>
      ))}
    </div>
  );
}
