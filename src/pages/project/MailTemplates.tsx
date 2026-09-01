/**
 * /projekt/mailvorlagen — mail templates, the mail composer and the
 * communication log of the GFK project.
 */
import { Fragment, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAiAnalyses,
  useCommunications,
  useEmailTemplates,
  usePartnerContacts,
  usePartners,
  useProjectMutation,
} from "@/hooks/project/useProjectData";
import { useAcknowledgeAiAnalysis, useRequestAiAnalysis } from "@/hooks/project/useProjectAi";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Markdown,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
  formatDateTime,
} from "@/components/project/ProjectUI";
import MailComposer from "@/components/project/MailTemplatesComposer";
import {
  CommunicationDialog,
  TemplateDialog,
} from "@/components/project/MailTemplatesDialogs";
import {
  ALL,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_DIRECTIONS,
  PlaceholderChips,
  templatePlaceholderKeys,
} from "@/components/project/MailTemplatesShared";
import { EMAIL_TEMPLATE_CATEGORIES, labelOf, toneOf } from "@/lib/project/constants";
import type { Communication, EmailTemplate } from "@/lib/project/types";
import { cn } from "@/lib/utils";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * ai_analyses.confidence stores the raw model verdict in English - the cockpit
 * and the risk register translate it, so this page must not print "high".
 */
const CONFIDENCE_LABELS: Record<string, string> = {
  high: "hoch",
  medium: "mittel",
  low: "niedrig",
};

/** ai_analyses.recommendations is free-form jsonb - accept strings and objects. */
function parseRecommendations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  value.forEach((entry) => {
    if (typeof entry === "string") {
      items.push(entry);
      return;
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const candidate = [record.title, record.text, record.action, record.recommendation].find(
        (field) => typeof field === "string" && field.trim().length > 0,
      );
      if (typeof candidate === "string") items.push(candidate);
    }
  });
  return items;
}

export default function MailTemplates() {
  const { user } = useAuth();

  const templatesQuery = useEmailTemplates();
  const partnersQuery = usePartners();
  const contactsQuery = usePartnerContacts();
  const communicationsQuery = useCommunications();
  const aiQuery = useAiAnalyses("partner_followup");

  const requestAi = useRequestAiAnalysis();
  const acknowledgeAi = useAcknowledgeAiAnalysis();

  /*
   * Own cache key: /profil uses ["profile", userId] with select("*"), and a
   * shared key would hand whichever query mounts first to the other component.
   */
  const profileQuery = useQuery({
    queryKey: ["mail-sender-profile", user?.id ?? "anonymous"],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<{ name: string; email: string | null } | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("user_id", user?.id ?? "")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });

  const [tab, setTab] = useState("templates");
  const [templateId, setTemplateId] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateDialogMode, setTemplateDialogMode] = useState<"create" | "edit">("create");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);

  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [logPartner, setLogPartner] = useState<string>(ALL);
  const [logDirection, setLogDirection] = useState<string>(ALL);
  const [logSearch, setLogSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const composerRef = useRef<HTMLDivElement | null>(null);

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const communications = useMemo(() => communicationsQuery.data ?? [], [communicationsQuery.data]);

  const partnerNames = useMemo(() => {
    const map = new Map<string, string>();
    partners.forEach((partner) => map.set(partner.id, partner.name));
    return map;
  }, [partners]);

  const contactNames = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach((contact) => map.set(contact.id, contact.name));
    return map;
  }, [contacts]);

  const templateNames = useMemo(() => {
    const map = new Map<string, string>();
    templates.forEach((template) => map.set(template.id, `${template.code} — ${template.name}`));
    return map;
  }, [templates]);

  /* ------------------------------------------------------------------ stats */

  const stats = useMemo(() => {
    const since = Date.now() - THIRTY_DAYS_MS;
    let outbound30 = 0;
    let inbound30 = 0;
    communications.forEach((entry) => {
      const time = new Date(entry.occurred_at).getTime();
      if (Number.isNaN(time) || time < since) return;
      if (entry.direction === "inbound") inbound30 += 1;
      else outbound30 += 1;
    });
    return { outbound30, inbound30 };
  }, [communications]);

  /* -------------------------------------------------------------- templates */

  const filteredTemplates = useMemo(() => {
    const term = templateSearch.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory = categoryFilter === ALL || template.category === categoryFilter;
      const matchesTerm =
        term === "" ||
        template.code.toLowerCase().includes(term) ||
        template.name.toLowerCase().includes(term) ||
        template.subject.toLowerCase().includes(term) ||
        template.body_md.toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [templates, templateSearch, categoryFilter]);

  const templateFiltersActive = templateSearch.trim() !== "" || categoryFilter !== ALL;

  const deleteTemplate = useProjectMutation<EmailTemplate>(
    async (template) => {
      const { data, error } = await supabase
        .from("project_email_templates")
        .delete()
        .eq("id", template.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Vorlage gelöscht",
      errorMessage: "Vorlage konnte nicht gelöscht werden",
      onDone: () => setTemplateToDelete(null),
    },
  );

  const openCreateTemplate = () => {
    setTemplateDialogMode("create");
    setEditingTemplate(null);
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (template: EmailTemplate) => {
    setTemplateDialogMode("edit");
    setEditingTemplate(template);
    setTemplateDialogOpen(true);
  };

  const applyTemplateToComposer = (template: EmailTemplate) => {
    setTemplateId(template.id);
    setTab("templates");
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /* ------------------------------------------------------- communication log */

  const filteredCommunications = useMemo(() => {
    const term = logSearch.trim().toLowerCase();
    return communications.filter((entry) => {
      const matchesPartner = logPartner === ALL || entry.partner_id === logPartner;
      const matchesDirection = logDirection === ALL || entry.direction === logDirection;
      const matchesTerm =
        term === "" ||
        (entry.subject ?? "").toLowerCase().includes(term) ||
        (entry.body ?? "").toLowerCase().includes(term) ||
        (entry.partner_id ? (partnerNames.get(entry.partner_id) ?? "") : "").toLowerCase().includes(term);
      return matchesPartner && matchesDirection && matchesTerm;
    });
  }, [communications, logPartner, logDirection, logSearch, partnerNames]);

  const logFiltersActive = logPartner !== ALL || logDirection !== ALL || logSearch.trim() !== "";

  const resetLogFilters = () => {
    setLogPartner(ALL);
    setLogDirection(ALL);
    setLogSearch("");
  };

  /* ---------------------------------------------------------------------- AI */

  const latestAi = useMemo(() => (aiQuery.data ?? [])[0] ?? null, [aiQuery.data]);
  const aiRecommendations = useMemo(
    () => parseRecommendations(latestAi?.recommendations),
    [latestAi],
  );

  const senderName = profileQuery.data?.name ?? "";
  const senderEmail = profileQuery.data?.email ?? user?.email ?? "";
  /*
   * A failed profile load is not an incomplete profile: without this the
   * composer would claim "Kein Profilname gefunden" for an RLS or network
   * error and offer no retry.
   */
  const senderFailed = profileQuery.isError;
  const senderMissing = !profileQuery.isLoading && !senderFailed && senderName.trim() === "";

  const directionMeta = (direction: string) => ({
    label: labelOf(COMMUNICATION_DIRECTIONS, direction),
    tone: toneOf(COMMUNICATION_DIRECTIONS, direction),
  });

  /* ------------------------------------------------------------------ render */

  return (
    <div className="space-y-6 animate-fade-in">
      <ProjectPageHeader
        title="Mailvorlagen & Kommunikation"
        description="Textvorlagen, Mail-Composer und lückenloser Kommunikationsverlauf zu allen Projektpartnern."
        icon={Mail}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => requestAi.mutate({ analysisType: "partner_followup" })}
              disabled={requestAi.isPending}
            >
              {requestAi.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              KI: Partner-Nachfassen
            </Button>
            <Button onClick={openCreateTemplate}>
              <Plus className="mr-2 h-4 w-4" />
              Neue Vorlage
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Vorlagen"
          value={templatesQuery.isLoading ? "…" : templatesQuery.isError ? "—" : templates.length}
          hint="Textbausteine"
          icon={FileText}
          accent="violet"
        />
        <StatCard
          label="Kommunikation"
          value={communicationsQuery.isLoading ? "…" : communicationsQuery.isError ? "—" : communications.length}
          hint="Einträge gesamt"
          icon={MessageSquare}
          accent="sky"
        />
        <StatCard
          label="Ausgehend"
          value={communicationsQuery.isLoading ? "…" : communicationsQuery.isError ? "—" : stats.outbound30}
          hint="letzte 30 Tage"
          icon={ArrowUpRight}
          accent="amber"
        />
        <StatCard
          label="Eingehend"
          value={communicationsQuery.isLoading ? "…" : communicationsQuery.isError ? "—" : stats.inbound30}
          hint="letzte 30 Tage"
          icon={ArrowDownLeft}
          accent="emerald"
        />
      </div>

      {(partnersQuery.isError || contactsQuery.isError) && (
        <ErrorState
          error={(partnersQuery.error as Error | null) ?? (contactsQuery.error as Error)}
          onRetry={() => {
            void partnersQuery.refetch();
            void contactsQuery.refetch();
          }}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-400" />
            KI: Partner-Nachfassen
          </CardTitle>
          <CardDescription>
            Welche Partner sind überfällig, wer wurde zuletzt kontaktiert, was ist der nächste Schritt?
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aiQuery.isLoading ? (
            <LoadingRows rows={3} />
          ) : aiQuery.isError ? (
            <ErrorState
              error={aiQuery.error as Error}
              onRetry={() => {
                void aiQuery.refetch();
              }}
            />
          ) : !latestAi ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Noch keine Nachfass-Auswertung vorhanden. Über „KI: Partner-Nachfassen“ werden
              Partnerstatus, letzte Kontakte und offene Aufgaben ausgewertet.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDateTime(latestAi.created_at)}</span>
                {latestAi.model && <Badge variant="outline" className="font-mono text-[10px]">{latestAi.model}</Badge>}
                {latestAi.confidence && (
                  <Badge variant="outline" className="text-[10px]">
                    Konfidenz: {CONFIDENCE_LABELS[latestAi.confidence] ?? latestAi.confidence}
                  </Badge>
                )}
                {latestAi.acknowledged_at && (
                  <Badge variant="outline" className="border-success/20 bg-success/10 text-[10px] text-success">
                    gelesen
                  </Badge>
                )}
              </div>

              {latestAi.output_md ? (
                <Markdown content={latestAi.output_md} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Die Auswertung enthält keinen Text. Bitte neu erzeugen.
                </p>
              )}

              {aiRecommendations.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Empfehlungen
                  </p>
                  <ul className="space-y-1.5">
                    {aiRecommendations.map((recommendation, index) => (
                      <li key={`${index}-${recommendation.slice(0, 16)}`} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground">•</span>
                        <span>{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!latestAi.acknowledged_at && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => acknowledgeAi.mutate({ id: latestAi.id, actedUpon: false })}
                  disabled={acknowledgeAi.isPending}
                >
                  {acknowledgeAi.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="mr-2 h-3.5 w-3.5" />
                  )}
                  Zur Kenntnis genommen
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="templates">Vorlagen</TabsTrigger>
          <TabsTrigger value="log">Kommunikationsverlauf</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- templates */}
        <TabsContent value="templates" className="space-y-4">
          <div ref={composerRef}>
            <MailComposer
              templates={templates}
              partners={partners}
              templatesLoading={templatesQuery.isLoading}
              partnersLoading={partnersQuery.isLoading}
              templateId={templateId}
              onTemplateChange={setTemplateId}
              senderName={senderName}
              senderEmail={senderEmail}
              senderMissing={senderMissing}
              senderFailed={senderFailed}
              onRetrySender={() => void profileQuery.refetch()}
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vorlagen</CardTitle>
              <CardDescription>
                Zeile antippen, um die Vorlage in den Composer zu übernehmen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Suchen nach Code, Name, Betreff …"
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="sm:w-56">
                    <SelectValue placeholder="Alle Kategorien" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value={ALL}>Alle Kategorien</SelectItem>
                    {EMAIL_TEMPLATE_CATEGORIES.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templateFiltersActive && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTemplateSearch("");
                      setCategoryFilter(ALL);
                    }}
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Zurücksetzen
                  </Button>
                )}
              </div>

              {templatesQuery.isLoading ? (
                <LoadingRows rows={5} />
              ) : templatesQuery.isError ? (
                <ErrorState
                  error={templatesQuery.error as Error}
                  onRetry={() => {
                    void templatesQuery.refetch();
                  }}
                />
              ) : templates.length === 0 ? (
                <EmptyState
                  title="Noch keine Mailvorlagen"
                  description="Materialanfragen, Technikumsanfragen, Analytik-Beauftragungen und Nachfassmails als Vorlage hinterlegen."
                  action={
                    <Button size="sm" onClick={openCreateTemplate}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Vorlage anlegen
                    </Button>
                  }
                />
              ) : filteredTemplates.length === 0 ? (
                <EmptyState
                  title="Keine Vorlage passt zum Filter"
                  description="Suchbegriff oder Kategorie anpassen."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTemplateSearch("");
                        setCategoryFilter(ALL);
                      }}
                    >
                      Filter zurücksetzen
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-32">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-40">Kategorie</TableHead>
                        <TableHead>Betreff</TableHead>
                        <TableHead className="w-56">Platzhalter</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTemplates.map((template) => (
                        <TableRow
                          key={template.id}
                          className={cn(
                            "cursor-pointer",
                            templateId === template.id && "bg-primary/5",
                          )}
                          onClick={() => applyTemplateToComposer(template)}
                        >
                          <TableCell className="font-mono text-xs font-medium">{template.code}</TableCell>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {labelOf(EMAIL_TEMPLATE_CATEGORIES, template.category)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[22rem] text-sm text-muted-foreground">
                            <span className="line-clamp-2">{template.subject}</span>
                          </TableCell>
                          <TableCell>
                            <PlaceholderChips keys={templatePlaceholderKeys(template)} max={3} />
                          </TableCell>
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                  <span className="sr-only">Aktionen</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover">
                                <DropdownMenuItem onClick={() => applyTemplateToComposer(template)}>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Im Composer verwenden
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditTemplate(template)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setTemplateToDelete(template)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------- communication log */}
        <TabsContent value="log" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Kommunikationsverlauf</CardTitle>
                  <CardDescription>Neueste Einträge zuerst — Zeile antippen für den Volltext.</CardDescription>
                </div>
                <Button className="w-full sm:w-auto" onClick={() => setCommDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Eintrag erfassen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="log-partner" className="text-xs text-muted-foreground">
                    Partner
                  </Label>
                  <Select value={logPartner} onValueChange={setLogPartner}>
                    <SelectTrigger id="log-partner">
                      <SelectValue placeholder="Alle Partner" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value={ALL}>Alle Partner</SelectItem>
                      {partners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="log-direction" className="text-xs text-muted-foreground">
                    Richtung
                  </Label>
                  <Select value={logDirection} onValueChange={setLogDirection}>
                    <SelectTrigger id="log-direction">
                      <SelectValue placeholder="Alle Richtungen" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value={ALL}>Alle Richtungen</SelectItem>
                      {COMMUNICATION_DIRECTIONS.map((direction) => (
                        <SelectItem key={direction.id} value={direction.id}>
                          {direction.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <Label htmlFor="log-search" className="text-xs text-muted-foreground">
                    Suche
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="log-search"
                        className="pl-9"
                        placeholder="Betreff, Text oder Partner"
                        value={logSearch}
                        onChange={(event) => setLogSearch(event.target.value)}
                      />
                    </div>
                    {logFiltersActive && (
                      <Button variant="ghost" onClick={resetLogFilters}>
                        <X className="mr-1.5 h-4 w-4" />
                        Zurücksetzen
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {communicationsQuery.isLoading ? (
                <LoadingRows rows={6} />
              ) : communicationsQuery.isError ? (
                <ErrorState
                  error={communicationsQuery.error as Error}
                  onRetry={() => {
                    void communicationsQuery.refetch();
                  }}
                />
              ) : communications.length === 0 ? (
                <EmptyState
                  title="Noch keine Kommunikation erfasst"
                  description="Mails aus dem Composer protokollieren oder Telefonate und Besuche manuell erfassen."
                  action={
                    <Button size="sm" onClick={() => setCommDialogOpen(true)}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Eintrag erfassen
                    </Button>
                  }
                />
              ) : filteredCommunications.length === 0 ? (
                <EmptyState
                  title="Kein Eintrag passt zum Filter"
                  description="Partner, Richtung oder Suchbegriff anpassen."
                  action={
                    <Button size="sm" variant="outline" onClick={resetLogFilters}>
                      Filter zurücksetzen
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[820px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10" />
                        <TableHead className="w-40">Zeitpunkt</TableHead>
                        <TableHead className="w-28">Richtung</TableHead>
                        <TableHead className="w-32">Kanal</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Kontakt</TableHead>
                        <TableHead>Betreff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCommunications.map((entry: Communication) => {
                        const meta = directionMeta(entry.direction);
                        const isExpanded = expandedId === entry.id;
                        return (
                          <Fragment key={entry.id}>
                            <TableRow
                              className="cursor-pointer"
                              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                            >
                              <TableCell>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {formatDateTime(entry.occurred_at)}
                              </TableCell>
                              <TableCell>
                                <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {labelOf(COMMUNICATION_CHANNELS, entry.channel)}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {entry.partner_id ? (partnerNames.get(entry.partner_id) ?? "Unbekannt") : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {entry.contact_id ? (contactNames.get(entry.contact_id) ?? "Unbekannt") : "—"}
                              </TableCell>
                              <TableCell className="max-w-[20rem] text-sm">
                                <span className="line-clamp-1">{entry.subject ?? "—"}</span>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={7} className="bg-muted/30">
                                  <div className="space-y-2 py-1">
                                    {entry.template_id && (
                                      <p className="text-xs text-muted-foreground">
                                        Vorlage: {templateNames.get(entry.template_id) ?? "gelöscht"}
                                      </p>
                                    )}
                                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
                                      {entry.body?.trim() ? entry.body : "Kein Text hinterlegt."}
                                    </pre>
                                    {entry.ai_summary && (
                                      <div className="rounded-md border border-border bg-background p-2">
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          KI-Zusammenfassung
                                        </p>
                                        <p className="text-sm">{entry.ai_summary}</p>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        mode={templateDialogMode}
        template={editingTemplate}
      />

      <CommunicationDialog
        open={commDialogOpen}
        onOpenChange={setCommDialogOpen}
        partners={partners}
        contacts={contacts}
        partnersLoading={partnersQuery.isLoading}
      />

      <AlertDialog
        open={templateToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTemplateToDelete(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {templateToDelete
                ? `„${templateToDelete.code} — ${templateToDelete.name}“ wird dauerhaft entfernt. Bereits protokollierte Kommunikation bleibt erhalten.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTemplate.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (templateToDelete) deleteTemplate.mutate(templateToDelete);
              }}
            >
              {deleteTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
