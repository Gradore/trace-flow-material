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
import { FileText, Download, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generateDeliveryNotePDF, downloadPDF } from "@/lib/pdf";
import { buildDeliveryNoteQRUrl } from "@/lib/qrcode";
import { toast } from "@/hooks/use-toast";

interface DeliveryNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeliveryNoteDialog({ open, onOpenChange }: DeliveryNoteDialogProps) {
  const [formData, setFormData] = useState({
    type: "incoming" as "incoming" | "outgoing",
    partner: "",
    material: "",
    weight: "",
    wasteCode: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const generateNoteId = (): string => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
    return `LS-${year}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsGenerating(true);
    try {
      const noteId = generateNoteId();
      const qrUrl = buildDeliveryNoteQRUrl(noteId);
      
      const pdfBlob = await generateDeliveryNotePDF(
        {
          noteId,
          type: formData.type,
          date: new Date().toLocaleDateString("de-DE"),
          partner: formData.partner,
          material: formData.material,
          weight: `${formData.weight} kg`,
          wasteCode: formData.wasteCode || undefined,
        },
        qrUrl
      );
      
      downloadPDF(pdfBlob, `Lieferschein_${noteId}.pdf`);
      
      toast({
        title: "Lieferschein erstellt",
        description: `${noteId} wurde als PDF heruntergeladen.`,
      });
      
      setFormData({
        type: "incoming",
        partner: "",
        material: "",
        weight: "",
        wasteCode: "",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating delivery note:", error);
      toast({
        title: "Fehler",
        description: "Der Lieferschein konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Neuen Lieferschein erstellen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie einen Eingangs- oder Ausgangslieferschein als PDF.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Lieferschein-Typ</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as "incoming" | "outgoing" })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="incoming" id="incoming" />
                <Label htmlFor="incoming" className="cursor-pointer">Eingang</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="outgoing" id="outgoing" />
                <Label htmlFor="outgoing" className="cursor-pointer">Ausgang</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>{formData.type === "incoming" ? "Lieferant" : "Kunde"}</Label>
            <Input
              placeholder={formData.type === "incoming" ? "z.B. Recycling GmbH" : "z.B. FiberTech AG"}
              value={formData.partner}
              onChange={(e) => setFormData({ ...formData, partner: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Material</Label>
            <Select
              value={formData.material}
              onValueChange={(value) => setFormData({ ...formData, material: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Material wählen" />
              </SelectTrigger>
              <SelectContent>
                {formData.type === "incoming" ? (
                  <>
                    <SelectItem value="GFK-UP">GFK-UP</SelectItem>
                    <SelectItem value="GFK-EP">GFK-EP</SelectItem>
                    <SelectItem value="GFK-VE">GFK-VE</SelectItem>
                    <SelectItem value="Polypropylen (PP)">Polypropylen (PP)</SelectItem>
                    <SelectItem value="Polyamid (PA6)">Polyamid (PA6)</SelectItem>
                    <SelectItem value="Polyamid (PA66)">Polyamid (PA66)</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="Recycelte Glasfasern">Recycelte Glasfasern</SelectItem>
                    <SelectItem value="Harzpulver">Harzpulver</SelectItem>
                    <SelectItem value="PP Regranulat">PP Regranulat</SelectItem>
                    <SelectItem value="PA Regranulat">PA Regranulat</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gewicht (kg)</Label>
              <Input
                type="number"
                placeholder="z.B. 2500"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Abfallschlüssel</Label>
              <Input
                placeholder="z.B. 07 02 13"
                value={formData.wasteCode}
                onChange={(e) => setFormData({ ...formData, wasteCode: e.target.value })}
              />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-info/10 border border-info/20">
            <p className="text-sm text-info">
              Nach dem Erstellen wird der Lieferschein als PDF mit QR-Code generiert.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isGenerating || !formData.partner || !formData.material || !formData.weight}>
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
