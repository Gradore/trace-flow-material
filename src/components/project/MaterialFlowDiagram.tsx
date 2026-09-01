/**
 * Hand drawn sankey diagram of the traceability chain.
 *
 * Seven fixed columns (Lieferant … Kunde), node height proportional to the
 * mass in kg, links drawn as bezier ribbons whose thickness is proportional to
 * the transferred mass. The layout is computed here - no chart library is
 * involved, recharts cannot draw a sankey.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  FLOW_STAGES,
  STAGE_META,
  formatMass,
  type FlowGraph,
  type FlowLink,
  type FlowNode,
  type FlowVisibility,
  type TraceResult,
} from "@/components/project/MaterialFlowShared";

const VIEW_WIDTH = 1180;
const COLUMN_WIDTH = VIEW_WIDTH / FLOW_STAGES.length;
const NODE_WIDTH = 14;
const NODE_GAP = 16;
const MIN_NODE_HEIGHT = 14;
const MIN_BAND = 2.5;
const BASE_HEIGHT = 520;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

interface PlacedNode {
  node: FlowNode;
  x: number;
  y: number;
  width: number;
  height: number;
  inKg: number;
  outKg: number;
}

interface PlacedLink {
  link: FlowLink;
  path: string;
  color: string;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

interface DiagramProps {
  graph: FlowGraph;
  visible: FlowVisibility;
  trace: TraceResult | null;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}

export function MaterialFlowDiagram({ graph, visible, trace, selectedId, onSelect }: DiagramProps) {
  const layout = useMemo(() => {
    const nodes = graph.nodes.filter((node) => visible.nodeIds.has(node.id));
    const links = graph.links.filter((link) => visible.linkIds.has(link.id));

    const inKg = new Map<string, number>();
    const outKg = new Map<string, number>();
    for (const link of links) {
      inKg.set(link.targetId, (inKg.get(link.targetId) ?? 0) + link.kg);
      outKg.set(link.sourceId, (outKg.get(link.sourceId) ?? 0) + link.kg);
    }

    const massOf = (node: FlowNode) =>
      Math.max(node.massKg, inKg.get(node.id) ?? 0, outKg.get(node.id) ?? 0, 0);

    // one scale for the whole diagram - the tightest column decides
    let scale = Number.POSITIVE_INFINITY;
    FLOW_STAGES.forEach((stage) => {
      const columnNodes = nodes.filter((node) => node.stage === stage.id);
      if (!columnNodes.length) return;
      const columnMass = columnNodes.reduce((acc, node) => acc + massOf(node), 0);
      if (columnMass <= 0) return;
      const available = BASE_HEIGHT - (columnNodes.length - 1) * NODE_GAP - columnNodes.length * MIN_NODE_HEIGHT;
      if (available <= 0) return;
      scale = Math.min(scale, available / columnMass);
    });
    if (!Number.isFinite(scale) || scale <= 0) scale = 0.5;

    const bandOf = (link: FlowLink) => Math.max(MIN_BAND, link.kg * scale);

    const placed = new Map<string, PlacedNode>();
    let maxColumnHeight = 0;

    FLOW_STAGES.forEach((stage, columnIndex) => {
      const columnNodes = nodes
        .filter((node) => node.stage === stage.id)
        .sort((a, b) => a.seq - b.seq);

      let cursor = PAD_TOP;
      for (const node of columnNodes) {
        const inBands = links.filter((link) => link.targetId === node.id).reduce((acc, link) => acc + bandOf(link), 0);
        const outBands = links.filter((link) => link.sourceId === node.id).reduce((acc, link) => acc + bandOf(link), 0);
        const height = Math.max(MIN_NODE_HEIGHT, massOf(node) * scale, inBands, outBands);
        placed.set(node.id, {
          node,
          x: columnIndex * COLUMN_WIDTH + 10,
          y: cursor,
          width: NODE_WIDTH,
          height,
          inKg: inKg.get(node.id) ?? 0,
          outKg: outKg.get(node.id) ?? 0,
        });
        cursor += height + NODE_GAP;
      }
      maxColumnHeight = Math.max(maxColumnHeight, cursor - NODE_GAP);
    });

    // ribbons: allocate bands top to bottom, ordered by the opposite endpoint
    const yOf = (id: string) => placed.get(id)?.y ?? 0;
    const sourceCursor = new Map<string, number>();
    const targetCursor = new Map<string, number>();
    const orderedLinks = [...links].sort((a, b) => yOf(a.sourceId) - yOf(b.sourceId) || yOf(a.targetId) - yOf(b.targetId));

    const placedLinks: PlacedLink[] = [];
    for (const link of orderedLinks) {
      const source = placed.get(link.sourceId);
      const target = placed.get(link.targetId);
      if (!source || !target) continue;
      const band = bandOf(link);

      const sourceOffset = sourceCursor.get(link.sourceId) ?? 0;
      const targetOffset = targetCursor.get(link.targetId) ?? 0;
      sourceCursor.set(link.sourceId, sourceOffset + band);
      targetCursor.set(link.targetId, targetOffset + band);

      const sx = source.x + source.width;
      const sy0 = source.y + sourceOffset;
      const sy1 = sy0 + band;
      const tx = target.x;
      const ty0 = target.y + targetOffset;
      const ty1 = ty0 + band;
      const cx = (sx + tx) / 2;

      placedLinks.push({
        link,
        color: STAGE_META[source.node.stage].color,
        path:
          `M ${sx.toFixed(1)} ${sy0.toFixed(1)} ` +
          `C ${cx.toFixed(1)} ${sy0.toFixed(1)}, ${cx.toFixed(1)} ${ty0.toFixed(1)}, ${tx.toFixed(1)} ${ty0.toFixed(1)} ` +
          `L ${tx.toFixed(1)} ${ty1.toFixed(1)} ` +
          `C ${cx.toFixed(1)} ${ty1.toFixed(1)}, ${cx.toFixed(1)} ${sy1.toFixed(1)}, ${sx.toFixed(1)} ${sy1.toFixed(1)} Z`,
      });
    }

    return {
      nodes: [...placed.values()],
      links: placedLinks,
      height: Math.max(BASE_HEIGHT, maxColumnHeight) + PAD_BOTTOM,
      counts: FLOW_STAGES.map((stage) => nodes.filter((node) => node.stage === stage.id).length),
    };
  }, [graph, visible]);

  const dimmed = (id: string) => Boolean(trace) && !trace?.nodeIds.has(id);

  return (
    <div className="overflow-x-auto">
      <div style={{ width: VIEW_WIDTH }} className="mx-auto">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${FLOW_STAGES.length}, minmax(0, 1fr))` }}>
          {FLOW_STAGES.map((stage, index) => (
            <div key={stage.id} className="pl-2.5 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: stage.color }} aria-hidden />
                <span className="text-xs font-semibold truncate">{stage.label}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {layout.counts[index]} {layout.counts[index] === 1 ? "Eintrag" : "Einträge"}
              </span>
            </div>
          ))}
        </div>

        <svg
          width={VIEW_WIDTH}
          height={layout.height}
          viewBox={`0 0 ${VIEW_WIDTH} ${layout.height}`}
          role="img"
          aria-label="Materialfluss von Lieferant bis Kunde"
          className="block"
        >
          {FLOW_STAGES.map((stage, index) => (
            <rect
              key={stage.id}
              x={index * COLUMN_WIDTH}
              y={0}
              width={COLUMN_WIDTH}
              height={layout.height}
              fill={index % 2 === 0 ? "hsl(var(--muted) / 0.25)" : "transparent"}
            />
          ))}

          <g style={{ pointerEvents: "none" }}>
            {layout.links.map((entry) => {
              const isDim = Boolean(trace) && !trace?.linkIds.has(entry.link.id);
              return (
                <path
                  key={entry.link.id}
                  d={entry.path}
                  fill={entry.color}
                  fillOpacity={isDim ? 0.06 : trace ? 0.5 : 0.28}
                  stroke={entry.color}
                  strokeOpacity={isDim ? 0.05 : 0.25}
                  strokeWidth={0.5}
                />
              );
            })}
          </g>

          {layout.nodes.map((entry) => {
            const stage = STAGE_META[entry.node.stage];
            const isDim = dimmed(entry.node.id);
            const isSelected = selectedId === entry.node.id;
            const isTraceRoot = trace?.rootId === entry.node.id;
            const labelX = entry.x + entry.width + 6;
            const centerY = entry.y + entry.height / 2;
            const massLabel = formatMass(
              Math.max(entry.node.massKg, entry.inKg, entry.outKg),
              entry.node.massEstimated,
            );
            return (
              <g
                key={entry.node.id}
                role="button"
                tabIndex={0}
                aria-label={`${stage.label} ${entry.node.code}, ${massLabel}`}
                className="cursor-pointer focus:outline-none"
                opacity={isDim ? 0.16 : 1}
                onClick={() => onSelect(entry.node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(entry.node.id);
                  }
                }}
              >
                <title>{`${stage.label}: ${entry.node.code}\n${entry.node.title}\n${massLabel}`}</title>
                <rect
                  x={entry.x - 4}
                  y={entry.y - 3}
                  width={COLUMN_WIDTH - 12}
                  height={entry.height + 6}
                  fill={isSelected || isTraceRoot ? "hsl(var(--foreground) / 0.06)" : "transparent"}
                  rx={4}
                />
                <rect
                  x={entry.x}
                  y={entry.y}
                  width={entry.width}
                  height={entry.height}
                  rx={3}
                  fill={stage.color}
                  stroke={isSelected || isTraceRoot ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                  strokeWidth={isSelected || isTraceRoot ? 1.5 : 0.75}
                />
                <text
                  x={labelX}
                  y={centerY - 1}
                  fontSize={11}
                  fontWeight={600}
                  fill="hsl(var(--foreground))"
                >
                  {truncate(entry.node.code, 18)}
                </text>
                <text x={labelX} y={centerY + 10} fontSize={9.5} fill="hsl(var(--muted-foreground))">
                  {truncate(massLabel, 20)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function MaterialFlowLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground", className)}>
      {FLOW_STAGES.map((stage) => (
        <span key={stage.id} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: stage.color }} aria-hidden />
          {stage.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="font-mono">≈</span> geschätzte Menge (nicht erfasstes Gewicht)
      </span>
    </div>
  );
}
