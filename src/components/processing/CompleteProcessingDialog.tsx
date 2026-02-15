import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Loader2, FlaskConical, Archive, Warehouse, Microscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  const [createRetentionSamples, setCreateRetentionSamples] = useState(true);
  
  // Retention sample fields
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(undefined);
  const [selectedOutputId, setSelectedOutputId] = useState<string | undefined>(undefined);
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [labLocation, setLabLocation] = useState("");
  
  const queryClient = useQueryClient();
  const { logEvent } = useMaterialFlowHistory();

  // Fetch pending/in_production orders for customer assignment
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-for-retention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_id, customer_name, product_name, status")
        .in("status", ["pending", "in_production", "ready"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && createRetentionSamples,
  });

  // Fetch available output materials (batches)
  const { data: outputMaterials = [] } = useQuery({
    queryKey: ["output-materials-for-retention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("id, output_id, batch_id, output_type, weight_kg, status")
        .in("status", ["available", "reserved"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && createRetentionSamples,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSamplerName("");
      setCreateRetentionSamples(true);
      setSelectedOrderId(undefined);
      setSelectedOutputId(undefined);
      setWarehouseLocation("");
      setLabLocation("");
    }
  }, [open]);

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

    if (createRetentionSamples && !warehouseLocation.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie den Lagerplatz für die Lager-Rückstellprobe ein.",
        variant: "destructive",
      });
      return;
    }

    if (createRetentionSamples && !labLocation.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie den Lagerplatz für die Labor-Rückstellprobe ein.",
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

      // Get customer and batch info for notes
      const selectedOrder = orders.find(o => o.id === selectedOrderId);
      const selectedOutput = outputMaterials.find(o => o.id === selectedOutputId);
      const dateStr = format(new Date(), "dd.MM.yyyy", { locale: de });

      // 4. Create TWO retention samples if requested
      if (createRetentionSamples) {
        // 4a. Warehouse retention sample (Lager-Rückstellprobe)
        const { data: warehouseIdData } = await supabase.rpc("generate_unique_id", { prefix: "RST" });
        
        const warehouseNotes = [
          "Rückstellprobe für Lager",
          selectedOrder ? `Kunde: ${selectedOrder.customer_name}` : null,
          selectedOutput ? `Charge: ${selectedOutput.batch_id}` : null,
          `Material: ${processingStep.material_inputs?.material_type || ""}`,
          `Datum: ${dateStr}`,
          `Lagerplatz: ${warehouseLocation}`,
        ].filter(Boolean).join(" | ");

        await supabase.from("samples").insert({
          sample_id: warehouseIdData,
          sampler_name: samplerName.trim(),
          material_input_id: processingStep.material_input_id,
          processing_step_id: processingStep.id,
          status: "pending",
          is_retention_sample: true,
          retention_purpose: "warehouse",
          storage_location: warehouseLocation.trim(),
          customer_order_id: selectedOrderId || null,
          output_material_id: selectedOutputId || null,
          notes: warehouseNotes,
        });

        // 4b. Lab retention sample (Labor-Rückstellprobe für Beanstandungen)
        const { data: labIdData } = await supabase.rpc("generate_unique_id", { prefix: "RST" });
        
        const labNotes = [
          "Rückstellprobe für Labor bei Beanstandungen",
          selectedOrder ? `Kunde: ${selectedOrder.customer_name}` : null,
          selectedOutput ? `Charge: ${selectedOutput.batch_id}` : null,
          `Material: ${processingStep.material_inputs?.material_type || ""}`,
          `Datum: ${dateStr}`,
          `Lagerplatz: ${labLocation}`,
        ].filter(Boolean).join(" | ");

        await supabase.from("samples").insert({
          sample_id: labIdData,
          sampler_name: samplerName.trim(),
          material_input_id: processingStep.material_input_id,
          processing_step_id: processingStep.id,
          status: "pending",
          is_retention_sample: true,
          retention_purpose: "lab_complaint",
          storage_location: labLocation.trim(),
          customer_order_id: selectedOrderId || null,
          output_material_id: selectedOutputId || null,
          notes: labNotes,
        });
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
        description: createRetentionSamples
          ? `${processingStep.processing_id} wurde abgeschlossen. Hauptprobe und 2 Rückstellproben wurden erstellt.`
          : `${processingStep.processing_id} wurde abgeschlossen. Probe wurde erstellt.`,
      });

      queryClient.invalidateQueries({ queryKey: ["processing-steps"] });
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      queryClient.invalidateQueries({ queryKey: ["material-inputs"] });
      
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            Verarbeitung abschließen
          </DialogTitle>
          <DialogDescription>
            Schließen Sie die Verarbeitung ab und erstellen Sie Proben für Laboranalyse und Rückstellung.
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
              <span className="font-medium">Hauptprobe (Laboranalyse)</span>
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
          </div>

          {/* Retention Samples Section */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="retention"
                checked={createRetentionSamples}
                onCheckedChange={(checked) => setCreateRetentionSamples(checked === true)}
              />
              <Label htmlFor="retention" className="cursor-pointer flex items-center gap-2">
                <Archive className="h-4 w-4" />
                2 Rückstellproben anlegen
              </Label>
            </div>

            {createRetentionSamples && (
              <div className="space-y-4 pl-6 border-l-2 border-warning/30">
                {/* Customer/Order Selection */}
                <div className="space-y-2">
                  <Label>Lieferung zu Kunde (optional)</Label>
                  <Select value={selectedOrderId} onValueChange={(v) => setSelectedOrderId(v === "__none__" ? undefined : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kundenauftrag wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Kein Auftrag</SelectItem>
                      {orders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.order_id} - {order.customer_name}
                          {order.product_name ? ` (${order.product_name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Batch/Output Selection */}
                <div className="space-y-2">
                  <Label>Chargennummer (optional)</Label>
                  <Select value={selectedOutputId} onValueChange={(v) => setSelectedOutputId(v === "__none__" ? undefined : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Charge wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine Charge</SelectItem>
                      {outputMaterials.map((output) => (
                        <SelectItem key={output.id} value={output.id}>
                          {output.batch_id} - {output.output_type} ({output.weight_kg} kg)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Warehouse Retention Sample */}
                <div className="p-3 rounded-lg bg-secondary/20 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Warehouse className="h-4 w-4 text-warning" />
                    Rückstellprobe 1: Lager
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warehouseLocation">Lagerplatz *</Label>
                    <Input
                      id="warehouseLocation"
                      placeholder="z.B. Regal A3, Fach 5"
                      value={warehouseLocation}
                      onChange={(e) => setWarehouseLocation(e.target.value)}
                    />
                  </div>
                </div>

                {/* Lab Retention Sample */}
                <div className="p-3 rounded-lg bg-secondary/20 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Microscope className="h-4 w-4 text-warning" />
                    Rückstellprobe 2: Labor (bei Beanstandungen)
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="labLocation">Lagerplatz *</Label>
                    <Input
                      id="labLocation"
                      placeholder="z.B. Labor-Kühlschrank K2"
                      value={labLocation}
                      onChange={(e) => setLabLocation(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={isSubmitting || !samplerName.trim() || (createRetentionSamples && (!warehouseLocation.trim() || !labLocation.trim()))}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Abschließen & Proben erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
