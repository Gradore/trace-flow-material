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
import { FileText, Download } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface DeliveryNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeliveryNoteDialog({ open, onOpenChange }: DeliveryNoteDialogProps) {
  const [formData, setFormData] = useState({
    type: "incoming",
    partner: "",
    material: "",
    weight: "",
    wasteCode: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Lieferschein erstellt:", formData);
    onOpenChange(false);
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
              onValueChange={(value) => setFormData({ ...formData, type: value })}
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
            />
          </div>

          <div className="space-y-2">
            <Label>Material / Charge</Label>
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
                    <SelectItem value="ME-2024-0089">ME-2024-0089 - GFK-UP</SelectItem>
                    <SelectItem value="ME-2024-0088">ME-2024-0088 - PP</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="OUT-2024-0089">OUT-2024-0089 - Glasfasern</SelectItem>
                    <SelectItem value="OUT-2024-0087">OUT-2024-0087 - PP Regranulat</SelectItem>
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
              Nach dem Erstellen wird der Lieferschein als PDF generiert und kann 
              heruntergeladen oder per E-Mail versendet werden.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit">
              <Download className="h-4 w-4" />
              PDF erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
