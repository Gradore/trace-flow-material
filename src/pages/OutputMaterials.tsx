import { useState } from "react";
import { Plus, Search, Filter, FileOutput, MoreVertical, QrCode, Truck, FileText, Package, Loader2, Users, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageDescription } from "@/components/layout/PageDescription";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OutputMaterialDialog } from "@/components/output/OutputMaterialDialog";
import { BatchAllocationDialog } from "@/components/processing/BatchAllocationDialog";
import { toast } from "@/hooks/use-toast";

const outputTypes: Record<string, { label: string; color: string }> = {
  glass_fiber: { label: "Recycelte Glasfasern", color: "bg-primary" },
  resin_powder: { label: "Harzpulver", color: "bg-info" },
  pp_regrind: { label: "PP Regranulat", color: "bg-warning" },
  pa_regrind: { label: "PA Regranulat", color: "bg-accent" },
};

const statusConfig: Record<string, { label: string; class: string }> = {
  in_stock: { label: "Auf Lager", class: "status-badge-success" },
  in_production: { label: "In Produktion", class: "status-badge-warning" },
  reserved: { label: "Reserviert", class: "status-badge-info" },
  shipped: { label: "Ausgeliefert", class: "status-badge" },
};

const statusOptions = [
  { value: "in_stock", label: "Auf Lager" },
  { value: "in_production", label: "In Produktion" },
  { value: "reserved", label: "Reserviert" },
  { value: "shipped", label: "Ausgeliefert" },
];

const qualityGrades = ["A", "B", "C"];

export default function OutputMaterials() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [outputToDelete, setOutputToDelete] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOutput, setEditingOutput] = useState<any>(null);
  const [editForm, setEditForm] = useState({ weight_kg: "", destination: "", quality_grade: "", fiber_size: "", notes: "" });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ["output-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select(`
          *,
          containers (
            container_id
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredOutputs = outputs.filter(
    (o) =>
      o.output_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.batch_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (outputTypes[o.output_type]?.label.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const typeStats = Object.entries(outputTypes).map(([key, config]) => {
    const total = outputs
      .filter((o) => o.output_type === key)
      .reduce((sum, o) => sum + Number(o.weight_kg || 0), 0);
    return { key, ...config, total };
  });

  const handleStatusChange = async (outputId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("output_materials")
        .update({ status: newStatus })
        .eq("id", outputId);
      
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["output-materials"] });
      toast({ title: "Status aktualisiert", description: `Status wurde auf "${statusConfig[newStatus]?.label || newStatus}" geändert.` });
    } catch (error: any) {
      toast({ title: "Fehler beim Statuswechsel", description: error.message || "Status konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!outputToDelete) return;
    try {
      // Delete related batch allocations first
      await supabase.from("batch_allocations").delete().eq("output_material_id", outputToDelete.id);
      await supabase.from("documents").delete().eq("output_material_id", outputToDelete.id);
      await supabase.from("delivery_notes").delete().eq("output_material_id", outputToDelete.id);
      
      const { error } = await supabase.from("output_materials").delete().eq("id", outputToDelete.id);
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["output-materials"] });
      toast({ title: "Ausgangsmaterial gelöscht", description: `${outputToDelete.output_id} wurde gelöscht.` });
    } catch (error: any) {
      toast({ title: "Fehler beim Löschen", description: error.message || "Material konnte nicht gelöscht werden.", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setOutputToDelete(null);
    }
  };

  const openEditDialog = (output: any) => {
    setEditingOutput(output);
    const attrs = output.attributes && typeof output.attributes === 'object' ? output.attributes : {};
    setEditForm({
      weight_kg: String(output.weight_kg || ""),
      destination: output.destination || "",
      quality_grade: output.quality_grade || "",
      fiber_size: output.fiber_size || "",
      notes: (attrs as any).notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingOutput) return;
    setIsEditSubmitting(true);
    try {
      const { error } = await supabase.from("output_materials").update({
        weight_kg: parseFloat(editForm.weight_kg),
        destination: editForm.destination || null,
        quality_grade: editForm.quality_grade || null,
        fiber_size: editForm.fiber_size || null,
        attributes: editForm.notes ? { notes: editForm.notes } : {},
      }).eq("id", editingOutput.id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["output-materials"] });
      toast({ title: "Ausgangsmaterial aktualisiert" });
      setEditDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Fehler beim Speichern", description: error.message || "Änderungen konnten nicht gespeichert werden.", variant: "destructive" });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageDescription
        title="Ausgangsmaterial & Fertigprodukte"
        description="Übersicht aller recycelten Materialien (Glasfasern, Harzpulver, PP/PA-Regranulat). Jede Charge erhält eine Batch-ID und kann Kundenaufträgen zugewiesen werden. Hier beginnt die Auslieferungsvorbereitung."
        nextSteps={[
          "Neues Material anlegen → Nach Verarbeitungsabschluss",
          "Kunde zuordnen → Charge für Auftrag reservieren",
          "Lieferschein erstellen → Versand dokumentieren"
        ]}
        workflowLinks={[
          { label: "Verarbeitung", path: "/processing", direction: "previous" },
          { label: "Beprobung", path: "/sampling", direction: "previous" },
          { label: "Aufträge", path: "/orders", direction: "next" },
          { label: "Lieferscheine", path: "/delivery-notes", direction: "next" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ausgangsmaterial</h1>
          <p className="text-muted-foreground mt-1">Fertige Produkte und recycelte Materialien</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neues Ausgangsmaterial
        </Button>
      </div>

      <OutputMaterialDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {typeStats.map((stat) => (
          <div key={stat.key} className="glass-card rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", stat.color)} />
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold text-foreground">{stat.total.toLocaleString("de-DE")} kg</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach ID, Charge, Typ..."
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
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOutputs.length === 0 ? (
          <div className="text-center py-12">
            <FileOutput className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Keine Ausgangsmaterialien gefunden</p>
            <p className="text-muted-foreground">Erstellen Sie neues Ausgangsmaterial um zu beginnen.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Ausgangs-ID</TableHead>
                <TableHead>Charge</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Gewicht</TableHead>
                <TableHead>Korngröße</TableHead>
                <TableHead>Container</TableHead>
                <TableHead>Bestimmung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOutputs.map((output) => {
                const type = outputTypes[output.output_type] || { label: output.output_type, color: "bg-secondary" };
                const status = statusConfig[output.status] || { label: output.status, class: "status-badge" };
                return (
                  <TableRow key={output.id} className="cursor-pointer">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileOutput className="h-4 w-4 text-primary" />
                        <span className="font-mono font-medium">{output.output_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{output.batch_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", type.color)} />
                        {type.label}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{Number(output.weight_kg).toLocaleString("de-DE")} kg</TableCell>
                    <TableCell>
                      {output.fiber_size ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                          {output.fiber_size}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {output.containers?.container_id ? (
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-sm">{output.containers.container_id}</span>
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{output.destination || "-"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={output.status}
                        onValueChange={(val) => handleStatusChange(output.id, val)}
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs border-none bg-transparent p-0">
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
                          <DropdownMenuItem onClick={() => openEditDialog(output)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedOutput(output);
                            setAllocationDialogOpen(true);
                          }}>
                            <Users className="h-4 w-4 mr-2" />
                            Kunde zuordnen
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <QrCode className="h-4 w-4 mr-2" />
                            Etikett drucken
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileText className="h-4 w-4 mr-2" />
                            Zertifikat anzeigen
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Truck className="h-4 w-4 mr-2" />
                            Lieferschein erstellen
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setOutputToDelete(output);
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
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <BatchAllocationDialog 
        open={allocationDialogOpen} 
        onOpenChange={setAllocationDialogOpen} 
        outputMaterial={selectedOutput}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ausgangsmaterial löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. {outputToDelete?.output_id} und alle verknüpften Daten werden dauerhaft gelöscht.
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Ausgangsmaterial bearbeiten
            </DialogTitle>
            <DialogDescription>
              {editingOutput?.output_id} – {outputTypes[editingOutput?.output_type]?.label || editingOutput?.output_type}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gewicht (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.weight_kg}
                  onChange={(e) => setEditForm({ ...editForm, weight_kg: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Qualitätsstufe</Label>
                <Select value={editForm.quality_grade} onValueChange={(v) => setEditForm({ ...editForm, quality_grade: v })}>
                  <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {qualityGrades.map((g) => <SelectItem key={g} value={g}>Qualität {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Korngröße</Label>
                <Select value={editForm.fiber_size} onValueChange={(v) => setEditForm({ ...editForm, fiber_size: v })}>
                  <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="0.125mm">0.125mm</SelectItem>
                    <SelectItem value="1mm">1mm</SelectItem>
                    <SelectItem value="3mm">3mm</SelectItem>
                    <SelectItem value="5mm">5mm</SelectItem>
                    <SelectItem value="Überkorn">Überkorn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bestimmung / Kunde</Label>
                <Input
                  value={editForm.destination}
                  onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bemerkungen</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
              />
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
