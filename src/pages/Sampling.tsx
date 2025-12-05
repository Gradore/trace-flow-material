import { useState } from "react";
import { Plus, Search, Filter, FlaskConical, MoreVertical, CheckCircle, XCircle, Clock, FileText, Upload, Loader2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  pending: { label: "Ausstehend", class: "status-badge-warning", icon: Clock },
  in_analysis: { label: "In Analyse", class: "status-badge-info", icon: FlaskConical },
  approved: { label: "Freigegeben", class: "status-badge-success", icon: CheckCircle },
  rejected: { label: "Abgelehnt", class: "status-badge-destructive", icon: XCircle },
};

export default function Sampling() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: samples = [], isLoading, refetch } = useQuery({
    queryKey: ["samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("*, material_inputs(input_id, material_type), processing_steps(processing_id, step_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredSamples = samples.filter(
    (s) =>
      s.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.sampler_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openResults = (sample: any) => {
    setSelectedSample(sample);
    setIsResultsDialogOpen(true);
  };

  const handleStatusChange = async (sampleId: string, newStatus: string) => {
    const { error } = await supabase
      .from("samples")
      .update({ 
        status: newStatus,
        ...(newStatus === "approved" ? { approved_at: new Date().toISOString() } : {}),
        ...(newStatus === "in_analysis" ? { analyzed_at: new Date().toISOString() } : {})
      })
      .eq("id", sampleId);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status aktualisiert" });
      refetch();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = samples.filter((s) => s.status === key).length;
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen nach ID, Probenehmer..."
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
                <TableHead>Proben-ID</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Prozessschritt</TableHead>
                <TableHead>Probenehmer</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSamples.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Keine Proben vorhanden
                  </TableCell>
                </TableRow>
              ) : (
                filteredSamples.map((sample) => {
                  const status = statusConfig[sample.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  const materialType = sample.material_inputs?.material_type || "-";
                  const processStep = sample.processing_steps?.step_type || "-";
                  return (
                    <TableRow key={sample.id} className="cursor-pointer" onClick={() => openResults(sample)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-primary" />
                          <span className="font-mono font-medium">{sample.sample_id}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{materialType}</TableCell>
                      <TableCell>{processStep}</TableCell>
                      <TableCell>{sample.sampler_name}</TableCell>
                      <TableCell>{new Date(sample.sampled_at).toLocaleDateString("de-DE")}</TableCell>
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
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => openResults(sample)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Ergebnisse anzeigen
                            </DropdownMenuItem>
                            {sample.status === "pending" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(sample.id, "in_analysis")}>
                                <FlaskConical className="h-4 w-4 mr-2" />
                                Analyse starten
                              </DropdownMenuItem>
                            )}
                            {sample.status === "in_analysis" && (
                              <>
                                <DropdownMenuItem className="text-success" onClick={() => handleStatusChange(sample.id, "approved")}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Freigeben
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleStatusChange(sample.id, "rejected")}>
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
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <SampleDialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) refetch(); }} />
      <SampleResultsDialog
        open={isResultsDialogOpen}
        onOpenChange={setIsResultsDialogOpen}
        sample={selectedSample}
      />
    </div>
  );
}
