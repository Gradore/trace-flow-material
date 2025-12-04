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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface ProcessingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const processSteps = [
  { id: "shredding", label: "Schreddern" },
  { id: "sorting", label: "Sortieren" },
  { id: "milling", label: "Mahlen" },
  { id: "separation", label: "Faser/Harz-Trennung" },
];

export function ProcessingDialog({ open, onOpenChange }: ProcessingDialogProps) {
  const [formData, setFormData] = useState({
    intake: "",
    steps: [] as string[],
  });

  const handleStepToggle = (stepId: string) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.includes(stepId)
        ? prev.steps.filter((s) => s !== stepId)
        : [...prev.steps, stepId],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Verarbeitung gestartet:", formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Neue Verarbeitung starten
          </DialogTitle>
          <DialogDescription>
            Wählen Sie den Materialeingang und die gewünschten Verarbeitungsschritte.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Materialeingang auswählen</Label>
            <Select
              value={formData.intake}
              onValueChange={(value) => setFormData({ ...formData, intake: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Eingang wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ME-2024-0089">ME-2024-0089 - GFK-UP (2500 kg)</SelectItem>
                <SelectItem value="ME-2024-0088">ME-2024-0088 - PP (1800 kg)</SelectItem>
                <SelectItem value="ME-2024-0087">ME-2024-0087 - GFK-EP (3200 kg)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Verarbeitungsschritte</Label>
            <div className="space-y-2">
              {processSteps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <Checkbox
                    id={step.id}
                    checked={formData.steps.includes(step.id)}
                    onCheckedChange={() => handleStepToggle(step.id)}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <label htmlFor={step.id} className="text-sm font-medium cursor-pointer">
                      {step.label}
                    </label>
                  </div>
                  {index < processSteps.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-info/10 border border-info/20">
            <p className="text-sm text-info">
              <strong>Hinweis:</strong> Für jeden Prozessschritt wird eine Probenahme empfohlen. 
              Chargen können ohne genehmigte Probe nicht freigegeben werden.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!formData.intake || formData.steps.length === 0}>
              Verarbeitung starten
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
