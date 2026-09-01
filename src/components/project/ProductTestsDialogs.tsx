/**
 * Create dialogs for the Produkttests page.
 *
 * A product test at a manufacturer is a phase-2 activity: it exposes the
 * process to a third party, so the IP gate banner rides along in both dialogs.
 */
import { useEffect, useMemo, useState } from "react";
import { Layers, Loader2, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  nextProjectCode,
  useInvalidateProject,
  useProjectMutation,
} from "@/hooks/project/useProjectData";
import { DOSAGE_SERIES, PRODUCT_TEST_CATEGORIES } from "@/lib/project/constants";
import {
  NO_SELECTION,
  PRODUCT_TEST_STATUSES,
  ReleasedFractionField,
  parseDecimal,
} from "@/components/project/ProductTestsShared";
import type { OutputFraction, Partner } from "@/lib/project/types";

const DIALOG_CLASS =
  "w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6";

interface DialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: Partner[];
  fractions: OutputFraction[];
}

function PartnerField({
  id,
  partners,
  value,
  onChange,
}: {
  id: string;
  partners: Partner[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Partner</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Partner wählen" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value={NO_SELECTION}>Ohne Partner (intern)</SelectItem>
          {partners.map((partner) => (
            <SelectItem key={partner.id} value={partner.id}>
              {partner.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CategoryField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Kategorie *</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Kategorie wählen" />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {PRODUCT_TEST_CATEGORIES.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ------------------------------------------------------------ single test */

interface CreateValues {
  title: string;
  category: string;
  partnerId: string | null;
  fractionId: string | null;
  dosagePct: number | null;
  status: string;
  plannedDate: string | null;
  costEur: number | null;
  recipeNotes: string | null;
}

export function ProductTestCreateDialog({ open, onOpenChange, partners, fractions }: DialogBaseProps) {
  const [codePreview, setCodePreview] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(PRODUCT_TEST_CATEGORIES[0].id);
  const [partnerId, setPartnerId] = useState<string>(NO_SELECTION);
  const [fractionId, setFractionId] = useState<string>(NO_SELECTION);
  const [dosage, setDosage] = useState("");
  const [status, setStatus] = useState("planned");
  const [plannedDate, setPlannedDate] = useState("");
  const [cost, setCost] = useState("");
  const [recipeNotes, setRecipeNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCategory(PRODUCT_TEST_CATEGORIES[0].id);
    setPartnerId(NO_SELECTION);
    setFractionId(NO_SELECTION);
    setDosage("");
    setStatus("planned");
    setPlannedDate("");
    setCost("");
    setRecipeNotes("");
    setCodePreview(null);
    setCodeError(null);

    let cancelled = false;
    nextProjectCode("product_test")
      .then((code) => {
        if (!cancelled) setCodePreview(code);
      })
      .catch((error: Error) => {
        if (!cancelled) setCodeError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const create = useProjectMutation<CreateValues>(
    async (values) => {
      const code = await nextProjectCode("product_test");
      const { data, error } = await supabase
        .from("product_tests")
        .insert({
          test_code: code,
          title: values.title,
          category: values.category,
          partner_id: values.partnerId,
          output_fraction_id: values.fractionId,
          dosage_pct: values.dosagePct,
          status: values.status,
          planned_date: values.plannedDate,
          cost_eur: values.costEur,
          recipe_notes: values.recipeNotes,
        })
        .select();
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
      toast({ title: "Produkttest angelegt", description: `${code} — ${values.title}` });
      return data[0];
    },
    {
      errorMessage: "Produkttest konnte nicht angelegt werden",
      onDone: () => onOpenChange(false),
    },
  );

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && !create.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    create.mutate({
      title: trimmedTitle,
      category,
      partnerId: partnerId === NO_SELECTION ? null : partnerId,
      fractionId: fractionId === NO_SELECTION ? null : fractionId,
      dosagePct: parseDecimal(dosage),
      status,
      plannedDate: plannedDate || null,
      costEur: parseDecimal(cost),
      recipeNotes: recipeNotes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle>Neuer Produkttest</DialogTitle>
          <DialogDescription>
            Validierung einer freigegebenen Fraktion in einer Baustoff- oder Compound-Rezeptur.
          </DialogDescription>
        </DialogHeader>


        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pt-code">Testcode</Label>
            <Input
              id="pt-code"
              readOnly
              value={codeError ? "" : codePreview ?? "wird vergeben …"}
              placeholder={codeError ? "Code nicht abrufbar" : undefined}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {codeError
                ? `Codevorschau fehlgeschlagen: ${codeError}. Der endgültige Code wird beim Speichern vergeben.`
                : "Wird beim Speichern fortlaufend aus der Datenbank vergeben."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pt-title">Titel *</Label>
            <Input
              id="pt-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="z. B. Mörtel M2 mit F4-Rezyklatfaser"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CategoryField id="pt-category" value={category} onChange={setCategory} />
            <PartnerField id="pt-partner" partners={partners} value={partnerId} onChange={setPartnerId} />
          </div>

          <ReleasedFractionField
            id="pt-fraction"
            fractions={fractions}
            value={fractionId}
            onChange={setFractionId}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pt-dosage">Dosierung (%)</Label>
              <Input
                id="pt-dosage"
                inputMode="decimal"
                value={dosage}
                onChange={(event) => setDosage(event.target.value)}
                placeholder="z. B. 10 — 0 für die Baseline"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="pt-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {PRODUCT_TEST_STATUSES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pt-planned">Geplantes Datum</Label>
              <Input
                id="pt-planned"
                type="date"
                value={plannedDate}
                onChange={(event) => setPlannedDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-cost">Kosten (EUR)</Label>
              <Input
                id="pt-cost"
                inputMode="decimal"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                placeholder="z. B. 1200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pt-recipe">Rezeptur / Notizen</Label>
            <Textarea
              id="pt-recipe"
              rows={3}
              value={recipeNotes}
              onChange={(event) => setRecipeNotes(event.target.value)}
              placeholder="Bindemittel, w/z-Wert, Zuschlag, Mischregime …"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Produkttest anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ dosage series */

interface SeriesValues {
  titlePrefix: string;
  category: string;
  partnerId: string | null;
  fractionId: string | null;
  plannedDate: string | null;
  costEur: number | null;
  recipeNotes: string | null;
}

function seriesTitle(prefix: string, dosage: number): string {
  return dosage === 0 ? `${prefix} — Baseline 0 %` : `${prefix} — ${dosage} % Dosierung`;
}

/**
 * Creates the whole dosage ladder in one go: the baseline recipe without
 * recycled fibre plus one test per DOSAGE_SERIES step. Codes come from the
 * RPC one at a time — it derives the next number from the stored rows, so the
 * inserts have to be sequential.
 */
export function DosageSeriesDialog({ open, onOpenChange, partners, fractions }: DialogBaseProps) {
  const [titlePrefix, setTitlePrefix] = useState("");
  const [category, setCategory] = useState<string>(PRODUCT_TEST_CATEGORIES[0].id);
  const [partnerId, setPartnerId] = useState<string>(NO_SELECTION);
  const [fractionId, setFractionId] = useState<string>(NO_SELECTION);
  const [plannedDate, setPlannedDate] = useState("");
  const [cost, setCost] = useState("");
  const [recipeNotes, setRecipeNotes] = useState("");
  const invalidateProject = useInvalidateProject();

  const dosages = useMemo<number[]>(() => [0, ...DOSAGE_SERIES], []);

  useEffect(() => {
    if (!open) return;
    setTitlePrefix("");
    setCategory(PRODUCT_TEST_CATEGORIES[0].id);
    setPartnerId(NO_SELECTION);
    setFractionId(NO_SELECTION);
    setPlannedDate("");
    setCost("");
    setRecipeNotes("");
  }, [open]);

  const createSeries = useProjectMutation<SeriesValues>(
    async (values) => {
      const created: string[] = [];
      try {
        for (const dosage of dosages) {
          const code = await nextProjectCode("product_test");
          const { data, error } = await supabase
            .from("product_tests")
            .insert({
              test_code: code,
              title: seriesTitle(values.titlePrefix, dosage),
              category: values.category,
              partner_id: values.partnerId,
              output_fraction_id: values.fractionId,
              dosage_pct: dosage,
              status: "planned",
              planned_date: values.plannedDate,
              cost_eur: values.costEur,
              recipe_notes: values.recipeNotes,
            })
            .select();
          if (error) throw new Error(error.message);
          if (!data || data.length === 0) {
            throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
          }
          created.push(code);
        }
      } catch (caught) {
        // Partial series: refresh so the user sees what already exists.
        invalidateProject();
        const message = caught instanceof Error ? caught.message : String(caught);
        throw new Error(
          created.length
            ? `Nur ${created.length} von ${dosages.length} Produkttests angelegt (${created.join(", ")}). Abbruch bei Dosierung ${dosages[created.length]} %: ${message}`
            : message,
        );
      }

      toast({
        title: `${created.length} Produkttests angelegt`,
        description: `Dosierreihe ${created[0]} bis ${created[created.length - 1]}: Baseline 0 % sowie ${DOSAGE_SERIES.join(" / ")} %.`,
      });
      return created;
    },
    {
      errorMessage: "Dosierreihe konnte nicht angelegt werden",
      onDone: () => onOpenChange(false),
    },
  );

  const trimmedPrefix = titlePrefix.trim();
  const canSubmit = trimmedPrefix.length > 0 && !createSeries.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    createSeries.mutate({
      titlePrefix: trimmedPrefix,
      category,
      partnerId: partnerId === NO_SELECTION ? null : partnerId,
      fractionId: fractionId === NO_SELECTION ? null : fractionId,
      plannedDate: plannedDate || null,
      costEur: parseDecimal(cost),
      recipeNotes: recipeNotes.trim() || null,
    });
  };

  const previewPrefix = trimmedPrefix || "Dosierreihe";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle>Dosierreihe anlegen</DialogTitle>
          <DialogDescription>
            Legt {dosages.length} Produkttests mit gemeinsamem Titelpräfix, Kategorie, Partner und Fraktion
            an: die Baseline ohne Faser sowie je einen Test für {DOSAGE_SERIES.join(" / ")} % Dosierung.
          </DialogDescription>
        </DialogHeader>


        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ds-prefix">Titelpräfix *</Label>
            <Input
              id="ds-prefix"
              value={titlePrefix}
              onChange={(event) => setTitlePrefix(event.target.value)}
              placeholder="z. B. Mörtel VELOSIT 503 mit F4"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CategoryField id="ds-category" value={category} onChange={setCategory} />
            <PartnerField id="ds-partner" partners={partners} value={partnerId} onChange={setPartnerId} />
          </div>

          <ReleasedFractionField
            id="ds-fraction"
            fractions={fractions}
            value={fractionId}
            onChange={setFractionId}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ds-planned">Geplantes Datum (alle Tests)</Label>
              <Input
                id="ds-planned"
                type="date"
                value={plannedDate}
                onChange={(event) => setPlannedDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-cost">Kosten je Test (EUR)</Label>
              <Input
                id="ds-cost"
                inputMode="decimal"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                placeholder="z. B. 450"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ds-recipe">Rezeptur / Notizen (alle Tests)</Label>
            <Textarea
              id="ds-recipe"
              rows={2}
              value={recipeNotes}
              onChange={(event) => setRecipeNotes(event.target.value)}
              placeholder="Gemeinsame Grundrezeptur der Reihe"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Diese {dosages.length} Tests werden angelegt
            </p>
            <ul className="space-y-1 text-sm">
              {dosages.map((dosage) => (
                <li key={dosage} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />
                  <span className="break-words">{seriesTitle(previewPrefix, dosage)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createSeries.isPending}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createSeries.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Layers className="h-4 w-4" />
            )}
            {dosages.length} Tests anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
