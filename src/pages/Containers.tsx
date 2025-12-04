import { useState } from "react";
import { Plus, Search, Filter, Package, QrCode, MoreVertical, MapPin, Scale } from "lucide-react";
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

const containerTypes = {
  bigbag: { label: "BigBag", icon: "📦" },
  box: { label: "Box", icon: "📦" },
  cage: { label: "Gitterbox", icon: "🏗️" },
  container: { label: "Container", icon: "📦" },
};

const statusConfig = {
  empty: { label: "Leer", class: "status-badge bg-secondary text-secondary-foreground" },
  filling: { label: "Befüllung", class: "status-badge-warning" },
  full: { label: "Voll", class: "status-badge-info" },
  in_processing: { label: "In Verarbeitung", class: "status-badge-warning" },
  processed: { label: "Verarbeitet", class: "status-badge-success" },
};

const mockContainers = [
  { id: "BB-2024-0234", type: "bigbag", volume: "1000L", weight: "450kg", status: "full", location: "Halle A, Regal 12", material: "GFK-UP" },
  { id: "BB-2024-0233", type: "bigbag", volume: "1000L", weight: "380kg", status: "in_processing", location: "Produktion", material: "GFK-EP" },
  { id: "GX-2024-0156", type: "cage", volume: "500L", weight: "220kg", status: "filling", location: "Annahme", material: "PP" },
  { id: "BB-2024-0232", type: "bigbag", volume: "1000L", weight: "0kg", status: "empty", location: "Halle B, Regal 5", material: "-" },
  { id: "BX-2024-0089", type: "box", volume: "200L", weight: "85kg", status: "processed", location: "Ausgang", material: "PA6" },
];

export default function Containers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContainers = mockContainers.filter(
    (c) =>
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.material.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
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

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach ID, Material..."
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="glass-card rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {mockContainers.filter((c) => c.status === key).length}
            </p>
            <p className="text-sm text-muted-foreground">{config.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Container-ID</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Volumen</TableHead>
              <TableHead>Gewicht</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContainers.map((container) => {
              const type = containerTypes[container.type as keyof typeof containerTypes];
              const status = statusConfig[container.status as keyof typeof statusConfig];
              return (
                <TableRow key={container.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-mono font-medium">{container.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span>{type.icon} {type.label}</span>
                  </TableCell>
                  <TableCell className="font-medium">{container.material}</TableCell>
                  <TableCell>{container.volume}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Scale className="h-3 w-3 text-muted-foreground" />
                      {container.weight}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {container.location}
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
                          <QrCode className="h-4 w-4 mr-2" />
                          QR-Code drucken
                        </DropdownMenuItem>
                        <DropdownMenuItem>Bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem>Details anzeigen</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Löschen</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ContainerDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
