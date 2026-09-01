/**
 * /projekt/partner — partner and contact management for the GFK project.
 * Three views (cards, table, status pipeline), filters over every relevant
 * master data field, and a detail sheet with contacts, tasks, test runs,
 * product tests and the communication log.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CalendarClock,
  Columns3,
  Filter,
  LayoutGrid,
  MapPin,
  Plus,
  Search,
  Star,
  Table2,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import {
  usePartnerContacts,
  usePartners,
  usePatentFiled,
  useFractionSpecs,
  useProjectMutation,
} from "@/hooks/project/useProjectData";
import {
  EmptyState,
  ErrorState,
  IpGateBanner,
  LoadingRows,
  ProjectPageHeader,
  StatCard,
  ToneBadge,
} from "@/components/project/ProjectUI";
import {
  ALL,
  ChipList,
  CompanyLinkBadge,
  FALLBACK_FRACTION_IDS,
  FixedPartnerBadge,
  RatingDots,
  comparePartners,
  isDueOrOverdue,
  partnerAddress,
  subcategoryLabel,
  type OptionItem,
} from "@/components/project/ProjectPartnersShared";
import {
  PartnerCreateDialog,
  emptyPartnerForm,
  formToPayload,
  isPhaseTwoActivity,
  type PartnerFormValues,
} from "@/components/project/ProjectPartnersForm";
import PartnerDetailSheet from "@/components/project/ProjectPartnersDetail";
import {
  MATERIAL_CLASSES,
  PARTNER_CATEGORIES,
  PARTNER_STATUSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import type { Partner } from "@/lib/project/types";
import { cn } from "@/lib/utils";

interface StatusChange {
  partner: Partner;
  status: string;
}

export default function ProjectPartners() {
  const partnersQuery = usePartners();
  const contactsQuery = usePartnerContacts();
  const fractionSpecsQuery = useFractionSpecs();
  const { isFiled: patentFiled } = usePatentFiled();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [subcategory, setSubcategory] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [materialClass, setMaterialClass] = useState<string>(ALL);
  const [fraction, setFraction] = useState<string>(ALL);
  const [minRating, setMinRating] = useState<string>(ALL);
  const [onlyFixed, setOnlyFixed] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<PartnerFormValues>(emptyPartnerForm);
  const [pendingStatus, setPendingStatus] = useState<StatusChange | null>(null);

  const partners = useMemo(() => partnersQuery.data ?? [], [partnersQuery.data]);
  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);

  const fractionOptions = useMemo<OptionItem[]>(() => {
    const specs = fractionSpecsQuery.data ?? [];
    if (specs.length) {
      return specs.map((spec) => ({
        id: spec.id,
        label: `${spec.id} — ${spec.name}`,
        hint: spec.application ?? undefined,
      }));
    }
    return FALLBACK_FRACTION_IDS.map((id) => ({ id, label: id }));
  }, [fractionSpecsQuery.data]);

  const subcategorySuggestions = useMemo(() => {
    const values = new Set<string>();
    partners.forEach((partner) => {
      if (partner.subcategory) values.add(partner.subcategory);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "de"));
  }, [partners]);

  const contactCounts = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach((contact) => {
      map.set(contact.partner_id, (map.get(contact.partner_id) ?? 0) + 1);
    });
    return map;
  }, [contacts]);

  /**
   * The contact counts come from a second query - while it loads or after it
   * failed there is no "0 Kontakte", only an unknown value.
   */
  const contactCountLabel = (partnerId: string): string => {
    if (contactsQuery.isLoading) return "…";
    if (contactsQuery.isError) return "—";
    const count = contactCounts.get(partnerId) ?? 0;
    return count === 1 ? "1 Kontakt" : `${count} Kontakte`;
  };

  const dueActions = useMemo(
    () => contacts.filter((contact) => contact.next_action && isDueOrOverdue(contact.next_action_date)),
    [contacts],
  );

  const filtersActive =
    search.trim() !== "" ||
    category !== ALL ||
    subcategory !== ALL ||
    status !== ALL ||
    materialClass !== ALL ||
    fraction !== ALL ||
    minRating !== ALL ||
    onlyFixed;

  const resetFilters = () => {
    setSearch("");
    setCategory(ALL);
    setSubcategory(ALL);
    setStatus(ALL);
    setMaterialClass(ALL);
    setFraction(ALL);
    setMinRating(ALL);
    setOnlyFixed(false);
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const minRatingValue = minRating === ALL ? null : Number(minRating);

    return partners
      .filter((partner) => {
        if (needle) {
          const haystack = `${partner.name} ${partner.city ?? ""}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        if (category !== ALL && partner.category !== category) return false;
        if (subcategory !== ALL && (partner.subcategory ?? "") !== subcategory) return false;
        if (status !== ALL && partner.status !== status) return false;
        if (materialClass !== ALL && !(partner.material_classes ?? []).includes(materialClass)) {
          return false;
        }
        if (fraction !== ALL && !(partner.fraction_ids ?? []).includes(fraction)) return false;
        if (minRatingValue !== null && (partner.suitability_rating ?? 0) < minRatingValue) {
          return false;
        }
        if (onlyFixed && !partner.is_fixed_partner) return false;
        return true;
      })
      .sort(comparePartners);
  }, [partners, search, category, subcategory, status, materialClass, fraction, minRating, onlyFixed]);

  const selectedPartner = useMemo(
    () => partners.find((partner) => partner.id === selectedId) ?? null,
    [partners, selectedId],
  );

  const openDetail = (partner: Partner) => {
    setSelectedId(partner.id);
    setDetailOpen(true);
  };

  const createMutation = useProjectMutation<PartnerFormValues>(
    async (values) => {
      const { data, error } = await supabase
        .from("project_partners")
        .insert(formToPayload(values))
        .select("id");
      if (error) {
        throw new Error(
          error.code === "23505"
            ? "Ein Partner mit diesem Namen existiert bereits."
            : error.message,
        );
      }
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Partner angelegt",
      errorMessage: "Partner konnte nicht angelegt werden",
      onDone: () => {
        setCreateOpen(false);
        setCreateValues(emptyPartnerForm());
      },
    },
  );

  const statusMutation = useProjectMutation<StatusChange>(
    async ({ partner, status: nextStatus }) => {
      const { data, error } = await supabase
        .from("project_partners")
        .update({ status: nextStatus })
        .eq("id", partner.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Status aktualisiert",
      errorMessage: "Status konnte nicht geändert werden",
      onDone: () => setPendingStatus(null),
    },
  );

  /** Moving a manufacturer into "Im Test" starts a phase-2 activity. */
  const requestStatusChange = (partner: Partner, nextStatus: string) => {
    if (partner.status === nextStatus) return;
    if (!patentFiled && isPhaseTwoActivity(partner.category, nextStatus)) {
      setPendingStatus({ partner, status: nextStatus });
      return;
    }
    statusMutation.mutate({ partner, status: nextStatus });
  };

  const isLoading = partnersQuery.isLoading;
  const isError = partnersQuery.isError;

  const emptyState =
    partners.length === 0 ? (
      <EmptyState
        title="Noch keine Partner erfasst"
        description="Maschinenhersteller, Materiallieferanten, Labore, Produktpartner und Kunden hier anlegen."
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Partner anlegen
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="Keine Partner für diese Filter"
        description="Filter lockern oder zurücksetzen, um wieder alle Partner zu sehen."
        action={
          <Button size="sm" variant="outline" onClick={resetFilters}>
            <X className="h-4 w-4 mr-1.5" />
            Filter zurücksetzen
          </Button>
        }
      />
    );

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <ProjectPageHeader
        title="Partner & Kontakte"
        description="Maschinenhersteller, Lieferanten, Labore und Produktpartner mit Ansprechpartnern und Kommunikationshistorie."
        icon={Users}
        actions={
          <Button
            onClick={() => {
              setCreateValues(emptyPartnerForm());
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Partner anlegen
          </Button>
        }
      />

      <IpGateBanner compact />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Partner gesamt" value={partners.length} icon={Users} accent="violet" />
        <StatCard
          label="Fixpartner"
          value={partners.filter((partner) => partner.is_fixed_partner).length}
          hint="im Projektplan gesetzt"
          icon={Star}
          accent="amber"
        />
        <StatCard
          label="Aktive Partner"
          value={partners.filter((partner) => partner.status === "active_partner").length}
          hint="Status „Aktiver Partner“"
          icon={Building2}
          accent="emerald"
        />
        <StatCard
          label="Offene Nachfassaktionen"
          value={
            contactsQuery.isLoading ? "…" : contactsQuery.isError ? "—" : dueActions.length
          }
          hint={
            contactsQuery.isError
              ? "Kontakte nicht geladen"
              : "Kontakte mit fälligem Termin"
          }
          icon={CalendarClock}
          accent="sky"
        />
      </div>

      {contactsQuery.isError && (
        <div className="mb-4">
          <ErrorState
            error={
              new Error(
                `Kontakte konnten nicht geladen werden: ${
                  (contactsQuery.error as Error | null)?.message ?? "Unbekannter Fehler"
                }`,
              )
            }
            onRetry={() => void contactsQuery.refetch()}
          />
        </div>
      )}

      {/* ------------------------------------------------------------ filters */}
      <Card className="mb-4">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Filter
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {filtered.length} von {partners.length} Partnern
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name oder Ort suchen …"
              className="pl-9"
              aria-label="Partner nach Name oder Ort suchen"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-category" className="text-xs text-muted-foreground">
                Kategorie
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="filter-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Alle Kategorien</SelectItem>
                  {PARTNER_CATEGORIES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-subcategory" className="text-xs text-muted-foreground">
                Unterkategorie
              </Label>
              <Select value={subcategory} onValueChange={setSubcategory}>
                <SelectTrigger id="filter-subcategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Alle Unterkategorien</SelectItem>
                  {subcategorySuggestions.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {subcategoryLabel(entry)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-status" className="text-xs text-muted-foreground">
                Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Alle Status</SelectItem>
                  {PARTNER_STATUSES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-material" className="text-xs text-muted-foreground">
                Materialklasse
              </Label>
              <Select value={materialClass} onValueChange={setMaterialClass}>
                <SelectTrigger id="filter-material">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Alle Materialklassen</SelectItem>
                  {MATERIAL_CLASSES.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.id} — {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-fraction" className="text-xs text-muted-foreground">
                Zielfraktion
              </Label>
              <Select value={fraction} onValueChange={setFraction}>
                <SelectTrigger id="filter-fraction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Alle Fraktionen</SelectItem>
                  {fractionOptions.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-rating" className="text-xs text-muted-foreground">
                Mindestbewertung
              </Label>
              <Select value={minRating} onValueChange={setMinRating}>
                <SelectTrigger id="filter-rating">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Beliebige Eignung</SelectItem>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      ab {value} von 5
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch id="filter-fixed" checked={onlyFixed} onCheckedChange={setOnlyFixed} />
              <Label htmlFor="filter-fixed" className="text-sm">
                Nur Fixpartner
              </Label>
            </div>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4 mr-1.5" />
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* -------------------------------------------------------------- views */}
      {isLoading ? (
        <LoadingRows rows={6} />
      ) : isError ? (
        <ErrorState
          error={(partnersQuery.error as Error | null) ?? new Error("Unbekannter Fehler")}
          onRetry={() => void partnersQuery.refetch()}
        />
      ) : (
        <Tabs defaultValue="cards" className="w-full">
          <div className="overflow-x-auto mb-3">
            <TabsList className="w-max">
              <TabsTrigger value="cards">
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Karten
              </TabsTrigger>
              <TabsTrigger value="table">
                <Table2 className="h-4 w-4 mr-1.5" />
                Tabelle
              </TabsTrigger>
              <TabsTrigger value="pipeline">
                <Columns3 className="h-4 w-4 mr-1.5" />
                Pipeline
              </TabsTrigger>
            </TabsList>
          </div>

          {/* --------------------------------------------------------- cards */}
          <TabsContent value="cards" className="mt-0">
            {filtered.length === 0 ? (
              emptyState
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((partner) => (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => openDetail(partner)}
                    className="text-left w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Card
                      className={cn(
                        "h-full transition-shadow hover:shadow-md",
                        partner.is_fixed_partner && "border-violet-400/40",
                      )}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold leading-tight break-words min-w-0">
                            {partner.name}
                          </p>
                          <RatingDots value={partner.suitability_rating} className="mt-1 shrink-0" />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {partner.is_fixed_partner && <FixedPartnerBadge />}
                          <ToneBadge tone={toneOf(PARTNER_STATUSES, partner.status)}>
                            {labelOf(PARTNER_STATUSES, partner.status)}
                          </ToneBadge>
                          {partner.company_id && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                            >
                              <Building2 className="h-3 w-3" aria-hidden />
                              Firma
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {labelOf(PARTNER_CATEGORIES, partner.category)}
                          {partner.subcategory ? ` · ${subcategoryLabel(partner.subcategory)}` : ""}
                        </p>

                        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span className="min-w-0 break-words">{partnerAddress(partner)}</span>
                        </p>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground w-16 shrink-0">
                              Material
                            </span>
                            <ChipList
                              values={partner.material_classes}
                              labelFor={(value) => labelOf(MATERIAL_CLASSES, value)}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground w-16 shrink-0">
                              Fraktionen
                            </span>
                            <ChipList
                              values={partner.fraction_ids}
                              labelFor={(value) =>
                                fractionOptions.find((option) => option.id === value)?.label ?? value
                              }
                            />
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground pt-1 border-t">
                          {contactCountLabel(partner.id)} · Details öffnen
                        </p>
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* --------------------------------------------------------- table */}
          <TabsContent value="table" className="mt-0">
            {filtered.length === 0 ? (
              emptyState
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Partner</TableHead>
                          <TableHead className="min-w-[150px]">Kategorie</TableHead>
                          <TableHead className="min-w-[140px]">Unterkategorie</TableHead>
                          <TableHead className="min-w-[140px]">Ort</TableHead>
                          <TableHead className="min-w-[130px]">Status</TableHead>
                          <TableHead className="min-w-[90px]">Eignung</TableHead>
                          <TableHead className="min-w-[130px]">Material</TableHead>
                          <TableHead className="min-w-[130px]">Fraktionen</TableHead>
                          <TableHead className="min-w-[90px] text-right">Kontakte</TableHead>
                          <TableHead className="min-w-[150px]">Firma</TableHead>
                          <TableHead className="min-w-[110px] text-right">Aktion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((partner) => (
                          <TableRow key={partner.id}>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-medium">{partner.name}</span>
                                {partner.is_fixed_partner && <FixedPartnerBadge className="w-fit" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {labelOf(PARTNER_CATEGORIES, partner.category)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {subcategoryLabel(partner.subcategory)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {[partner.city, partner.country].filter(Boolean).join(", ") || "—"}
                            </TableCell>
                            <TableCell>
                              <ToneBadge tone={toneOf(PARTNER_STATUSES, partner.status)}>
                                {labelOf(PARTNER_STATUSES, partner.status)}
                              </ToneBadge>
                            </TableCell>
                            <TableCell>
                              <RatingDots value={partner.suitability_rating} />
                            </TableCell>
                            <TableCell>
                              <ChipList
                                values={partner.material_classes}
                                labelFor={(value) => labelOf(MATERIAL_CLASSES, value)}
                              />
                            </TableCell>
                            <TableCell>
                              <ChipList values={partner.fraction_ids} />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {contactsQuery.isLoading
                                ? "…"
                                : contactsQuery.isError
                                  ? "—"
                                  : (contactCounts.get(partner.id) ?? 0)}
                            </TableCell>
                            <TableCell>
                              {partner.company_id ? (
                                <CompanyLinkBadge />
                              ) : (
                                <span className="text-xs text-muted-foreground">nicht verknüpft</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => openDetail(partner)}>
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ------------------------------------------------------ pipeline */}
          <TabsContent value="pipeline" className="mt-0">
            {filtered.length === 0 ? (
              emptyState
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-3 min-w-max">
                  {PARTNER_STATUSES.map((column) => {
                    const columnPartners = filtered.filter(
                      (partner) => partner.status === column.id,
                    );
                    return (
                      <div key={column.id} className="w-[260px] shrink-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <ToneBadge tone={column.tone}>{column.label}</ToneBadge>
                          <span className="text-xs text-muted-foreground">
                            {columnPartners.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {columnPartners.length === 0 ? (
                            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground text-center">
                              Keine Partner
                            </p>
                          ) : (
                            columnPartners.map((partner) => (
                              <Card
                                key={partner.id}
                                className={cn(
                                  partner.is_fixed_partner && "border-violet-400/40",
                                )}
                              >
                                <CardContent className="p-3 space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => openDetail(partner)}
                                    className="text-left w-full"
                                  >
                                    <span className="font-medium text-sm leading-tight break-words block hover:underline">
                                      {partner.name}
                                    </span>
                                  </button>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {partner.is_fixed_partner && <FixedPartnerBadge />}
                                    <RatingDots value={partner.suitability_rating} />
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {labelOf(PARTNER_CATEGORIES, partner.category)}
                                    {partner.city ? ` · ${partner.city}` : ""}
                                  </p>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full h-8 text-xs"
                                        disabled={statusMutation.isPending}
                                      >
                                        Status ändern
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                      <DropdownMenuLabel>Status setzen</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      {PARTNER_STATUSES.filter(
                                        (entry) => entry.id !== partner.status,
                                      ).map((entry) => (
                                        <DropdownMenuItem
                                          key={entry.id}
                                          onSelect={() => requestStatusChange(partner, entry.id)}
                                        >
                                          {entry.label}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <PartnerDetailSheet
        partner={selectedPartner}
        open={detailOpen}
        onOpenChange={(next) => {
          setDetailOpen(next);
          if (!next) setSelectedId(null);
        }}
        fractionOptions={fractionOptions}
        subcategorySuggestions={subcategorySuggestions}
      />

      <PartnerCreateDialog
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) setCreateValues(emptyPartnerForm());
        }}
        values={createValues}
        onValuesChange={setCreateValues}
        onSubmit={() => createMutation.mutate(createValues)}
        isPending={createMutation.isPending}
        fractionOptions={fractionOptions}
        subcategorySuggestions={subcategorySuggestions}
      />

      <AlertDialog
        open={Boolean(pendingStatus)}
        onOpenChange={(next) => {
          if (!next && !statusMutation.isPending) setPendingStatus(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Phase-2-Aktivität vor Patentanmeldung</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus
                ? `„${pendingStatus.partner.name}“ soll auf „${labelOf(
                    PARTNER_STATUSES,
                    pendingStatus.status,
                  )}“ gesetzt werden. Aufgabe P0-2 (Patentanmeldung) ist noch nicht erledigt — eine Herstellerdemo gefährdet die Neuheit des Verfahrens.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm">
            <Link to="/projekt/aufgaben" className="underline underline-offset-2">
              Zu den Aufgaben (P0-2)
            </Link>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (pendingStatus) statusMutation.mutate(pendingStatus);
              }}
            >
              Trotzdem setzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
