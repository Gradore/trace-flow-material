import { useState } from "react";
import { Plus, Search, Filter, FlaskConical, MoreVertical, CheckCircle, XCircle, Clock, FileText, Edit, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { SampleDialog } from "@/components/sampling/SampleDialog";
import { SampleResultsDialog } from "@/components/sampling/SampleResultsDialog";
import { SampleResultsInputDialog } from "@/components/sampling/SampleResultsInputDialog";
import { PageDescription } from "@/components/layout/PageDescription";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const statusConfig: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  pending: { label: "Ausstehend", class: "status-badge-warning", icon: Clock },
  in_analysis: { label: "In Analyse", class: "status-badge-info", icon: FlaskConical },
  approved: { label: "Freigegeben", class: "status-badge-success", icon: CheckCircle },
  rejected: { label: "Abgelehnt", class: "status-badge-destructive", icon: XCircle },
};

export default function Sampling() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);
  const [isResultsInputDialogOpen, setIsResultsInputDialogOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<any>(null);
  const [selectedSampleForInput, setSelectedSampleForInput] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [sampleToRevert, setSampleToRevert] = useState<any>(null);
  const [isReverting, setIsReverting] = useState(false);
  const queryClient = useQueryClient();

  const { data: samples = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("*, material_inputs(id, input_id, material_type, status), processing_steps(processing_id, step_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredSamples = samples.filter((s) => {
    const matchesSearch =
      s.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.sampler_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "retention" ? s.is_retention_sample : !s.is_retention_sample);
    return matchesSearch && matchesStatus && matchesType;
  });

  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0);

  const openResults = (sample: any) => {
    setSelectedSample({
      id: sample.id,
      sampleId: sample.sample_id,
      batch: sample.material_inputs?.input_id || "-",
      material: sample.material_inputs?.material_type || "-",
      processStep: sample.processing_steps?.step_type || "-",
      sampler: sample.sampler_name,
      date: sample.sampled_at,
      status: sample.status,
      materialInputId: sample.material_input_id,
    });
    setIsResultsDialogOpen(true);
  };

  const handleStatusChange = async (sampleId: string, newStatus: string, materialInputId?: string) => {
    try {
      // Update sample status - .select() so an RLS-filtered (zero row) update is detected
      const { data: updated, error } = await supabase
        .from("samples")
        .update({ 
          status: newStatus,
          ...(newStatus === "approved" ? { approved_at: new Date().toISOString() } : {}),
          ...(newStatus === "in_analysis" ? { analyzed_at: new Date().toISOString() } : {})
        })
        .eq("id", sampleId)
        .select("id");

      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden.");
      }

      // CRITICAL: If sample is rejected, also reject the associated material input (batch)
      if (newStatus === "rejected" && materialInputId) {
        const { error: materialError } = await supabase
          .from("material_inputs")
          .update({ status: "rejected" })
          .eq("id", materialInputId);

        if (materialError) {
          console.warn("Could not update material input status:", materialError);
        } else {
          // Also cancel any running processing steps for this material
          const { error: processingError } = await supabase
            .from("processing_steps")
            .update({ status: "completed", notes: "Automatisch beendet wegen Proben-Ablehnung" })
            .eq("material_input_id", materialInputId)
            .in("status", ["running", "paused", "pending", "sample_required"]);

          if (processingError) {
            console.warn("Could not cancel processing steps:", processingError);
          }
        }

        toast({ 
          title: "Probe und Charge abgelehnt",
          description: "Die zugehörige Charge wurde ebenfalls als abgelehnt markiert. Keine weiteren Verarbeitungsschritte möglich.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Status aktualisiert" });
      }

      queryClient.invalidateQueries({ queryKey: ["samples"] });
      queryClient.invalidateQueries({ queryKey: ["material-inputs"] });
      queryClient.invalidateQueries({ queryKey: ["processing-steps"] });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
  };

  const handleRevertRejection = async () => {
    if (!sampleToRevert) return;
    setIsReverting(true);

    try {
      // Revert sample status to in_analysis - .select() detects an RLS-filtered no-op
      const { data: reverted, error } = await supabase
        .from("samples")
        .update({ status: "in_analysis" })
        .eq("id", sampleToRevert.id)
        .select("id");

      if (error) throw error;
      if (!reverted || reverted.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden.");
      }

      // Also revert the material input status back to in_processing
      if (sampleToRevert.material_input_id) {
        const { error: materialError } = await supabase
          .from("material_inputs")
          .update({ status: "in_processing" })
          .eq("id", sampleToRevert.material_input_id);

        if (materialError) {
          console.warn("Could not revert material input status:", materialError);
        }
      }

      toast({ 
        title: "Ablehnung zurückgenommen",
        description: "Die Probe wurde auf 'In Analyse' zurückgesetzt."
      });

      queryClient.invalidateQueries({ queryKey: ["samples"] });
      queryClient.invalidateQueries({ queryKey: ["material-inputs"] });
      queryClient.invalidateQueries({ queryKey: ["processing-steps"] });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setIsReverting(false);
      setRevertDialogOpen(false);
      setSampleToRevert(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageDescription
        title="Beprobung & Qualitätskontrolle"
        description="Erstellen und verwalten Sie Proben für Laboranalysen. Jede Probe (PRB-XXXX) wird mit Material und Verarbeitungsschritt verknüpft. Laborergebnisse bestimmen, ob eine Charge freigegeben oder abgelehnt wird."
        nextSteps={[
          "Probe erstellen → Für Laboranalyse",
          "Ergebnisse eintragen → Nach Laborprüfung",
          "Freigeben oder Ablehnen → Entscheidet über Materialfluss"
        ]}
        workflowLinks={[
          { label: "Verarbeitung", path: "/processing", direction: "previous" },
          { label: "Materialeingang", path: "/intake", direction: "previous" },
          { label: "Rückstellmuster", path: "/retention-samples", direction: "next" },
          { label: "Ausgangsmaterial", path: "/output", direction: "next" },
        ]}
      />

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
                  <p className="text-2xl font-bold text-foreground">{isError ? "–" : count}</p>
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
            <div className="space-y-2">
              <Label>Probenart</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Proben" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Alle Proben</SelectItem>
                  <SelectItem value="regular">Laborproben</SelectItem>
                  <SelectItem value="retention">Rückstellmuster</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={activeFilterCount === 0}
              onClick={() => {
                setStatusFilter("all");
                setTypeFilter("all");
              }}
            >
              Filter zurücksetzen
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="font-medium text-foreground">Proben konnten nicht geladen werden</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as any)?.message || "Bitte versuchen Sie es erneut."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
              Erneut laden
            </Button>
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
                  const isRejected = sample.status === "rejected";
                  
                  return (
                    <TableRow 
                      key={sample.id} 
                      className={cn("cursor-pointer", isRejected && "bg-destructive/5")}
                      onClick={() => openResults(sample)}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {sample.is_retention_sample ? (
                              <Archive className="h-4 w-4 text-warning" />
                            ) : (
                              <FlaskConical className={cn("h-4 w-4", isRejected ? "text-destructive" : "text-primary")} />
                            )}
                            <span className="font-mono font-medium">{sample.sample_id}</span>
                            {sample.is_retention_sample && (
                              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                                {(sample as any).retention_purpose === "warehouse" ? "RST-Lager" : 
                                 (sample as any).retention_purpose === "lab_complaint" ? "RST-Labor" : "RST"}
                              </Badge>
                            )}
                          </div>
                          {sample.is_retention_sample && (sample as any).storage_location && (
                            <span className="text-xs text-muted-foreground pl-6">
                              📍 {(sample as any).storage_location}
                            </span>
                          )}
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
                            {(sample.status === "pending" || sample.status === "in_analysis") && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedSampleForInput({
                                  id: sample.id,
                                  sampleId: sample.sample_id,
                                  materialInputId: sample.material_input_id,
                                });
                                setIsResultsInputDialogOpen(true);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Ergebnisse eingeben
                              </DropdownMenuItem>
                            )}
                            {sample.status === "pending" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(sample.id, "in_analysis")}>
                                <FlaskConical className="h-4 w-4 mr-2" />
                                Analyse starten
                              </DropdownMenuItem>
                            )}
                            {sample.status === "in_analysis" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-success" onClick={() => handleStatusChange(sample.id, "approved")}>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Freigeben
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive" 
                                  onClick={() => handleStatusChange(sample.id, "rejected", sample.material_input_id)}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Ablehnen
                                </DropdownMenuItem>
                              </>
                            )}
                            {/* Regel: Nach Freigabe darf NICHT mehr abgelehnt werden */}
                            {/* Revert rejection option for rejected samples */}
                            {sample.status === "rejected" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSampleToRevert(sample);
                                    setRevertDialogOpen(true);
                                  }}
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Ablehnung zurücknehmen
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
      <SampleResultsInputDialog
        open={isResultsInputDialogOpen}
        onOpenChange={(open) => { setIsResultsInputDialogOpen(open); if (!open) refetch(); }}
        sample={selectedSampleForInput}
      />

      {/* Revert Rejection Confirmation Dialog */}
      <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ablehnung zurücknehmen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Ablehnung für Probe {sampleToRevert?.sample_id} wirklich zurücknehmen? 
              Der Status wird auf 'In Analyse' zurückgesetzt und die zugehörige Charge wird wieder freigegeben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReverting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevertRejection} disabled={isReverting}>
              {isReverting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Ablehnung zurücknehmen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
