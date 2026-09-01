import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BATCH_STATUSES,
  MATERIAL_CLASSES,
  PARTNER_CATEGORIES,
  RESIN_TYPES,
  labelOf,
} from "@/lib/project/constants";
import { nextProjectCode } from "@/hooks/project/useProjectData";
import type { MaterialBatch, Partner } from "@/lib/project/types";

/** Sentinel for "no selection" - Radix Select forbids an empty string value. */
const NONE = "__none__";

/** Material classes that carry a hard acceptance rule from the specification. */
const CLASS_HINTS: Record<string, { tone: "danger" | "warning"; text: string }> = {
  M7: {
    tone: "danger",
    text: "Kein Sandkern-Material (z. B. Schleuderguss-Rohre mit Sandkern) annehmen.",
  },
  M2: {
    tone: "warning",
    text: "Hoher Füllstoffanteil (CaCO₃) — Verschleiß dokumentieren.",
  },
};

export interface BatchFormPayload {
  batch_code: string;
  supplier_partner_id: string | null;
  material_class: string;
  resin_type: string | null;
  weight_kg: number;
  received_date: string | null;
  declared_fiber_content_pct: number | null;
  declared_filler: string | null;
  contamination_notes: string | null;
  storage_location: string | null;
  status: string;
  notes: string | null;
}

interface MaterialBatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  batch: MaterialBatch | null;
  partners: Partner[];
  isSaving: boolean;
  onSubmit: (payload: BatchFormPayload) => void;
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

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

interface FormState {
  supplierId: string;
  materialClass: string;
  resinType: string;
  weightKg: string;
  receivedDate: string;
  fiberContent: string;
  declaredFiller: string;
  contaminationNotes: string;
  storageLocation: string;
  status: string;
  notes: string;
}

/** Fresh form for a new batch - the received date defaults to today. */
function createEmptyForm(): FormState {
  return {
    supplierId: NONE,
    materialClass: "M1",
    resinType: NONE,
    weightKg: "",
    receivedDate: new Date().toISOString().slice(0, 10),
    fiberContent: "",
    declaredFiller: "",
    contaminationNotes: "",
    storageLocation: "",
    status: "received",
    notes: "",
  };
}

function formFromBatch(batch: MaterialBatch): FormState {
  return {
    supplierId: batch.supplier_partner_id ?? NONE,
    materialClass: batch.material_class,
    resinType: batch.resin_type ?? NONE,
    weightKg: batch.weight_kg === null ? "" : String(batch.weight_kg),
    receivedDate: toDateInput(batch.received_date),
    fiberContent:
      batch.declared_fiber_content_pct === null ? "" : String(batch.declared_fiber_content_pct),
    declaredFiller: batch.declared_filler ?? "",
    contaminationNotes: batch.contamination_notes ?? "",
    storageLocation: batch.storage_location ?? "",
    status: batch.status,
    notes: batch.notes ?? "",
  };
}

export default function MaterialBatchesDialog({
  open,
  onOpenChange,
  mode,
  batch,
  partners,
  isSaving,
  onSubmit,
}: MaterialBatchesDialogProps) {
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  /** Bumped to re-trigger code generation after a failed attempt. */
  const [codeAttempt, setCodeAttempt] = useState(0);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (mode === "edit" && batch) {
      setForm(formFromBatch(batch));
      setCode(batch.batch_code);
      setCodeError(null);
      setCodeLoading(false);
    } else {
      setForm(createEmptyForm());
      setCode("");
    }
  }, [open, mode, batch]);

  useEffect(() => {
    if (!open || mode !== "create") return;
    let cancelled = false;
    setCodeLoading(true);
    setCodeError(null);
    nextProjectCode("material_batch")
      .then((generated) => {
        if (cancelled) return;
        setCode(generated);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setCode("");
        setCodeError(error.message);
      })
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, codeAttempt]);

  /** Material suppliers first, everyone else below - but all are selectable. */
  const partnerGroups = useMemo(() => {
    const suppliers = partners.filter((p) => p.category === "material_supplier");
    const others = partners.filter((p) => p.category !== "material_supplier");
    return { suppliers, others };
  }, [partners]);

  const selectedClass = MATERIAL_CLASSES.find((entry) => entry.id === form.materialClass);
  const classHint = CLASS_HINTS[form.materialClass];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!code.trim()) {
      nextErrors.code = "Chargencode konnte nicht erzeugt werden.";
    }

    const weight = parseDecimal(form.weightKg);
    if (!weight.ok) {
      nextErrors.weightKg = "Bitte eine gültige Zahl ≥ 0 eingeben.";
    } else if (weight.value === null) {
      nextErrors.weightKg = "Bitte das Anliefergewicht eingeben.";
    }

    const fiber = parseDecimal(form.fiberContent);
    if (!fiber.ok) {
      nextErrors.fiberContent = "Bitte eine gültige Zahl ≥ 0 eingeben.";
    } else if (fiber.value !== null && fiber.value > 100) {
      nextErrors.fiberContent = "Der Faseranteil kann höchstens 100 % betragen.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!weight.ok || weight.value === null || !fiber.ok) return;

    onSubmit({
      batch_code: code.trim(),
      supplier_partner_id: form.supplierId === NONE ? null : form.supplierId,
      material_class: form.materialClass,
      resin_type: form.resinType === NONE ? null : form.resinType,
      weight_kg: weight.value,
      received_date: form.receivedDate ? form.receivedDate : null,
      declared_fiber_content_pct: fiber.value,
      declared_filler: trimmedOrNull(form.declaredFiller),
      contamination_notes: trimmedOrNull(form.contaminationNotes),
      storage_location: trimmedOrNull(form.storageLocation),
      status: form.status,
      notes: trimmedOrNull(form.notes),
    });
  };

  const submitDisabled = isSaving || codeLoading || !code.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Neue Charge erfassen" : `Charge ${batch?.batch_code ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            Wareneingang für die Zerkleinerungsversuche. Der Chargencode wird automatisch vergeben.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="batch-code">Chargencode</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="batch-code"
                  value={codeLoading ? "wird erzeugt …" : code}
                  readOnly
                  aria-readonly="true"
                  className="font-mono bg-muted/50"
                />
                {mode === "create" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={codeLoading || isSaving}
                    onClick={() => setCodeAttempt((n) => n + 1)}
                    aria-label="Chargencode erneut erzeugen"
                    title="Chargencode erneut erzeugen"
                  >
                    <RotateCcw className={`h-4 w-4 ${codeLoading ? "animate-spin" : ""}`} />
                  </Button>
                )}
              </div>
              {codeError && <p className="text-xs text-destructive">{codeError}</p>}
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-supplier">Lieferant</Label>
              <Select value={form.supplierId} onValueChange={(value) => set("supplierId", value)}>
                <SelectTrigger id="batch-supplier">
                  <SelectValue placeholder="Lieferant wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Kein Lieferant hinterlegt</SelectItem>
                  {partnerGroups.suppliers.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Materiallieferanten</SelectLabel>
                      {partnerGroups.suppliers.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {partnerGroups.others.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Weitere Partner</SelectLabel>
                      {partnerGroups.others.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name} · {labelOf(PARTNER_CATEGORIES, partner.category)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              {partners.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Kein Partner zur Auswahl verfügbar. Die Charge lässt sich ohne Lieferant speichern
                  und später ergänzen.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="batch-class">Materialklasse</Label>
              <Select
                value={form.materialClass}
                onValueChange={(value) => set("materialClass", value)}
              >
                <SelectTrigger id="batch-class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-w-[min(22rem,calc(100vw-2rem))]">
                  {MATERIAL_CLASSES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      <span className="font-mono text-xs mr-1">{entry.id}</span>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClass && (
                <p className="text-xs text-muted-foreground">
                  Harz laut Klasse: {selectedClass.resin} — {selectedClass.note}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-resin">Harztyp</Label>
              <Select value={form.resinType} onValueChange={(value) => set("resinType", value)}>
                <SelectTrigger id="batch-resin">
                  <SelectValue placeholder="Harztyp wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Keine Angabe</SelectItem>
                  {RESIN_TYPES.map((resin) => (
                    <SelectItem key={resin} value={resin}>
                      {resin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {classHint && (
            <Alert
              variant={classHint.tone === "danger" ? "destructive" : "default"}
              className={classHint.tone === "warning" ? "border-warning/30 bg-warning/5" : undefined}
            >
              <AlertTriangle
                className={`h-4 w-4 ${classHint.tone === "warning" ? "text-warning" : ""}`}
              />
              <AlertTitle className={classHint.tone === "warning" ? "text-warning" : undefined}>
                {form.materialClass} — Annahmehinweis
              </AlertTitle>
              <AlertDescription className="text-sm">{classHint.text}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="batch-weight">Gewicht (kg)</Label>
              <Input
                id="batch-weight"
                inputMode="decimal"
                placeholder="z. B. 250"
                value={form.weightKg}
                onChange={(event) => set("weightKg", event.target.value)}
                aria-invalid={Boolean(errors.weightKg)}
              />
              {errors.weightKg && <p className="text-xs text-destructive">{errors.weightKg}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-received">Eingangsdatum</Label>
              <Input
                id="batch-received"
                type="date"
                value={form.receivedDate}
                onChange={(event) => set("receivedDate", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="batch-fiber">Deklarierter Faseranteil (%)</Label>
              <Input
                id="batch-fiber"
                inputMode="decimal"
                placeholder="z. B. 30"
                value={form.fiberContent}
                onChange={(event) => set("fiberContent", event.target.value)}
                aria-invalid={Boolean(errors.fiberContent)}
              />
              {errors.fiberContent && (
                <p className="text-xs text-destructive">{errors.fiberContent}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-filler">Füllstoff</Label>
              <Input
                id="batch-filler"
                placeholder="z. B. CaCO₃, ATH"
                value={form.declaredFiller}
                onChange={(event) => set("declaredFiller", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="batch-storage">Lagerort</Label>
              <Input
                id="batch-storage"
                placeholder="z. B. Halle 2 / Regal B"
                value={form.storageLocation}
                onChange={(event) => set("storageLocation", event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-status">Status</Label>
              <Select value={form.status} onValueChange={(value) => set("status", value)}>
                <SelectTrigger id="batch-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BATCH_STATUSES.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="batch-contamination">Störstoffe / Verunreinigungen</Label>
            <Textarea
              id="batch-contamination"
              rows={2}
              placeholder="Metalleinleger, Gelcoat, Schaumkern, Sandkern …"
              value={form.contaminationNotes}
              onChange={(event) => set("contaminationNotes", event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="batch-notes">Notizen</Label>
            <Textarea
              id="batch-notes"
              rows={2}
              placeholder="Herkunft, Vorzerkleinerung, Absprachen …"
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "create" ? "Charge anlegen" : "Änderungen speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
