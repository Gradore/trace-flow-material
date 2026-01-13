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
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Loader2, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";

interface CompleteProcessingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processingStep: {
    id: string;
    processing_id: string;
    material_input_id: string;
    step_type: string;
    material_inputs?: {
      input_id: string;
      material_type: string;
      material_subtype?: string;
      weight_kg?: number;
    };
  } | null;
}

export function CompleteProcessingDialog({
  open,
  onOpenChange,
  processingStep,
}: CompleteProcessingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [samplerName, setSamplerName] = useState("");
  const [createRetentionSample, setCreateRetentionSample] = useState(true);
  const queryClient = useQueryClient();
  const { logEvent } = useMaterialFlowHistory();

  const handleComplete = async () => {
    if (!processingStep) return;
    if (!samplerName.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie den Namen des Probenehmers ein.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Mark processing step as completed
      const { error: stepError } = await supabase
        .from("processing_steps")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          progress: 100,
        })
        .eq("id", processingStep.id);

      if (stepError) {
        console.error("Error completing processing step:", stepError);
        throw new Error("Verarbeitungsschritt konnte nicht abgeschlossen werden.");
      }

      // 2. Update material input status
      const { error: materialError } = await supabase
        .from("material_inputs")
        .update({ status: "processed" })
        .eq("id", processingStep.material_input_id);

      if (materialError) {
        console.warn("Could not update material input status:", materialError);
      }

      // 3. Create main sample
      const { data: sampleIdData, error: sampleIdError } = await supabase.rpc(
        "generate_unique_id",
        { prefix: "PRB" }
      );
      if (sampleIdError) throw new Error("Proben-ID konnte nicht generiert werden.");

      const { data: mainSample, error: mainSampleError } = await supabase
        .from("samples")
        .insert({
          sample_id: sampleIdData,
          sampler_name: samplerName.trim(),
          material_input_id: processingStep.material_input_id,
          processing_step_id: processingStep.id,
          status: "pending",
          is_retention_sample: false,
        })
        .select("id")
        .single();

      if (mainSampleError) {
        console.error("Error creating main sample:", mainSampleError);
        throw new Error("Hauptprobe konnte nicht erstellt werden.");
      }

      // 4. Create retention sample if requested
      let retentionSampleId: string | null = null;
      if (createRetentionSample) {
        const { data: retentionIdData, error: retentionIdError } = await supabase.rpc(
          "generate_unique_id",
          { prefix: "RST" }
        );
        if (retentionIdError) {
          console.warn("Could not generate retention sample ID:", retentionIdError);
        } else {
          const { data: retentionSample, error: retentionError } = await supabase
            .from("samples")
            .insert({
              sample_id: retentionIdData,
              sampler_name: samplerName.trim(),
              material_input_id: processingStep.material_input_id,
              processing_step_id: processingStep.id,
              status: "pending",
              is_retention_sample: true,
              notes: "Rückstellprobe",
            })
            .select("id")
            .single();

          if (retentionError) {
            console.warn("Could not create retention sample:", retentionError);
          } else {
            retentionSampleId = retentionSample?.id || null;
          }
        }
      }

      // 5. Log events (non-critical)
      try {
        await logEvent({
          eventType: "processing_completed",
          eventDescription: `Verarbeitung ${processingStep.processing_id} abgeschlossen`,
          eventDetails: {
            processing_id: processingStep.processing_id,
            step_type: processingStep.step_type,
          },
          materialInputId: processingStep.material_input_id,
          processingStepId: processingStep.id,
        });

        await logEvent({
          eventType: "sample_created",
          eventDescription: `Probe ${sampleIdData} erstellt nach Verarbeitungsabschluss`,
          materialInputId: processingStep.material_input_id,
          processingStepId: processingStep.id,
          sampleId: mainSample?.id,
        });
      } catch (logError) {
        console.warn("Could not log events:", logError);
      }

      toast({
        title: "Verarbeitung abgeschlossen",
        description: createRetentionSample
          ? `${processingStep.processing_id} wurde abgeschlossen. Probe und Rückstellprobe wurden erstellt.`
          : `${processingStep.processing_id} wurde abgeschlossen. Probe wurde erstellt.`,
      });

      queryClient.invalidateQueries({ queryKey: ["processing-steps"] });
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      queryClient.invalidateQueries({ queryKey: ["material-inputs"] });
      
      setSamplerName("");
      setCreateRetentionSample(true);
      onOpenChange(false);
    } catch (error: any) {
      console.error("CompleteProcessingDialog error:", error);
      toast({
        title: "Fehler",
        description: error.message || "Ein Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!processingStep) return null;

  const materialLabel = processingStep.material_inputs?.material_subtype
    ? `${processingStep.material_inputs.material_type}-${processingStep.material_inputs.material_subtype}`
    : processingStep.material_inputs?.material_type || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Verarbeitung abschließen
          </DialogTitle>
          <DialogDescription>
            Schließen Sie die Verarbeitung ab und erstellen Sie eine Probe für die Laboranalyse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Processing Info */}
          <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Verarbeitung:</span>
              <span className="font-mono font-medium">{processingStep.processing_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Material:</span>
              <span className="font-medium">{materialLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Eingang:</span>
              <span className="font-medium">{processingStep.material_inputs?.input_id || "-"}</span>
            </div>
            {processingStep.material_inputs?.weight_kg && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Gewicht:</span>
                <span className="font-medium">{processingStep.material_inputs.weight_kg} kg</span>
              </div>
            )}
          </div>

          {/* Sample Creation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <FlaskConical className="h-4 w-4" />
              <span className="font-medium">Probenentnahme</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sampler">Probenehmer *</Label>
              <Input
                id="sampler"
                placeholder="Name des Probenehmers"
                value={samplerName}
                onChange={(e) => setSamplerName(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="retention"
                checked={createRetentionSample}
                onCheckedChange={(checked) => setCreateRetentionSample(checked === true)}
              />
              <Label htmlFor="retention" className="cursor-pointer">
                Rückstellprobe anlegen
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleComplete} disabled={isSubmitting || !samplerName.trim()}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Abschließen & Probe erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
