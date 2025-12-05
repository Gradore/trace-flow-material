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
  const [formData, setFormData] = useState({
    type: "",
    volume: "",
    location: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdContainer, setCreatedContainer] = useState<{
    id: string;
    type: string;
  } | null>(null);

  const generateContainerId = (type: string): string => {
    const prefix = containerTypes[type as keyof typeof containerTypes]?.prefix || "CT";
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
    return `${prefix}-${year}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const containerId = generateContainerId(formData.type);
    setCreatedContainer({
      id: containerId,
      type: containerTypes[formData.type as keyof typeof containerTypes]?.label || formData.type,
    });
    
    toast({
      title: "Container erstellt",
      description: `${containerId} wurde erfolgreich erstellt.`,
    });
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
    setFormData({ type: "", volume: "", location: "" });
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
                  <SelectContent>
                    <SelectItem value="bigbag">BigBag</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="cage">Gitterbox</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="volume">Volumen (Liter)</Label>
                <Input
                  id="volume"
                  type="number"
                  placeholder="z.B. 1000"
                  value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
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
              <Button type="submit" disabled={!formData.type}>
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
