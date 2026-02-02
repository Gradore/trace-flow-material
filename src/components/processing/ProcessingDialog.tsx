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
import { useUserRole } from "@/hooks/useUserRole";
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
  status?: string;
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
  const { role, isLoading: isRoleLoading } = useUserRole();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      fetchMaterialInputs();
    }
  }, [open]);

  const fetchMaterialInputs = async () => {
    setIsLoading(true);
    try {
      // Fetch materials that are either received OR in_processing (for re-processing)
      // Exclude rejected materials
      const { data, error } = await supabase
        .from('material_inputs')
        .select('id, input_id, material_type, material_subtype, weight_kg, supplier, status')
        .in('status', ['received', 'in_processing', 'processed'])
        .neq('status', 'rejected')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMaterialInputs((data as any) || []);
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

    if (isRoleLoading) {
      toast({
        title: "Bitte warten",
        description: "Berechtigungen werden noch geladen.",
        variant: "destructive",
      });
      return;
    }

    const canStartProcessing = role === 'admin' || role === 'production' || role === 'betriebsleiter';
    if (!canStartProcessing) {
      toast({
        title: "Keine Berechtigung",
        description: "Sie haben keine Berechtigung, eine Verarbeitung zu starten.",
        variant: "destructive",
      });
      return;
    }

    // Validate input before submission
    if (!formData.intake) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Materialeingang aus.",
        variant: "destructive",
      });
      return;
    }

    if (formData.steps.length === 0) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie mindestens einen Verarbeitungsschritt aus.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate processing ID
      const { data: processingIdData, error: idError } = await supabase
        .rpc('generate_unique_id', { prefix: 'VRB' });
      
      if (idError) {
        console.error('Error generating processing ID:', idError);
        throw new Error('Verarbeitungs-ID konnte nicht generiert werden.');
      }

      const processingId = processingIdData;

      // Check for ACTIVE processing steps (not completed ones - allow re-processing)
      const { data: existingSteps, error: existingError } = await supabase
        .from('processing_steps')
        .select('id, status')
        .eq('material_input_id', formData.intake)
        .in('status', ['running', 'paused', 'pending', 'sample_required']);

      if (existingError) {
        console.warn('Could not check existing processing steps:', existingError);
      }

      // Only block if there are ACTIVE processing steps
      if (existingSteps && existingSteps.length > 0) {
        throw new Error('Dieser Materialeingang hat bereits aktive Verarbeitungsschritte. Bitte schließen Sie diese zuerst ab.');
      }

      // Create processing steps
      const stepsToInsert = formData.steps.map((stepId, index) => ({
        processing_id: processingId,
        material_input_id: formData.intake,
        step_type: stepId,
        step_order: index + 1,
        status: index === 0 ? 'running' : 'pending',
        started_at: index === 0 ? new Date().toISOString() : null,
      }));

      const { data: insertedSteps, error: stepsError } = await supabase
        .from('processing_steps')
        .insert(stepsToInsert)
        .select();

      if (stepsError) {
        console.error('Error inserting processing steps:', stepsError);
        // Most common: RLS permissions
        if ((stepsError as any).message?.toLowerCase?.().includes('row level security')) {
          throw new Error('Keine Berechtigung: Verarbeitungsschritte dürfen nicht erstellt werden.');
        }
        throw new Error(`Verarbeitungsschritte konnten nicht erstellt werden: ${stepsError.message}`);
      }

      // Update material input status
      const { error: updateError } = await supabase
        .from('material_inputs')
        .update({ status: 'in_processing' })
        .eq('id', formData.intake);

      if (updateError) {
        console.error('Error updating material input status:', updateError);
        // Don't throw here - the processing steps were created successfully
        console.warn('Material input status could not be updated, but processing was created');
      }

      // Log event (non-critical - don't fail if this fails)
      const selectedInput = materialInputs.find(m => m.id === formData.intake);
      try {
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
      } catch (logError) {
        // Non-critical - just log warning
        console.warn('Could not log event to material flow history:', logError);
      }

      toast({
        title: "Verarbeitung gestartet",
        description: `${processingId} wurde erfolgreich erstellt.`,
      });

      queryClient.invalidateQueries({ queryKey: ['processing-steps'] });
      queryClient.invalidateQueries({ queryKey: ['material-inputs'] });
      
      setFormData({ intake: "", steps: [] });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating processing:', error);
      toast({
        title: "Fehler beim Starten",
        description: error.message || "Die Verarbeitung konnte nicht gestartet werden. Bitte überprüfen Sie Ihre Berechtigungen.",
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
            <Button
              type="submit"
              disabled={
                isRoleLoading ||
                !(role === 'admin' || role === 'production' || role === 'betriebsleiter') ||
                !formData.intake ||
                formData.steps.length === 0 ||
                isSubmitting
              }
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Verarbeitung starten
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
