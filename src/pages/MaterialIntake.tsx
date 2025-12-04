import { useState } from "react";
import { Plus, Search, Filter, Inbox, MoreVertical, FileText, Upload, Calendar, Building2 } from "lucide-react";
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
import { IntakeDialog } from "@/components/intake/IntakeDialog";

const statusConfig = {
  received: { label: "Eingegangen", class: "status-badge-info" },
  in_processing: { label: "In Verarbeitung", class: "status-badge-warning" },
  processed: { label: "Verarbeitet", class: "status-badge-success" },
};

const materialTypes = {
  "gfk-up": "GFK-UP",
  "gfk-ep": "GFK-EP",
  "gfk-ve": "GFK-VE",
  "gfk-pu": "GFK-PU",
  "gfk-pet": "GFK-PET",
  pp: "Polypropylen (PP)",
  pa6: "Polyamid (PA6)",
  pa66: "Polyamid (PA66)",
};

const mockIntakes = [
  {
    id: "ME-2024-0089",
    date: "2024-12-03",
    supplier: "Recycling GmbH",
    material: "gfk-up",
    weight: "2500 kg",
    wasteCode: "07 02 13",
    container: "BB-2024-0234",
    status: "received",
    hasReach: true,
    hasDeliveryNote: true,
  },
  {
    id: "ME-2024-0088",
    date: "2024-12-02",
    supplier: "AutoParts AG",
    material: "pp",
    weight: "1800 kg",
    wasteCode: "07 02 13",
    container: "BB-2024-0233",
    status: "in_processing",
    hasReach: true,
    hasDeliveryNote: true,
  },
  {
    id: "ME-2024-0087",
    date: "2024-12-01",
    supplier: "WindTech KG",
    material: "gfk-ep",
    weight: "3200 kg",
    wasteCode: "07 02 13",
    container: "GX-2024-0156",
    status: "processed",
    hasReach: false,
    hasDeliveryNote: true,
  },
  {
    id: "ME-2024-0086",
    date: "2024-11-30",
    supplier: "PlastRecycle",
    material: "pa6",
    weight: "1200 kg",
    wasteCode: "07 02 13",
    container: "BX-2024-0089",
    status: "processed",
    hasReach: true,
    hasDeliveryNote: true,
  },
];

export default function MaterialIntake() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredIntakes = mockIntakes.filter(
    (i) =>
      i.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materialTypes[i.material as keyof typeof materialTypes].toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Heute eingegangen</p>
          <p className="text-2xl font-bold text-foreground mt-1">3</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Gesamtgewicht heute</p>
          <p className="text-2xl font-bold text-foreground mt-1">7.500 kg</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Fehlende REACH-Docs</p>
          <p className="text-2xl font-bold text-warning mt-1">2</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">In Verarbeitung</p>
          <p className="text-2xl font-bold text-info mt-1">5</p>
        </div>
      </div>

      {/* Filters */}
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

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Eingangs-ID</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Lieferant</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Gewicht</TableHead>
              <TableHead>Container</TableHead>
              <TableHead>Dokumente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIntakes.map((intake) => {
              const status = statusConfig[intake.status as keyof typeof statusConfig];
              const material = materialTypes[intake.material as keyof typeof materialTypes];
              return (
                <TableRow key={intake.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-primary" />
                      <span className="font-mono font-medium">{intake.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {new Date(intake.date).toLocaleDateString("de-DE")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      {intake.supplier}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{material}</TableCell>
                  <TableCell>{intake.weight}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{intake.container}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-xs",
                        intake.hasReach ? "text-success" : "text-warning"
                      )}>
                        <FileText className="h-3 w-3" />
                        REACH
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-xs",
                        intake.hasDeliveryNote ? "text-success" : "text-warning"
                      )}>
                        <FileText className="h-3 w-3" />
                        LS
                      </span>
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
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Upload className="h-4 w-4 mr-2" />
                          Dokumente hochladen
                        </DropdownMenuItem>
                        <DropdownMenuItem>Bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem>Details anzeigen</DropdownMenuItem>
                        <DropdownMenuItem>Verarbeitung starten</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <IntakeDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
