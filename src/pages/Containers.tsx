import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Filter, Package, QrCode, MoreVertical, MapPin, Scale, Loader2, Edit, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import { ContainerDialog } from "@/components/containers/ContainerDialog";
import { ContainerDetailsDialog } from "@/components/containers/ContainerDetailsDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateLabelPDF, downloadPDF } from "@/lib/pdf";
import { buildContainerQRUrl } from "@/lib/qrcode";
import { toast } from "@/hooks/use-toast";

const containerTypes: Record<string, { label: string; icon: string }> = {
  bigbag: { label: "BigBag", icon: "📦" },
  box: { label: "Box", icon: "📦" },
  cage: { label: "Gitterbox", icon: "🏗️" },
  container: { label: "Container", icon: "📦" },
};

const statusConfig: Record<string, { label: string; class: string }> = {
  empty: { label: "Leer", class: "status-badge bg-secondary text-secondary-foreground" },
  filling: { label: "Befüllung", class: "status-badge-warning" },
  full: { label: "Voll", class: "status-badge-info" },
  in_processing: { label: "In Verarbeitung", class: "status-badge-warning" },
  processed: { label: "Verarbeitet", class: "status-badge-success" },
};

export default function Containers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<typeof containers[0] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [containerToDelete, setContainerToDelete] = useState<typeof containers[0] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: containers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["containers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("containers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredContainers = containers.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.container_id.toLowerCase().includes(term) ||
      (c.location || "").toLowerCase().includes(term);
    const matchesType = typeFilter === "all" || c.type === typeFilter;
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeFilterCount = (typeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  // Deep link support: /containers?id=<uuid|Container-ID> opens that container.
  const deepLinkId = searchParams.get("id");
  useEffect(() => {
    // Wait for the list; on a failed query there is nothing to resolve against,
    // so do not claim the container does not exist.
    if (!deepLinkId || isLoading || isError) return;
    const match = containers.find((c) => c.id === deepLinkId || c.container_id === deepLinkId);
    if (match) {
      setSelectedContainer(match);
      setIsDetailsDialogOpen(true);
    } else {
      toast({
        title: "Container nicht gefunden",
        description: `Es existiert kein Container mit der Kennung ${deepLinkId}.`,
        variant: "destructive",
      });
    }
    const params = new URLSearchParams(searchParams);
    params.delete("id");
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, isLoading, isError, containers]);

  const handlePrintQR = async (container: typeof containers[0]) => {
    try {
      const qrUrl = buildContainerQRUrl(container.container_id);
      const typeLabel = containerTypes[container.type]?.label || container.type;
      const pdfBlob = await generateLabelPDF(
        {
          id: container.container_id,
          type: typeLabel,
          location: container.location || "Nicht zugewiesen",
          date: new Date(container.created_at).toLocaleDateString("de-DE"),
        },
        qrUrl
      );
      downloadPDF(pdfBlob, `Etikett_${container.container_id}.pdf`);
      toast({ title: "Etikett heruntergeladen" });
    } catch {
      toast({ title: "Fehler", description: "Etikett konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const handleDeleteClick = (container: typeof containers[0], e: React.MouseEvent) => {
    e.stopPropagation();
    setContainerToDelete(container);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!containerToDelete) return;
    
    setIsDeleting(true);
    try {
      // Check if container is assigned to materials
      const { data: materialInputs, error: materialError } = await supabase
        .from("material_inputs")
        .select("id, input_id, status")
        .eq("container_id", containerToDelete.id);

      if (materialError) throw materialError;

      const activeInputs = (materialInputs || []).filter(
        (m) => m.status === "received" || m.status === "in_processing"
      );

      // Check if the material in this container is still in an active processing step
      // (processing_steps has no container_id, so it is joined via material_inputs)
      let activeProcessing: { id: string }[] = [];
      if (materialInputs && materialInputs.length > 0) {
        const { data: processingSteps, error: checkError } = await supabase
          .from("processing_steps")
          .select("id")
          .in("material_input_id", materialInputs.map((m) => m.id))
          .in("status", ["pending", "running", "paused", "sample_required"])
          .limit(1);

        if (checkError) throw checkError;
        activeProcessing = processingSteps || [];
      }

      // Check if container is assigned to output materials
      const { data: outputMaterials, error: outputError } = await supabase
        .from("output_materials")
        .select("id, output_id")
        .eq("container_id", containerToDelete.id)
        .in("status", ["in_stock", "reserved"])
        .limit(1);

      if (outputError) throw outputError;

      // Block deletion if in active use
      if (activeInputs.length > 0 || activeProcessing.length > 0 || (outputMaterials && outputMaterials.length > 0)) {
        toast({ 
          title: "Fehler: Container in Verwendung", 
          description: "Dieser Container ist in einem aktiven Prozess und kann nicht gelöscht werden. Bitte entfernen Sie zuerst die Verknüpfung zu Materialien.", 
          variant: "destructive" 
        });
        return;
      }

      // Safe to delete
      const { data: deleted, error } = await supabase
        .from("containers")
        .delete()
        .eq("id", containerToDelete.id)
        .select();
      if (error) {
        if (error.code === '23503') {
          toast({
            title: "Fehler: Container in Verwendung",
            description: "Dieser Container ist mit anderen Datensätzen verknüpft und kann nicht gelöscht werden.",
            variant: "destructive"
          });
        } else {
          throw error;
        }
      } else if (!deleted || deleted.length === 0) {
        // RLS filters the row out silently: no error, no affected rows.
        toast({
          title: "Fehler beim Löschen",
          description: "Keine Berechtigung oder Datensatz nicht gefunden.",
          variant: "destructive",
        });
      } else {
        await queryClient.invalidateQueries({ queryKey: ["containers"] });
        toast({ title: "Container gelöscht", description: `${containerToDelete.container_id} wurde erfolgreich entfernt.` });
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({ 
        title: "Fehler beim Löschen", 
        description: error.message || "Der Container konnte nicht gelöscht werden.", 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setContainerToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageDescription
        title="Container & Behälterverwaltung"
        description="Verwalten Sie alle BigBags, Gitterboxen und Container. Jeder Behälter erhält eine eindeutige ID und kann mit QR-Codes gekennzeichnet werden. Container werden beim Materialeingang und bei der Verarbeitung zugewiesen."
        nextSteps={[
          "Neuen Container anlegen → QR-Etikett drucken",
          "Container einem Materialeingang zuweisen",
          "Standort aktualisieren für Lagerverwaltung"
        ]}
        workflowLinks={[
          { label: "Materialeingang", path: "/intake", direction: "next" },
          { label: "Verarbeitung", path: "/processing", direction: "next" },
          { label: "Ausgangsmaterial", path: "/output", direction: "next" },
        ]}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Container & BigBags</h1>
          <p className="text-muted-foreground mt-1">Verwaltung aller Behälter und Gebinde</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neuer Container
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach ID, Standort..."
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
              <Label>Container-Typ</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Typen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Alle Typen</SelectItem>
                  {Object.entries(containerTypes).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Alle Status</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={activeFilterCount === 0}
              onClick={() => {
                setTypeFilter("all");
                setStatusFilter("all");
              }}
            >
              Filter zurücksetzen
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="glass-card rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {containers.filter((c) => c.status === key).length}
            </p>
            <p className="text-sm text-muted-foreground">{config.label}</p>
          </div>
        ))}
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
              Container konnten nicht geladen werden. Bitte prüfen Sie Ihre Verbindung und Berechtigungen.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Erneut versuchen
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Container-ID</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Gewicht (kg)</TableHead>
                <TableHead>Standort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContainers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Keine Container vorhanden
                  </TableCell>
                </TableRow>
              ) : (
                filteredContainers.map((container) => {
                  const type = containerTypes[container.type] || { label: container.type, icon: "📦" };
                  const status = statusConfig[container.status] || statusConfig.empty;
                  return (
                    <TableRow 
                      key={container.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedContainer(container);
                        setIsDetailsDialogOpen(true);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="font-mono font-medium">{container.container_id}</span>
                          <Edit className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span>{type.icon} {type.label}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Scale className="h-3 w-3 text-muted-foreground" />
                          {container.weight_kg ? `${container.weight_kg} kg` : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {container.location || "-"}
                        </div>
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePrintQR(container); }}>
                              <QrCode className="h-4 w-4 mr-2" />
                              QR-Code drucken
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive" 
                              onClick={(e) => handleDeleteClick(container, e)}
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

      <ContainerDialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) queryClient.invalidateQueries({ queryKey: ["containers"] }); }} />
      
      <ContainerDetailsDialog 
        open={isDetailsDialogOpen} 
        onOpenChange={(open) => {
          setIsDetailsDialogOpen(open);
          if (!open) {
            setSelectedContainer(null);
            queryClient.invalidateQueries({ queryKey: ["containers"] });
          }
        }}
        container={selectedContainer}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Container endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Container <strong>{containerToDelete?.container_id}</strong> wirklich endgültig löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Löscht...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Endgültig löschen
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
