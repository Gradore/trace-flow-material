/**
 * Partner detail sheet: master data, contacts, linked tasks, test runs,
 * product tests and the communication log.
 */
import { ReactNode, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useProductTests,
  useProjectMutation,
  useProjectTasks,
  useTestRuns,
} from "@/hooks/project/useProjectData";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  ToneBadge,
  formatDate,
  formatEur,
  formatKg,
  formatNumber,
} from "@/components/project/ProjectUI";
import {
  ChipList,
  CompanyLinkBadge,
  FixedPartnerBadge,
  RatingDots,
  partnerAddress,
  subcategoryLabel,
} from "@/components/project/ProjectPartnersShared";
import {
  PartnerFormFields,
  formToPayload,
  partnerToForm,
  validatePartnerForm,
  type PartnerFormValues,
} from "@/components/project/ProjectPartnersForm";
import PartnerContactsTab from "@/components/project/ProjectPartnersContacts";
import PartnerCommunicationTab from "@/components/project/ProjectPartnersComms";
import { linkPartnerToCompany } from "@/lib/project/bridges";
import {
  MATERIAL_CLASSES,
  PARTNER_CATEGORIES,
  PARTNER_STATUSES,
  PROCESS_LINES,
  PRODUCT_TEST_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TEST_RUN_STATUSES,
  labelOf,
  toneOf,
} from "@/lib/project/constants";
import type { OptionItem } from "@/components/project/ProjectPartnersShared";
import type { Partner } from "@/lib/project/types";

function SectionState({
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  children: ReactNode;
}) {
  if (isLoading) return <LoadingRows rows={3} />;
  if (isError) {
    return <ErrorState error={error ?? new Error("Unbekannter Fehler")} onRetry={onRetry} />;
  }
  if (isEmpty) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <>{children}</>;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="text-xs text-muted-foreground sm:w-32 sm:shrink-0">{label}</span>
      <span className="text-sm min-w-0 break-words">{children}</span>
    </div>
  );
}

interface DetailProps {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fractionOptions: OptionItem[];
  subcategorySuggestions: string[];
}

export default function PartnerDetailSheet({
  partner,
  open,
  onOpenChange,
  fractionOptions,
  subcategorySuggestions,
}: DetailProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col gap-0"
      >
        {partner ? (
          <PartnerDetailBody
            key={partner.id}
            partner={partner}
            fractionOptions={fractionOptions}
            subcategorySuggestions={subcategorySuggestions}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <div className="p-6">
            <SheetHeader>
              <SheetTitle>Partner</SheetTitle>
              <SheetDescription>Kein Partner ausgewählt.</SheetDescription>
            </SheetHeader>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PartnerDetailBody({
  partner,
  fractionOptions,
  subcategorySuggestions,
  onClose,
}: {
  partner: Partner;
  fractionOptions: OptionItem[];
  subcategorySuggestions: string[];
  onClose: () => void;
}) {
  const idPrefix = useId();
  const [values, setValues] = useState<PartnerFormValues>(() => partnerToForm(partner));
  const [deleteOpen, setDeleteOpen] = useState(false);

  /**
   * Re-sync the form when the stored record actually changed (own save or a
   * concurrent writer) - a plain refetch must not discard pending edits, so we
   * compare the record version instead of the object identity.
   */
  const recordVersion = `${partner.id}:${partner.updated_at}`;
  const [syncedVersion, setSyncedVersion] = useState(recordVersion);
  if (recordVersion !== syncedVersion) {
    setSyncedVersion(recordVersion);
    setValues(partnerToForm(partner));
  }

  const tasksQuery = useProjectTasks();
  const testRunsQuery = useTestRuns();
  const productTestsQuery = useProductTests();

  const tasks = useMemo(
    () => (tasksQuery.data ?? []).filter((task) => task.partner_id === partner.id),
    [tasksQuery.data, partner.id],
  );
  const testRuns = useMemo(
    () => (testRunsQuery.data ?? []).filter((run) => run.partner_id === partner.id),
    [testRunsQuery.data, partner.id],
  );
  const productTests = useMemo(
    () => (productTestsQuery.data ?? []).filter((test) => test.partner_id === partner.id),
    [productTestsQuery.data, partner.id],
  );

  const saveMutation = useProjectMutation<PartnerFormValues>(
    async (form) => {
      const { data, error } = await supabase
        .from("project_partners")
        .update(formToPayload(form))
        .eq("id", partner.id)
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
    { successMessage: "Stammdaten gespeichert", errorMessage: "Speichern fehlgeschlagen" },
  );

  const deleteMutation = useProjectMutation<Partner>(
    async (entry) => {
      const { data, error } = await supabase
        .from("project_partners")
        .delete()
        .eq("id", entry.id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Partner gelöscht",
      errorMessage: "Partner konnte nicht gelöscht werden",
      onDone: () => {
        setDeleteOpen(false);
        onClose();
      },
    },
  );

  const linkMutation = useProjectMutation<Partner>(
    async (entry) => {
      const companyId = await linkPartnerToCompany(entry);
      /**
       * linkPartnerToCompany writes project_partners.company_id without a
       * returning clause - an update filtered away by RLS reports no error at
       * all. Read the row back before reporting success.
       */
      const { data, error } = await supabase
        .from("project_partners")
        .select("company_id")
        .eq("id", entry.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || data.company_id !== companyId) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden");
      }
    },
    {
      successMessage: "Firma verknüpft",
      errorMessage: "Firma konnte nicht verknüpft werden",
    },
  );

  const formError = validatePartnerForm(values);
  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(partnerToForm(partner)),
    [values, partner],
  );

  const websiteHref = partner.website
    ? partner.website.startsWith("http")
      ? partner.website
      : `https://${partner.website}`
    : null;

  return (
    <>
      <SheetHeader className="px-4 pt-5 pb-3 border-b space-y-2 text-left">
        <SheetTitle className="text-lg leading-tight break-words pr-8">{partner.name}</SheetTitle>
        <SheetDescription className="sr-only">
          Detailansicht des Projektpartners {partner.name}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-1.5">
          {partner.is_fixed_partner && <FixedPartnerBadge />}
          <ToneBadge tone={toneOf(PARTNER_STATUSES, partner.status)}>
            {labelOf(PARTNER_STATUSES, partner.status)}
          </ToneBadge>
          {partner.company_id && <CompanyLinkBadge />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{labelOf(PARTNER_CATEGORIES, partner.category)}</span>
          {partner.subcategory && <span>· {subcategoryLabel(partner.subcategory)}</span>}
          <RatingDots value={partner.suitability_rating} />
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="master" className="w-full">
          <div className="sticky top-0 z-10 bg-background border-b px-4 py-2 overflow-x-auto">
            <TabsList className="w-max">
              <TabsTrigger value="master">Stammdaten</TabsTrigger>
              <TabsTrigger value="contacts">Kontakte</TabsTrigger>
              <TabsTrigger value="tasks">Aufgaben</TabsTrigger>
              <TabsTrigger value="runs">Versuchsläufe</TabsTrigger>
              <TabsTrigger value="products">Produkttests</TabsTrigger>
              <TabsTrigger value="comms">Kommunikation</TabsTrigger>
            </TabsList>
          </div>

          {/* ------------------------------------------------------- master */}
          <TabsContent value="master" className="px-4 py-4 space-y-4 mt-0">
            <Card>
              <CardContent className="p-3 space-y-2">
                <DetailRow label="Anschrift">
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    {partnerAddress(partner)}
                  </span>
                </DetailRow>
                <DetailRow label="Telefon">
                  {partner.phone ? (
                    <a
                      href={`tel:${partner.phone.replace(/\s/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {partner.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="E-Mail">
                  {partner.email ? (
                    <a
                      href={`mailto:${partner.email}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:underline break-all"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {partner.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Website">
                  {websiteHref ? (
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline break-all"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      {partner.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="Materialklassen">
                  <ChipList
                    values={partner.material_classes}
                    labelFor={(value) => labelOf(MATERIAL_CLASSES, value)}
                  />
                </DetailRow>
                <DetailRow label="Zielfraktionen">
                  <ChipList
                    values={partner.fraction_ids}
                    labelFor={(value) =>
                      fractionOptions.find((option) => option.id === value)?.label ?? value
                    }
                  />
                </DetailRow>
                <DetailRow label="Angelegt">{formatDate(partner.created_at)}</DetailRow>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              {partner.company_id ? (
                <Button asChild size="sm" variant="outline">
                  <Link to="/companies">
                    <Building2 className="h-4 w-4 mr-1.5" />
                    Firma öffnen
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={linkMutation.isPending}
                  onClick={() => linkMutation.mutate(partner)}
                >
                  {linkMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Building2 className="h-4 w-4 mr-1.5" />
                  )}
                  Als Firma anlegen / verknüpfen
                </Button>
              )}
            </div>

            <div className="rounded-lg border p-3 space-y-4">
              <p className="text-sm font-semibold">Stammdaten bearbeiten</p>
              <PartnerFormFields
                idPrefix={`detail-${idPrefix}`}
                values={values}
                onChange={setValues}
                fractionOptions={fractionOptions}
                subcategorySuggestions={subcategorySuggestions}
                disabled={saveMutation.isPending}
              />
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={saveMutation.isPending || Boolean(formError) || !isDirty}
                  onClick={() => saveMutation.mutate(values)}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  Speichern
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saveMutation.isPending || !isDirty}
                  onClick={() => setValues(partnerToForm(partner))}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Änderungen verwerfen
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-semibold text-destructive">Partner löschen</p>
              <p className="text-xs text-muted-foreground">
                Kontakte und Kommunikation dieses Partners werden mitgelöscht. Aufgaben, Versuche
                und Produkttests bleiben bestehen, verlieren aber die Partnerzuordnung.
              </p>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Partner löschen
              </Button>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------ contacts */}
          <TabsContent value="contacts" className="px-4 py-4 mt-0">
            <PartnerContactsTab partnerId={partner.id} partnerName={partner.name} />
          </TabsContent>

          {/* --------------------------------------------------------- tasks */}
          <TabsContent value="tasks" className="px-4 py-4 space-y-3 mt-0">
            <SectionState
              isLoading={tasksQuery.isLoading}
              isError={tasksQuery.isError}
              error={(tasksQuery.error as Error | null) ?? null}
              onRetry={() => void tasksQuery.refetch()}
              isEmpty={tasks.length === 0}
              emptyTitle="Keine Aufgaben mit diesem Partner"
              emptyDescription="Aufgaben werden im Aufgabenboard angelegt und dort einem Partner zugeordnet."
            >
              <div className="space-y-2">
                {tasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-muted-foreground">{task.code}</p>
                          <p className="font-medium leading-tight break-words">{task.title}</p>
                        </div>
                        <ToneBadge tone={toneOf(TASK_STATUSES, task.status)} className="shrink-0">
                          {labelOf(TASK_STATUSES, task.status)}
                        </ToneBadge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Priorität: {labelOf(TASK_PRIORITIES, task.priority)}</span>
                        <span>Fällig: {formatDate(task.due_date)}</span>
                        {task.estimated_cost_eur !== null && (
                          <span>Budget: {formatEur(task.estimated_cost_eur)}</span>
                        )}
                      </div>
                      {task.blocker_reason && (
                        <p className="text-xs text-destructive">Blocker: {task.blocker_reason}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </SectionState>
            <Button asChild variant="outline" size="sm">
              <Link to="/projekt/aufgaben">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Zum Aufgabenboard
              </Link>
            </Button>
          </TabsContent>

          {/* ----------------------------------------------------- test runs */}
          <TabsContent value="runs" className="px-4 py-4 space-y-3 mt-0">
            <SectionState
              isLoading={testRunsQuery.isLoading}
              isError={testRunsQuery.isError}
              error={(testRunsQuery.error as Error | null) ?? null}
              onRetry={() => void testRunsQuery.refetch()}
              isEmpty={testRuns.length === 0}
              emptyTitle="Keine Versuchsläufe mit diesem Partner"
              emptyDescription="Technikumsversuche werden unter Versuche angelegt."
            >
              <div className="space-y-2">
                {testRuns.map((run) => (
                  <Card key={run.id}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-muted-foreground">{run.run_code}</p>
                          <p className="font-medium leading-tight break-words">{run.title}</p>
                        </div>
                        <ToneBadge
                          tone={toneOf(TEST_RUN_STATUSES, run.status)}
                          className="shrink-0"
                        >
                          {labelOf(TEST_RUN_STATUSES, run.status)}
                        </ToneBadge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{labelOf(PROCESS_LINES, run.process_line)}</span>
                        {run.machine_name && <span>Maschine: {run.machine_name}</span>}
                        <span>Geplant: {formatDate(run.planned_date)}</span>
                        {run.actual_date && <span>Durchgeführt: {formatDate(run.actual_date)}</span>}
                        {run.input_weight_kg !== null && (
                          <span>Einsatz: {formatKg(run.input_weight_kg)}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </SectionState>
            <Button asChild variant="outline" size="sm">
              <Link to="/projekt/versuche">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Zu den Versuchen
              </Link>
            </Button>
          </TabsContent>

          {/* -------------------------------------------------- product tests */}
          <TabsContent value="products" className="px-4 py-4 space-y-3 mt-0">
            <SectionState
              isLoading={productTestsQuery.isLoading}
              isError={productTestsQuery.isError}
              error={(productTestsQuery.error as Error | null) ?? null}
              onRetry={() => void productTestsQuery.refetch()}
              isEmpty={productTests.length === 0}
              emptyTitle="Keine Produkttests mit diesem Partner"
              emptyDescription="Beton-, Mörtel- und Compound-Tests werden unter Produkttests geführt."
            >
              <div className="space-y-2">
                {productTests.map((test) => (
                  <Card key={test.id}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-muted-foreground">{test.test_code}</p>
                          <p className="font-medium leading-tight break-words">{test.title}</p>
                        </div>
                        <ToneBadge
                          tone={toneOf(TEST_RUN_STATUSES, test.status)}
                          className="shrink-0"
                        >
                          {labelOf(TEST_RUN_STATUSES, test.status)}
                        </ToneBadge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{labelOf(PRODUCT_TEST_CATEGORIES, test.category)}</span>
                        {test.dosage_pct !== null && (
                          <span>Dosierung: {formatNumber(test.dosage_pct, 1)} %</span>
                        )}
                        <span>Geplant: {formatDate(test.planned_date)}</span>
                        {test.cost_eur !== null && <span>Kosten: {formatEur(test.cost_eur)}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </SectionState>
            <Button asChild variant="outline" size="sm">
              <Link to="/projekt/produkttests">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Zu den Produkttests
              </Link>
            </Button>
          </TabsContent>

          {/* ---------------------------------------------------------- comms */}
          <TabsContent value="comms" className="px-4 py-4 mt-0">
            <PartnerCommunicationTab partnerId={partner.id} partnerName={partner.name} />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!deleteMutation.isPending) setDeleteOpen(next);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Partner „{partner.name}“ löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Kontakte und Kommunikationseinträge dieses Partners werden mitgelöscht. Dieser
              Schritt kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate(partner);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
