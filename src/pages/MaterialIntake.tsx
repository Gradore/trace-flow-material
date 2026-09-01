import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Filter, Inbox, MoreVertical, FileText, Upload, Calendar, Building2, Loader2, Trash2, Eye, XCircle, AlertTriangle, Pencil, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { IntakeDialog } from "@/components/intake/IntakeDialog";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { ProcessingDialog } from "@/components/processing/ProcessingDialog";
import { PageDescription } from "@/components/layout/PageDescription";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
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

const statusConfig: Record<string, { label: string; class: string }> = {
  created: { label: "Angelegt", class: "status-badge" },
  ordered: { label: "Bestellt", class: "status-badge-info" },
  received: { label: "Eingetroffen", class: "status-badge-warning" },
  quality_check: { label: "Qualitätsprüfung", class: "status-badge-info" },
  stored: { label: "Eingelagert", class: "status-badge-success" },
  in_processing: { label: "In Verarbeitung", class: "status-badge-warning" },
  processed: { label: "Verarbeitet", class: "status-badge-success" },
  rejected: { label: "Abgelehnt", class: "status-badge-destructive" },
};

// Only these three values are accepted by the material_inputs_status_check
// constraint in the database.
const statusOptions = [
  { value: "received", label: "Eingetroffen" },
  { value: "in_processing", label: "In Verarbeitung" },
  { value: "processed", label: "Verarbeitet" },
];

const materialTypes: Record<string, string> = {
  gfk: "GFK",
  "gfk-up": "GFK-UP",
  "gfk-ep": "GFK-EP",
  "gfk-ve": "GFK-VE",
  "gfk-pu": "GFK-PU",
  "gfk-pet": "GFK-PET",
  pp: "Polypropylen (PP)",
  pa: "Polyamid (PA)",
  pa6: "Polyamid (PA6)",
  pa66: "Polyamid (PA66)",
};

export default function MaterialIntake() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [intakeToDelete, setIntakeToDelete] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailIntake, setDetailIntake] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingIntake, setEditingIntake] = useState<any>(null);
  const [editForm, setEditForm] = useState({ supplier: "", weight_kg: "", waste_code: "", notes: "" });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [documentIntake, setDocumentIntake] = useState<{ id: string } | null>(null);
  const [isProcessingDialogOpen, setIsProcessingDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: intakes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["material-inputs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_inputs")
        .select("*, containers(container_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredIntakes = intakes.filter((i) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      i.input_id.toLowerCase().includes(term) ||
      i.supplier.toLowerCase().includes(term) ||
      i.material_type.toLowerCase().includes(term);
    const matchesStatus = statusFilter === "all" || i.status === statusFilter;
    const matchesMaterial = materialFilter === "all" || i.material_type === materialFilter;
    return matchesSearch && matchesStatus && matchesMaterial;
  });

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (materialFilter !== "all" ? 1 : 0);

  // Deep link support: /intake?id=<uuid|Eingangs-ID> opens that intake.
  const deepLinkId = searchParams.get("id");
  useEffect(() => {
    if (!deepLinkId || isLoading) return;
    const match = intakes.find((i) => i.id === deepLinkId || i.input_id === deepLinkId);
    if (match) {
      setDetailIntake(match);
      setDetailDialogOpen(true);
    } else {
      toast({
        title: "Materialeingang nicht gefunden",
        description: `Es existiert kein Eingang mit der Kennung ${deepLinkId}.`,
        variant: "destructive",
      });
    }
    const params = new URLSearchParams(searchParams);
    params.delete("id");
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, isLoading, intakes]);

  const todayIntakes = intakes.filter(
    (i) => new Date(i.received_at).toDateString() === new Date().toDateString()
  );
  const todayWeight = todayIntakes.reduce((sum, i) => sum + (i.weight_kg || 0), 0);
  const inProcessingCount = intakes.filter((i) => i.status === "in_processing").length;
  const rejectedCount = intakes.filter((i) => i.status === "rejected").length;

  const handleStatusChange = async (intakeId: string, newStatus: string) => {
    try {
      const { data, error } = await supabase
        .from("material_inputs")
        .update({ status: newStatus })
        .eq("id", intakeId)
        .select();

      if (error) throw error;
      // RLS filters the row out silently: no error, no affected rows.
      if (!data || data.length === 0) {
        toast({ title: "Fehler beim Statuswechsel", description: "Keine Berechtigung oder Datensatz nicht gefunden.", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["material-inputs"] });
      toast({ title: "Status aktualisiert", description: `Status wurde auf "${statusConfig[newStatus]?.label || newStatus}" geändert.` });
    } catch (error: any) {
      toast({ title: "Fehler beim Statuswechsel", description: error.message || "Status konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!intakeToDelete) return;

    try {
      // processing_steps.material_input_id is NOT NULL without ON DELETE, so an
      // intake that has been processed can never be removed.
      const { data: processingSteps, error: processingError } = await supabase
        .from("processing_steps")
        .select("id, processing_id")
        .eq("material_input_id", intakeToDelete.id)
        .limit(1);
      if (processingError) throw processingError;

      if (processingSteps && processingSteps.length > 0) {
        toast({
          title: "Materialeingang in Verwendung",
          description: "Zu diesem Eingang existieren Verarbeitungsschritte. Bitte löschen Sie diese zuerst.",
          variant: "destructive",
        });
        return;
      }

      const { error: documentsError } = await supabase
        .from("documents")
        .delete()
        .eq("material_input_id", intakeToDelete.id);
      if (documentsError) throw documentsError;

      const { error: samplesError } = await supabase
        .from("samples")
        .delete()
        .eq("material_input_id", intakeToDelete.id);
      if (samplesError) throw samplesError;

      const { data: deleted, error } = await supabase
        .from("material_inputs")
        .delete()
        .eq("id", intakeToDelete.id)
        .select();
      if (error) throw error;

      // RLS filters the row out silently: no error, no affected rows.
      if (!deleted || deleted.length === 0) {
        toast({
          title: "Fehler beim Löschen",
          description: "Keine Berechtigung oder Datensatz nicht gefunden.",
          variant: "destructive",
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["material-inputs"] });
      toast({ title: "Materialeingang gelöscht" });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Materialeingang konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setIntakeToDelete(null);
    }
  };

  const openEditDialog = (intake: any) => {
    setEditingIntake(intake);
    setEditForm({
      supplier: intake.supplier || "",
      weight_kg: String(intake.weight_kg || ""),
      waste_code: intake.waste_code || "",
      notes: intake.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingIntake) return;

    if (!editForm.supplier.trim()) {
      toast({ title: "Lieferant fehlt", description: "Bitte geben Sie einen Lieferanten an.", variant: "destructive" });
      return;
    }

    const weight = parseFloat(editForm.weight_kg);
    if (!Number.isFinite(weight) || weight <= 0) {
      toast({ title: "Ungültiges Gewicht", description: "Bitte geben Sie ein Gewicht größer als 0 kg an.", variant: "destructive" });
      return;
    }

    setIsEditSubmitting(true);
    try {
      const { data, error } = await supabase.from("material_inputs").update({
        supplier: editForm.supplier,
        weight_kg: weight,
        waste_code: editForm.waste_code || null,
        notes: editForm.notes || null,
      }).eq("id", editingIntake.id).select();

      if (error) throw error;
      // RLS filters the row out silently: no error, no affected rows.
      if (!data || data.length === 0) {
        toast({ title: "Fehler beim Speichern", description: "Keine Berechtigung oder Datensatz nicht gefunden.", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["material-inputs"] });
      toast({ title: "Materialeingang aktualisiert" });
      setEditDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Fehler beim Speichern", description: error.message || "Änderungen konnten nicht gespeichert werden.", variant: "destructive" });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const getMaterialLabel = (intake: any) => {
    let label = materialTypes[intake.material_type] || intake.material_type;
    if (intake.material_subtype) {
      label = `${materialTypes[intake.material_type] || intake.material_type}-${intake.material_subtype.toUpperCase()}`;
    }
    return label;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageDescription
        title="Materialeingang & Wareneingang"
        description="Erfassen Sie eingehende Materialien von Lieferanten. Jeder Eingang erhält eine eindeutige ID (ME-XXXX) und wird mit Lieferant, Materialtyp, Gewicht und Container dokumentiert. Das ist der Startpunkt des Materialflusses."
        nextSteps={[
          "Neuen Eingang erfassen → Lieferanten und Material angeben",
          "Container zuweisen → Für Nachverfolgung im Lager",
          "Verarbeitung starten → Material in Produktion geben"
        ]}
        workflowLinks={[
          { label: "Container", path: "/containers", direction: "previous" },
          { label: "Firmen", path: "/companies", direction: "previous" },
          { label: "Verarbeitung", path: "/processing", direction: "next" },
          { label: "Beprobung", path: "/sampling", direction: "next" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Materialeingang</h1>
          <p className="text-muted-foreground mt-1">Erfassung und Verwaltung eingehender Materialien</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neuer Eingang
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Heute eingegangen</p>
          <p className="text-2xl font-bold text-foreground mt-1">{todayIntakes.length}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Gesamtgewicht heute</p>
          <p className="text-2xl font-bold text-foreground mt-1">{todayWeight.toLocaleString("de-DE")} kg</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Gesamt Eingänge</p>
          <p className="text-2xl font-bold text-foreground mt-1">{intakes.length}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">In Verarbeitung</p>
          <p className="text-2xl font-bold text-info mt-1">{inProcessingCount}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Abgelehnt</p>
          <p className="text-2xl font-bold text-destructive mt-1">{rejectedCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach ID, Lieferant, Material..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-4 bg-popover">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Alle Status</SelectItem>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Materialart</Label>
              <Select value={materialFilter} onValueChange={setMaterialFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Materialien" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Alle Materialien</SelectItem>
                  <SelectItem value="gfk">GFK</SelectItem>
                  <SelectItem value="pp">Polypropylen (PP)</SelectItem>
                  <SelectItem value="pa">Polyamid (PA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={activeFilterCount === 0}
              onClick={() => {
                setStatusFilter("all");
                setMaterialFilter("all");
              }}
            >
              Filter zurücksetzen
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Materialeingänge konnten nicht geladen werden. Bitte prüfen Sie Ihre Verbindung und Berechtigungen.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Erneut versuchen
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Eingangs-ID</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Gewicht</TableHead>
                <TableHead>Container</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIntakes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Keine Materialeingänge vorhanden
                  </TableCell>
                </TableRow>
              ) : (
                filteredIntakes.map((intake) => {
                  const status = statusConfig[intake.status] || statusConfig.received;
                  const isRejected = intake.status === "rejected";
                  const materialLabel = getMaterialLabel(intake);
                  const containerLabel = intake.containers?.container_id || "-";

                  return (
                    <TableRow 
                      key={intake.id} 
                      className={cn("cursor-pointer", isRejected && "bg-destructive/5")}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isRejected ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Inbox className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-mono font-medium">{intake.input_id}</span>
                          {isRejected && (
                            <span className="text-xs text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(intake.received_at).toLocaleDateString("de-DE")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {intake.supplier}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{materialLabel}</TableCell>
                      <TableCell>{intake.weight_kg?.toLocaleString("de-DE")} kg</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{containerLabel}</span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={intake.status}
                          onValueChange={(val) => handleStatusChange(intake.id, val)}
                        >
                          <SelectTrigger className="h-7 w-[150px] text-xs border-none bg-transparent p-0">
                            <span className={cn(status.class)}>{status.label}</span>
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {statusOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => {
                              setDetailIntake(intake);
                              setDetailDialogOpen(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              Details anzeigen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(intake)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDocumentIntake(intake)}>
                              <Upload className="h-4 w-4 mr-2" />
                              Dokumente hochladen
                            </DropdownMenuItem>
                            {!isRejected && intake.status === "received" && (
                              <DropdownMenuItem onClick={() => setIsProcessingDialogOpen(true)}>
                                <Settings className="h-4 w-4 mr-2" />
                                Verarbeitung starten
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => {
                                setIntakeToDelete(intake);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <IntakeDialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) refetch(); }} />

      <DocumentUploadDialog
        open={!!documentIntake}
        onOpenChange={(open) => { if (!open) setDocumentIntake(null); }}
        preselectedMaterialInputId={documentIntake?.id}
      />

      <ProcessingDialog
        open={isProcessingDialogOpen}
        onOpenChange={(open) => { setIsProcessingDialogOpen(open); if (!open) refetch(); }}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Materialeingang löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Der Materialeingang {intakeToDelete?.input_id} und alle verknüpften Dokumente und Proben werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Materialeingang Details
            </DialogTitle>
            <DialogDescription>{detailIntake?.input_id}</DialogDescription>
          </DialogHeader>
          {detailIntake && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Lieferant</p><p className="font-medium">{detailIntake.supplier}</p></div>
                <div><p className="text-xs text-muted-foreground">Material</p><p className="font-medium">{getMaterialLabel(detailIntake)}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Gewicht</p><p className="font-medium">{detailIntake.weight_kg?.toLocaleString("de-DE")} kg</p></div>
                <div><p className="text-xs text-muted-foreground">Eingangsdatum</p><p className="font-medium">{new Date(detailIntake.received_at).toLocaleDateString("de-DE")}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Container</p><p className="font-medium">{detailIntake.containers?.container_id || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Abfallschlüssel</p><p className="font-medium">{detailIntake.waste_code || "-"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium"><span className={cn(statusConfig[detailIntake.status]?.class)}>{statusConfig[detailIntake.status]?.label || detailIntake.status}</span></p></div>
                <div><p className="text-xs text-muted-foreground">Erstellt am</p><p className="font-medium">{new Date(detailIntake.created_at).toLocaleString("de-DE")}</p></div>
              </div>
              {detailIntake.notes && (
                <div><p className="text-xs text-muted-foreground">Notizen</p><p className="text-sm">{detailIntake.notes}</p></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Materialeingang bearbeiten
            </DialogTitle>
            <DialogDescription>{editingIntake?.input_id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lieferant</Label>
              <Input value={editForm.supplier} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gewicht (kg)</Label>
                <Input type="number" step="0.1" value={editForm.weight_kg} onChange={(e) => setEditForm({ ...editForm, weight_kg: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Abfallschlüssel</Label>
                <Input value={editForm.waste_code} onChange={(e) => setEditForm({ ...editForm, waste_code: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notizen</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleEditSubmit} disabled={isEditSubmitting}>
              {isEditSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
