import { useState } from "react";
import { Plus, Search, Filter, FileText, MoreVertical, Download, Mail, Eye, ArrowDownLeft, ArrowUpRight } from "lucide-react";
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
import { DeliveryNoteDialog } from "@/components/delivery/DeliveryNoteDialog";

const typeConfig = {
  incoming: { label: "Eingang", icon: ArrowDownLeft, class: "bg-info/10 text-info" },
  outgoing: { label: "Ausgang", icon: ArrowUpRight, class: "bg-success/10 text-success" },
};

const mockDeliveryNotes = [
  {
    id: "LS-2024-0089",
    type: "incoming",
    date: "2024-12-03",
    partner: "Recycling GmbH",
    material: "GFK-UP",
    batch: "ME-2024-0089",
    weight: "2500 kg",
    wasteCode: "07 02 13",
  },
  {
    id: "LS-2024-0088",
    type: "outgoing",
    date: "2024-12-02",
    partner: "FiberTech AG",
    material: "Recycelte Glasfasern",
    batch: "OUT-2024-0089",
    weight: "1850 kg",
    wasteCode: "-",
  },
  {
    id: "LS-2024-0087",
    type: "incoming",
    date: "2024-12-02",
    partner: "AutoParts AG",
    material: "PP",
    batch: "ME-2024-0088",
    weight: "1800 kg",
    wasteCode: "07 02 13",
  },
  {
    id: "LS-2024-0086",
    type: "outgoing",
    date: "2024-12-01",
    partner: "PlastPro GmbH",
    material: "PP Regranulat",
    batch: "OUT-2024-0087",
    weight: "1200 kg",
    wasteCode: "-",
  },
];

export default function DeliveryNotes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredNotes = mockDeliveryNotes.filter(
    (n) =>
      n.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.partner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.material.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lieferscheine</h1>
          <p className="text-muted-foreground mt-1">Eingangs- und Ausgangslieferscheine verwalten</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neuer Lieferschein
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Eingang heute</p>
          <p className="text-2xl font-bold text-foreground mt-1">2</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Ausgang heute</p>
          <p className="text-2xl font-bold text-foreground mt-1">1</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Eingang diesen Monat</p>
          <p className="text-2xl font-bold text-foreground mt-1">24</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Ausgang diesen Monat</p>
          <p className="text-2xl font-bold text-foreground mt-1">18</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach ID, Partner, Material..."
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
              <TableHead>Lieferschein-ID</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Charge</TableHead>
              <TableHead>Gewicht</TableHead>
              <TableHead>Abfallschlüssel</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNotes.map((note) => {
              const type = typeConfig[note.type as keyof typeof typeConfig];
              const TypeIcon = type.icon;
              return (
                <TableRow key={note.id} className="cursor-pointer">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-mono font-medium">{note.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", type.class)}>
                      <TypeIcon className="h-3 w-3" />
                      {type.label}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(note.date).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell className="font-medium">{note.partner}</TableCell>
                  <TableCell>{note.material}</TableCell>
                  <TableCell className="font-mono text-sm">{note.batch}</TableCell>
                  <TableCell>{note.weight}</TableCell>
                  <TableCell className="font-mono text-sm">{note.wasteCode}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          Anzeigen
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          PDF herunterladen
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 mr-2" />
                          Per E-Mail senden
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DeliveryNoteDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
