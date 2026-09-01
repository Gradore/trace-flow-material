/**
 * Material flow / traceability model.
 *
 * The whole chain of the GFK project is a forest: a supplier delivers batches,
 * a batch feeds test runs, a run produces output fractions, a fraction is
 * split into lab samples (analytics) and material for product tests, and a
 * product test belongs to a customer. Every record therefore has at most one
 * parent, which makes both the layout and the backward traceability trivial:
 * walking up the parent chain reaches the originating batch, walking down the
 * children reaches the product tests.
 *
 * Mass bookkeeping: only weights that are actually recorded in the database
 * are treated as exact. Everything that has to be derived (a run without a
 * recorded input weight, the share of a fraction that went into one of several
 * product tests) is flagged as `estimated` and rendered with a "≈".
 */
import {
  ANALYSIS_STATUSES,
  BATCH_STATUSES,
  FRACTION_STATUSES,
  MATERIAL_CLASSES,
  PARTNER_CATEGORIES,
  PRODUCT_TEST_CATEGORIES,
  PROCESS_LINES,
  TEST_RUN_STATUSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import { formatDate, formatEur, formatKg, formatNumber } from "@/components/project/ProjectUI";
import type {
  FractionAnalysis,
  FractionSpec,
  MaterialBatch,
  OutputFraction,
  Partner,
  ProductTest,
  TestRun,
} from "@/lib/project/types";

/* ------------------------------------------------------------------ stages */

export type FlowStageId =
  | "supplier"
  | "batch"
  | "run"
  | "fraction"
  | "analysis"
  | "product_test"
  | "customer";

export interface FlowStageMeta {
  id: FlowStageId;
  label: string;
  short: string;
  color: string;
  /** Where the records of this stage are managed. */
  route: string;
  routeLabel: string;
  /** No successor stage - the mass ends here (lab sample, delivered material). */
  terminal: boolean;
}

export const FLOW_STAGES: readonly FlowStageMeta[] = [
  {
    id: "supplier",
    label: "Lieferant",
    short: "Lieferant",
    color: "hsl(var(--muted-foreground))",
    route: "/projekt/partner",
    routeLabel: "Zu den Partnern",
    terminal: false,
  },
  {
    id: "batch",
    label: "Materialcharge",
    short: "Charge",
    color: "hsl(var(--warning))",
    route: "/projekt/chargen",
    routeLabel: "Zu den Materialchargen",
    terminal: false,
  },
  {
    id: "run",
    label: "Versuchslauf",
    short: "Versuch",
    color: "hsl(var(--primary))",
    route: "/projekt/versuche",
    routeLabel: "Zu den Versuchsläufen",
    terminal: false,
  },
  {
    id: "fraction",
    label: "Ausgangsfraktion",
    short: "Fraktion",
    color: "hsl(var(--success))",
    route: "/projekt/fraktionen",
    routeLabel: "Zu den Fraktionen",
    terminal: false,
  },
  {
    id: "analysis",
    label: "Analytik",
    short: "Analytik",
    color: "hsl(var(--info))",
    route: "/projekt/analytik",
    routeLabel: "Zur Analytik",
    terminal: true,
  },
  {
    id: "product_test",
    label: "Produkttest",
    short: "Produkttest",
    color: "hsl(var(--accent))",
    route: "/projekt/produkttests",
    routeLabel: "Zu den Produkttests",
    terminal: false,
  },
  {
    id: "customer",
    label: "Kunde",
    short: "Kunde",
    color: "hsl(var(--muted-foreground))",
    route: "/projekt/partner",
    routeLabel: "Zu den Partnern",
    terminal: true,
  },
] as const;

export const STAGE_META: Record<FlowStageId, FlowStageMeta> = FLOW_STAGES.reduce(
  (acc, stage) => {
    acc[stage.id] = stage;
    return acc;
  },
  {} as Record<FlowStageId, FlowStageMeta>,
);

/** Losses above this threshold are shown as a warning. */
export const LOSS_WARNING_PCT = 15;

/* ------------------------------------------------------------------- model */

export interface FlowMetaRow {
  label: string;
  value: string;
}

export interface FlowNode {
  id: string;
  stage: FlowStageId;
  recordId: string;
  /** Short code shown in the diagram (run code, batch code, partner name …). */
  code: string;
  /** Longer description shown in lists and in the detail panel. */
  title: string;
  massKg: number;
  massEstimated: boolean;
  statusLabel: string | null;
  statusTone: string;
  date: string | null;
  parentId: string | null;
  childIds: string[];
  meta: FlowMetaRow[];
  /** Partners referenced by this record itself. */
  partnerIds: string[];
  materialClass: string | null;
  targetFractionId: string | null;
  /** Depth-first order - used to stack the nodes of a column. */
  seq: number;
}

export interface FlowLink {
  id: string;
  sourceId: string;
  targetId: string;
  kg: number;
  estimated: boolean;
}

export interface FlowGraph {
  nodes: FlowNode[];
  links: FlowLink[];
  byId: Map<string, FlowNode>;
  linksBySource: Map<string, FlowLink[]>;
  linksByTarget: Map<string, FlowLink[]>;
}

export interface FlowGraphInput {
  partners: Partner[];
  batches: MaterialBatch[];
  runs: TestRun[];
  fractions: OutputFraction[];
  analyses: FractionAnalysis[];
  productTests: ProductTest[];
  specs: FractionSpec[];
}

const nodeId = (stage: FlowStageId, recordId: string) => `${stage}:${recordId}`;

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

/** Builds the complete traceability forest from the project records. */
export function buildFlowGraph(input: FlowGraphInput): FlowGraph {
  const { partners, batches, runs, fractions, analyses, productTests, specs } = input;

  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  const specById = new Map(specs.map((spec) => [spec.id, spec]));
  const partnerName = (id: string | null): string =>
    (id ? partnerById.get(id)?.name : null) ?? "Unbekannter Partner";

  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  const byId = new Map<string, FlowNode>();

  const push = (node: FlowNode) => {
    nodes.push(node);
    byId.set(node.id, node);
  };
  const connect = (sourceId: string, targetId: string, kg: number, estimated: boolean) => {
    if (!byId.has(sourceId) || !byId.has(targetId)) return;
    links.push({ id: `${sourceId}->${targetId}`, sourceId, targetId, kg: Math.max(0, kg), estimated });
  };

  /* --- suppliers ------------------------------------------------------- */
  const batchesBySupplier = new Map<string, MaterialBatch[]>();
  for (const batch of batches) {
    if (!batch.supplier_partner_id) continue;
    const list = batchesBySupplier.get(batch.supplier_partner_id) ?? [];
    list.push(batch);
    batchesBySupplier.set(batch.supplier_partner_id, list);
  }
  for (const [supplierId, supplierBatches] of batchesBySupplier) {
    const partner = partnerById.get(supplierId) ?? null;
    push({
      id: nodeId("supplier", supplierId),
      stage: "supplier",
      recordId: supplierId,
      code: partner?.name ?? "Unbekannter Lieferant",
      title: partner?.name ?? "Unbekannter Lieferant",
      massKg: sum(supplierBatches.map((batch) => batch.weight_kg)),
      massEstimated: false,
      statusLabel: partner ? labelOf(PARTNER_CATEGORIES, partner.category) : null,
      statusTone: partner?.is_fixed_partner ? "success" : "muted",
      date: null,
      parentId: null,
      childIds: [],
      meta: [
        { label: "Kategorie", value: partner ? labelOf(PARTNER_CATEGORIES, partner.category) : "—" },
        { label: "Ort", value: partner?.city ? `${partner.postal_code ?? ""} ${partner.city}`.trim() : "—" },
        { label: "E-Mail", value: partner?.email ?? "—" },
        { label: "Telefon", value: partner?.phone ?? "—" },
        { label: "Chargen", value: `${supplierBatches.length}` },
        { label: "Geliefert", value: formatKg(sum(supplierBatches.map((b) => b.weight_kg))) },
      ],
      partnerIds: [supplierId],
      materialClass: null,
      targetFractionId: null,
      seq: 0,
    });
  }

  /* --- batches --------------------------------------------------------- */
  for (const batch of batches) {
    const materialClass = MATERIAL_CLASSES.find((entry) => entry.id === batch.material_class);
    push({
      id: nodeId("batch", batch.id),
      stage: "batch",
      recordId: batch.id,
      code: batch.batch_code,
      title: materialClass ? `${materialClass.id} — ${materialClass.label}` : batch.material_class,
      massKg: batch.weight_kg,
      massEstimated: false,
      statusLabel: labelOf(BATCH_STATUSES, batch.status),
      statusTone: toneOf(BATCH_STATUSES, batch.status),
      date: batch.received_date,
      parentId: batch.supplier_partner_id ? nodeId("supplier", batch.supplier_partner_id) : null,
      childIds: [],
      meta: [
        { label: "Materialklasse", value: materialClass ? `${materialClass.id} — ${materialClass.label}` : batch.material_class },
        { label: "Harztyp", value: batch.resin_type ?? "—" },
        { label: "Gewicht", value: formatKg(batch.weight_kg) },
        { label: "Wareneingang", value: formatDate(batch.received_date) },
        { label: "Lieferant", value: partnerName(batch.supplier_partner_id) },
        { label: "Faseranteil (deklariert)", value: batch.declared_fiber_content_pct !== null ? `${formatNumber(batch.declared_fiber_content_pct, 1)} %` : "—" },
        { label: "Füllstoff", value: batch.declared_filler ?? "—" },
        { label: "Lagerort", value: batch.storage_location ?? "—" },
        { label: "Verunreinigungen", value: batch.contamination_notes ?? "—" },
      ],
      partnerIds: batch.supplier_partner_id ? [batch.supplier_partner_id] : [],
      materialClass: batch.material_class,
      targetFractionId: null,
      seq: 0,
    });
    if (batch.supplier_partner_id) {
      connect(nodeId("supplier", batch.supplier_partner_id), nodeId("batch", batch.id), batch.weight_kg, false);
    }
  }

  /* --- runs ------------------------------------------------------------ */
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const runsByBatch = new Map<string, TestRun[]>();
  for (const run of runs) {
    if (!run.input_batch_id) continue;
    const list = runsByBatch.get(run.input_batch_id) ?? [];
    list.push(run);
    runsByBatch.set(run.input_batch_id, list);
  }

  const fractionsByRun = new Map<string, OutputFraction[]>();
  for (const fraction of fractions) {
    if (!fraction.test_run_id) continue;
    const list = fractionsByRun.get(fraction.test_run_id) ?? [];
    list.push(fraction);
    fractionsByRun.set(fraction.test_run_id, list);
  }

  for (const run of runs) {
    const batch = run.input_batch_id ? batchById.get(run.input_batch_id) ?? null : null;
    const siblings = run.input_batch_id ? runsByBatch.get(run.input_batch_id)?.length ?? 1 : 1;
    const derivedInput = batch ? batch.weight_kg / siblings : null;
    const runFractions = fractionsByRun.get(run.id) ?? [];
    const inputKg = run.input_weight_kg ?? derivedInput ?? (runFractions.length ? sum(runFractions.map((f) => f.weight_kg)) : 0);
    const inputEstimated = run.input_weight_kg === null;
    const line = PROCESS_LINES.find((entry) => entry.id === run.process_line);

    push({
      id: nodeId("run", run.id),
      stage: "run",
      recordId: run.id,
      code: run.run_code,
      title: run.title,
      massKg: inputKg,
      massEstimated: inputEstimated,
      statusLabel: labelOf(TEST_RUN_STATUSES, run.status),
      statusTone: toneOf(TEST_RUN_STATUSES, run.status),
      date: run.actual_date ?? run.planned_date,
      parentId: batch ? nodeId("batch", batch.id) : null,
      childIds: [],
      meta: [
        { label: "Titel", value: run.title },
        { label: "Prozesslinie", value: line ? `${line.label} (${line.goal})` : run.process_line },
        { label: "Maschine", value: run.machine_name ?? "—" },
        { label: "Technikumspartner", value: partnerName(run.partner_id) },
        { label: "Einsatzcharge", value: batch?.batch_code ?? "—" },
        { label: "Einsatzmenge", value: run.input_weight_kg !== null ? formatKg(run.input_weight_kg) : "— (nicht erfasst)" },
        { label: "Termin", value: formatDate(run.actual_date ?? run.planned_date) },
        { label: "Kosten", value: formatEur(run.cost_eur) },
        { label: "Verantwortlich", value: run.responsible ?? "—" },
        { label: "Fazit", value: run.summary ?? "—" },
      ],
      partnerIds: run.partner_id ? [run.partner_id] : [],
      materialClass: batch?.material_class ?? null,
      targetFractionId: null,
      seq: 0,
    });

    if (batch) {
      connect(nodeId("batch", batch.id), nodeId("run", run.id), inputKg, inputEstimated);
    }
  }

  /* --- fractions ------------------------------------------------------- */
  const analysesByFraction = new Map<string, FractionAnalysis[]>();
  for (const analysis of analyses) {
    if (!analysis.output_fraction_id) continue;
    const list = analysesByFraction.get(analysis.output_fraction_id) ?? [];
    list.push(analysis);
    analysesByFraction.set(analysis.output_fraction_id, list);
  }
  const testsByFraction = new Map<string, ProductTest[]>();
  for (const test of productTests) {
    if (!test.output_fraction_id) continue;
    const list = testsByFraction.get(test.output_fraction_id) ?? [];
    list.push(test);
    testsByFraction.set(test.output_fraction_id, list);
  }

  const runById = new Map(runs.map((run) => [run.id, run]));

  for (const fraction of fractions) {
    const spec = fraction.target_fraction_id ? specById.get(fraction.target_fraction_id) ?? null : null;
    const run = fraction.test_run_id ? runById.get(fraction.test_run_id) ?? null : null;
    push({
      id: nodeId("fraction", fraction.id),
      stage: "fraction",
      recordId: fraction.id,
      code: fraction.fraction_code,
      title: spec ? `${spec.id} — ${spec.name}` : fraction.target_fraction_id ?? "Ohne Zielfraktion",
      massKg: fraction.weight_kg,
      massEstimated: false,
      statusLabel: labelOf(FRACTION_STATUSES, fraction.status),
      statusTone: toneOf(FRACTION_STATUSES, fraction.status),
      date: fraction.created_at,
      parentId: run ? nodeId("run", run.id) : null,
      childIds: [],
      meta: [
        { label: "Zielfraktion", value: spec ? `${spec.id} — ${spec.name}` : fraction.target_fraction_id ?? "—" },
        { label: "Anwendung", value: spec?.application ?? "—" },
        { label: "Menge", value: formatKg(fraction.weight_kg) },
        { label: "Ausbeute", value: fraction.yield_pct !== null ? `${formatNumber(fraction.yield_pct, 1)} %` : "—" },
        { label: "Rückstellprobe", value: fraction.retained_sample_kg !== null ? formatKg(fraction.retained_sample_kg) : "—" },
        { label: "Aus Versuch", value: run?.run_code ?? "—" },
        { label: "Lagerort", value: fraction.storage_location ?? "—" },
        { label: "Freigegeben für Produkttest", value: fraction.released_for_product_test ? "Ja" : "Nein" },
        { label: "Notizen", value: fraction.notes ?? "—" },
      ],
      partnerIds: [],
      materialClass: null,
      targetFractionId: fraction.target_fraction_id,
      seq: 0,
    });
    if (run) {
      connect(nodeId("run", run.id), nodeId("fraction", fraction.id), fraction.weight_kg, false);
    }
  }

  /* --- analytics ------------------------------------------------------- */
  const fractionById = new Map(fractions.map((fraction) => [fraction.id, fraction]));

  for (const analysis of analyses) {
    const fraction = analysis.output_fraction_id ? fractionById.get(analysis.output_fraction_id) ?? null : null;
    const siblings = fraction ? analysesByFraction.get(fraction.id)?.length ?? 1 : 1;
    const retained = fraction?.retained_sample_kg ?? null;
    const sampleKg = retained !== null ? retained / siblings : 0;
    push({
      id: nodeId("analysis", analysis.id),
      stage: "analysis",
      recordId: analysis.id,
      code: analysis.analysis_code,
      title: analysis.method ?? "Analytik",
      massKg: sampleKg,
      massEstimated: retained === null,
      statusLabel: labelOf(ANALYSIS_STATUSES, analysis.status),
      statusTone: toneOf(ANALYSIS_STATUSES, analysis.status),
      date: analysis.result_date ?? analysis.sample_sent_date,
      parentId: fraction ? nodeId("fraction", fraction.id) : null,
      childIds: [],
      meta: [
        { label: "Methode", value: analysis.method ?? "—" },
        { label: "Labor", value: partnerName(analysis.lab_partner_id) },
        { label: "Fraktion", value: fraction?.fraction_code ?? "—" },
        { label: "Probenmenge", value: retained !== null ? formatKg(sampleKg) : "— (keine Rückstellprobe erfasst)" },
        { label: "Probe versendet", value: formatDate(analysis.sample_sent_date) },
        { label: "Ergebnis", value: formatDate(analysis.result_date) },
        { label: "Kosten", value: formatEur(analysis.cost_eur) },
        { label: "Notizen", value: analysis.notes ?? "—" },
      ],
      partnerIds: analysis.lab_partner_id ? [analysis.lab_partner_id] : [],
      materialClass: null,
      targetFractionId: fraction?.target_fraction_id ?? null,
      seq: 0,
    });
    if (fraction) {
      connect(nodeId("fraction", fraction.id), nodeId("analysis", analysis.id), sampleKg, retained === null);
    }
  }

  /* --- product tests + customers --------------------------------------- */
  const customerTests = new Map<string, number[]>();

  for (const test of productTests) {
    const fraction = test.output_fraction_id ? fractionById.get(test.output_fraction_id) ?? null : null;
    const siblings = fraction ? testsByFraction.get(fraction.id)?.length ?? 1 : 1;
    const available = fraction ? Math.max(0, fraction.weight_kg - (fraction.retained_sample_kg ?? 0)) : 0;
    const shareKg = fraction ? available / siblings : 0;
    push({
      id: nodeId("product_test", test.id),
      stage: "product_test",
      recordId: test.id,
      code: test.test_code,
      title: test.title,
      massKg: shareKg,
      massEstimated: true,
      statusLabel: labelOf(TEST_RUN_STATUSES, test.status),
      statusTone: toneOf(TEST_RUN_STATUSES, test.status),
      date: test.actual_date ?? test.planned_date,
      parentId: fraction ? nodeId("fraction", fraction.id) : null,
      childIds: [],
      meta: [
        { label: "Titel", value: test.title },
        { label: "Kategorie", value: labelOf(PRODUCT_TEST_CATEGORIES, test.category) },
        { label: "Partner", value: partnerName(test.partner_id) },
        { label: "Eingesetzte Fraktion", value: fraction?.fraction_code ?? "—" },
        { label: "Dosierung", value: test.dosage_pct !== null ? `${formatNumber(test.dosage_pct, 1)} %` : "—" },
        { label: "Zugeordnete Menge", value: fraction ? `≈ ${formatKg(shareKg)}` : "—" },
        { label: "Termin", value: formatDate(test.actual_date ?? test.planned_date) },
        { label: "Kosten", value: formatEur(test.cost_eur) },
        { label: "Rezeptur", value: test.recipe_notes ?? "—" },
        { label: "Fazit", value: test.summary ?? "—" },
      ],
      partnerIds: test.partner_id ? [test.partner_id] : [],
      materialClass: null,
      targetFractionId: fraction?.target_fraction_id ?? null,
      seq: 0,
    });
    if (fraction) {
      connect(nodeId("fraction", fraction.id), nodeId("product_test", test.id), shareKg, true);
    }
    if (test.partner_id) {
      const list = customerTests.get(test.partner_id) ?? [];
      list.push(shareKg);
      customerTests.set(test.partner_id, list);
    }
  }

  for (const [customerId, shares] of customerTests) {
    const partner = partnerById.get(customerId) ?? null;
    push({
      id: nodeId("customer", customerId),
      stage: "customer",
      recordId: customerId,
      code: partner?.name ?? "Unbekannter Kunde",
      title: partner?.name ?? "Unbekannter Kunde",
      massKg: sum(shares),
      massEstimated: true,
      statusLabel: partner ? labelOf(PARTNER_CATEGORIES, partner.category) : null,
      statusTone: partner?.is_fixed_partner ? "success" : "muted",
      date: null,
      parentId: null,
      childIds: [],
      meta: [
        { label: "Kategorie", value: partner ? labelOf(PARTNER_CATEGORIES, partner.category) : "—" },
        { label: "Ort", value: partner?.city ? `${partner.postal_code ?? ""} ${partner.city}`.trim() : "—" },
        { label: "E-Mail", value: partner?.email ?? "—" },
        { label: "Produkttests", value: `${shares.length}` },
        { label: "Zugeordnete Menge", value: `≈ ${formatKg(sum(shares))}` },
      ],
      partnerIds: [customerId],
      materialClass: null,
      targetFractionId: null,
      seq: 0,
    });
  }

  /* --- product test -> customer links ---------------------------------- */
  for (const test of productTests) {
    if (!test.partner_id) continue;
    const node = byId.get(nodeId("product_test", test.id));
    if (!node) continue;
    connect(nodeId("product_test", test.id), nodeId("customer", test.partner_id), node.massKg, true);
  }

  /* --- children, parents of customer nodes ----------------------------- */
  const linksBySource = new Map<string, FlowLink[]>();
  const linksByTarget = new Map<string, FlowLink[]>();
  for (const link of links) {
    const outgoing = linksBySource.get(link.sourceId) ?? [];
    outgoing.push(link);
    linksBySource.set(link.sourceId, outgoing);
    const incoming = linksByTarget.get(link.targetId) ?? [];
    incoming.push(link);
    linksByTarget.set(link.targetId, incoming);
  }
  for (const node of nodes) {
    node.childIds = (linksBySource.get(node.id) ?? []).map((link) => link.targetId);
  }
  // A customer can be fed by several product tests - keep the first as the
  // structural parent so the forest stays a forest.
  for (const node of nodes) {
    if (node.stage !== "customer") continue;
    const incoming = linksByTarget.get(node.id) ?? [];
    node.parentId = incoming.length ? incoming[0].sourceId : null;
  }

  /* --- depth-first ordering -------------------------------------------- */
  const stageOrder = FLOW_STAGES.map((stage) => stage.id);
  const roots = nodes
    .filter((node) => !node.parentId)
    .sort((a, b) => {
      const byStage = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
      return byStage !== 0 ? byStage : a.code.localeCompare(b.code, "de");
    });

  let counter = 0;
  const visited = new Set<string>();
  const walk = (node: FlowNode) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    node.seq = counter++;
    const children = node.childIds
      .map((id) => byId.get(id))
      .filter((child): child is FlowNode => Boolean(child))
      // keep a customer next to its first product test only
      .filter((child) => child.parentId === node.id)
      .sort((a, b) => {
        const byStage = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
        return byStage !== 0 ? byStage : a.code.localeCompare(b.code, "de");
      });
    children.forEach(walk);
  };
  roots.forEach(walk);
  // anything left over (cycles cannot occur, but be defensive)
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      visited.add(node.id);
      node.seq = counter++;
    }
  }

  return { nodes, links, byId, linksBySource, linksByTarget };
}

/* ----------------------------------------------------------------- filters */

export interface FlowFilters {
  materialClass: string;
  targetFraction: string;
  partnerId: string;
  from: string;
  to: string;
}

export const EMPTY_FILTERS: FlowFilters = {
  materialClass: "all",
  targetFraction: "all",
  partnerId: "all",
  from: "",
  to: "",
};

export function activeFilterCount(filters: FlowFilters): number {
  return (
    (filters.materialClass !== "all" ? 1 : 0) +
    (filters.targetFraction !== "all" ? 1 : 0) +
    (filters.partnerId !== "all" ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0)
  );
}

interface ChainFacts {
  materialClasses: Set<string>;
  targets: Set<string>;
  partners: Set<string>;
  dates: string[];
}

function emptyFacts(): ChainFacts {
  return { materialClasses: new Set(), targets: new Set(), partners: new Set(), dates: [] };
}

function ownFacts(node: FlowNode): ChainFacts {
  const facts = emptyFacts();
  if (node.materialClass) facts.materialClasses.add(node.materialClass);
  if (node.targetFractionId) facts.targets.add(node.targetFractionId);
  node.partnerIds.forEach((id) => facts.partners.add(id));
  if (node.date) facts.dates.push(node.date);
  return facts;
}

function mergeFacts(target: ChainFacts, source: ChainFacts): void {
  source.materialClasses.forEach((value) => target.materialClasses.add(value));
  source.targets.forEach((value) => target.targets.add(value));
  source.partners.forEach((value) => target.partners.add(value));
  target.dates.push(...source.dates);
}

/**
 * Kalendertag eines Datums- oder Zeitstempelwerts in der Zeitzone des Browsers -
 * also genau der Tag, den formatDate anzeigt. Über toISOString() gerechnet
 * fielen Zeitstempel kurz vor Mitternacht (created_at) einen Tag zu früh und
 * verschwanden aus einem Zeitraumfilter, obwohl die Tabelle sie im Zeitraum
 * ausweist.
 */
function localDayKey(raw: string): string | null {
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) return null;
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function inRange(dates: string[], from: string, to: string): boolean {
  if (!from && !to) return true;
  return dates.some((raw) => {
    const day = localDayKey(raw);
    if (day === null) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

export interface FlowVisibility {
  nodeIds: Set<string>;
  linkIds: Set<string>;
}

/**
 * A record stays visible when its own chain - all ancestors plus its whole
 * subtree - satisfies every active filter. Sibling branches are not part of
 * that chain, so filtering by a target fraction really hides the other
 * fractions of the same run while keeping the run itself.
 */
export function applyFilters(graph: FlowGraph, filters: FlowFilters): FlowVisibility {
  const subtree = new Map<string, ChainFacts>();
  const ordered = [...graph.nodes].sort((a, b) => b.seq - a.seq); // children before parents

  for (const node of ordered) {
    const facts = ownFacts(node);
    for (const childId of node.childIds) {
      const child = graph.byId.get(childId);
      if (!child || child.parentId !== node.id) continue;
      const childFacts = subtree.get(childId);
      if (childFacts) mergeFacts(facts, childFacts);
    }
    subtree.set(node.id, facts);
  }

  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    const chain = emptyFacts();
    const own = subtree.get(node.id);
    if (own) mergeFacts(chain, own);
    let cursor = node.parentId ? graph.byId.get(node.parentId) ?? null : null;
    const guard = new Set<string>([node.id]);
    while (cursor && !guard.has(cursor.id)) {
      guard.add(cursor.id);
      mergeFacts(chain, ownFacts(cursor));
      cursor = cursor.parentId ? graph.byId.get(cursor.parentId) ?? null : null;
    }

    if (filters.materialClass !== "all" && !chain.materialClasses.has(filters.materialClass)) continue;
    if (filters.targetFraction !== "all" && !chain.targets.has(filters.targetFraction)) continue;
    if (filters.partnerId !== "all" && !chain.partners.has(filters.partnerId)) continue;
    if (!inRange(chain.dates, filters.from, filters.to)) continue;
    nodeIds.add(node.id);
  }

  const linkIds = new Set<string>();
  for (const link of graph.links) {
    if (nodeIds.has(link.sourceId) && nodeIds.has(link.targetId)) linkIds.add(link.id);
  }
  return { nodeIds, linkIds };
}

/* ------------------------------------------------------------------- trace */

export interface TraceResult {
  rootId: string;
  nodeIds: Set<string>;
  linkIds: Set<string>;
  /** The path grouped per stage, ready to be rendered as a breadcrumb. */
  chain: { stage: FlowStageMeta; nodes: FlowNode[] }[];
}

/** Complete path of a record: back to the batch, forward to the product tests. */
export function computeTrace(graph: FlowGraph, rootId: string): TraceResult | null {
  const root = graph.byId.get(rootId);
  if (!root) return null;

  const nodeIds = new Set<string>([root.id]);

  let cursor = root.parentId ? graph.byId.get(root.parentId) ?? null : null;
  while (cursor && !nodeIds.has(cursor.id)) {
    nodeIds.add(cursor.id);
    cursor = cursor.parentId ? graph.byId.get(cursor.parentId) ?? null : null;
  }

  const queue: FlowNode[] = [root];
  while (queue.length) {
    const node = queue.shift() as FlowNode;
    for (const childId of node.childIds) {
      if (nodeIds.has(childId)) continue;
      const child = graph.byId.get(childId);
      if (!child) continue;
      nodeIds.add(child.id);
      queue.push(child);
    }
  }

  const linkIds = new Set<string>();
  for (const link of graph.links) {
    if (nodeIds.has(link.sourceId) && nodeIds.has(link.targetId)) linkIds.add(link.id);
  }

  const chain = FLOW_STAGES.map((stage) => ({
    stage,
    nodes: graph.nodes
      .filter((node) => node.stage === stage.id && nodeIds.has(node.id))
      .sort((a, b) => a.seq - b.seq),
  })).filter((entry) => entry.nodes.length > 0);

  return { rootId, nodeIds, linkIds, chain };
}

/* ------------------------------------------------------------------ search */

export interface SearchEntry {
  nodeId: string;
  code: string;
  title: string;
  stage: FlowStageMeta;
}

const SEARCHABLE_STAGES: FlowStageId[] = ["batch", "run", "fraction", "analysis", "product_test"];

export function buildSearchEntries(graph: FlowGraph): SearchEntry[] {
  return graph.nodes
    .filter((node) => SEARCHABLE_STAGES.includes(node.stage))
    .sort((a, b) => a.code.localeCompare(b.code, "de"))
    .map((node) => ({ nodeId: node.id, code: node.code, title: node.title, stage: STAGE_META[node.stage] }));
}

export function searchEntries(entries: SearchEntry[], term: string, limit = 8): SearchEntry[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  const matches = entries.filter(
    (entry) => entry.code.toLowerCase().includes(needle) || entry.title.toLowerCase().includes(needle),
  );
  matches.sort((a, b) => {
    const aStarts = a.code.toLowerCase().startsWith(needle) ? 0 : 1;
    const bStarts = b.code.toLowerCase().startsWith(needle) ? 0 : 1;
    return aStarts !== bStarts ? aStarts - bStarts : a.code.localeCompare(b.code, "de");
  });
  return matches.slice(0, limit);
}

/* ------------------------------------------------------------ mass balance */

export interface RunBalance {
  runId: string;
  nodeId: string;
  runCode: string;
  title: string;
  processLine: string;
  batchCode: string | null;
  materialClass: string | null;
  partnerName: string;
  date: string | null;
  statusLabel: string;
  statusTone: string;
  /** Recorded input weight only - an estimate never enters the balance. */
  inputKg: number | null;
  /** Input derived from the batch when nothing was recorded (information only). */
  derivedInputKg: number | null;
  outputKg: number;
  fractionCount: number;
  lossKg: number | null;
  lossPct: number | null;
}

export function computeRunBalances(
  graph: FlowGraph,
  visible: FlowVisibility,
  runs: TestRun[],
  batches: MaterialBatch[],
  fractions: OutputFraction[],
  partners: Partner[],
): RunBalance[] {
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));

  return runs
    .filter((run) => visible.nodeIds.has(nodeId("run", run.id)))
    .map((run) => {
      /*
       * Die Massenbilanz gehört zum Lauf, nicht zur Filterauswahl. Ein Filter
       * blendet Schwesterfraktionen desselben Laufs aus (Zielfraktion, Partner,
       * Zeitraum) - würden nur die sichtbaren Fraktionen gegengerechnet, meldete
       * die Tabelle einen erfundenen Verlust samt Warnsymbol. Bilanziert werden
       * deshalb immer alle Ausgangsfraktionen des Laufs.
       */
      const runFractions = fractions.filter((fraction) => fraction.test_run_id === run.id);
      const outputKg = sum(runFractions.map((fraction) => fraction.weight_kg));
      const node = graph.byId.get(nodeId("run", run.id));
      const inputKg = run.input_weight_kg;
      const derivedInputKg = inputKg === null && node && node.massEstimated && node.massKg > 0 ? node.massKg : null;
      const batch = run.input_batch_id ? batchById.get(run.input_batch_id) ?? null : null;
      const computable = inputKg !== null && inputKg > 0 && runFractions.length > 0;
      const lossKg = computable ? (inputKg as number) - outputKg : null;
      const lossPct = computable && lossKg !== null ? (lossKg / (inputKg as number)) * 100 : null;

      return {
        runId: run.id,
        nodeId: nodeId("run", run.id),
        runCode: run.run_code,
        title: run.title,
        processLine: run.process_line,
        batchCode: batch?.batch_code ?? null,
        materialClass: batch?.material_class ?? null,
        partnerName: (run.partner_id ? partnerById.get(run.partner_id)?.name : null) ?? "—",
        date: run.actual_date ?? run.planned_date,
        statusLabel: labelOf(TEST_RUN_STATUSES, run.status),
        statusTone: toneOf(TEST_RUN_STATUSES, run.status),
        inputKg,
        derivedInputKg,
        outputKg,
        fractionCount: runFractions.length,
        lossKg,
        lossPct,
      };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.runCode.localeCompare(b.runCode, "de"));
}

export interface RunBalanceTotals {
  inputKg: number;
  outputKg: number;
  lossKg: number;
  lossPct: number | null;
  countedRuns: number;
  skippedRuns: number;
}

export function totalRunBalance(balances: RunBalance[]): RunBalanceTotals {
  const counted = balances.filter((balance) => balance.lossKg !== null && balance.inputKg !== null);
  const inputKg = sum(counted.map((balance) => balance.inputKg as number));
  const outputKg = sum(counted.map((balance) => balance.outputKg));
  const lossKg = inputKg - outputKg;
  return {
    inputKg,
    outputKg,
    lossKg,
    lossPct: inputKg > 0 ? (lossKg / inputKg) * 100 : null,
    countedRuns: counted.length,
    skippedRuns: balances.length - counted.length,
  };
}

export interface StageBalance {
  stage: FlowStageMeta;
  nodeCount: number;
  inKg: number;
  processedKg: number;
  outKg: number;
  stockKg: number;
  lossKg: number | null;
  lossPct: number | null;
  terminal: boolean;
}

/**
 * Per stage: what came in, what was actually passed on (verarbeitet), what
 * left the stage and the difference. Only the run stage can lose mass
 * physically - everywhere else the difference between "eingegangen" and
 * "verarbeitet" is material that is still in stock, shown separately.
 *
 * Der Filter bestimmt, welche Datensätze gezählt werden - gerechnet wird immer
 * mit deren vollständigen Mengen. Würden nur sichtbare Kanten summiert, meldete
 * ein Filter, der eine Fraktion eines Laufs ausblendet, einen Verlust, den es
 * physikalisch nie gab (und beim Bestand einer Charge dasselbe umgekehrt).
 */
export function computeStageBalances(graph: FlowGraph, visible: FlowVisibility): StageBalance[] {
  return FLOW_STAGES.map((stage) => {
    const nodes = graph.nodes.filter((node) => node.stage === stage.id && visible.nodeIds.has(node.id));
    const inOf = (node: FlowNode) => sum((graph.linksByTarget.get(node.id) ?? []).map((link) => link.kg));
    const outOf = (node: FlowNode) => sum((graph.linksBySource.get(node.id) ?? []).map((link) => link.kg));

    let inKg = 0;
    let outKg = 0;
    let processedKg = 0;

    for (const node of nodes) {
      const linkedIn = inOf(node);
      // records without a predecessor (a batch without supplier, a run without
      // batch) still carry their own mass into the stage
      const incoming = stage.id === "supplier" ? outOf(node) : linkedIn > 0 ? linkedIn : node.massKg;
      const outgoing = outOf(node);
      inKg += incoming;
      outKg += outgoing;
      if (stage.id === "run") {
        // a run counts as processed as soon as it produced at least one fraction
        processedKg += outgoing > 0 ? incoming : 0;
      } else {
        processedKg += outgoing;
      }
    }

    const terminal = stage.terminal;
    const lossKg = terminal ? null : processedKg - outKg;
    const lossPct = lossKg !== null && processedKg > 0 ? (lossKg / processedKg) * 100 : null;

    return {
      stage,
      nodeCount: nodes.length,
      inKg,
      outKg,
      processedKg,
      stockKg: Math.max(0, inKg - processedKg),
      lossKg,
      lossPct,
      terminal,
    };
  });
}

/** Tone for a loss percentage: > 15 % is a warning, negative values are a data error. */
export function lossTone(pct: number | null): string {
  if (pct === null) return "muted";
  if (pct < -0.5) return "destructive";
  if (pct > LOSS_WARNING_PCT) return "warning";
  return "success";
}

export function lossTextClass(pct: number | null): string {
  const tone = lossTone(pct);
  if (tone === "destructive") return "text-destructive font-semibold";
  if (tone === "warning") return "text-warning font-semibold";
  if (tone === "success") return "text-success";
  return "text-muted-foreground";
}

export function formatMass(kg: number, estimated: boolean): string {
  return estimated ? `≈ ${formatKg(kg)}` : formatKg(kg);
}

export function formatPct(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${formatNumber(value, digits)} %`;
}

export { nodeId as flowNodeId };
