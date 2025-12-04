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
import { Package, QrCode } from "lucide-react";

interface ContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContainerDialog({ open, onOpenChange }: ContainerDialogProps) {
  const [formData, setFormData] = useState({
    type: "",
    volume: "",
    location: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save container
    console.log("Container erstellt:", formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Neuen Container erstellen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie einen neuen Container, BigBag oder Gitterbox mit automatischer QR-Code-Generierung.
          </DialogDescription>
        </DialogHeader>

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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit">
              Container erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
