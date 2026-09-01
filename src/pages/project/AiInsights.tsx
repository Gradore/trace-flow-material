import { useMemo, useState } from "react";
import {
  BrainCircuit,
  CalendarRange,
  ClipboardCheck,
  Clock,
  Coins,
  FlaskConical,
  Inbox,
  ListChecks,
  Network,
  ServerCog,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  ProjectPageHeader,
  StatCard,
  formatNumber,
} from "@/components/project/ProjectUI";
import {
  AiInsightsTriggerCard,
  type ScopeConfig,
} from "@/components/project/AiInsightsTriggerCard";
import { AiInsightsEntryCard } from "@/components/project/AiInsightsEntryCard";
import { AI_ANALYSIS_TYPES, labelOf } from "@/lib/project/constants";
import {
  useAiAnalyses,
  useDoeSeries,
  useOutputFractions,
  usePartners,
  usePhases,
  useProductTests,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import type { AiAnalysisType } from "@/hooks/project/useProjectAi";

/** What each evaluation type does, in the operator's language. */
const TYPE_META: Record<
  AiAnalysisType,
  {
    description: string;
    scheduled: boolean;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  daily_briefing: {
    description:
      "Fasst den Projektstand der letzten sieben Tage zusammen: laufende Versuche, neue Analysenergebnisse, fällige Aufgaben und was heute Priorität hat.",
    scheduled: true,
    icon: Sparkles,
  },
  test_interpretation: {
    description:
      "Wertet einen einzelnen Versuchslauf aus: Maschinenparameter gegen Fraktionsausbeute und Analysenwerte, inklusive Prüfung der Go/No-Go-Grenzen (Faserlänge, Energie, Glasgehalt).",
    scheduled: false,
    icon: FlaskConical,
  },
  doe_optimization: {
    description:
      "Analysiert eine ganze DoE-Serie: welcher Faktor wirkt tatsächlich auf die Zielgrößen, welcher Versuchspunkt fehlt noch und welcher Parametersatz ist als Nächstes zu fahren.",
    scheduled: false,
    icon: Network,
  },
  next_actions: {
    description:
      "Leitet aus Aufgaben, Blockern, Abhängigkeiten und dem IP-Gate die nächsten konkreten Schritte ab — priorisiert und mit Begründung.",
    scheduled: true,
    icon: ListChecks,
  },
  partner_followup: {
    description:
      "Prüft den Kontaktstand aller Projektpartner und findet überfällige Nachfassaktionen, offene Zusagen und verwaiste Anfragen.",
    scheduled: true,
    icon: Users,
  },
  spec_conformity: {
    description:
      "Prüft eine erzeugte Ausgangsfraktion gegen ihre Zielspezifikation F1–F5, benennt Abweichungen und bewertet die Freigabefähigkeit.",
    scheduled: false,
    icon: ClipboardCheck,
  },
  risk_scan: {
    description:
      "Durchsucht den aktuellen Datenstand nach neuen technischen, wirtschaftlichen, terminlichen und schutzrechtlichen Risiken und schlägt Gegenmaßnahmen vor.",
    scheduled: true,
    icon: ShieldAlert,
  },
  weekly_report: {
    description:
      "Erstellt den Wochenbericht: Fortschritt je Phase, angefallene Kosten, erreichte Meilensteine und offener Entscheidungsbedarf.",
    scheduled: true,
    icon: CalendarRange,
  },
};

const SCOPED_TYPES: Partial<
  Record<AiAnalysisType, { scopeType: ScopeConfig["scopeType"]; selectLabel: string; placeholder: string; emptyHint: string }>
> = {
  test_interpretation: {
    scopeType: "test_run",
    selectLabel: "Versuchslauf",
    placeholder: "Versuchslauf wählen",
    emptyHint: "Noch kein Versuchslauf angelegt.",
  },
  doe_optimization: {
    scopeType: "doe_series",
    selectLabel: "DoE-Serie",
    placeholder: "DoE-Serie wählen",
    emptyHint: "Noch keine DoE-Serie angelegt.",
  },
  spec_conformity: {
    scopeType: "output_fraction",
    selectLabel: "Ausgangsfraktion",
    placeholder: "Fraktion wählen",
    emptyHint: "Noch keine Ausgangsfraktion erfasst.",
  },
};

const SCHEDULED_LABELS = AI_ANALYSIS_TYPES.filter((entry) => TYPE_META[entry.id].scheduled)
  .map((entry) => entry.label)
  .join(", ");

export default function AiInsights() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const analysesQuery = useAiAnalyses();
  const testRuns = useTestRuns();
  const doeSeries = useDoeSeries();
  const fractions = useOutputFractions();
  const partners = usePartners();
  const phases = usePhases();
  const productTests = useProductTests();

  const analyses = useMemo(() => analysesQuery.data ?? [], [analysesQuery.data]);

  /* ----------------------------------------------------- scope resolution */

  const scopeLabels = useMemo(() => {
    const map = new Map<string, string>();
    (testRuns.data ?? []).forEach((run) => map.set(`test_run:${run.id}`, `${run.run_code} — ${run.title}`));
    (doeSeries.data ?? []).forEach((series) => map.set(`doe_series:${series.id}`, `${series.code} — ${series.name}`));
    (fractions.data ?? []).forEach((fraction) =>
      map.set(
        `output_fraction:${fraction.id}`,
        fraction.target_fraction_id
          ? `${fraction.fraction_code} (Ziel ${fraction.target_fraction_id})`
          : fraction.fraction_code,
      ),
    );
    (partners.data ?? []).forEach((partner) => map.set(`partner:${partner.id}`, partner.name));
    (phases.data ?? []).forEach((phase) => map.set(`phase:${phase.id}`, `${phase.code} — ${phase.name}`));
    (productTests.data ?? []).forEach((test) =>
      map.set(`product_test:${test.id}`, `${test.test_code} — ${test.title}`),
    );
    return map;
  }, [testRuns.data, doeSeries.data, fractions.data, partners.data, phases.data, productTests.data]);

  /** Die Nachschlagequellen laden unabhängig vom Protokoll. */
  const scopeLoading: Record<string, boolean> = {
    test_run: testRuns.isLoading,
    doe_series: doeSeries.isLoading,
    output_fraction: fractions.isLoading,
    partner: partners.isLoading,
    phase: phases.isLoading,
    product_test: productTests.isLoading,
  };

  const scopeLabelFor = (scopeType: string, scopeId: string | null): string => {
    if (scopeType === "global" || !scopeId) return "Gesamtprojekt";
    const label = scopeLabels.get(`${scopeType}:${scopeId}`);
    if (label) return label;
    if (scopeLoading[scopeType]) return "wird geladen …";
    return `${scopeType} (${scopeId.slice(0, 8)}…)`;
  };

  const scopeConfigFor = (type: AiAnalysisType): ScopeConfig | undefined => {
    const base = SCOPED_TYPES[type];
    if (!base) return undefined;
    if (base.scopeType === "test_run") {
      return {
        ...base,
        isLoading: testRuns.isLoading,
        isError: testRuns.isError,
        onRetry: () => {
          void testRuns.refetch();
        },
        options: (testRuns.data ?? []).map((run) => ({
          value: run.id,
          label: `${run.run_code} — ${run.title}`,
        })),
      };
    }
    if (base.scopeType === "doe_series") {
      return {
        ...base,
        isLoading: doeSeries.isLoading,
        isError: doeSeries.isError,
        onRetry: () => {
          void doeSeries.refetch();
        },
        options: (doeSeries.data ?? []).map((series) => ({
          value: series.id,
          label: `${series.code} — ${series.name}`,
        })),
      };
    }
    return {
      ...base,
      isLoading: fractions.isLoading,
      isError: fractions.isError,
      onRetry: () => {
        void fractions.refetch();
      },
      options: (fractions.data ?? []).map((fraction) => ({
        value: fraction.id,
        label: fraction.target_fraction_id
          ? `${fraction.fraction_code} (Ziel ${fraction.target_fraction_id})`
          : fraction.fraction_code,
      })),
    };
  };

  /* ------------------------------------------------------------ filtering */

  const filtered = useMemo(
    () =>
      analyses.filter((entry) => {
        if (typeFilter !== "all" && entry.analysis_type !== typeFilter) return false;
        if (onlyUnread && entry.acknowledged_at) return false;
        return true;
      }),
    [analyses, typeFilter, onlyUnread],
  );

  // Solange das Protokoll lädt oder fehlgeschlagen ist, wäre jede Kennzahl eine
  // erfundene Null - dann steht in den Karten „—“.
  const statsReady = !analysesQuery.isLoading && !analysesQuery.isError;
  const unreadCount = analyses.filter((entry) => !entry.acknowledged_at).length;
  const actedCount = analyses.filter((entry) => entry.acted_upon).length;
  const tokenSum = analyses.reduce((sum, entry) => sum + (entry.tokens_used ?? 0), 0);
  const filtersActive = typeFilter !== "all" || onlyUnread;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ProjectPageHeader
        title="KI-Auswertungen"
        description="Auswertungen anstoßen, Ergebnisse lesen und jede Aussage bis zum Datenstand zurückverfolgen."
        icon={BrainCircuit}
      />

      {/* -------------------------------------------------------- hint card */}
      <Card className="mb-6 border-violet-400/25 bg-violet-400/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ServerCog className="h-4 w-4 text-violet-400" />
            Acht Auswertungstypen — so arbeiten sie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 text-sm">
          <ul className="space-y-1.5">
            {AI_ANALYSIS_TYPES.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <span className="font-semibold shrink-0">{entry.label}:</span>
                <span className="text-muted-foreground">{TYPE_META[entry.id].description}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <span>
              <strong className="text-foreground">{SCHEDULED_LABELS}</strong> sind für den zeitgesteuerten
              Betrieb gedacht und laufen turnusmäßig ohne Zutun. Die drei kontextbezogenen Typen
              (Versuchsauswertung, DoE-Optimierung, Spec-Konformität) werden hier manuell für ein konkretes
              Objekt angestoßen.
            </span>
          </p>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ServerCog className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Der Modellaufruf läuft ausschließlich serverseitig in der Edge Function{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">project-ai</code>. Im Browser
              liegt kein API-Schlüssel. Zu jeder Auswertung wird der übergebene Datenstand gespeichert und
              ist unter „Grundlage der Auswertung“ einsehbar.
            </span>
          </p>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Auswertungen"
          value={formatNumber(statsReady ? analyses.length : null, 0)}
          icon={BrainCircuit}
          accent="violet"
        />
        <StatCard
          label="Ungelesen"
          value={formatNumber(statsReady ? unreadCount : null, 0)}
          icon={Inbox}
          accent={statsReady && unreadCount > 0 ? "amber" : "emerald"}
        />
        <StatCard
          label="Umgesetzt"
          value={formatNumber(statsReady ? actedCount : null, 0)}
          icon={ClipboardCheck}
          accent="emerald"
        />
        <StatCard
          label="Tokens gesamt"
          value={formatNumber(statsReady ? tokenSum : null, 0)}
          hint="über die geladenen Auswertungen (max. 100)"
          icon={Coins}
          accent="sky"
        />
      </div>

      {/* ---------------------------------------------------- trigger board */}
      <h2 className="mb-3 text-lg font-semibold">Auswertung anstoßen</h2>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {AI_ANALYSIS_TYPES.map((entry) => (
          <AiInsightsTriggerCard
            key={entry.id}
            type={entry.id}
            label={entry.label}
            description={TYPE_META[entry.id].description}
            scheduled={TYPE_META[entry.id].scheduled}
            icon={TYPE_META[entry.id].icon}
            scope={scopeConfigFor(entry.id)}
          />
        ))}
      </div>

      {/* ------------------------------------------------------------- log */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">
          Auswertungsprotokoll
          {filtersActive && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {filtered.length} von {analyses.length}
            </span>
          )}
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Nach Auswertungstyp filtern">
              <SelectValue placeholder="Alle Typen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {AI_ANALYSIS_TYPES.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="only-unread" checked={onlyUnread} onCheckedChange={setOnlyUnread} />
            <Label htmlFor="only-unread" className="cursor-pointer text-sm">
              Nur ungelesene
            </Label>
          </div>
        </div>
      </div>

      {analysesQuery.isLoading ? (
        <LoadingRows rows={4} />
      ) : analysesQuery.isError ? (
        <ErrorState
          error={analysesQuery.error as Error}
          onRetry={() => {
            void analysesQuery.refetch();
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={analyses.length === 0 ? "Noch keine KI-Auswertung vorhanden" : "Keine Auswertung passt zum Filter"}
          description={
            analyses.length === 0
              ? "Starten Sie oben eine Auswertung. Jedes Ergebnis wird mit Modell, Tokenverbrauch und vollständigem Eingabekontext protokolliert."
              : `Aktive Filter: ${typeFilter === "all" ? "" : labelOf(AI_ANALYSIS_TYPES, typeFilter)}${
                  typeFilter !== "all" && onlyUnread ? ", " : ""
                }${onlyUnread ? "nur ungelesene" : ""}.`
          }
          action={
            filtersActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTypeFilter("all");
                  setOnlyUnread(false);
                }}
              >
                Filter zurücksetzen
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((entry) => (
            <AiInsightsEntryCard
              key={entry.id}
              analysis={entry}
              typeLabel={labelOf(AI_ANALYSIS_TYPES, entry.analysis_type)}
              scopeLabel={scopeLabelFor(entry.scope_type, entry.scope_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
