/**
 * "Kontakte" tab of the partner detail sheet: list, create, edit, delete of
 * project_contacts including the primary / decision maker flags and the
 * follow-up action.
 */
import { useId, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Smartphone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePartnerContacts, useProjectMutation } from "@/hooks/project/useProjectData";
import { EmptyState, ErrorState, LoadingRows, formatDate } from "@/components/project/ProjectUI";
import { dateOrNull, isDueOrOverdue, trimmedOrNull } from "@/components/project/ProjectPartnersShared";
import type { PartnerContact } from "@/lib/project/types";
import { cn } from "@/lib/utils";

interface ContactFormValues {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  mobile: string;
  is_primary: boolean;
  is_decision_maker: boolean;
  last_contact_date: string;
  next_action: string;
  next_action_date: string;
  notes: string;
}

function emptyContactForm(): ContactFormValues {
  return {
    name: "",
    role: "",
    department: "",
    email: "",
    phone: "",
    mobile: "",
    is_primary: false,
    is_decision_maker: false,
    last_contact_date: "",
    next_action: "",
    next_action_date: "",
    notes: "",
  };
}

function contactToForm(contact: PartnerContact): ContactFormValues {
  return {
    name: contact.name,
    role: contact.role ?? "",
    department: contact.department ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    mobile: contact.mobile ?? "",
    is_primary: contact.is_primary,
    is_decision_maker: contact.is_decision_maker,
    last_contact_date: contact.last_contact_date ?? "",
    next_action: contact.next_action ?? "",
    next_action_date: contact.next_action_date ?? "",
    notes: contact.notes ?? "",
  };
}

function todayIsoDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface SaveVars {
  contactId: string | null;
  values: ContactFormValues;
}

export default function PartnerContactsTab({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const contactsQuery = usePartnerContacts(partnerId);
  const idPrefix = useId();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerContact | null>(null);
  const [values, setValues] = useState<ContactFormValues>(emptyContactForm);
  const [toDelete, setToDelete] = useState<PartnerContact | null>(null);

  const saveMutation = useProjectMutation<SaveVars>(
    async ({ contactId, values: form }) => {
      const payload = {
        partner_id: partnerId,
        name: form.name.trim(),
        role: trimmedOrNull(form.role),
        department: trimmedOrNull(form.department),
        email: trimmedOrNull(form.email),
        phone: trimmedOrNull(form.phone),
        mobile: trimmedOrNull(form.mobile),
        is_primary: form.is_primary,
        is_decision_maker: form.is_decision_maker,
        last_contact_date: dateOrNull(form.last_contact_date),
        next_action: trimmedOrNull(form.next_action),
        next_action_date: dateOrNull(form.next_action_date),
        notes: trimmedOrNull(form.notes),
      };

      let savedId = contactId;

      if (contactId) {
        const { data, error } = await supabase
          .from("project_contacts")
          .update(payload)
          .eq("id", contactId)
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
      } else {
        const { data, error } = await supabase
          .from("project_contacts")
          .insert(payload)
          .select("id");
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) {
          throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
        }
        savedId = data[0].id;
      }

      // Only one primary contact per partner.
      if (form.is_primary && savedId) {
        const { error: demoteError } = await supabase
          .from("project_contacts")
          .update({ is_primary: false })
          .eq("partner_id", partnerId)
          .neq("id", savedId);
        if (demoteError) throw new Error(demoteError.message);
      }
    },
    {
      successMessage: "Kontakt gespeichert",
      errorMessage: "Kontakt konnte nicht gespeichert werden",
      onDone: () => {
        setDialogOpen(false);
        setEditing(null);
      },
    },
  );

  const deleteMutation = useProjectMutation<PartnerContact>(
    async (contact) => {
      const { data, error } = await supabase
        .from("project_contacts")
        .delete()
        .eq("id", contact.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Kontakt gelöscht",
      errorMessage: "Kontakt konnte nicht gelöscht werden",
      onDone: () => setToDelete(null),
    },
  );

  const touchMutation = useProjectMutation<PartnerContact>(
    async (contact) => {
      const { data, error } = await supabase
        .from("project_contacts")
        .update({ last_contact_date: todayIsoDate() })
        .eq("id", contact.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Als heute kontaktiert vermerkt",
      errorMessage: "Kontaktdatum konnte nicht gesetzt werden",
    },
  );

  const openCreate = () => {
    setEditing(null);
    setValues(emptyContactForm());
    setDialogOpen(true);
  };

  const openEdit = (contact: PartnerContact) => {
    setEditing(contact);
    setValues(contactToForm(contact));
    setDialogOpen(true);
  };

  const formError = values.name.trim() ? null : "Bitte einen Namen angeben.";

  const contacts = contactsQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {contacts.length === 1 ? "1 Kontakt" : `${contacts.length} Kontakte`} bei {partnerName}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Kontakt hinzufügen
        </Button>
      </div>

      {contactsQuery.isLoading ? (
        <LoadingRows rows={3} />
      ) : contactsQuery.isError ? (
        <ErrorState
          error={contactsQuery.error as Error}
          onRetry={() => void contactsQuery.refetch()}
        />
      ) : contacts.length === 0 ? (
        <EmptyState
          title="Noch keine Kontakte"
          description="Ansprechpartner mit Rolle, Telefon und nächster Aktion hinterlegen."
          action={
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Ersten Kontakt anlegen
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight break-words">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[contact.role, contact.department].filter(Boolean).join(" · ") || "Ohne Rolle"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Kontakt bearbeiten"
                      onClick={() => openEdit(contact)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label="Kontakt löschen"
                      onClick={() => setToDelete(contact)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {(contact.is_primary || contact.is_decision_maker) && (
                  <div className="flex flex-wrap gap-1.5">
                    {contact.is_primary && (
                      <Badge
                        variant="outline"
                        className="border-violet-400/40 bg-violet-400/15 text-violet-300"
                      >
                        Hauptkontakt
                      </Badge>
                    )}
                    {contact.is_decision_maker && (
                      <Badge
                        variant="outline"
                        className="border-amber-400/40 bg-amber-400/15 text-amber-300"
                      >
                        Entscheider
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline break-all"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.mobile && (
                    <a
                      href={`tel:${contact.mobile.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Smartphone className="h-3.5 w-3.5 shrink-0" />
                      {contact.mobile}
                    </a>
                  )}
                </div>

                {contact.next_action && (
                  <div
                    className={cn(
                      "flex items-start gap-1.5 rounded-md border p-2 text-xs",
                      isDueOrOverdue(contact.next_action_date)
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <CalendarClock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <strong className="font-medium">Nächste Aktion:</strong> {contact.next_action}
                      {contact.next_action_date && ` — ${formatDate(contact.next_action_date)}`}
                    </span>
                  </div>
                )}

                {contact.notes && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    Letzter Kontakt: {formatDate(contact.last_contact_date)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={touchMutation.isPending}
                    onClick={() => touchMutation.mutate(contact)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Heute kontaktiert
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (saveMutation.isPending) return;
          setDialogOpen(next);
          if (!next) setEditing(null);
        }}
      >
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Kontakt bearbeiten" : "Kontakt hinzufügen"}</DialogTitle>
            <DialogDescription>Ansprechpartner bei {partnerName}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-name`}>
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`${idPrefix}-name`}
                value={values.name}
                onChange={(event) => setValues({ ...values, name: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-role`}>Rolle</Label>
                <Input
                  id={`${idPrefix}-role`}
                  value={values.role}
                  onChange={(event) => setValues({ ...values, role: event.target.value })}
                  disabled={saveMutation.isPending}
                  placeholder="z. B. Vertrieb / Technikum"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-dept`}>Abteilung</Label>
                <Input
                  id={`${idPrefix}-dept`}
                  value={values.department}
                  onChange={(event) => setValues({ ...values, department: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`${idPrefix}-email`}>E-Mail</Label>
                <Input
                  id={`${idPrefix}-email`}
                  value={values.email}
                  inputMode="email"
                  onChange={(event) => setValues({ ...values, email: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-phone`}>Telefon</Label>
                <Input
                  id={`${idPrefix}-phone`}
                  value={values.phone}
                  inputMode="tel"
                  onChange={(event) => setValues({ ...values, phone: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-mobile`}>Mobil</Label>
                <Input
                  id={`${idPrefix}-mobile`}
                  value={values.mobile}
                  inputMode="tel"
                  onChange={(event) => setValues({ ...values, mobile: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                <Label htmlFor={`${idPrefix}-primary`} className="text-sm">
                  Hauptkontakt
                </Label>
                <Switch
                  id={`${idPrefix}-primary`}
                  checked={values.is_primary}
                  disabled={saveMutation.isPending}
                  onCheckedChange={(checked) => setValues({ ...values, is_primary: checked })}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                <Label htmlFor={`${idPrefix}-dm`} className="text-sm">
                  Entscheider
                </Label>
                <Switch
                  id={`${idPrefix}-dm`}
                  checked={values.is_decision_maker}
                  disabled={saveMutation.isPending}
                  onCheckedChange={(checked) =>
                    setValues({ ...values, is_decision_maker: checked })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-last`}>Letzter Kontakt</Label>
                <Input
                  id={`${idPrefix}-last`}
                  type="date"
                  value={values.last_contact_date}
                  onChange={(event) =>
                    setValues({ ...values, last_contact_date: event.target.value })
                  }
                  disabled={saveMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-next-date`}>Termin nächste Aktion</Label>
                <Input
                  id={`${idPrefix}-next-date`}
                  type="date"
                  value={values.next_action_date}
                  onChange={(event) =>
                    setValues({ ...values, next_action_date: event.target.value })
                  }
                  disabled={saveMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-next`}>Nächste Aktion</Label>
              <Input
                id={`${idPrefix}-next`}
                value={values.next_action}
                onChange={(event) => setValues({ ...values, next_action: event.target.value })}
                disabled={saveMutation.isPending}
                placeholder="z. B. Technikumstermin abstimmen"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-notes`}>Notizen</Label>
              <Textarea
                id={`${idPrefix}-notes`}
                rows={3}
                value={values.notes}
                onChange={(event) => setValues({ ...values, notes: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending || Boolean(formError)}
              onClick={() => saveMutation.mutate({ contactId: editing?.id ?? null, values })}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(next) => {
          if (!next && !deleteMutation.isPending) setToDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Kontakt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{toDelete?.name}“ wird dauerhaft entfernt. Bereits erfasste Kommunikation bleibt
              erhalten, verliert aber die Zuordnung zu diesem Kontakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (toDelete) deleteMutation.mutate(toDelete);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
