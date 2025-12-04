import { useState } from "react";
import { Plus, Search, Filter, Settings, MoreVertical, ArrowRight, FlaskConical, Play, Pause, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProcessingDialog } from "@/components/processing/ProcessingDialog";
import { Progress } from "@/components/ui/progress";

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

const mockProcessing = [
  {
    id: "VRB-2024-0045",
    intake: "ME-2024-0089",
    material: "GFK-UP",
    currentStep: "shredding",
    progress: 65,
    status: "running",
    weight: "2500 kg",
    startTime: "08:30",
    hasSample: false,
  },
  {
    id: "VRB-2024-0044",
    intake: "ME-2024-0088",
    material: "PP",
    currentStep: "milling",
    progress: 100,
    status: "sample_required",
    weight: "1800 kg",
    startTime: "07:15",
    hasSample: false,
  },
  {
    id: "VRB-2024-0043",
    intake: "ME-2024-0087",
    material: "GFK-EP",
    currentStep: "separation",
    progress: 30,
    status: "running",
    weight: "3200 kg",
    startTime: "06:00",
    hasSample: true,
  },
  {
    id: "VRB-2024-0042",
    intake: "ME-2024-0086",
    material: "PA6",
    currentStep: "sorting",
    progress: 100,
    status: "completed",
    weight: "1200 kg",
    startTime: "Gestern",
    hasSample: true,
  },
];

export default function Processing() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProcessing = mockProcessing.filter(
    (p) =>
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.material.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <p className="text-2xl font-bold text-foreground mt-1">4</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Laufend</p>
          <p className="text-2xl font-bold text-info mt-1">2</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Probe erforderlich</p>
          <p className="text-2xl font-bold text-destructive mt-1">1</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Heute abgeschlossen</p>
          <p className="text-2xl font-bold text-success mt-1">3</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProcessing.map((process) => {
          const status = statusConfig[process.status as keyof typeof statusConfig];
          const currentStepIndex = processSteps.findIndex((s) => s.id === process.currentStep);
          
          return (
            <div key={process.id} className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    <span className="font-mono font-bold text-lg">{process.id}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Eingang: {process.intake} • {process.material}
                  </p>
                </div>
                <span className={cn(status.class)}>{status.label}</span>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {processSteps[currentStepIndex]?.icon} {processSteps[currentStepIndex]?.label}
                  </span>
                  <span className="font-medium">{process.progress}%</span>
                </div>
                <Progress value={process.progress} className="h-2" />
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
                <span>Gewicht: {process.weight}</span>
                <span>Gestartet: {process.startTime}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {process.status === "running" && (
                  <Button variant="outline" size="sm">
                    <Pause className="h-4 w-4" />
                    Pausieren
                  </Button>
                )}
                {process.status === "paused" && (
                  <Button variant="outline" size="sm">
                    <Play className="h-4 w-4" />
                    Fortsetzen
                  </Button>
                )}
                {process.status === "sample_required" && (
                  <Button variant="warning" size="sm">
                    <FlaskConical className="h-4 w-4" />
                    Probe erstellen
                  </Button>
                )}
                {!process.hasSample && process.status !== "sample_required" && (
                  <Button variant="outline" size="sm">
                    <FlaskConical className="h-4 w-4" />
                    Probe hinzufügen
                  </Button>
                )}
                {process.hasSample && (
                  <Button variant="ghost" size="sm" className="text-success">
                    <CheckCircle className="h-4 w-4" />
                    Probe vorhanden
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ProcessingDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
