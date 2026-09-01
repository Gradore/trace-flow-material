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
import { FlaskConical, Upload, FileText, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";

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
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);

  // Fetch sample results
  const { data: results = [], isError: isResultsError } = useQuery({
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
  const { data: documents = [], isError: isDocumentsError } = useQuery({
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
      const { data: updated, error } = await supabase
        .from("samples")
        .update({ 
          status: newStatus,
          approved_at: newStatus === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", sample.id)
        .select("id");

      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden.");
      }

      // Log event
      await logEvent({
        eventType: newStatus === "approved" ? "sample_approved" : "sample_rejected",
        eventDescription: `Probe ${sample.sampleId} wurde ${newStatus === "approved" ? "freigegeben" : "abgelehnt"}`,
        sampleId: sample.id,
        materialInputId: sample.materialInputId,
      });

      // CRITICAL: a rejected sample also rejects its batch and stops its processing steps
      let batchRejected = false;
      if (newStatus === "rejected" && sample.materialInputId) {
        // .select() so an RLS-filtered (zero row) update is not reported as a rejection
        const { data: rejectedBatch, error: materialError } = await supabase
          .from("material_inputs")
          .update({ status: "rejected" })
          .eq("id", sample.materialInputId)
          .select("id");

        batchRejected = !materialError && !!rejectedBatch && rejectedBatch.length > 0;

        if (!batchRejected) {
          console.warn("Could not update material input status:", materialError);
        } else {
          const { error: processingError } = await supabase
            .from("processing_steps")
            .update({ status: "completed", notes: "Automatisch beendet wegen Proben-Ablehnung" })
            .eq("material_input_id", sample.materialInputId)
            .in("status", ["running", "paused", "pending", "sample_required"]);

          if (processingError) {
            console.warn("Could not cancel processing steps:", processingError);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["samples"] });
      queryClient.invalidateQueries({ queryKey: ["material-inputs"] });
      queryClient.invalidateQueries({ queryKey: ["processing-steps"] });

      if (newStatus === "rejected" && batchRejected) {
        toast({
          title: "Probe und Charge abgelehnt",
          description: "Die zugehörige Charge wurde ebenfalls als abgelehnt markiert. Keine weiteren Verarbeitungsschritte möglich.",
          variant: "destructive",
        });
      } else {
        toast({
          title: newStatus === "approved" ? "Probe freigegeben" : "Probe abgelehnt",
          description: `${sample.sampleId} wurde aktualisiert.`,
        });
      }

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

  const handleOpenDocument = async (doc: { id: string; name: string; file_url: string }) => {
    setOpeningDocumentId(doc.id);
    try {
      // Older records may already hold a full URL, newer ones hold the storage path
      if (doc.file_url.startsWith("http")) {
        window.open(doc.file_url, "_blank", "noopener,noreferrer");
        return;
      }

      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_url, 60);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Dokument konnte nicht geöffnet werden.");

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Dokument konnte nicht geöffnet werden.",
        variant: "destructive",
      });
    } finally {
      setOpeningDocumentId(null);
    }
  };

  return (
    <>
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
            {isResultsError ? (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Ergebnisse konnten nicht geladen werden.
              </div>
            ) : results.length > 0 ? (
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
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setIsUploadDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Datei wählen
              </Button>
            </div>

            <div className="space-y-2">
              {isDocumentsError ? (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Dokumente konnten nicht geladen werden.
                </div>
              ) : documents.length > 0 ? (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={openingDocumentId === doc.id}
                      onClick={() => handleOpenDocument(doc)}
                    >
                      {openingDocumentId === doc.id && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
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

    <DocumentUploadDialog
      open={isUploadDialogOpen}
      onOpenChange={setIsUploadDialogOpen}
      preselectedSampleId={sample.id}
    />
    </>
  );
}
