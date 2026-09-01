/**
 * "Kommunikation" tab of the partner detail sheet: the contact history for a
 * partner (project_communications) plus a form to log a new entry.
 */
import { useId, useMemo, useState } from "react";
import { Loader2, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import {
  useCommunications,
  usePartnerContacts,
  useProjectMutation,
  useProjectTasks,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Markdown,
  ToneBadge,
  formatDateTime,
} from "@/components/project/ProjectUI";
import {
  ALL,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_DIRECTIONS,
  fromLocalInputValue,
  toLocalInputValue,
  trimmedOrNull,
} from "@/components/project/ProjectPartnersShared";
import { labelOf } from "@/lib/project/constants";
import type { Communication } from "@/lib/project/types";

interface CommFormValues {
  direction: string;
  channel: string;
  contactId: string;
  subject: string;
  body: string;
  occurredAt: string;
}

function emptyCommForm(): CommFormValues {
  return {
    direction: "outbound",
    channel: "email",
    contactId: ALL,
    subject: "",
    body: "",
    occurredAt: toLocalInputValue(null),
  };
}

export default function PartnerCommunicationTab({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const commsQuery = useCommunications(partnerId);
  const contactsQuery = usePartnerContacts(partnerId);
  const tasksQuery = useProjectTasks();
  const testRunsQuery = useTestRuns();
  const idPrefix = useId();

  const [values, setValues] = useState<CommFormValues>(emptyCommForm);
  const [toDelete, setToDelete] = useState<Communication | null>(null);

  const taskLabels = useMemo(() => {
    const map = new Map<string, string>();
    (tasksQuery.data ?? []).forEach((task) => map.set(task.id, `${task.code} — ${task.title}`));
    return map;
  }, [tasksQuery.data]);

  const runLabels = useMemo(() => {
    const map = new Map<string, string>();
    (testRunsQuery.data ?? []).forEach((run) => map.set(run.id, `${run.run_code} — ${run.title}`));
    return map;
  }, [testRunsQuery.data]);

  const contactNames = useMemo(() => {
    const map = new Map<string, string>();
    (contactsQuery.data ?? []).forEach((contact) => map.set(contact.id, contact.name));
    return map;
  }, [contactsQuery.data]);

  const saveMutation = useProjectMutation<CommFormValues>(
    async (form) => {
      const occurredAt = fromLocalInputValue(form.occurredAt);
      if (!occurredAt) throw new Error("Ungültiger Zeitpunkt");

      const { data, error } = await supabase
        .from("project_communications")
        .insert({
          partner_id: partnerId,
          contact_id: form.contactId === ALL ? null : form.contactId,
          direction: form.direction,
          channel: form.channel,
          subject: trimmedOrNull(form.subject),
          body: trimmedOrNull(form.body),
          occurred_at: occurredAt,
        })
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Eintrag erfasst",
      errorMessage: "Eintrag konnte nicht gespeichert werden",
      onDone: () => setValues(emptyCommForm()),
    },
  );

  const deleteMutation = useProjectMutation<Communication>(
    async (entry) => {
      const { data, error } = await supabase
        .from("project_communications")
        .delete()
        .eq("id", entry.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Eintrag gelöscht",
      errorMessage: "Eintrag konnte nicht gelöscht werden",
      onDone: () => setToDelete(null),
    },
  );

  const formError =
    !values.subject.trim() && !values.body.trim()
      ? "Bitte Betreff oder Inhalt ausfüllen."
      : !fromLocalInputValue(values.occurredAt)
        ? "Bitte einen gültigen Zeitpunkt angeben."
        : null;

  const entries = commsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            Eintrag erfassen
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-direction`}>Richtung</Label>
              <Select
                value={values.direction}
                onValueChange={(value) => setValues({ ...values, direction: value })}
              >
                <SelectTrigger id={`${idPrefix}-direction`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_DIRECTIONS.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-channel`}>Kanal</Label>
              <Select
                value={values.channel}
                onValueChange={(value) => setValues({ ...values, channel: value })}
              >
                <SelectTrigger id={`${idPrefix}-channel`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_CHANNELS.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-contact`}>Kontakt</Label>
              <Select
                value={values.contactId}
                onValueChange={(value) => setValues({ ...values, contactId: value })}
              >
                <SelectTrigger id={`${idPrefix}-contact`}>
                  <SelectValue placeholder="Ohne Kontakt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Ohne Kontakt</SelectItem>
                  {(contactsQuery.data ?? []).map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-occurred`}>Zeitpunkt</Label>
              <Input
                id={`${idPrefix}-occurred`}
                type="datetime-local"
                value={values.occurredAt}
                onChange={(event) => setValues({ ...values, occurredAt: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-subject`}>Betreff</Label>
            <Input
              id={`${idPrefix}-subject`}
              value={values.subject}
              onChange={(event) => setValues({ ...values, subject: event.target.value })}
              placeholder={`z. B. Technikumsanfrage ${partnerName}`}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-body`}>Inhalt</Label>
            <Textarea
              id={`${idPrefix}-body`}
              rows={4}
              value={values.body}
              onChange={(event) => setValues({ ...values, body: event.target.value })}
              placeholder="Gesprächsnotiz, Zusagen, offene Punkte …"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {formError ? (
              <p className="text-xs text-destructive">{formError}</p>
            ) : (
              <span className="text-xs text-muted-foreground">
                Wird dem Partner {partnerName} zugeordnet.
              </span>
            )}
            <Button
              size="sm"
              disabled={saveMutation.isPending || Boolean(formError)}
              onClick={() => saveMutation.mutate(values)}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eintrag speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      {commsQuery.isLoading ? (
        <LoadingRows rows={3} />
      ) : commsQuery.isError ? (
        <ErrorState error={commsQuery.error as Error} onRetry={() => void commsQuery.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Keine Kommunikation erfasst"
          description="Anrufe, Mails und Termine hier dokumentieren — Grundlage für Nachfassen und KI-Auswertung."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const direction = COMMUNICATION_DIRECTIONS.find((d) => d.id === entry.direction);
            return (
              <Card key={entry.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <ToneBadge tone={direction?.tone ?? "muted"}>
                        {direction?.label ?? entry.direction}
                      </ToneBadge>
                      <span className="text-xs text-muted-foreground">
                        {labelOf(COMMUNICATION_CHANNELS, entry.channel)}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(entry.occurred_at)}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      aria-label="Eintrag löschen"
                      onClick={() => setToDelete(entry)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {entry.subject && <p className="font-medium leading-tight break-words">{entry.subject}</p>}
                  {entry.body && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                      {entry.body}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {entry.contact_id && contactNames.has(entry.contact_id) && (
                      <span>Kontakt: {contactNames.get(entry.contact_id)}</span>
                    )}
                    {entry.linked_task_id && taskLabels.has(entry.linked_task_id) && (
                      <span>Aufgabe: {taskLabels.get(entry.linked_task_id)}</span>
                    )}
                    {entry.linked_test_run_id && runLabels.has(entry.linked_test_run_id) && (
                      <span>Versuch: {runLabels.get(entry.linked_test_run_id)}</span>
                    )}
                  </div>

                  {entry.ai_summary && (
                    <div className="rounded-md border border-primary/25 bg-primary/5 p-2">
                      <p className="text-xs font-semibold flex items-center gap-1.5 text-primary mb-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        KI-Zusammenfassung
                      </p>
                      <Markdown content={entry.ai_summary} className="text-xs" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={Boolean(toDelete)}
        onOpenChange={(next) => {
          if (!next && !deleteMutation.isPending) setToDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Kommunikationseintrag vom {formatDateTime(toDelete?.occurred_at)} wird dauerhaft
              entfernt.
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
