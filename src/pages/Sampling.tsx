import { useState } from "react";
import { Plus, Search, Filter, FlaskConical, MoreVertical, CheckCircle, XCircle, Clock, FileText, Upload } from "lucide-react";
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
import { SampleDialog } from "@/components/sampling/SampleDialog";
import { SampleResultsDialog } from "@/components/sampling/SampleResultsDialog";

const statusConfig = {
  pending: { label: "Ausstehend", class: "status-badge-warning", icon: Clock },
  in_analysis: { label: "In Analyse", class: "status-badge-info", icon: FlaskConical },
  approved: { label: "Freigegeben", class: "status-badge-success", icon: CheckCircle },
  rejected: { label: "Abgelehnt", class: "status-badge-destructive", icon: XCircle },
};

const mockSamples = [
  {
    id: "PRB-2024-0156",
    batch: "CHG-2024-089",
    material: "GFK-UP",
    processStep: "Schreddern",
    sampler: "M. Schmidt",
    date: "2024-12-03",
    status: "pending",
    hasResults: false,
  },
  {
    id: "PRB-2024-0155",
    batch: "CHG-2024-088",
    material: "PP",
    processStep: "Mahlen",
    sampler: "K. Weber",
    date: "2024-12-03",
    status: "in_analysis",
    hasResults: true,
  },
  {
    id: "PRB-2024-0154",
    batch: "CHG-2024-087",
    material: "GFK-EP",
    processStep: "Faser/Harz-Trennung",
    sampler: "M. Schmidt",
    date: "2024-12-02",
    status: "approved",
    hasResults: true,
  },
  {
    id: "PRB-2024-0153",
    batch: "CHG-2024-086",
    material: "PA6",
    processStep: "Sortieren",
    sampler: "L. Müller",
    date: "2024-12-02",
    status: "rejected",
    hasResults: true,
  },
];

export default function Sampling() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<typeof mockSamples[0] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSamples = mockSamples.filter(
    (s) =>
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.batch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.material.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openResults = (sample: typeof mockSamples[0]) => {
    setSelectedSample(sample);
    setIsResultsDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Beprobung</h1>
          <p className="text-muted-foreground mt-1">Probenmanagement und Laborergebnisse</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neue Probe
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = mockSamples.filter((s) => s.status === key).length;
          const Icon = config.icon;
          return (
            <div key={key} className="glass-card rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", key === "approved" ? "bg-success/10" : key === "rejected" ? "bg-destructive/10" : key === "in_analysis" ? "bg-info/10" : "bg-warning/10")}>
                  <Icon className={cn("h-5 w-5", key === "approved" ? "text-success" : key === "rejected" ? "text-destructive" : key === "in_analysis" ? "text-info" : "text-warning")} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-sm text-muted-foreground">{config.label}</p>
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
            placeholder="Suchen nach ID, Charge, Material..."
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
              <TableHead>Proben-ID</TableHead>
              <TableHead>Charge</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Prozessschritt</TableHead>
              <TableHead>Probenehmer</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSamples.map((sample) => {
              const status = statusConfig[sample.status as keyof typeof statusConfig];
              const StatusIcon = status.icon;
              return (
                <TableRow key={sample.id} className="cursor-pointer" onClick={() => openResults(sample)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-primary" />
                      <span className="font-mono font-medium">{sample.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{sample.batch}</TableCell>
                  <TableCell className="font-medium">{sample.material}</TableCell>
                  <TableCell>{sample.processStep}</TableCell>
                  <TableCell>{sample.sampler}</TableCell>
                  <TableCell>{new Date(sample.date).toLocaleDateString("de-DE")}</TableCell>
                  <TableCell>
                    <span className={cn(status.class, "flex items-center gap-1.5")}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon-sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openResults(sample)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Ergebnisse anzeigen
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Upload className="h-4 w-4 mr-2" />
                          Dokumente hochladen
                        </DropdownMenuItem>
                        {sample.status === "in_analysis" && (
                          <>
                            <DropdownMenuItem className="text-success">
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Freigeben
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <XCircle className="h-4 w-4 mr-2" />
                              Ablehnen
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <SampleDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      <SampleResultsDialog 
        open={isResultsDialogOpen} 
        onOpenChange={setIsResultsDialogOpen}
        sample={selectedSample}
      />
    </div>
  );
}
