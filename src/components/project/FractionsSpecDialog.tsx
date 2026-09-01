/**
 * Inline editor for a target fraction specification (F1..F5).
 * Only admins and Betriebsleiter reach this dialog - the specification is the
 * yardstick every analysis is measured against, so it is not casual data.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useProjectMutation } from "@/hooks/project/useProjectData";
import { PROCESS_LINES } from "@/lib/project/constants";
import type { FractionSpec } from "@/lib/project/types";
import { decimalToInput, isDecimalInputValid, parseDecimal } from "./FractionsShared";

interface FormState {
  name: string;
  fiberMin: string;
  fiberMax: string;
  glassMin: string;
  moistureMax: string;
  finesMax: string;
  application: string;
  targetPrice: string;
  processLine: string;
  notes: string;
}

const EMPTY: FormState = {
  name: "",
  fiberMin: "",
  fiberMax: "",
  glassMin: "",
  moistureMax: "",
  finesMax: "",
  application: "",
  targetPrice: "",
  processLine: "",
  notes: "",
};

function toForm(spec: FractionSpec): FormState {
  return {
    name: spec.name,
    fiberMin: decimalToInput(spec.fiber_length_min_mm),
    fiberMax: decimalToInput(spec.fiber_length_max_mm),
    glassMin: decimalToInput(spec.glass_content_min_pct),
    moistureMax: decimalToInput(spec.moisture_max_pct),
    finesMax: decimalToInput(spec.fines_max_pct),
    application: spec.application ?? "",
    targetPrice: decimalToInput(spec.target_price_eur_t),
    processLine: spec.process_line ?? "",
    notes: spec.notes ?? "",
  };
}

export function FractionsSpecDialog({
  spec,
  open,
  onOpenChange,
}: {
  spec: FractionSpec | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (open && spec) setForm(toForm(spec));
  }, [open, spec]);

  const save = useProjectMutation(
    async (vars: { id: string; form: FormState }) => {
      const { data, error } = await supabase
        .from("fraction_specs")
        .update({
          name: vars.form.name.trim(),
          fiber_length_min_mm: parseDecimal(vars.form.fiberMin),
          fiber_length_max_mm: parseDecimal(vars.form.fiberMax),
          glass_content_min_pct: parseDecimal(vars.form.glassMin),
          moisture_max_pct: parseDecimal(vars.form.moistureMax),
          fines_max_pct: parseDecimal(vars.form.finesMax),
          application: vars.form.application.trim() || null,
          target_price_eur_t: parseDecimal(vars.form.targetPrice),
          process_line: vars.form.processLine || null,
          notes: vars.form.notes.trim() || null,
        })
        .eq("id", vars.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
    },
    {
      successMessage: "Zielspezifikation gespeichert",
      errorMessage: "Zielspezifikation konnte nicht gespeichert werden",
      onDone: () => onOpenChange(false),
    },
  );

  const numericFields: (keyof FormState)[] = [
    "fiberMin", "fiberMax", "glassMin", "moistureMax", "finesMax", "targetPrice",
  ];
  const invalidNumber = numericFields.some((field) => !isDecimalInputValid(form[field]));
  const min = parseDecimal(form.fiberMin);
  const max = parseDecimal(form.fiberMax);
  const windowInverted = min !== null && max !== null && min > max;
  const nameMissing = form.name.trim().length === 0;

  const validationMessage = nameMissing
    ? "Ein Name ist erforderlich."
    : invalidNumber
      ? "Bitte nur Zahlen eingeben (Dezimaltrennzeichen Komma oder Punkt)."
      : windowInverted
        ? "Die minimale Faserlänge darf nicht größer als die maximale sein."
        : null;

  const field = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base">
            Zielspezifikation {spec?.id} bearbeiten
          </DialogTitle>
          <DialogDescription className="text-xs">
            Diese Werte sind der Maßstab für jede Analytik. Änderungen bewerten alle vorhandenen Fraktionen neu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="spec-name">Bezeichnung</Label>
            <Input id="spec-name" value={form.name} onChange={(e) => field("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="spec-fiber-min">Faserlänge min. (mm)</Label>
              <Input id="spec-fiber-min" inputMode="decimal" value={form.fiberMin} onChange={(e) => field("fiberMin", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spec-fiber-max">Faserlänge max. (mm)</Label>
              <Input id="spec-fiber-max" inputMode="decimal" value={form.fiberMax} onChange={(e) => field("fiberMax", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spec-glass">Glasgehalt min. (%)</Label>
              <Input id="spec-glass" inputMode="decimal" value={form.glassMin} onChange={(e) => field("glassMin", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spec-moisture">Restfeuchte max. (%)</Label>
              <Input id="spec-moisture" inputMode="decimal" value={form.moistureMax} onChange={(e) => field("moistureMax", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spec-fines">Feinanteil max. (%)</Label>
              <Input id="spec-fines" inputMode="decimal" value={form.finesMax} onChange={(e) => field("finesMax", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spec-price">Zielpreis (€/t)</Label>
              <Input id="spec-price" inputMode="decimal" value={form.targetPrice} onChange={(e) => field("targetPrice", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spec-application">Anwendung</Label>
            <Input id="spec-application" value={form.application} onChange={(e) => field("application", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spec-line">Prozesslinie</Label>
            <Select value={form.processLine || "none"} onValueChange={(value) => field("processLine", value === "none" ? "" : value)}>
              <SelectTrigger id="spec-line">
                <SelectValue placeholder="Prozesslinie wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nicht zugeordnet</SelectItem>
                {PROCESS_LINES.map((line) => (
                  <SelectItem key={line.id} value={line.id}>{line.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spec-notes">Notizen</Label>
            <Textarea id="spec-notes" rows={3} value={form.notes} onChange={(e) => field("notes", e.target.value)} />
          </div>

          {validationMessage && <p className="text-xs text-destructive">{validationMessage}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            onClick={() => spec && save.mutate({ id: spec.id, form })}
            disabled={!spec || save.isPending || validationMessage !== null}
          >
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
