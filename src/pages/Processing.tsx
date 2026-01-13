import { useState } from "react";
import { Plus, Search, Filter, Settings, MoreVertical, ArrowRight, FlaskConical, Play, Pause, CheckCircle, Loader2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProcessingDialog } from "@/components/processing/ProcessingDialog";
import { CompleteProcessingDialog } from "@/components/processing/CompleteProcessingDialog";
import { Progress } from "@/components/ui/progress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

const processSteps = [
  { id: "shredding", label: "Schreddern", icon: "⚙️" },
  { id: "sorting", label: "Sortieren", icon: "📊" },
  { id: "milling", label: "Mahlen", icon: "🔄" },
  { id: "separation", label: "Faser/Harz-Trennung", icon: "🧪" },
];

const statusConfig = {
  pending: { label: "Wartend", class: "status-badge bg-secondary text-secondary-foreground" },
  running: { label: "Läuft", class: "status-badge-info" },
  paused: { label: "Pausiert", class: "status-badge-warning" },
  completed: { label: "Abgeschlossen", class: "status-badge-success" },
  sample_required: { label: "Probe erforderlich", class: "status-badge-destructive" },
};

export default function Processing() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedProcessingStep, setSelectedProcessingStep] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: processingSteps = [], isLoading } = useQuery({
    queryKey: ["processing-steps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processing_steps")
        .select(`
          *,
          material_inputs (
            input_id,
            material_type,
            material_subtype,
            weight_kg
          ),
          samples (
            id,
            status
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredProcessing = processingSteps.filter(
    (p) =>
      p.processing_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.material_inputs?.material_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const activeCount = processingSteps.filter(p => p.status !== 'completed').length;
  const runningCount = processingSteps.filter(p => p.status === 'running').length;
  const sampleRequiredCount = processingSteps.filter(p => p.status === 'sample_required').length;
  const completedTodayCount = processingSteps.filter(p => 
    p.status === 'completed' && p.completed_at && isToday(new Date(p.completed_at))
  ).length;

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, "HH:mm", { locale: de });
    }
    return format(date, "dd.MM.", { locale: de });
  };

  const getMaterialLabel = (step: typeof processingSteps[0]) => {
    const type = step.material_inputs?.material_type || "";
    const subtype = step.material_inputs?.material_subtype || "";
    return subtype ? `${type}-${subtype}` : type;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Verarbeitung</h1>
          <p className="text-muted-foreground mt-1">Übersicht aller aktiven Verarbeitungsprozesse</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Neue Verarbeitung
        </Button>
      </div>

      {/* Process Steps Legend */}
      <div className="flex items-center gap-2 p-4 glass-card rounded-lg overflow-x-auto">
        <span className="text-sm text-muted-foreground shrink-0">Prozessschritte:</span>
        {processSteps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary">
              <span>{step.icon}</span>
              <span className="text-sm font-medium">{step.label}</span>
            </div>
            {index < processSteps.length - 1 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Aktive Prozesse</p>
          <p className="text-2xl font-bold text-foreground mt-1">{activeCount}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Laufend</p>
          <p className="text-2xl font-bold text-info mt-1">{runningCount}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Probe erforderlich</p>
          <p className="text-2xl font-bold text-destructive mt-1">{sampleRequiredCount}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Heute abgeschlossen</p>
          <p className="text-2xl font-bold text-success mt-1">{completedTodayCount}</p>
        </div>
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

      {/* Processing Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredProcessing.length === 0 ? (
        <div className="text-center py-12 glass-card rounded-xl">
          <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">Keine Verarbeitungen gefunden</p>
          <p className="text-muted-foreground">Erstellen Sie eine neue Verarbeitung um zu beginnen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProcessing.map((process) => {
            const status = statusConfig[process.status as keyof typeof statusConfig] || statusConfig.pending;
            const currentStepIndex = processSteps.findIndex((s) => s.id === process.step_type);
            const hasSample = process.samples && process.samples.length > 0;
            
            return (
              <div key={process.id} className="glass-card rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      <span className="font-mono font-bold text-lg">{process.processing_id}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Eingang: {process.material_inputs?.input_id || "-"} • {getMaterialLabel(process)}
                    </p>
                  </div>
                  <span className={cn(status.class)}>{status.label}</span>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {processSteps[currentStepIndex]?.icon} {processSteps[currentStepIndex]?.label || process.step_type}
                    </span>
                    <span className="font-medium">{process.progress || 0}%</span>
                  </div>
                  <Progress value={process.progress || 0} className="h-2" />
                </div>

                {/* Process Steps Indicator */}
                <div className="flex items-center gap-1 mb-4">
                  {processSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className={cn(
                        "flex-1 h-1.5 rounded-full transition-colors",
                        index < currentStepIndex
                          ? "bg-success"
                          : index === currentStepIndex
                          ? "bg-primary"
                          : "bg-secondary"
                      )}
                    />
                  ))}
                </div>

                {/* Info Row */}
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                  <span>Gewicht: {process.material_inputs?.weight_kg ? `${process.material_inputs.weight_kg} kg` : "-"}</span>
                  <span>Gestartet: {formatTime(process.started_at)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {process.status === "running" && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("processing_steps")
                            .update({ status: "paused" })
                            .eq("id", process.id);
                          if (error) {
                            toast({ title: "Fehler", description: "Konnte nicht pausieren.", variant: "destructive" });
                          } else {
                            queryClient.invalidateQueries({ queryKey: ["processing-steps"] });
                          }
                        }}
                      >
                        <Pause className="h-4 w-4" />
                        Pausieren
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => {
                          setSelectedProcessingStep(process);
                          setCompleteDialogOpen(true);
                        }}
                      >
                        <StopCircle className="h-4 w-4" />
                        Abschließen
                      </Button>
                    </>
                  )}
                  {process.status === "paused" && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={async () => {
                          const { error } = await supabase
                            .from("processing_steps")
                            .update({ status: "running" })
                            .eq("id", process.id);
                          if (error) {
                            toast({ title: "Fehler", description: "Konnte nicht fortsetzen.", variant: "destructive" });
                          } else {
                            queryClient.invalidateQueries({ queryKey: ["processing-steps"] });
                          }
                        }}
                      >
                        <Play className="h-4 w-4" />
                        Fortsetzen
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => {
                          setSelectedProcessingStep(process);
                          setCompleteDialogOpen(true);
                        }}
                      >
                        <StopCircle className="h-4 w-4" />
                        Abschließen
                      </Button>
                    </>
                  )}
                  {process.status === "completed" && (
                    <Button variant="ghost" size="sm" className="text-success pointer-events-none">
                      <CheckCircle className="h-4 w-4" />
                      Abgeschlossen
                    </Button>
                  )}
                  {hasSample && process.status !== "completed" && (
                    <Button variant="ghost" size="sm" className="text-success pointer-events-none">
                      <FlaskConical className="h-4 w-4" />
                      Probe vorhanden
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProcessingDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      <CompleteProcessingDialog 
        open={completeDialogOpen} 
        onOpenChange={setCompleteDialogOpen} 
        processingStep={selectedProcessingStep}
      />
    </div>
  );
}
