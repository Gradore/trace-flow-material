import { useState } from "react";
import { Plus, Search, Filter, FileOutput, MoreVertical, QrCode, Truck, FileText, Package } from "lucide-react";
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

const outputTypes = {
  glass_fiber: { label: "Recycelte Glasfasern", color: "bg-primary" },
  resin_powder: { label: "Harzpulver", color: "bg-info" },
  pp_regrind: { label: "PP Regranulat", color: "bg-warning" },
  pa_regrind: { label: "PA Regranulat", color: "bg-accent" },
};

const statusConfig = {
  in_stock: { label: "Auf Lager", class: "status-badge-success" },
  reserved: { label: "Reserviert", class: "status-badge-warning" },
  shipped: { label: "Versandt", class: "status-badge-info" },
};

const mockOutputs = [
  {
    id: "OUT-2024-0089",
    batch: "CHG-2024-087",
    type: "glass_fiber",
    weight: "1850 kg",
    quality: "A",
    destination: "FiberTech AG",
    container: "BB-2024-0240",
    status: "in_stock",
    hasCertificate: true,
  },
  {
    id: "OUT-2024-0088",
    batch: "CHG-2024-086",
    type: "resin_powder",
    weight: "920 kg",
    quality: "B",
    destination: "-",
    container: "BB-2024-0239",
    status: "in_stock",
    hasCertificate: true,
  },
  {
    id: "OUT-2024-0087",
    batch: "CHG-2024-085",
    type: "pp_regrind",
    weight: "1200 kg",
    quality: "A",
    destination: "PlastPro GmbH",
    container: "BB-2024-0238",
    status: "reserved",
    hasCertificate: true,
  },
  {
    id: "OUT-2024-0086",
    batch: "CHG-2024-084",
    type: "pa_regrind",
    weight: "780 kg",
    quality: "A",
    destination: "AutoParts AG",
    container: "BB-2024-0237",
    status: "shipped",
    hasCertificate: true,
  },
];

export default function OutputMaterials() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOutputs = mockOutputs.filter(
    (o) =>
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.batch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      outputTypes[o.type as keyof typeof outputTypes].label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ausgangsmaterial</h1>
          <p className="text-muted-foreground mt-1">Fertige Produkte und recycelte Materialien</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Neues Ausgangsmaterial
        </Button>
      </div>

      {/* Material Type Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(outputTypes).map(([key, config]) => {
          const total = mockOutputs
            .filter((o) => o.type === key)
            .reduce((sum, o) => sum + parseInt(o.weight), 0);
          return (
            <div key={key} className="glass-card rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-3 h-3 rounded-full", config.color)} />
                <div>
                  <p className="text-sm text-muted-foreground">{config.label}</p>
                  <p className="text-xl font-bold text-foreground">{total.toLocaleString("de-DE")} kg</p>
                </div>
              </div>
            </div>
          );
        })}
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
              const type = outputTypes[output.type as keyof typeof outputTypes];
              const status = statusConfig[output.status as keyof typeof statusConfig];
              return (
                <TableRow key={output.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileOutput className="h-4 w-4 text-primary" />
                      <span className="font-mono font-medium">{output.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{output.batch}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", type.color)} />
                      {type.label}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{output.weight}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      output.quality === "A" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    )}>
                      Qualität {output.quality}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-sm">{output.container}</span>
                    </div>
                  </TableCell>
                  <TableCell>{output.destination}</TableCell>
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
                      <DropdownMenuContent align="end">
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
      </div>
    </div>
  );
}
