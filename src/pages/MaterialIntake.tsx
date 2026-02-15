import { useState } from "react";
import { Plus, Search, Filter, Inbox, MoreVertical, FileText, Upload, Calendar, Building2, Loader2, Trash2, Eye, XCircle, AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const statusOptions = [
  { value: "created", label: "Angelegt" },
  { value: "ordered", label: "Bestellt" },
  { value: "received", label: "Eingetroffen" },
  { value: "quality_check", label: "Qualitätsprüfung" },
  { value: "stored", label: "Eingelagert" },
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
  const queryClient = useQueryClient();

  const { data: intakes = [], isLoading, refetch } = useQuery({
    queryKey: ["material_inputs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_inputs")
        .select("*, containers(container_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredIntakes = intakes.filter(
    (i) =>
      i.input_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.material_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const todayIntakes = intakes.filter(
    (i) => new Date(i.received_at).toDateString() === new Date().toDateString()
  );
  const todayWeight = todayIntakes.reduce((sum, i) => sum + (i.weight_kg || 0), 0);
  const inProcessingCount = intakes.filter((i) => i.status === "in_processing").length;
  const rejectedCount = intakes.filter((i) => i.status === "rejected").length;

  const handleStatusChange = async (intakeId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("material_inputs")
        .update({ status: newStatus })
        .eq("id", intakeId);
      
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["material_inputs"] });
      toast({ title: "Status aktualisiert", description: `Status wurde auf "${statusConfig[newStatus]?.label || newStatus}" geändert.` });
    } catch (error: any) {
      toast({ title: "Fehler beim Statuswechsel", description: error.message || "Status konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!intakeToDelete) return;
    
    try {
      await supabase.from("documents").delete().eq("material_input_id", intakeToDelete.id);
      await supabase.from("samples").delete().eq("material_input_id", intakeToDelete.id);
      
      const { error } = await supabase.from("material_inputs").delete().eq("id", intakeToDelete.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["material_inputs"] });
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
    setIsEditSubmitting(true);
    try {
      const { error } = await supabase.from("material_inputs").update({
        supplier: editForm.supplier,
        weight_kg: parseFloat(editForm.weight_kg),
        waste_code: editForm.waste_code || null,
        notes: editForm.notes || null,
      }).eq("id", editingIntake.id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["material_inputs"] });
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
        <Button variant="outline">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                            <DropdownMenuItem>
                              <Upload className="h-4 w-4 mr-2" />
                              Dokumente hochladen
                            </DropdownMenuItem>
                            {!isRejected && intake.status === "received" && (
                              <DropdownMenuItem>Verarbeitung starten</DropdownMenuItem>
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
