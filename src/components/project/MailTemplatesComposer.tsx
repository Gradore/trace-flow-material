/**
 * Mail composer: template -> partner -> contact. Every placeholder that can be
 * derived from the selected data is filled automatically, the rest becomes an
 * editable field. The result can be copied, opened in the mail client or
 * logged as an outbound communication.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  Mail,
  RotateCcw,
  Save,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { usePartnerContacts, useProjectMutation } from "@/hooks/project/useProjectData";
import { IpGateBanner, formatDate } from "@/components/project/ProjectUI";
import {
  AUTO_PLACEHOLDER_HINTS,
  applyPlaceholders,
  buildMailtoHref,
  copyTextToClipboard,
  isoDateToday,
  templatePlaceholderKeys,
} from "@/components/project/MailTemplatesShared";
import { EMAIL_TEMPLATE_CATEGORIES, labelOf } from "@/lib/project/constants";
import type { EmailTemplate, Partner, PartnerContact } from "@/lib/project/types";
import { cn } from "@/lib/utils";

const NO_TEMPLATE = "";
const NO_CONTACT = "none";

interface LogVars {
  templateId: string;
  partnerId: string;
  contactId: string | null;
  subject: string;
  body: string;
}

interface MailComposerProps {
  templates: EmailTemplate[];
  partners: Partner[];
  templatesLoading?: boolean;
  partnersLoading?: boolean;
  templateId: string;
  onTemplateChange: (templateId: string) => void;
  senderName: string;
  senderEmail: string;
  senderMissing: boolean;
}

export default function MailComposer({
  templates,
  partners,
  templatesLoading = false,
  partnersLoading = false,
  templateId,
  onTemplateChange,
  senderName,
  senderEmail,
  senderMissing,
}: MailComposerProps) {
  const { user } = useAuth();
  const [partnerId, setPartnerId] = useState<string>("");
  const [contactId, setContactId] = useState<string>(NO_CONTACT);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const contactsQuery = usePartnerContacts(partnerId || undefined);

  const template = useMemo(
    () => templates.find((entry) => entry.id === templateId) ?? null,
    [templates, templateId],
  );
  const partner = useMemo(
    () => partners.find((entry) => entry.id === partnerId) ?? null,
    [partners, partnerId],
  );
  const contacts = useMemo<PartnerContact[]>(() => {
    if (!partnerId) return [];
    return (contactsQuery.data ?? []).filter((entry) => entry.partner_id === partnerId);
  }, [contactsQuery.data, partnerId]);
  const contact = useMemo(
    () => contacts.find((entry) => entry.id === contactId) ?? null,
    [contacts, contactId],
  );

  /* The placeholder values are template specific - start over on a new template. */
  useEffect(() => {
    setOverrides({});
  }, [templateId]);

  /* Preselect the primary contact of a partner, drop stale selections. */
  useEffect(() => {
    if (!partnerId) {
      setContactId(NO_CONTACT);
      return;
    }
    if (contactsQuery.isLoading) return;
    setContactId((current) => {
      if (current !== NO_CONTACT && contacts.some((entry) => entry.id === current)) return current;
      const preferred = contacts.find((entry) => entry.is_primary) ?? contacts[0];
      return preferred ? preferred.id : NO_CONTACT;
    });
  }, [partnerId, contacts, contactsQuery.isLoading]);

  const autoValues = useMemo<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    if (contact) {
      values.contact_name = contact.name;
      if (contact.email) values.contact_email = contact.email;
      if (contact.role) values.contact_role = contact.role;
    }
    if (partner) {
      values.partner_name = partner.name;
      if (partner.city) values.partner_city = partner.city;
    }
    if (senderName) values.sender_name = senderName;
    if (senderEmail) values.sender_email = senderEmail;
    const today = formatDate(new Date().toISOString());
    values.original_date = today;
    values.today = today;
    return values;
  }, [contact, partner, senderEmail, senderName]);

  const placeholderKeys = useMemo(
    () => (template ? templatePlaceholderKeys(template) : []),
    [template],
  );

  const values = useMemo<Record<string, string>>(() => {
    const merged: Record<string, string> = {};
    placeholderKeys.forEach((key) => {
      const override = overrides[key];
      merged[key] = override !== undefined ? override : (autoValues[key] ?? "");
    });
    return merged;
  }, [autoValues, overrides, placeholderKeys]);

  const openKeys = placeholderKeys.filter((key) => !values[key]?.trim());

  const subject = template ? applyPlaceholders(template.subject, values) : "";
  const body = template ? applyPlaceholders(template.body_md, values) : "";
  const fullMailText = subject ? `Betreff: ${subject}\n\n${body}` : body;

  const contactEmail = contact?.email?.trim() ?? "";
  const isPhaseTwoMail =
    template?.category === "trial_request" || partner?.category === "machine_manufacturer";

  const logMutation = useProjectMutation<LogVars>(
    async (vars) => {
      const { data, error } = await supabase
        .from("project_communications")
        .insert({
          partner_id: vars.partnerId,
          contact_id: vars.contactId,
          direction: "outbound",
          channel: "email",
          subject: vars.subject,
          body: vars.body,
          template_id: vars.templateId,
          occurred_at: new Date().toISOString(),
          created_by: user?.id ?? null,
        })
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }

      if (vars.contactId) {
        const { data: updated, error: updateError } = await supabase
          .from("project_contacts")
          .update({ last_contact_date: isoDateToday() })
          .eq("id", vars.contactId)
          .select("id");
        if (updateError) throw new Error(updateError.message);
        if (!updated || updated.length === 0) {
          throw new Error(
            "Kommunikation gespeichert, aber der letzte Kontakt konnte nicht aktualisiert werden: Keine Berechtigung oder Datensatz nicht gefunden",
          );
        }
      }
    },
    {
      successMessage: "Kommunikation protokolliert",
      errorMessage: "Kommunikation konnte nicht protokolliert werden",
    },
  );

  const handleCopy = async (text: string, label: string) => {
    const copied = await copyTextToClipboard(text);
    if (copied) {
      toast({ title: `${label} in die Zwischenablage kopiert` });
    } else {
      toast({
        variant: "destructive",
        title: "Kopieren fehlgeschlagen",
        description: "Der Browser hat den Zugriff auf die Zwischenablage verweigert. Bitte den Text manuell markieren.",
      });
    }
  };

  const handleMailto = () => {
    if (!contactEmail) return;
    const href = buildMailtoHref(contactEmail, subject, body);
    if (href.length > 1900) {
      toast({
        title: "Lange Mail",
        description: "Manche Mailprogramme kürzen sehr lange Texte. Notfalls den Text über die Zwischenablage einfügen.",
      });
    }
    window.location.href = href;
  };

  const handleLog = () => {
    if (!template || !partnerId) return;
    logMutation.mutate({
      templateId: template.id,
      partnerId,
      contactId: contactId === NO_CONTACT ? null : contactId,
      subject,
      body,
    });
  };

  const resetOverrides = () => setOverrides({});

  const canSend = Boolean(template && partnerId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-violet-400" />
              Mail-Composer
            </CardTitle>
            <CardDescription>
              Vorlage, Partner und Ansprechpartner wählen — die Platzhalter werden aus den Stammdaten
              gefüllt.
            </CardDescription>
          </div>
          {template && (
            <Badge variant="outline" className="w-fit shrink-0 font-mono text-[11px]">
              {template.code}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="composer-template">Vorlage</Label>
            <Select
              value={templateId || NO_TEMPLATE}
              onValueChange={onTemplateChange}
              disabled={templatesLoading}
            >
              <SelectTrigger id="composer-template">
                <SelectValue placeholder={templatesLoading ? "Wird geladen …" : "Vorlage wählen"} />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {templatesLoading ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Vorlagen werden geladen …</div>
                ) : templates.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Keine Vorlagen vorhanden</div>
                ) : (
                  templates.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.code} — {entry.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="composer-partner">Partner</Label>
            <Select value={partnerId} onValueChange={setPartnerId} disabled={partnersLoading}>
              <SelectTrigger id="composer-partner">
                <SelectValue placeholder={partnersLoading ? "Wird geladen …" : "Partner wählen"} />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {partnersLoading ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Partner werden geladen …</div>
                ) : partners.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Keine Partner vorhanden</div>
                ) : (
                  partners.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="composer-contact">Ansprechpartner</Label>
            <Select
              value={contactId}
              onValueChange={setContactId}
              disabled={!partnerId || contactsQuery.isLoading || contactsQuery.isError}
            >
              <SelectTrigger id="composer-contact">
                <SelectValue
                  placeholder={
                    !partnerId
                      ? "Erst Partner wählen"
                      : contactsQuery.isLoading
                        ? "Wird geladen …"
                        : "Kontakt wählen"
                  }
                />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value={NO_CONTACT}>Ohne Ansprechpartner</SelectItem>
                {contacts.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                    {entry.role ? ` — ${entry.role}` : ""}
                    {entry.is_primary ? " ★" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {partnerId && contactsQuery.isError && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-destructive">
                Ansprechpartner konnten nicht geladen werden.
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => void contactsQuery.refetch()}
                >
                  Erneut versuchen
                </button>
              </p>
            )}
            {partnerId && !contactsQuery.isLoading && !contactsQuery.isError && contacts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Für diesen Partner ist kein Ansprechpartner hinterlegt.
              </p>
            )}
          </div>
        </div>

        {isPhaseTwoMail && <IpGateBanner compact />}

        {senderMissing && (
          <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Kein Profilname gefunden — {"{{sender_name}}"} bitte manuell ausfüllen.
          </p>
        )}

        {!template ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Bitte zuerst eine Vorlage wählen. Betreff, Text und Platzhalter werden danach hier
            aufgebaut.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Platzhalter ({placeholderKeys.length})
                </p>
                <div className="flex items-center gap-2">
                  {openKeys.length > 0 && (
                    <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                      {openKeys.length} offen
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetOverrides}
                    disabled={Object.keys(overrides).length === 0}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Automatik
                  </Button>
                </div>
              </div>

              {placeholderKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Diese Vorlage enthält keine Platzhalter.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {placeholderKeys.map((key) => {
                    const auto = autoValues[key];
                    const isOverridden = overrides[key] !== undefined;
                    const isOpen = !values[key]?.trim();
                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`ph-${key}`} className="font-mono text-xs">
                            {`{{${key}}}`}
                          </Label>
                          {auto && !isOverridden && (
                            <span className="flex items-center gap-1 text-[10px] text-success">
                              <Wand2 className="h-3 w-3" />
                              automatisch
                            </span>
                          )}
                          {isOverridden && auto && (
                            <button
                              type="button"
                              className="text-[10px] text-muted-foreground underline underline-offset-2"
                              onClick={() =>
                                setOverrides((current) => {
                                  const next = { ...current };
                                  delete next[key];
                                  return next;
                                })
                              }
                            >
                              zurücksetzen
                            </button>
                          )}
                        </div>
                        <Input
                          id={`ph-${key}`}
                          value={values[key] ?? ""}
                          onChange={(event) =>
                            setOverrides((current) => ({ ...current, [key]: event.target.value }))
                          }
                          placeholder={AUTO_PLACEHOLDER_HINTS[key] ?? "Wert eintragen"}
                          className={cn(isOpen && "border-warning/50")}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vorschau
              </p>
              <div className="rounded-lg border border-border bg-muted/30">
                <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Betreff</p>
                    <p className="break-words text-sm font-medium">{subject}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void handleCopy(subject, "Betreff")}
                    title="Betreff kopieren"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" />
                    <span className="sr-only">Betreff kopieren</span>
                  </Button>
                </div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-sans text-sm leading-relaxed">
                  {body}
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                Kategorie: {labelOf(EMAIL_TEMPLATE_CATEGORIES, template.category)}
                {contactEmail ? ` · Empfänger: ${contactEmail}` : " · keine E-Mail-Adresse hinterlegt"}
              </p>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={!template}
          onClick={() => void handleCopy(fullMailText, "Mailtext")}
        >
          <ClipboardCopy className="mr-2 h-4 w-4" />
          In Zwischenablage kopieren
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={!template || !contactEmail}
          onClick={handleMailto}
          title={contactEmail ? `An ${contactEmail}` : "Für den Kontakt ist keine E-Mail hinterlegt"}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          In Mailprogramm öffnen
        </Button>
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={!canSend || logMutation.isPending}
          onClick={handleLog}
        >
          {logMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Als Kommunikation protokollieren
        </Button>
      </CardFooter>
    </Card>
  );
}
