import { useState, useEffect, useRef } from "react";
import { Search, History, Package, Inbox, Settings, FlaskConical, FileOutput, FileText, CheckCircle, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { PageDescription } from "@/components/layout/PageDescription";
import { toast } from "@/hooks/use-toast";
import { generateTraceabilityPDF, downloadPDF } from "@/lib/pdf";
import { buildMaterialInputQRUrl } from "@/lib/qrcode";

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

/**
 * Free text is spliced into a PostgREST .or() filter string, where , ( ) and "
 * are grammar characters - a raw value breaks the request with a 400.
 */
const sanitizeFilterValue = (value: string): string =>
  value.replace(/[,()"\\%*]/g, " ").replace(/\s+/g, " ").trim();

const formatEventDetails = (details: unknown): string | undefined => {
  if (!details || typeof details !== 'object') return undefined;

  const entries = Object.entries(details as Record<string, unknown>).filter(
    ([key]) => !['created_by', 'step_labels'].includes(key)
  );

  if (entries.length === 0) return undefined;

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' • ');
};

/**
 * Collect the flow history of a material input. output_created and outgoing
 * delivery_note_created events carry no material_input_id, so the related
 * processing steps, samples, output materials and delivery notes are followed
 * as well - otherwise the timeline stops before output and shipment.
 */
const fetchTimelineEvents = async (materialInputId: string): Promise<TimelineEvent[]> => {
  const events = new Map<string, TimelineEvent>();

  const collect = (rows: TimelineEvent[] | null) => {
    (rows || []).forEach((row) => events.set(row.id, row));
  };

  const { data: directEvents, error: directError } = await supabase
    .from('material_flow_history')
    .select('*')
    .eq('material_input_id', materialInputId);
  if (directError) throw directError;
  collect(directEvents);

  const { data: steps, error: stepsError } = await supabase
    .from('processing_steps')
    .select('id')
    .eq('material_input_id', materialInputId);
  if (stepsError) throw stepsError;
  const stepIds = (steps || []).map((step) => step.id);

  const sampleIds = new Set<string>();
  const { data: samplesByInput, error: samplesByInputError } = await supabase
    .from('samples')
    .select('id')
    .eq('material_input_id', materialInputId);
  if (samplesByInputError) throw samplesByInputError;
  (samplesByInput || []).forEach((sample) => sampleIds.add(sample.id));

  if (stepIds.length > 0) {
    const { data: samplesByStep, error: samplesByStepError } = await supabase
      .from('samples')
      .select('id')
      .in('processing_step_id', stepIds);
    if (samplesByStepError) throw samplesByStepError;
    (samplesByStep || []).forEach((sample) => sampleIds.add(sample.id));
  }

  const outputIds = new Set<string>();
  if (stepIds.length > 0) {
    const { data: outputsByStep, error: outputsByStepError } = await supabase
      .from('output_materials')
      .select('id')
      .in('processing_step_id', stepIds);
    if (outputsByStepError) throw outputsByStepError;
    (outputsByStep || []).forEach((output) => outputIds.add(output.id));
  }
  if (sampleIds.size > 0) {
    const { data: outputsBySample, error: outputsBySampleError } = await supabase
      .from('output_materials')
      .select('id')
      .in('sample_id', Array.from(sampleIds));
    if (outputsBySampleError) throw outputsBySampleError;
    (outputsBySample || []).forEach((output) => outputIds.add(output.id));
  }

  const noteIds = new Set<string>();
  const { data: notesByInput, error: notesByInputError } = await supabase
    .from('delivery_notes')
    .select('id')
    .eq('material_input_id', materialInputId);
  if (notesByInputError) throw notesByInputError;
  (notesByInput || []).forEach((note) => noteIds.add(note.id));

  if (outputIds.size > 0) {
    const { data: notesByOutput, error: notesByOutputError } = await supabase
      .from('delivery_notes')
      .select('id')
      .in('output_material_id', Array.from(outputIds));
    if (notesByOutputError) throw notesByOutputError;
    (notesByOutput || []).forEach((note) => noteIds.add(note.id));
  }

  const relations: Array<{
    column: 'processing_step_id' | 'sample_id' | 'output_material_id' | 'delivery_note_id';
    ids: string[];
  }> = [
    { column: 'processing_step_id', ids: stepIds },
    { column: 'sample_id', ids: Array.from(sampleIds) },
    { column: 'output_material_id', ids: Array.from(outputIds) },
    { column: 'delivery_note_id', ids: Array.from(noteIds) },
  ];

  for (const relation of relations) {
    if (relation.ids.length === 0) continue;

    const { data, error } = await supabase
      .from('material_flow_history')
      .select('*')
      .in(relation.column, relation.ids);
    if (error) throw error;
    collect(data);
  }

  return Array.from(events.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export default function Traceability() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? "");
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialInput | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchResults, setSearchResults] = useState<MaterialInput[]>([]);
  const [samplesCount, setSamplesCount] = useState(0);
  const [containerInfo, setContainerInfo] = useState<{ container_id: string; location: string } | null>(null);
  const initialSearchHandled = useRef(false);

  const runSearch = async (term: string) => {
    const cleanTerm = sanitizeFilterValue(term);
    if (!cleanTerm) {
      toast({
        title: "Ungültiger Suchbegriff",
        description: "Bitte geben Sie eine Materialeingangs-ID, einen Lieferanten oder eine Container-ID ein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_inputs')
        .select('*')
        .or(`input_id.ilike.%${cleanTerm}%,supplier.ilike.%${cleanTerm}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      let results: MaterialInput[] = data || [];

      // Container IDs (BB-/BX-/GX-/CT-...) resolve via the linked container
      if (results.length === 0) {
        const { data: containers, error: containersError } = await supabase
          .from('containers')
          .select('id')
          .ilike('container_id', `%${cleanTerm}%`)
          .limit(10);

        if (containersError) throw containersError;

        if (containers && containers.length > 0) {
          const { data: byContainer, error: byContainerError } = await supabase
            .from('material_inputs')
            .select('*')
            .in('container_id', containers.map((container) => container.id))
            .order('created_at', { ascending: false })
            .limit(10);

          if (byContainerError) throw byContainerError;
          results = byContainer || [];
        }
      }

      setSearchResults(results);

      if (results.length === 1) {
        selectMaterial(results[0]);
      } else if (results.length === 0) {
        toast({
          title: "Keine Treffer",
          description: `Zu "${cleanTerm}" wurde kein Materialeingang gefunden.`,
        });
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast({
        title: "Suche fehlgeschlagen",
        description: error instanceof Error ? error.message : "Die Suche konnte nicht ausgeführt werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => runSearch(searchTerm);

  const selectMaterial = async (material: MaterialInput) => {
    setSelectedMaterial(material);
    setSearchResults([]);
    setIsLoading(true);

    try {
      // Fetch timeline events
      const events = await fetchTimelineEvents(material.id);
      setTimeline(events);

      // Fetch samples count
      const { count, error: countError } = await supabase
        .from('samples')
        .select('*', { count: 'exact', head: true })
        .eq('material_input_id', material.id);

      if (countError) throw countError;
      setSamplesCount(count || 0);

      // Fetch container info
      if (material.container_id) {
        const { data: container, error: containerError } = await supabase
          .from('containers')
          .select('container_id, location')
          .eq('id', material.container_id)
          .maybeSingle();

        if (containerError) throw containerError;
        setContainerInfo(container);
      } else {
        setContainerInfo(null);
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
      toast({
        title: "Historie konnte nicht geladen werden",
        description: error instanceof Error ? error.message : "Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Deep link from the QR scanner: /traceability?search=<code>
  useEffect(() => {
    const initialTerm = searchParams.get('search');
    if (!initialTerm || initialSearchHandled.current) return;

    initialSearchHandled.current = true;
    setSearchTerm(initialTerm);
    runSearch(initialTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleExportPDF = async () => {
    if (!selectedMaterial) return;

    setIsExporting(true);
    try {
      const pdfBlob = await generateTraceabilityPDF(
        {
          inputId: selectedMaterial.input_id,
          material: `${selectedMaterial.material_type}${selectedMaterial.material_subtype ? `-${selectedMaterial.material_subtype}` : ''}`,
          supplier: selectedMaterial.supplier,
          weight: `${selectedMaterial.weight_kg} kg`,
          status: getStatusLabel(selectedMaterial.status).label,
          containerId: containerInfo?.container_id,
          samplesCount,
          createdAt: format(new Date(selectedMaterial.created_at), 'dd.MM.yyyy', { locale: de }),
        },
        timeline.map((event) => ({
          label: eventTypeConfig[event.event_type]?.label || event.event_type,
          description: event.event_description,
          date: format(new Date(event.created_at), 'dd.MM.yyyy HH:mm', { locale: de }),
          details: formatEventDetails(event.event_details),
        })),
        buildMaterialInputQRUrl(selectedMaterial.input_id)
      );

      downloadPDF(pdfBlob, `Rueckverfolgung_${selectedMaterial.input_id}.pdf`);

      toast({
        title: "PDF erstellt",
        description: `Der Rückverfolgungsnachweis für ${selectedMaterial.input_id} wurde heruntergeladen.`,
      });
    } catch (error) {
      console.error('Error generating traceability PDF:', error);
      toast({
        title: "Export fehlgeschlagen",
        description: error instanceof Error ? error.message : "Das PDF konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
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
          <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Erstelle PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                PDF exportieren
              </>
            )}
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
                              {formatEventDetails(event.event_details) && (
                                <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
                                  {formatEventDetails(event.event_details)}
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
