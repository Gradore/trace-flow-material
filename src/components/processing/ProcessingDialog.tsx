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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, ArrowRight, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";
import { useQueryClient } from "@tanstack/react-query";

interface ProcessingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MaterialInput {
  id: string;
  input_id: string;
  material_type: string;
  material_subtype: string | null;
  weight_kg: number;
  supplier: string;
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
  const [materialInputs, setMaterialInputs] = useState<MaterialInput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { logEvent } = useMaterialFlowHistory();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      fetchMaterialInputs();
    }
  }, [open]);

  const fetchMaterialInputs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_inputs')
        .select('id, input_id, material_type, material_subtype, weight_kg, supplier')
        .in('status', ['received', 'in_processing'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMaterialInputs(data || []);
    } catch (error) {
      console.error('Error fetching material inputs:', error);
      toast({
        title: "Fehler",
        description: "Materialeingänge konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepToggle = (stepId: string) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.includes(stepId)
        ? prev.steps.filter((s) => s !== stepId)
        : [...prev.steps, stepId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Generate processing ID
      const { data: processingIdData, error: idError } = await supabase
        .rpc('generate_unique_id', { prefix: 'VRB' });
      
      if (idError) throw idError;

      const processingId = processingIdData;

      // Create processing steps
      const stepsToInsert = formData.steps.map((stepId, index) => ({
        processing_id: processingId,
        material_input_id: formData.intake,
        step_type: stepId,
        step_order: index + 1,
        status: index === 0 ? 'in_progress' : 'pending',
        started_at: index === 0 ? new Date().toISOString() : null,
      }));

      const { data: insertedSteps, error: stepsError } = await supabase
        .from('processing_steps')
        .insert(stepsToInsert)
        .select();

      if (stepsError) throw stepsError;

      // Update material input status
      await supabase
        .from('material_inputs')
        .update({ status: 'in_processing' })
        .eq('id', formData.intake);

      // Log event
      const selectedInput = materialInputs.find(m => m.id === formData.intake);
      await logEvent({
        eventType: 'processing_started',
        eventDescription: `Verarbeitung ${processingId} gestartet für ${selectedInput?.input_id}`,
        eventDetails: {
          processing_id: processingId,
          steps: formData.steps,
          step_labels: formData.steps.map(s => processSteps.find(ps => ps.id === s)?.label),
        },
        materialInputId: formData.intake,
        processingStepId: insertedSteps?.[0]?.id,
      });

      toast({
        title: "Verarbeitung gestartet",
        description: `${processingId} wurde erfolgreich erstellt.`,
      });

      queryClient.invalidateQueries({ queryKey: ['processing-steps'] });
      queryClient.invalidateQueries({ queryKey: ['material-inputs'] });
      
      setFormData({ intake: "", steps: [] });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating processing:', error);
      toast({
        title: "Fehler",
        description: "Die Verarbeitung konnte nicht gestartet werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Lädt..." : "Eingang wählen"} />
              </SelectTrigger>
              <SelectContent>
                {materialInputs.map((input) => (
                  <SelectItem key={input.id} value={input.id}>
                    {input.input_id} - {input.material_type}
                    {input.material_subtype ? `-${input.material_subtype}` : ''} ({input.weight_kg} kg)
                  </SelectItem>
                ))}
                {materialInputs.length === 0 && !isLoading && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Keine verfügbaren Materialeingänge
                  </div>
                )}
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
            <Button type="submit" disabled={!formData.intake || formData.steps.length === 0 || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Verarbeitung starten
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
