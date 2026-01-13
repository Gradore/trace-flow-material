import { useState } from "react";
import { Plus, Search, Filter, FileOutput, MoreVertical, QrCode, Truck, FileText, Package, Loader2, Users } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OutputMaterialDialog } from "@/components/output/OutputMaterialDialog";
import { BatchAllocationDialog } from "@/components/processing/BatchAllocationDialog";

const outputTypes: Record<string, { label: string; color: string }> = {
  glass_fiber: { label: "Recycelte Glasfasern", color: "bg-primary" },
  resin_powder: { label: "Harzpulver", color: "bg-info" },
  pp_regrind: { label: "PP Regranulat", color: "bg-warning" },
  pa_regrind: { label: "PA Regranulat", color: "bg-accent" },
};

const statusConfig: Record<string, { label: string; class: string }> = {
  in_stock: { label: "Auf Lager", class: "status-badge-success" },
  reserved: { label: "Reserviert", class: "status-badge-warning" },
  shipped: { label: "Versandt", class: "status-badge-info" },
};

export default function OutputMaterials() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<any>(null);

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

  // Calculate stats per type
  const typeStats = Object.entries(outputTypes).map(([key, config]) => {
    const total = outputs
      .filter((o) => o.output_type === key)
      .reduce((sum, o) => sum + Number(o.weight_kg || 0), 0);
    return { key, ...config, total };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
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

      {/* Material Type Stats */}
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

      {/* Filters */}
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

      {/* Table */}
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
                <TableHead>Qualität</TableHead>
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
                      {output.quality_grade && (
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          output.quality_grade === "A" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                        )}>
                          Qualität {output.quality_grade}
                        </span>
                      )}
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
                          <DropdownMenuItem>Details anzeigen</DropdownMenuItem>
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
    </div>
  );
}
