/**
 * Create / edit dialog of the risk register.
 * `severity` is a GENERATED column in project_risks and is never sent - the
 * dialog only previews probability * impact.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RISK_CATEGORIES } from "@/lib/project/constants";
import {
  FieldLabel,
  IMPACT_LABELS,
  PROBABILITY_LABELS,
  RISK_STATUSES,
  ScaleSelector,
  SeverityBadge,
} from "@/components/project/ProjectRisksShared";
import type { Phase, ProjectRisk } from "@/lib/project/types";

export interface RiskFormValues {
  title: string;
  description: string;
  category: string;
  probability: number;
  impact: number;
  mitigation_plan: string;
  owner: string;
  status: string;
  phase_id: string | null;
  ai_suggested: boolean;
}

export const EMPTY_RISK_FORM: RiskFormValues = {
  title: "",
  description: "",
  category: "technical",
  probability: 3,
  impact: 3,
  mitigation_plan: "",
  owner: "",
  status: "open",
  phase_id: null,
  ai_suggested: false,
};

const NO_PHASE = "__none__";

function fromRisk(risk: ProjectRisk): RiskFormValues {
  return {
    title: risk.title,
    description: risk.description ?? "",
    category: risk.category,
    probability: risk.probability ?? 3,
    impact: risk.impact ?? 3,
    mitigation_plan: risk.mitigation_plan ?? "",
    owner: risk.owner ?? "",
    status: risk.status,
    phase_id: risk.phase_id,
    ai_suggested: risk.ai_suggested,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Row being edited, or null for a new risk. */
  risk: ProjectRisk | null;
  /** Stable prefill object (e.g. from the AI risk scan panel). */
  prefill: Partial<RiskFormValues> | null;
  phases: Phase[];
  isSaving: boolean;
  onSubmit: (values: RiskFormValues) => void;
}

export function ProjectRisksDialog({
  open,
  onOpenChange,
  risk,
  prefill,
  phases,
  isSaving,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<RiskFormValues>(EMPTY_RISK_FORM);
  const [error, setError] = useState<string | null>(null);

  // Read the row through a ref so a background refetch cannot reset a form
  // the user is currently typing in.
  const riskRef = useRef<ProjectRisk | null>(risk);
  riskRef.current = risk;
  const riskId = risk?.id ?? null;

  useEffect(() => {
    if (!open) return;
    const current = riskRef.current;
    setError(null);
    setValues(current ? fromRisk(current) : { ...EMPTY_RISK_FORM, ...(prefill ?? {}) });
  }, [open, riskId, prefill]);

  const severity = values.probability * values.impact;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.title.trim()) {
      setError("Bitte einen Titel angeben.");
      return;
    }
    setError(null);
    onSubmit({ ...values, title: values.title.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{risk ? "Risiko bearbeiten" : "Neues Risiko"}</DialogTitle>
          <DialogDescription>
            Schwere = Wahrscheinlichkeit × Auswirkung und wird von der Datenbank berechnet.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="risk-title">Titel *</FieldLabel>
            <Input
              id="risk-title"
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              placeholder="z. B. Faserlänge Median unter 0,3 mm"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="risk-description">Beschreibung</FieldLabel>
            <Textarea
              id="risk-description"
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              placeholder="Was genau kann passieren und warum?"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Kategorie</FieldLabel>
              <Select
                value={values.category}
                onValueChange={(next) => setValues((v) => ({ ...v, category: next }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {RISK_CATEGORIES.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Status</FieldLabel>
              <Select
                value={values.status}
                onValueChange={(next) => setValues((v) => ({ ...v, status: next }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status wählen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {RISK_STATUSES.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel>Eintrittswahrscheinlichkeit</FieldLabel>
              <ScaleSelector
                value={values.probability}
                onChange={(next) => setValues((v) => ({ ...v, probability: next }))}
                labels={PROBABILITY_LABELS}
                idPrefix="probability"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Auswirkung</FieldLabel>
              <ScaleSelector
                value={values.impact}
                onChange={(next) => setValues((v) => ({ ...v, impact: next }))}
                labels={IMPACT_LABELS}
                idPrefix="impact"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm text-muted-foreground">
              Schwere ({values.probability} × {values.impact})
            </span>
            <SeverityBadge severity={severity} />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="risk-mitigation">Maßnahmenplan</FieldLabel>
            <Textarea
              id="risk-mitigation"
              value={values.mitigation_plan}
              onChange={(e) => setValues((v) => ({ ...v, mitigation_plan: e.target.value }))}
              placeholder="Gegenmaßnahme, Frühindikator, Rückfallebene"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="risk-owner">Verantwortlich</FieldLabel>
              <Input
                id="risk-owner"
                value={values.owner}
                onChange={(e) => setValues((v) => ({ ...v, owner: e.target.value }))}
                placeholder="Name"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Phase</FieldLabel>
              <Select
                value={values.phase_id ?? NO_PHASE}
                onValueChange={(next) =>
                  setValues((v) => ({ ...v, phase_id: next === NO_PHASE ? null : next }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Phase wählen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={NO_PHASE}>Keine Phase</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.code} · {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                Von KI vorgeschlagen
              </p>
              <p className="text-xs text-muted-foreground">
                Markiert Risiken, die aus einem KI-Risikoscan übernommen wurden.
              </p>
            </div>
            <Switch
              checked={values.ai_suggested}
              onCheckedChange={(checked) => setValues((v) => ({ ...v, ai_suggested: checked }))}
              aria-label="Von KI vorgeschlagen"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {risk ? "Änderungen speichern" : "Risiko anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
