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
import { FlaskConical } from "lucide-react";

interface SampleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SampleDialog({ open, onOpenChange }: SampleDialogProps) {
  const [formData, setFormData] = useState({
    batch: "",
    processStep: "",
    sampler: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Probe erstellt:", formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Neue Probe erstellen
          </DialogTitle>
          <DialogDescription>
            Erfassen Sie eine neue Probe für die Laboranalyse.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Charge / Verarbeitung</Label>
            <Select
              value={formData.batch}
              onValueChange={(value) => setFormData({ ...formData, batch: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Charge wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VRB-2024-0045">VRB-2024-0045 - GFK-UP (Schreddern)</SelectItem>
                <SelectItem value="VRB-2024-0044">VRB-2024-0044 - PP (Mahlen)</SelectItem>
                <SelectItem value="VRB-2024-0043">VRB-2024-0043 - GFK-EP (Trennung)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prozessschritt</Label>
            <Select
              value={formData.processStep}
              onValueChange={(value) => setFormData({ ...formData, processStep: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Prozessschritt wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shredding">Schreddern</SelectItem>
                <SelectItem value="sorting">Sortieren</SelectItem>
                <SelectItem value="milling">Mahlen</SelectItem>
                <SelectItem value="separation">Faser/Harz-Trennung</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Probenehmer</Label>
            <Input
              placeholder="Name des Probenehmers"
              value={formData.sampler}
              onChange={(e) => setFormData({ ...formData, sampler: e.target.value })}
            />
          </div>

          <div className="p-4 rounded-lg bg-secondary/30 border border-border">
            <p className="text-sm text-muted-foreground">
              <strong>Proben-ID:</strong> Wird automatisch generiert
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <strong>Datum/Zeit:</strong> {new Date().toLocaleString("de-DE")}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit">
              Probe erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
