import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlaskConical, Upload, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";

interface SampleResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sample: {
    id: string;
    sampleId: string;
    batch: string;
    material: string;
    processStep: string;
    sampler: string;
    date: string;
    status: string;
    materialInputId?: string;
  } | null;
}

export function SampleResultsDialog({ open, onOpenChange, sample }: SampleResultsDialogProps) {
  const queryClient = useQueryClient();
  const { logEvent } = useMaterialFlowHistory();
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch sample results
  const { data: results = [] } = useQuery({
    queryKey: ["sample-results", sample?.id],
    queryFn: async () => {
      if (!sample?.id) return [];
      const { data, error } = await supabase
        .from("sample_results")
        .select("*")
        .eq("sample_id", sample.id)
        .order("parameter_name");
      if (error) throw error;
      return data;
    },
    enabled: !!sample?.id && open,
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["sample-documents", sample?.id],
    queryFn: async () => {
      if (!sample?.id) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("sample_id", sample.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!sample?.id && open,
  });

  if (!sample) return null;

  const statusConfig = {
    pending: { label: "Ausstehend", class: "status-badge-warning" },
    in_analysis: { label: "In Analyse", class: "status-badge-info" },
    approved: { label: "Freigegeben", class: "status-badge-success" },
    rejected: { label: "Abgelehnt", class: "status-badge-destructive" },
  };

  const status = statusConfig[sample.status as keyof typeof statusConfig];

  const handleStatusUpdate = async (newStatus: "approved" | "rejected") => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("samples")
        .update({ 
          status: newStatus,
          approved_at: newStatus === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", sample.id);

      if (error) throw error;

      // Log event
      await logEvent({
        eventType: newStatus === "approved" ? "sample_approved" : "sample_rejected",
        eventDescription: `Probe ${sample.sampleId} wurde ${newStatus === "approved" ? "freigegeben" : "abgelehnt"}`,
        sampleId: sample.id,
        materialInputId: sample.materialInputId,
      });

      queryClient.invalidateQueries({ queryKey: ["samples"] });

      toast({
        title: newStatus === "approved" ? "Probe freigegeben" : "Probe abgelehnt",
        description: `${sample.sampleId} wurde aktualisiert.`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Status konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            {sample.sampleId}
            <span className={cn(status.class, "ml-2")}>{status.label}</span>
          </DialogTitle>
          <DialogDescription>
            Charge: {sample.batch} • Material: {sample.material} • {sample.processStep}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="results" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="results">Ergebnisse</TabsTrigger>
            <TabsTrigger value="documents">Dokumente</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4 mt-4">
            {results.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {results.map((result) => (
                  <div key={result.id} className="space-y-2">
                    <Label>{result.parameter_name}</Label>
                    <Input
                      value={`${result.parameter_value}${result.unit ? ` ${result.unit}` : ""}`}
                      readOnly
                      className="bg-secondary/30"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Keine Ergebnisse vorhanden</p>
              </div>
            )}

            {(sample.status === "in_analysis" || sample.status === "pending") && (
              <div className="flex items-center gap-2 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="flex-1 border-success text-success hover:bg-success hover:text-success-foreground"
                  onClick={() => handleStatusUpdate("approved")}
                  disabled={isUpdating}
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Freigeben
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleStatusUpdate("rejected")}
                  disabled={isUpdating}
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Ablehnen
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Dokumente hochladen</p>
              <p className="text-xs text-muted-foreground mt-1">
                Laborberichte, Fotos oder CSV-Daten
              </p>
              <Button variant="outline" size="sm" className="mt-4">
                <Upload className="h-4 w-4 mr-2" />
                Datei wählen
              </Button>
            </div>

            <div className="space-y-2">
              {documents.length > 0 ? (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Öffnen
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">Keine Dokumente vorhanden</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Proben-ID</Label>
                <p className="font-mono font-medium">{sample.sampleId}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Charge</Label>
                <p className="font-mono font-medium">{sample.batch}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Material</Label>
                <p className="font-medium">{sample.material}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Prozessschritt</Label>
                <p className="font-medium">{sample.processStep}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Probenehmer</Label>
                <p className="font-medium">{sample.sampler}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Datum</Label>
                <p className="font-medium">{new Date(sample.date).toLocaleDateString("de-DE")}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
