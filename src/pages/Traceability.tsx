import { useState, useEffect } from "react";
import { Search, History, Package, Inbox, Settings, FlaskConical, FileOutput, FileText, CheckCircle, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { PageDescription } from "@/components/layout/PageDescription";

interface TimelineEvent {
  id: string;
  event_type: string;
  event_description: string;
  event_details: unknown;
  created_at: string;
  material_input_id: string | null;
  container_id: string | null;
  processing_step_id: string | null;
  sample_id: string | null;
  output_material_id: string | null;
  delivery_note_id: string | null;
}

interface MaterialInput {
  id: string;
  input_id: string;
  material_type: string;
  material_subtype: string | null;
  weight_kg: number;
  supplier: string;
  status: string;
  created_at: string;
  container_id: string | null;
}

const eventTypeConfig: Record<string, { icon: typeof Inbox; label: string }> = {
  intake_received: { icon: Inbox, label: "Materialeingang" },
  container_assigned: { icon: Package, label: "Container zugewiesen" },
  processing_started: { icon: Settings, label: "Verarbeitung gestartet" },
  processing_completed: { icon: Settings, label: "Verarbeitung abgeschlossen" },
  sample_created: { icon: FlaskConical, label: "Probe erstellt" },
  sample_analyzed: { icon: FlaskConical, label: "Probe analysiert" },
  sample_approved: { icon: CheckCircle, label: "Probe freigegeben" },
  sample_rejected: { icon: AlertCircle, label: "Probe abgelehnt" },
  output_created: { icon: FileOutput, label: "Ausgangsmaterial erstellt" },
  delivery_note_created: { icon: FileText, label: "Lieferschein erstellt" },
  document_uploaded: { icon: FileText, label: "Dokument hochgeladen" },
};

const statusColors: Record<string, string> = {
  completed: "bg-success text-success-foreground",
  pending: "bg-warning text-warning-foreground",
  waiting: "bg-secondary text-secondary-foreground",
  error: "bg-destructive text-destructive-foreground",
};

export default function Traceability() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialInput | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MaterialInput[]>([]);
  const [samplesCount, setSamplesCount] = useState(0);
  const [containerInfo, setContainerInfo] = useState<{ container_id: string; location: string } | null>(null);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_inputs')
        .select('*')
        .or(`input_id.ilike.%${searchTerm}%,supplier.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
      
      if (data && data.length === 1) {
        selectMaterial(data[0]);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectMaterial = async (material: MaterialInput) => {
    setSelectedMaterial(material);
    setSearchResults([]);
    setIsLoading(true);

    try {
      // Fetch timeline events
      const { data: events, error: eventsError } = await supabase
        .from('material_flow_history')
        .select('*')
        .eq('material_input_id', material.id)
        .order('created_at', { ascending: true });

      if (eventsError) throw eventsError;
      setTimeline(events || []);

      // Fetch samples count
      const { count } = await supabase
        .from('samples')
        .select('*', { count: 'exact', head: true })
        .eq('material_input_id', material.id);

      setSamplesCount(count || 0);

      // Fetch container info
      if (material.container_id) {
        const { data: container } = await supabase
          .from('containers')
          .select('container_id, location')
          .eq('id', material.container_id)
          .maybeSingle();

        setContainerInfo(container);
      } else {
        setContainerInfo(null);
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventStatus = (eventType: string): string => {
    if (eventType.includes('rejected')) return 'error';
    if (eventType.includes('pending') || eventType.includes('created')) return 'pending';
    return 'completed';
  };

  const getStatusLabel = (status: string): { label: string; className: string } => {
    switch (status) {
      case 'received':
        return { label: 'Eingegangen', className: 'status-badge-info' };
      case 'in_processing':
        return { label: 'In Verarbeitung', className: 'status-badge-warning' };
      case 'processed':
        return { label: 'Verarbeitet', className: 'status-badge-success' };
      default:
        return { label: status, className: 'status-badge' };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageDescription
        title="Material-Rückverfolgung"
        description="Verfolgen Sie den kompletten Lebenszyklus eines Materials von der Anlieferung bis zur Auslieferung. Alle Ereignisse werden lückenlos dokumentiert."
        nextSteps={[
          "Material-ID eingeben → Historie anzeigen",
          "PDF exportieren → Für Audits und Nachweise",
          "Container-Verlauf → Standort verfolgen"
        ]}
      />
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rückverfolgung</h1>
          <p className="text-muted-foreground mt-1">Komplette Materialhistorie einsehen</p>
        </div>
        {selectedMaterial && (
          <Button variant="outline">
            PDF exportieren
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Materialeingangs-ID oder Lieferant suchen..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suchen'}
        </Button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Suchergebnisse</h3>
          <div className="space-y-2">
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => selectMaterial(result)}
                className="w-full p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left flex items-center justify-between"
              >
                <div>
                  <p className="font-mono font-medium">{result.input_id}</p>
                  <p className="text-sm text-muted-foreground">
                    {result.material_type} • {result.supplier} • {result.weight_kg} kg
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Material Info */}
      {selectedMaterial ? (
        <>
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <History className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{selectedMaterial.input_id}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedMaterial.material_type}
                  {selectedMaterial.material_subtype ? `-${selectedMaterial.material_subtype}` : ''} • {selectedMaterial.supplier} • {selectedMaterial.weight_kg} kg
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className={getStatusLabel(selectedMaterial.status).className}>
                  {getStatusLabel(selectedMaterial.status).label}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 rounded-lg bg-secondary/30">
              <div>
                <p className="text-xs text-muted-foreground">Eingangsdatum</p>
                <p className="font-medium">
                  {format(new Date(selectedMaterial.created_at), 'dd.MM.yyyy', { locale: de })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Material</p>
                <p className="font-medium">
                  {selectedMaterial.material_type}
                  {selectedMaterial.material_subtype ? `-${selectedMaterial.material_subtype}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gewicht</p>
                <p className="font-medium">{selectedMaterial.weight_kg} kg</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Container</p>
                <p className="font-medium font-mono">
                  {containerInfo?.container_id || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Proben</p>
                <p className="font-medium">{samplesCount}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-lg font-semibold text-foreground mb-6">Materialfluss-Timeline</h3>
            
            {timeline.length > 0 ? (
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
                
                <div className="space-y-6">
                  {timeline.map((event, index) => {
                    const config = eventTypeConfig[event.event_type] || { icon: Inbox, label: event.event_type };
                    const Icon = config.icon;
                    const status = getEventStatus(event.event_type);
                    const isLast = index === timeline.length - 1;
                    
                    return (
                      <div key={event.id} className="relative flex gap-4">
                        {/* Icon */}
                        <div className={cn(
                          "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-background",
                          statusColors[status]
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        
                        {/* Content */}
                        <div className={cn(
                          "flex-1 pb-6",
                          isLast && "pb-0"
                        )}>
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-foreground">{config.label}</h4>
                              <p className="text-sm text-muted-foreground mt-0.5">{event.event_description}</p>
                              {event.event_details && typeof event.event_details === 'object' && Object.keys(event.event_details as object).length > 0 && (
                                <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
                                  {Object.entries(event.event_details as Record<string, unknown>)
                                    .filter(([key]) => !['created_by', 'step_labels'].includes(key))
                                    .map(([key, value]) => `${key}: ${String(value)}`)
                                    .join(' • ')}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 ml-4">
                              {format(new Date(event.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-secondary/50 mb-4">
                  <History className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground">Keine Ereignisse</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Für diesen Materialeingang wurden noch keine Ereignisse protokolliert.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="glass-card rounded-xl p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-full bg-secondary/50 mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">Material suchen</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Geben Sie eine Materialeingangs-ID (z.B. ME-2024-0001) oder einen Lieferantennamen ein, 
              um die vollständige Materialhistorie anzuzeigen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
