/**
 * Dialogs of the mail templates page: the template editor (create + edit) and
 * the manual communication log entry (calls, meetings, visits).
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useProjectMutation } from "@/hooks/project/useProjectData";
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_DIRECTIONS,
  extractPlaceholderKeys,
  isoDateToday,
  localDateTimeInputValue,
  normalizePlaceholderKey,
} from "@/components/project/MailTemplatesShared";
import { EMAIL_TEMPLATE_CATEGORIES } from "@/lib/project/constants";
import type { EmailTemplate, Partner, PartnerContact } from "@/lib/project/types";

const DIALOG_CLASSES =
  "w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6";
const NO_CONTACT = "none";

/* ------------------------------------------------------------ template editor */

interface TemplateFormState {
  code: string;
  name: string;
  category: string;
  subject: string;
  bodyMd: string;
  notes: string;
  placeholders: string[];
}

const emptyTemplateForm = (): TemplateFormState => ({
  code: "",
  name: "",
  category: EMAIL_TEMPLATE_CATEGORIES[0].id,
  subject: "",
  bodyMd: "",
  notes: "",
  placeholders: [],
});

const templateToForm = (template: EmailTemplate): TemplateFormState => ({
  code: template.code,
  name: template.name,
  category: template.category,
  subject: template.subject,
  bodyMd: template.body_md,
  notes: template.notes ?? "",
  placeholders: (template.placeholders ?? [])
    .map(normalizePlaceholderKey)
    .filter((key) => key.length > 0),
});

export function TemplateDialog({
  open,
  onOpenChange,
  mode,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  template: EmailTemplate | null;
}) {
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [newPlaceholder, setNewPlaceholder] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(mode === "edit" && template ? templateToForm(template) : emptyTemplateForm());
    setNewPlaceholder("");
  }, [open, mode, template]);

  const detectedKeys = useMemo(
    () => extractPlaceholderKeys(form.subject, form.bodyMd),
    [form.subject, form.bodyMd],
  );
  const missingKeys = detectedKeys.filter((key) => !form.placeholders.includes(key));

  const saveMutation = useProjectMutation<TemplateFormState>(
    async (values) => {
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        category: values.category,
        subject: values.subject.trim(),
        body_md: values.bodyMd,
        placeholders: values.placeholders.map((key) => `{{${key}}}`),
        notes: values.notes.trim() ? values.notes.trim() : null,
      };

      if (mode === "create") {
        const { data, error } = await supabase
          .from("project_email_templates")
          .insert(payload)
          .select("id");
        if (error) {
          throw new Error(
            error.code === "23505"
              ? `Der Code „${payload.code}“ ist bereits vergeben.`
              : error.message,
          );
        }
        if (!data || data.length === 0) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
        return;
      }

      if (!template) throw new Error("Keine Vorlage zum Bearbeiten ausgewählt");
      const { data, error } = await supabase
        .from("project_email_templates")
        .update(payload)
        .eq("id", template.id)
        .select("id");
      if (error) {
        throw new Error(
          error.code === "23505"
            ? `Der Code „${payload.code}“ ist bereits vergeben.`
            : error.message,
        );
      }
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: mode === "create" ? "Vorlage angelegt" : "Vorlage gespeichert",
      errorMessage: "Vorlage konnte nicht gespeichert werden",
      onDone: () => onOpenChange(false),
    },
  );

  const addPlaceholder = (raw: string) => {
    const key = normalizePlaceholderKey(raw);
    if (!key) return;
    setForm((current) =>
      current.placeholders.includes(key)
        ? current
        : { ...current, placeholders: [...current.placeholders, key] },
    );
    setNewPlaceholder("");
  };

  const removePlaceholder = (key: string) => {
    setForm((current) => ({
      ...current,
      placeholders: current.placeholders.filter((entry) => entry !== key),
    }));
  };

  const adoptDetected = () => {
    setForm((current) => ({
      ...current,
      placeholders: [
        ...current.placeholders,
        ...detectedKeys.filter((key) => !current.placeholders.includes(key)),
      ],
    }));
  };

  const handleSubmit = () => {
    if (!form.code.trim() || !form.name.trim() || !form.subject.trim() || !form.bodyMd.trim()) {
      toast({
        variant: "destructive",
        title: "Pflichtfelder fehlen",
        description: "Code, Name, Betreff und Text müssen ausgefüllt sein.",
      });
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASSES}>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Neue Mailvorlage" : "Vorlage bearbeiten"}</DialogTitle>
          <DialogDescription>
            Platzhalter im Format {"{{name}}"} werden im Composer automatisch oder manuell gefüllt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-code">Code *</Label>
              <Input
                id="template-code"
                value={form.code}
                onChange={(event) => setForm((c) => ({ ...c, code: event.target.value }))}
                placeholder="z. B. MAT-ANFRAGE"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-category">Kategorie</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((c) => ({ ...c, category: value }))}
              >
                <SelectTrigger id="template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {EMAIL_TEMPLATE_CATEGORIES.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name *</Label>
            <Input
              id="template-name"
              value={form.name}
              onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
              placeholder="Materialanfrage an Produzenten"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-subject">Betreff *</Label>
            <Input
              id="template-subject"
              value={form.subject}
              onChange={(event) => setForm((c) => ({ ...c, subject: event.target.value }))}
              placeholder="Anfrage GFK-Produktionsreste"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-body">Text *</Label>
            <Textarea
              id="template-body"
              value={form.bodyMd}
              onChange={(event) => setForm((c) => ({ ...c, bodyMd: event.target.value }))}
              rows={12}
              className="font-mono text-xs"
              placeholder={"Sehr geehrte(r) {{contact_name}},\n\n…\n\nMit freundlichen Grüßen\n{{sender_name}}"}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Platzhalter</Label>
              {missingKeys.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={adoptDetected}>
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  {missingKeys.length} aus Text übernehmen
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.placeholders.length === 0 ? (
                <span className="text-xs text-muted-foreground">Noch keine Platzhalter gelistet</span>
              ) : (
                form.placeholders.map((key) => (
                  <Badge key={key} variant="outline" className="gap-1 font-mono text-[11px] font-normal">
                    {`{{${key}}}`}
                    <button
                      type="button"
                      onClick={() => removePlaceholder(key)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Platzhalter ${key} entfernen`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newPlaceholder}
                onChange={(event) => setNewPlaceholder(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPlaceholder(newPlaceholder);
                  }
                }}
                placeholder="quantity"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addPlaceholder(newPlaceholder)}
                disabled={!normalizePlaceholderKey(newPlaceholder)}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Platzhalter hinzufügen</span>
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-notes">Notizen</Label>
            <Textarea
              id="template-notes"
              value={form.notes}
              onChange={(event) => setForm((c) => ({ ...c, notes: event.target.value }))}
              rows={3}
              placeholder="Wann wird diese Vorlage eingesetzt?"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Vorlage anlegen" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------- manual communication entry */

interface CommunicationFormState {
  partnerId: string;
  contactId: string;
  direction: string;
  channel: string;
  subject: string;
  body: string;
  occurredAt: string;
  touchContact: boolean;
}

const emptyCommunicationForm = (): CommunicationFormState => ({
  partnerId: "",
  contactId: NO_CONTACT,
  direction: "inbound",
  channel: "phone",
  subject: "",
  body: "",
  occurredAt: localDateTimeInputValue(),
  touchContact: true,
});

export function CommunicationDialog({
  open,
  onOpenChange,
  partners,
  contacts,
  partnersLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partners: Partner[];
  contacts: PartnerContact[];
  partnersLoading?: boolean;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<CommunicationFormState>(emptyCommunicationForm);

  useEffect(() => {
    if (!open) return;
    setForm(emptyCommunicationForm());
  }, [open]);

  const partnerContacts = useMemo(
    () => contacts.filter((entry) => entry.partner_id === form.partnerId),
    [contacts, form.partnerId],
  );

  const saveMutation = useProjectMutation<CommunicationFormState>(
    async (values) => {
      const occurred = new Date(values.occurredAt);
      if (Number.isNaN(occurred.getTime())) {
        throw new Error("Der Zeitpunkt ist ungültig.");
      }
      const contactId = values.contactId === NO_CONTACT ? null : values.contactId;

      const { data, error } = await supabase
        .from("project_communications")
        .insert({
          partner_id: values.partnerId,
          contact_id: contactId,
          direction: values.direction,
          channel: values.channel,
          subject: values.subject.trim() ? values.subject.trim() : null,
          body: values.body.trim() ? values.body.trim() : null,
          occurred_at: occurred.toISOString(),
          created_by: user?.id ?? null,
        })
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }

      if (contactId && values.touchContact) {
        const { data: updated, error: updateError } = await supabase
          .from("project_contacts")
          .update({ last_contact_date: isoDateToday() })
          .eq("id", contactId)
          .select("id");
        if (updateError) throw new Error(updateError.message);
        if (!updated || updated.length === 0) {
          throw new Error(
            "Eintrag gespeichert, aber der letzte Kontakt konnte nicht aktualisiert werden: Keine Berechtigung oder Datensatz nicht gefunden",
          );
        }
      }
    },
    {
      successMessage: "Eintrag protokolliert",
      errorMessage: "Eintrag konnte nicht gespeichert werden",
      onDone: () => onOpenChange(false),
    },
  );

  const handleSubmit = () => {
    if (!form.partnerId) {
      toast({
        variant: "destructive",
        title: "Partner fehlt",
        description: "Bitte den Partner auswählen, zu dem der Kontakt gehört.",
      });
      return;
    }
    if (!form.subject.trim() && !form.body.trim()) {
      toast({
        variant: "destructive",
        title: "Inhalt fehlt",
        description: "Bitte mindestens einen Betreff oder eine Notiz erfassen.",
      });
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASSES}>
        <DialogHeader>
          <DialogTitle>Kommunikation erfassen</DialogTitle>
          <DialogDescription>
            Telefonate, Besprechungen und Besuche nachträglich im Verlauf dokumentieren.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="comm-partner">Partner *</Label>
              <Select
                value={form.partnerId}
                onValueChange={(value) =>
                  setForm((c) => ({ ...c, partnerId: value, contactId: NO_CONTACT }))
                }
                disabled={partnersLoading}
              >
                <SelectTrigger id="comm-partner">
                  <SelectValue placeholder={partnersLoading ? "Wird geladen …" : "Partner wählen"} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {partnersLoading ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      Partner werden geladen …
                    </div>
                  ) : partners.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      Keine Partner vorhanden
                    </div>
                  ) : (
                    partners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comm-contact">Ansprechpartner</Label>
              <Select
                value={form.contactId}
                onValueChange={(value) => setForm((c) => ({ ...c, contactId: value }))}
                disabled={!form.partnerId}
              >
                <SelectTrigger id="comm-contact">
                  <SelectValue placeholder={form.partnerId ? "Kontakt wählen" : "Erst Partner wählen"} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value={NO_CONTACT}>Ohne Ansprechpartner</SelectItem>
                  {partnerContacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.role ? ` — ${contact.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comm-direction">Richtung</Label>
              <Select
                value={form.direction}
                onValueChange={(value) => setForm((c) => ({ ...c, direction: value }))}
              >
                <SelectTrigger id="comm-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {COMMUNICATION_DIRECTIONS.map((direction) => (
                    <SelectItem key={direction.id} value={direction.id}>
                      {direction.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="comm-channel">Kanal</Label>
              <Select
                value={form.channel}
                onValueChange={(value) => setForm((c) => ({ ...c, channel: value }))}
              >
                <SelectTrigger id="comm-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {COMMUNICATION_CHANNELS.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comm-occurred">Zeitpunkt</Label>
            <Input
              id="comm-occurred"
              type="datetime-local"
              value={form.occurredAt}
              onChange={(event) => setForm((c) => ({ ...c, occurredAt: event.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comm-subject">Betreff</Label>
            <Input
              id="comm-subject"
              value={form.subject}
              onChange={(event) => setForm((c) => ({ ...c, subject: event.target.value }))}
              placeholder="Telefonat Technikumstermin"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comm-body">Notiz</Label>
            <Textarea
              id="comm-body"
              value={form.body}
              onChange={(event) => setForm((c) => ({ ...c, body: event.target.value }))}
              rows={6}
              placeholder="Ergebnis, Zusagen, nächste Schritte …"
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={form.touchContact}
              disabled={form.contactId === NO_CONTACT}
              onCheckedChange={(checked) =>
                setForm((c) => ({ ...c, touchContact: checked === true }))
              }
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              Letzten Kontakt beim Ansprechpartner auf heute setzen
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eintrag speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
