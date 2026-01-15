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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, QrCode, Download, Loader2 } from "lucide-react";
import { generateLabelPDF, downloadPDF } from "@/lib/pdf";
import { buildContainerQRUrl } from "@/lib/qrcode";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";

interface ContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const containerTypes = {
  bigbag: { label: "BigBag", prefix: "BB" },
  box: { label: "Box", prefix: "BX" },
  cage: { label: "Gitterbox", prefix: "GX" },
  container: { label: "Container", prefix: "CT" },
};

export function ContainerDialog({ open, onOpenChange }: ContainerDialogProps) {
  const queryClient = useQueryClient();
  const { logEvent } = useMaterialFlowHistory();
  const [formData, setFormData] = useState({
    type: "",
    weight: "",
    location: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdContainer, setCreatedContainer] = useState<{
    id: string;
    uuid: string;
    type: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type) return;

    setIsSubmitting(true);
    try {
      const prefix = containerTypes[formData.type as keyof typeof containerTypes]?.prefix || "CT";
      
      // Generate unique ID using database function
      const { data: idData, error: idError } = await supabase.rpc("generate_unique_id", { prefix });
      if (idError) throw idError;
      
      const containerId = idData as string;
      const qrUrl = buildContainerQRUrl(containerId);

      const { data: inserted, error } = await supabase.from("containers").insert({
        container_id: containerId,
        type: formData.type,
        weight_kg: formData.weight ? parseFloat(formData.weight) : null,
        location: formData.location || null,
        qr_code: qrUrl,
        status: "empty",
      }).select().single();

      if (error) throw error;

      // Log event
      await logEvent({
        eventType: "container_assigned",
        eventDescription: `Container ${containerId} erstellt: ${containerTypes[formData.type as keyof typeof containerTypes]?.label || formData.type}`,
        eventDetails: {
          container_id: containerId,
          type: formData.type,
          location: formData.location || null,
        },
        containerId: inserted.id,
      });

      setCreatedContainer({
        id: containerId,
        uuid: inserted.id,
        type: containerTypes[formData.type as keyof typeof containerTypes]?.label || formData.type,
      });

      queryClient.invalidateQueries({ queryKey: ["containers"] });

      toast({
        title: "Container erstellt",
        description: `${containerId} wurde erfolgreich erstellt.`,
      });
    } catch (error: any) {
      console.error("Container creation error:", error);
      toast({
        title: "Fehler beim Erstellen",
        description: error.message || "Container konnte nicht erstellt werden. Bitte überprüfen Sie Ihre Berechtigungen.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadLabel = async () => {
    if (!createdContainer) return;

    setIsGenerating(true);
    try {
      const qrUrl = buildContainerQRUrl(createdContainer.id);
      const pdfBlob = await generateLabelPDF(
        {
          id: createdContainer.id,
          type: createdContainer.type,
          location: formData.location || "Nicht zugewiesen",
          date: new Date().toLocaleDateString("de-DE"),
        },
        qrUrl
      );

      downloadPDF(pdfBlob, `Etikett_${createdContainer.id}.pdf`);

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
    setFormData({ type: "", weight: "", location: "" });
    setCreatedContainer(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {createdContainer ? "Container erstellt" : "Neuen Container erstellen"}
          </DialogTitle>
          <DialogDescription>
            {createdContainer
              ? "Der Container wurde erstellt. Sie können jetzt das Etikett herunterladen."
              : "Erstellen Sie einen neuen Container, BigBag oder Gitterbox mit automatischer QR-Code-Generierung."}
          </DialogDescription>
        </DialogHeader>

        {!createdContainer ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Container-Typ</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Typ wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="bigbag">BigBag</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="cage">Gitterbox</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Gewicht (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  placeholder="z.B. 500"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Standort</Label>
              <Input
                id="location"
                placeholder="z.B. Halle A, Regal 12"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
              <Button type="submit" disabled={!formData.type || isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Container erstellen
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-6 rounded-lg bg-success/10 border border-success/20 text-center">
              <div className="p-3 rounded-full bg-success/20 w-fit mx-auto mb-3">
                <QrCode className="h-8 w-8 text-success" />
              </div>
              <p className="font-mono text-xl font-bold text-foreground">{createdContainer.id}</p>
              <p className="text-sm text-muted-foreground mt-1">{createdContainer.type}</p>
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
