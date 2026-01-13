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
import { FlaskConical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";
import { useUserRole } from "@/hooks/useUserRole";

interface SampleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SampleDialog({ open, onOpenChange }: SampleDialogProps) {
  const [formData, setFormData] = useState({
    materialInput: "",
    processingStep: "",
    sampler: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { logEvent } = useMaterialFlowHistory();
  const { role, isLoading: isRoleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const { data: materialInputs = [] } = useQuery({
    queryKey: ["material-inputs-for-sampling"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_inputs")
        .select("id, input_id, material_type")
        .in("status", ["received", "in_processing", "processed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: processingSteps = [] } = useQuery({
    queryKey: ["processing-steps-for-sampling"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processing_steps")
        .select("id, processing_id, step_type, material_input_id, status")
        .in("status", ["running", "paused", "pending", "sample_required", "completed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

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

    const canCreateSample = role === 'admin' || role === 'production' || role === 'qa';
    if (!canCreateSample) {
      toast({
        title: "Keine Berechtigung",
        description: "Sie haben keine Berechtigung, Proben zu erstellen.",
        variant: "destructive",
      });
      return;
    }

    const samplerName = formData.sampler.trim();
    if (!samplerName) {
      toast({
        title: "Fehler",
        description: "Probenehmer darf nicht leer sein.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: idData, error: idError } = await supabase.rpc("generate_unique_id", { prefix: "PRB" });
      if (idError) {
        console.error('Error generating sample id:', idError);
        throw new Error("Proben-ID konnte nicht generiert werden.");
      }

      const sampleId = idData as string;

      const { data: insertedData, error } = await supabase
        .from("samples")
        .insert({
          sample_id: sampleId,
          sampler_name: samplerName,
          material_input_id: formData.materialInput || null,
          processing_step_id: formData.processingStep || null,
          status: "pending",
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Error creating sample:', error);
        const msg = (error as any).message?.toLowerCase?.() || '';
        if (msg.includes('row level security')) {
          throw new Error('Keine Berechtigung: Probe darf nicht erstellt werden.');
        }
        if ((error as any).code === '23505') {
          throw new Error('Proben-ID ist bereits vergeben. Bitte erneut versuchen.');
        }
        throw new Error((error as any).message || 'Probe konnte nicht erstellt werden.');
      }

      // Log event (non-critical)
      try {
        await logEvent({
          eventType: 'sample_created',
          eventDescription: `Probe ${sampleId} von ${samplerName} erstellt`,
          eventDetails: {
            sample_id: sampleId,
            sampler_name: samplerName,
          },
          materialInputId: formData.materialInput || undefined,
          processingStepId: formData.processingStep || undefined,
          sampleId: insertedData?.id,
        });
      } catch (logError) {
        console.warn('Could not log sample_created event:', logError);
      }

      toast({
        title: "Probe erstellt",
        description: `${sampleId} wurde erfolgreich erstellt.`,
      });

      queryClient.invalidateQueries({ queryKey: ['samples'] });
      setFormData({ materialInput: "", processingStep: "", sampler: "" });
      onOpenChange(false);
    } catch (error: any) {
      console.error('SampleDialog submit failed:', error);
      toast({
        title: "Fehler",
        description: error.message || "Probe konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTypeLabels: Record<string, string> = {
    shredding: "Schreddern",
    sorting: "Sortieren",
    milling: "Mahlen",
    separation: "Faser/Harz-Trennung",
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
            <Label>Materialeingang (optional)</Label>
            <Select
              value={formData.materialInput}
              onValueChange={(value) => setFormData({ ...formData, materialInput: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Materialeingang wählen" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {materialInputs.map((mi) => (
                  <SelectItem key={mi.id} value={mi.id}>
                    {mi.input_id} - {mi.material_type}
                  </SelectItem>
                ))}
                {materialInputs.length === 0 && (
                  <SelectItem value="none" disabled>Keine Materialeingänge verfügbar</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Verarbeitungsschritt (optional)</Label>
            <Select
              value={formData.processingStep}
              onValueChange={(value) => setFormData({ ...formData, processingStep: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Prozessschritt wählen" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {processingSteps.map((ps) => (
                  <SelectItem key={ps.id} value={ps.id}>
                    {ps.processing_id} - {stepTypeLabels[ps.step_type] || ps.step_type}
                  </SelectItem>
                ))}
                {processingSteps.length === 0 && (
                  <SelectItem value="none" disabled>Keine Verarbeitungsschritte verfügbar</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Probenehmer *</Label>
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
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                isRoleLoading ||
                !(role === 'admin' || role === 'production' || role === 'qa')
              }
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Probe erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
