import { useState } from "react";
import { Plus, Search, Filter, Package, QrCode, MoreVertical, MapPin, Scale, Loader2 } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ContainerDialog } from "@/components/containers/ContainerDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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
  const [searchTerm, setSearchTerm] = useState("");

  const { data: containers = [], isLoading, refetch } = useQuery({
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

  const filteredContainers = containers.filter(
    (c) =>
      c.container_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.location || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    } catch (error) {
      toast({ title: "Fehler", description: "Etikett konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("containers").delete().eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Container gelöscht" });
      refetch();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
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
        <Button variant="outline">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
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
                    <TableRow key={container.id} className="cursor-pointer">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="font-mono font-medium">{container.container_id}</span>
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
                            <DropdownMenuItem onClick={() => handlePrintQR(container)}>
                              <QrCode className="h-4 w-4 mr-2" />
                              QR-Code drucken
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(container.id)}>
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

      <ContainerDialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) refetch(); }} />
    </div>
  );
}
