/**
 * Partner master data form. Used by the create dialog on the partner list and
 * by the "Stammdaten" tab of the partner detail sheet.
 */
import { useId } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IpGateBanner } from "@/components/project/ProjectUI";
import {
  CheckboxGroup,
  RatingPicker,
  subcategoryLabel,
  type OptionItem,
  trimmedOrNull,
} from "@/components/project/ProjectPartnersShared";
import { MATERIAL_CLASSES, PARTNER_CATEGORIES, PARTNER_STATUSES } from "@/lib/project/constants";
import type { Partner } from "@/lib/project/types";

export interface PartnerFormValues {
  name: string;
  category: string;
  subcategory: string;
  status: string;
  suitability_rating: number | null;
  is_fixed_partner: boolean;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  website: string;
  phone: string;
  email: string;
  material_classes: string[];
  fraction_ids: string[];
  notes: string;
}

/** What actually goes to project_partners - every field exists as a column. */
export interface PartnerWritePayload {
  name: string;
  category: string;
  subcategory: string | null;
  status: string;
  suitability_rating: number | null;
  is_fixed_partner: boolean;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  material_classes: string[];
  fraction_ids: string[];
  notes: string | null;
}

export function emptyPartnerForm(): PartnerFormValues {
  return {
    name: "",
    category: PARTNER_CATEGORIES[0].id,
    subcategory: "",
    status: PARTNER_STATUSES[0].id,
    suitability_rating: null,
    is_fixed_partner: false,
    street: "",
    postal_code: "",
    city: "",
    country: "DE",
    website: "",
    phone: "",
    email: "",
    material_classes: [],
    fraction_ids: [],
    notes: "",
  };
}

export function partnerToForm(partner: Partner): PartnerFormValues {
  return {
    name: partner.name,
    category: partner.category,
    subcategory: partner.subcategory ?? "",
    status: partner.status,
    suitability_rating: partner.suitability_rating,
    is_fixed_partner: partner.is_fixed_partner,
    street: partner.street ?? "",
    postal_code: partner.postal_code ?? "",
    city: partner.city ?? "",
    country: partner.country ?? "",
    website: partner.website ?? "",
    phone: partner.phone ?? "",
    email: partner.email ?? "",
    material_classes: partner.material_classes ?? [],
    fraction_ids: partner.fraction_ids ?? [],
    notes: partner.notes ?? "",
  };
}

export function formToPayload(values: PartnerFormValues): PartnerWritePayload {
  return {
    name: values.name.trim(),
    category: values.category,
    subcategory: trimmedOrNull(values.subcategory),
    status: values.status,
    suitability_rating: values.suitability_rating,
    is_fixed_partner: values.is_fixed_partner,
    street: trimmedOrNull(values.street),
    postal_code: trimmedOrNull(values.postal_code),
    city: trimmedOrNull(values.city),
    country: trimmedOrNull(values.country),
    website: trimmedOrNull(values.website),
    phone: trimmedOrNull(values.phone),
    email: trimmedOrNull(values.email),
    material_classes: values.material_classes,
    fraction_ids: values.fraction_ids,
    notes: trimmedOrNull(values.notes),
  };
}

/** German validation message, or null when the form may be submitted. */
export function validatePartnerForm(values: PartnerFormValues): string | null {
  if (!values.name.trim()) return "Bitte einen Namen angeben.";
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return "Die E-Mail-Adresse ist nicht gültig.";
  }
  if (
    values.website.trim() &&
    !/^(https?:\/\/|www\.)/i.test(values.website.trim())
  ) {
    return "Die Website muss mit http://, https:// oder www. beginnen.";
  }
  return null;
}

/**
 * Statuses / categories that mean a manufacturer trial is being prepared.
 * Those are phase-2 activities and are gated by the patent filing (P0-2).
 */
const TRIAL_CATEGORIES = new Set(["machine_manufacturer", "toll_processor", "research_institute"]);

export function isPhaseTwoActivity(category: string, status: string): boolean {
  return TRIAL_CATEGORIES.has(category) && (status === "testing" || status === "active_partner");
}

const MATERIAL_OPTIONS: OptionItem[] = MATERIAL_CLASSES.map((entry) => ({
  id: entry.id,
  label: `${entry.id} — ${entry.label}`,
  hint: entry.resin,
}));

interface FieldsProps {
  values: PartnerFormValues;
  onChange: (values: PartnerFormValues) => void;
  fractionOptions: OptionItem[];
  subcategorySuggestions: string[];
  disabled?: boolean;
  idPrefix: string;
}

export function PartnerFormFields({
  values,
  onChange,
  fractionOptions,
  subcategorySuggestions,
  disabled,
  idPrefix,
}: FieldsProps) {
  const set = <K extends keyof PartnerFormValues>(key: K, value: PartnerFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const listId = `${idPrefix}-subcategories`;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          disabled={disabled}
          onChange={(event) => set("name", event.target.value)}
          placeholder="z. B. Vecoplan AG"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-category`}>Kategorie</Label>
          <Select
            value={values.category}
            disabled={disabled}
            onValueChange={(value) => set("category", value)}
          >
            <SelectTrigger id={`${idPrefix}-category`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTNER_CATEGORIES.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-subcategory`}>Unterkategorie</Label>
          <Input
            id={`${idPrefix}-subcategory`}
            value={values.subcategory}
            disabled={disabled}
            list={listId}
            onChange={(event) => set("subcategory", event.target.value)}
            placeholder="z. B. shear_mill"
          />
          {/* Stored value stays the key, the picker shows the German label. */}
          <datalist id={listId}>
            {subcategorySuggestions.map((entry) => (
              <option key={entry} value={entry}>
                {subcategoryLabel(entry)}
              </option>
            ))}
          </datalist>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select
            value={values.status}
            disabled={disabled}
            onValueChange={(value) => set("status", value)}
          >
            <SelectTrigger id={`${idPrefix}-status`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTNER_STATUSES.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Eignung (1–5)</Label>
          <RatingPicker
            value={values.suitability_rating}
            disabled={disabled}
            onChange={(value) => set("suitability_rating", value)}
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-md border border-violet-400/30 bg-violet-400/5 p-3">
        <div className="min-w-0">
          <Label htmlFor={`${idPrefix}-fixed`} className="font-semibold">
            Fixpartner („Gesetzt“)
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Im Projektplan fest eingeplant — wird in allen Ansichten zuerst gelistet.
          </p>
        </div>
        <Switch
          id={`${idPrefix}-fixed`}
          checked={values.is_fixed_partner}
          disabled={disabled}
          onCheckedChange={(checked) => set("is_fixed_partner", checked)}
        />
      </div>

      {isPhaseTwoActivity(values.category, values.status) && <IpGateBanner compact />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-street`}>Straße</Label>
          <Input
            id={`${idPrefix}-street`}
            value={values.street}
            disabled={disabled}
            onChange={(event) => set("street", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-postal`}>PLZ</Label>
          <Input
            id={`${idPrefix}-postal`}
            value={values.postal_code}
            disabled={disabled}
            onChange={(event) => set("postal_code", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-city`}>Ort</Label>
          <Input
            id={`${idPrefix}-city`}
            value={values.city}
            disabled={disabled}
            onChange={(event) => set("city", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-country`}>Land</Label>
          <Input
            id={`${idPrefix}-country`}
            value={values.country}
            disabled={disabled}
            maxLength={40}
            onChange={(event) => set("country", event.target.value)}
            placeholder="DE"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-website`}>Website</Label>
          <Input
            id={`${idPrefix}-website`}
            value={values.website}
            disabled={disabled}
            inputMode="url"
            onChange={(event) => set("website", event.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-phone`}>Telefon</Label>
          <Input
            id={`${idPrefix}-phone`}
            value={values.phone}
            disabled={disabled}
            inputMode="tel"
            onChange={(event) => set("phone", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-email`}>E-Mail</Label>
          <Input
            id={`${idPrefix}-email`}
            value={values.email}
            disabled={disabled}
            inputMode="email"
            onChange={(event) => set("email", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Materialklassen</Label>
        <CheckboxGroup
          idPrefix={`${idPrefix}-mat`}
          options={MATERIAL_OPTIONS}
          value={values.material_classes}
          disabled={disabled}
          onChange={(next) => set("material_classes", next)}
        />
      </div>

      <div className="space-y-2">
        <Label>Zielfraktionen</Label>
        <CheckboxGroup
          idPrefix={`${idPrefix}-frac`}
          options={fractionOptions}
          value={values.fraction_ids}
          disabled={disabled}
          onChange={(next) => set("fraction_ids", next)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>Notizen</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={values.notes}
          disabled={disabled}
          rows={4}
          onChange={(event) => set("notes", event.target.value)}
          placeholder="Technikum, Maschinentypen, Besonderheiten …"
        />
      </div>
    </div>
  );
}

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: PartnerFormValues;
  onValuesChange: (values: PartnerFormValues) => void;
  onSubmit: () => void;
  isPending: boolean;
  fractionOptions: OptionItem[];
  subcategorySuggestions: string[];
}

export function PartnerCreateDialog({
  open,
  onOpenChange,
  values,
  onValuesChange,
  onSubmit,
  isPending,
  fractionOptions,
  subcategorySuggestions,
}: CreateDialogProps) {
  const idPrefix = useId();
  const error = validatePartnerForm(values);

  return (
    <Dialog open={open} onOpenChange={(next) => (isPending ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Partner anlegen</DialogTitle>
          <DialogDescription>
            Stammdaten für Maschinenhersteller, Lieferanten, Labore, Produktpartner und Kunden.
          </DialogDescription>
        </DialogHeader>

        <PartnerFormFields
          idPrefix={`create-${idPrefix}`}
          values={values}
          onChange={onValuesChange}
          fractionOptions={fractionOptions}
          subcategorySuggestions={subcategorySuggestions}
          disabled={isPending}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Abbrechen
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isPending || Boolean(error)}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Partner speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
