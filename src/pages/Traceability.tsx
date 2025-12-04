import { useState } from "react";
import { Search, History, Package, Inbox, Settings, FlaskConical, FileOutput, FileText, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const mockTimeline = [
  {
    id: "1",
    type: "intake",
    title: "Materialeingang",
    description: "GFK-UP von Recycling GmbH empfangen",
    details: "ME-2024-0089 • 2500 kg • Abfallschlüssel: 07 02 13",
    date: "03.12.2024 08:30",
    icon: Inbox,
    status: "completed",
  },
  {
    id: "2",
    type: "container",
    title: "Container zugewiesen",
    description: "Material in BigBag BB-2024-0234 gelagert",
    details: "Standort: Halle A, Regal 12",
    date: "03.12.2024 09:15",
    icon: Package,
    status: "completed",
  },
  {
    id: "3",
    type: "processing",
    title: "Verarbeitung gestartet",
    description: "Schreddern begonnen",
    details: "VRB-2024-0045 • Prozessschritt 1/4",
    date: "03.12.2024 10:00",
    icon: Settings,
    status: "completed",
  },
  {
    id: "4",
    type: "sample",
    title: "Probe erstellt",
    description: "Probe PRB-2024-0156 entnommen",
    details: "Probenehmer: M. Schmidt",
    date: "03.12.2024 11:30",
    icon: FlaskConical,
    status: "pending",
  },
  {
    id: "5",
    type: "sample_result",
    title: "Laborergebnis",
    description: "Analyse ausstehend",
    details: "Erwartete Fertigstellung: 04.12.2024",
    date: "-",
    icon: FlaskConical,
    status: "waiting",
  },
  {
    id: "6",
    type: "output",
    title: "Ausgangsmaterial",
    description: "Noch nicht erstellt",
    details: "Wartet auf Probenfreigabe",
    date: "-",
    icon: FileOutput,
    status: "waiting",
  },
  {
    id: "7",
    type: "delivery",
    title: "Lieferschein",
    description: "Noch nicht erstellt",
    details: "-",
    date: "-",
    icon: FileText,
    status: "waiting",
  },
];

const statusColors = {
  completed: "bg-success text-success-foreground",
  pending: "bg-warning text-warning-foreground",
  waiting: "bg-secondary text-secondary-foreground",
};

export default function Traceability() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBatch] = useState("CHG-2024-089");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rückverfolgung</h1>
          <p className="text-muted-foreground mt-1">Komplette Materialhistorie einsehen</p>
        </div>
        <Button variant="outline">
          PDF exportieren
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Charge, Container-ID oder Materialeingang suchen..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button>
          Suchen
        </Button>
      </div>

      {/* Selected Batch Info */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <History className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Charge {selectedBatch}</h2>
            <p className="text-sm text-muted-foreground">
              GFK-UP • Recycling GmbH • 2500 kg
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="status-badge-warning">In Verarbeitung</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-lg bg-secondary/30">
          <div>
            <p className="text-xs text-muted-foreground">Eingangsdatum</p>
            <p className="font-medium">03.12.2024</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Material</p>
            <p className="font-medium">GFK-UP</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gewicht</p>
            <p className="font-medium">2500 kg</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Container</p>
            <p className="font-medium font-mono">BB-2024-0234</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Proben</p>
            <p className="font-medium">1 (ausstehend)</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-lg font-semibold text-foreground mb-6">Materialfluss-Timeline</h3>
        
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-6">
            {mockTimeline.map((event, index) => {
              const Icon = event.icon;
              const isLast = index === mockTimeline.length - 1;
              
              return (
                <div key={event.id} className="relative flex gap-4">
                  {/* Icon */}
                  <div className={cn(
                    "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-background",
                    statusColors[event.status as keyof typeof statusColors]
                  )}>
                    {event.status === "completed" ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className={cn(
                    "flex-1 pb-6",
                    isLast && "pb-0"
                  )}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-foreground">{event.title}</h4>
                        <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
                        <p className="text-xs text-muted-foreground/70 mt-1 font-mono">{event.details}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-4">
                        {event.date}
                      </span>
                    </div>
                    
                    {event.status === "completed" && (
                      <Button variant="ghost" size="sm" className="mt-2 text-primary">
                        Details anzeigen
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
