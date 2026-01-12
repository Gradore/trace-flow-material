import { useState } from "react";
import { Plus, Search, Filter, Inbox, MoreVertical, FileText, Upload, Calendar, Building2, Loader2, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { IntakeDialog } from "@/components/intake/IntakeDialog";
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
  received: { label: "Eingegangen", class: "status-badge-info" },
  in_processing: { label: "In Verarbeitung", class: "status-badge-warning" },
  processed: { label: "Verarbeitet", class: "status-badge-success" },
};

const materialTypes: Record<string, string> = {
  "gfk-up": "GFK-UP",
  "gfk-ep": "GFK-EP",
  "gfk-ve": "GFK-VE",
  "gfk-pu": "GFK-PU",
  "gfk-pet": "GFK-PET",
  pp: "Polypropylen (PP)",
  pa6: "Polyamid (PA6)",
  pa66: "Polyamid (PA66)",
};

export default function MaterialIntake() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [intakeToDelete, setIntakeToDelete] = useState<any>(null);
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

  const handleDelete = async () => {
    if (!intakeToDelete) return;
    
    try {
      // Delete related documents first
      await supabase
        .from("documents")
        .delete()
        .eq("material_input_id", intakeToDelete.id);
      
      // Delete related samples
      await supabase
        .from("samples")
        .delete()
        .eq("material_input_id", intakeToDelete.id);
      
      // Delete the material input
      const { error } = await supabase
        .from("material_inputs")
        .delete()
        .eq("id", intakeToDelete.id);
      
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

  return (
    <div className="space-y-6 animate-fade-in">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  const materialLabel = materialTypes[intake.material_type] || intake.material_type;
                  const containerLabel = intake.containers?.container_id || "-";
                  return (
                    <TableRow key={intake.id} className="cursor-pointer">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Inbox className="h-4 w-4 text-primary" />
                          <span className="font-mono font-medium">{intake.input_id}</span>
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
                      <TableCell>
                        <span className={cn(status.class)}>{status.label}</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Details anzeigen
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Upload className="h-4 w-4 mr-2" />
                              Dokumente hochladen
                            </DropdownMenuItem>
                            <DropdownMenuItem>Verarbeitung starten</DropdownMenuItem>
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
    </div>
  );
}
