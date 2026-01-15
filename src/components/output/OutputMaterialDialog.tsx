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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileOutput, QrCode, Download, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateLabelPDF, downloadPDF } from "@/lib/pdf";
import { buildOutputMaterialQRUrl } from "@/lib/qrcode";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";

interface OutputMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const outputTypes = [
  { value: "glass_fiber", label: "Recycelte Glasfasern" },
  { value: "resin_powder", label: "Harzpulver" },
  { value: "pp_regrind", label: "PP Regranulat" },
  { value: "pa_regrind", label: "PA Regranulat" },
];

const qualityGrades = ["A", "B", "C"];

export function OutputMaterialDialog({ open, onOpenChange }: OutputMaterialDialogProps) {
  const queryClient = useQueryClient();
  const { logEvent } = useMaterialFlowHistory();
  const [formData, setFormData] = useState({
    outputType: "",
    batchId: "",
    weightKg: "",
    qualityGrade: "",
    containerId: "",
    sampleId: "",
    destination: "",
    notes: "",
    fiberSize: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdOutput, setCreatedOutput] = useState<{
    id: string;
    type: string;
    batchId: string;
  } | null>(null);

  // Fetch available containers
  const { data: containers = [] } = useQuery({
    queryKey: ["containers-available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("containers")
        .select("id, container_id, type")
        .in("status", ["empty", "in_use"])
        .order("container_id");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch approved samples
  const { data: samples = [] } = useQuery({
    queryKey: ["samples-approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("id, sample_id")
        .eq("status", "approved")
        .order("sample_id", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.outputType || !formData.batchId || !formData.weightKg) return;

    setIsSubmitting(true);
    try {
      // Generate unique ID
      const { data: idData, error: idError } = await supabase.rpc("generate_unique_id", { prefix: "OUT" });
      if (idError) throw idError;

      const outputId = idData as string;
      const qrUrl = buildOutputMaterialQRUrl(outputId);

      const { data: inserted, error } = await supabase.from("output_materials").insert({
        output_id: outputId,
        batch_id: formData.batchId,
        output_type: formData.outputType,
        weight_kg: parseFloat(formData.weightKg),
        quality_grade: formData.qualityGrade || null,
        container_id: formData.containerId || null,
        sample_id: formData.sampleId || null,
        destination: formData.destination || null,
        fiber_size: formData.fiberSize || null,
        qr_code: qrUrl,
        status: "in_stock",
        attributes: formData.notes ? { notes: formData.notes } : {},
      }).select().single();

      if (error) throw error;

      // Update container status if assigned
      if (formData.containerId) {
        await supabase
          .from("containers")
          .update({ status: "in_use" })
          .eq("id", formData.containerId);
      }

      // Log event
      await logEvent({
        eventType: "output_created",
        eventDescription: `Ausgangsmaterial ${outputId} erstellt: ${outputTypes.find(t => t.value === formData.outputType)?.label}, ${formData.weightKg} kg`,
        eventDetails: {
          output_id: outputId,
          batch_id: formData.batchId,
          output_type: formData.outputType,
          weight_kg: parseFloat(formData.weightKg),
        },
        outputMaterialId: inserted.id,
        containerId: formData.containerId || undefined,
        sampleId: formData.sampleId || undefined,
      });

      setCreatedOutput({
        id: outputId,
        type: outputTypes.find(t => t.value === formData.outputType)?.label || formData.outputType,
        batchId: formData.batchId,
      });

      queryClient.invalidateQueries({ queryKey: ["output-materials"] });
      queryClient.invalidateQueries({ queryKey: ["containers-available"] });

      toast({
        title: "Ausgangsmaterial erstellt",
        description: `${outputId} wurde erfolgreich erstellt.`,
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Ausgangsmaterial konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadLabel = async () => {
    if (!createdOutput) return;

    setIsGenerating(true);
    try {
      const qrUrl = buildOutputMaterialQRUrl(createdOutput.id);
      const pdfBlob = await generateLabelPDF(
        {
          id: createdOutput.id,
          type: createdOutput.type,
          location: `Charge: ${createdOutput.batchId}`,
          date: new Date().toLocaleDateString("de-DE"),
        },
        qrUrl
      );

      downloadPDF(pdfBlob, `Etikett_${createdOutput.id}.pdf`);

      toast({
        title: "Etikett heruntergeladen",
        description: "Das PDF-Etikett mit QR-Code wurde erstellt.",
      });
    } catch (error) {
      console.error("Error generating label:", error);
      toast({
        title: "Fehler",
        description: "Das Etikett konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setFormData({
      outputType: "",
      batchId: "",
      weightKg: "",
      qualityGrade: "",
      containerId: "",
      sampleId: "",
      destination: "",
      notes: "",
      fiberSize: "",
    });
    setCreatedOutput(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileOutput className="h-5 w-5 text-primary" />
            {createdOutput ? "Ausgangsmaterial erstellt" : "Neues Ausgangsmaterial"}
          </DialogTitle>
          <DialogDescription>
            {createdOutput
              ? "Das Ausgangsmaterial wurde erstellt. Sie können jetzt das Etikett herunterladen."
              : "Erfassen Sie ein neues Ausgangsmaterial mit Qualitätsdaten."}
          </DialogDescription>
        </DialogHeader>

        {!createdOutput ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outputType">Material-Typ *</Label>
                <Select
                  value={formData.outputType}
                  onValueChange={(value) => setFormData({ ...formData, outputType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Typ wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {outputTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batchId">Chargen-Nummer *</Label>
                <Input
                  id="batchId"
                  placeholder="z.B. BATCH-2024-001"
                  value={formData.batchId}
                  onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weightKg">Gewicht (kg) *</Label>
                <Input
                  id="weightKg"
                  type="number"
                  step="0.1"
                  placeholder="z.B. 250"
                  value={formData.weightKg}
                  onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qualityGrade">Qualitätsstufe</Label>
                <Select
                  value={formData.qualityGrade}
                  onValueChange={(value) => setFormData({ ...formData, qualityGrade: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {qualityGrades.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        Qualität {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="containerId">Container</Label>
                <Select
                  value={formData.containerId}
                  onValueChange={(value) => setFormData({ ...formData, containerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {containers.map((container) => (
                      <SelectItem key={container.id} value={container.id}>
                        {container.container_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sampleId">Verknüpfte Probe</Label>
                <Select
                  value={formData.sampleId}
                  onValueChange={(value) => setFormData({ ...formData, sampleId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {samples.map((sample) => (
                      <SelectItem key={sample.id} value={sample.id}>
                        {sample.sample_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fiberSize">Fasergröße</Label>
                <Select
                  value={formData.fiberSize}
                  onValueChange={(value) => setFormData({ ...formData, fiberSize: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="0.125mm">0.125mm</SelectItem>
                    <SelectItem value="1mm">1mm</SelectItem>
                    <SelectItem value="3mm">3mm</SelectItem>
                    <SelectItem value="5mm">5mm</SelectItem>
                    <SelectItem value="Überkorn">Überkorn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Bestimmung / Kunde</Label>
                <Input
                  id="destination"
                  placeholder="z.B. Kunde XY, Lager B"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Bemerkungen</Label>
              <Textarea
                id="notes"
                placeholder="Optionale Anmerkungen..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="p-4 rounded-lg bg-secondary/30 border border-dashed border-border">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">QR-Code wird automatisch generiert</p>
                  <p className="text-xs text-muted-foreground">
                    Nach dem Erstellen können Sie das Etikett als PDF herunterladen
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={!formData.outputType || !formData.batchId || !formData.weightKg || isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Erstellen
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-6 rounded-lg bg-success/10 border border-success/20 text-center">
              <div className="p-3 rounded-full bg-success/20 w-fit mx-auto mb-3">
                <QrCode className="h-8 w-8 text-success" />
              </div>
              <p className="font-mono text-xl font-bold text-foreground">{createdOutput.id}</p>
              <p className="text-sm text-muted-foreground mt-1">{createdOutput.type}</p>
              <p className="text-xs text-muted-foreground">Charge: {createdOutput.batchId}</p>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                Schließen
              </Button>
              <Button onClick={handleDownloadLabel} disabled={isGenerating} className="w-full sm:w-auto">
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Etikett herunterladen
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
