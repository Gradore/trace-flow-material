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
import { FlaskConical, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";

interface SampleResultsInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sample: {
    id: string;
    sampleId: string;
    materialInputId?: string;
  } | null;
}

interface ResultRow {
  id: string;
  parameterName: string;
  parameterValue: string;
  unit: string;
}

const commonParameters = [
  { name: "Faserlänge", unit: "mm" },
  { name: "Reinheit", unit: "%" },
  { name: "Harzanteil", unit: "%" },
  { name: "MFI", unit: "g/10min" },
  { name: "Viskosität", unit: "Pa·s" },
  { name: "Dichte", unit: "g/cm³" },
  { name: "Feuchtigkeit", unit: "%" },
  { name: "Siebfraktion", unit: "mm" },
];

export function SampleResultsInputDialog({ 
  open, 
  onOpenChange, 
  sample 
}: SampleResultsInputDialogProps) {
  const queryClient = useQueryClient();
  const { logEvent } = useMaterialFlowHistory();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([
    { id: "1", parameterName: "", parameterValue: "", unit: "" },
  ]);

  if (!sample) return null;

  const addRow = () => {
    setResults([
      ...results,
      { id: Date.now().toString(), parameterName: "", parameterValue: "", unit: "" },
    ]);
  };

  const removeRow = (id: string) => {
    if (results.length > 1) {
      setResults(results.filter((r) => r.id !== id));
    }
  };

  const updateRow = (id: string, field: keyof ResultRow, value: string) => {
    setResults(
      results.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const selectCommonParameter = (rowId: string, paramIndex: number) => {
    const param = commonParameters[paramIndex];
    setResults(
      results.map((r) =>
        r.id === rowId ? { ...r, parameterName: param.name, unit: param.unit } : r
      )
    );
  };

  const handleSubmit = async () => {
    // Filter out empty rows
    const validResults = results.filter(
      (r) => r.parameterName.trim() && r.parameterValue.trim()
    );

    if (validResults.length === 0) {
      toast({
        title: "Keine Ergebnisse",
        description: "Bitte mindestens einen Parameter eingeben.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Insert sample results
      const resultsToInsert = validResults.map((r) => ({
        sample_id: sample.id,
        parameter_name: r.parameterName.trim(),
        parameter_value: r.parameterValue.trim(),
        unit: r.unit.trim() || null,
      }));

      const { error: resultsError } = await supabase
        .from("sample_results")
        .insert(resultsToInsert);

      if (resultsError) throw resultsError;

      // Update sample status to "in_analysis"
      const { error: updateError } = await supabase
        .from("samples")
        .update({ 
          status: "in_analysis",
          analyzed_at: new Date().toISOString(),
        })
        .eq("id", sample.id);

      if (updateError) throw updateError;

      // Log event
      await logEvent({
        eventType: "sample_analyzed",
        eventDescription: `Laborergebnisse für Probe ${sample.sampleId} erfasst (${validResults.length} Parameter)`,
        eventDetails: {
          sample_id: sample.sampleId,
          parameters: validResults.map((r) => r.parameterName),
          count: validResults.length,
        },
        sampleId: sample.id,
        materialInputId: sample.materialInputId,
      });

      queryClient.invalidateQueries({ queryKey: ["samples"] });
      queryClient.invalidateQueries({ queryKey: ["sample-results", sample.id] });

      toast({
        title: "Ergebnisse gespeichert",
        description: `${validResults.length} Laborergebnisse wurden erfasst.`,
      });

      // Reset and close
      setResults([{ id: "1", parameterName: "", parameterValue: "", unit: "" }]);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Ergebnisse konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Laborergebnisse erfassen
          </DialogTitle>
          <DialogDescription>
            Probe: {sample.sampleId} — Geben Sie die Analyseergebnisse ein.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick select buttons */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Schnellauswahl Parameter:</Label>
            <div className="flex flex-wrap gap-2">
              {commonParameters.map((param, idx) => (
                <Button
                  key={param.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    // Add to first empty row or create new
                    const emptyRow = results.find((r) => !r.parameterName);
                    if (emptyRow) {
                      selectCommonParameter(emptyRow.id, idx);
                    } else {
                      const newId = Date.now().toString();
                      setResults([
                        ...results,
                        { id: newId, parameterName: param.name, parameterValue: "", unit: param.unit },
                      ]);
                    }
                  }}
                >
                  {param.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Results table */}
          <div className="space-y-3">
            {results.map((row, index) => (
              <div key={row.id} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Parameter</Label>
                  <Input
                    placeholder="z.B. Faserlänge"
                    value={row.parameterName}
                    onChange={(e) => updateRow(row.id, "parameterName", e.target.value)}
                  />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">Wert</Label>
                  <Input
                    placeholder="z.B. 12.5"
                    value={row.parameterValue}
                    onChange={(e) => updateRow(row.id, "parameterValue", e.target.value)}
                  />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Einheit</Label>
                  <Input
                    placeholder="mm"
                    value={row.unit}
                    onChange={(e) => updateRow(row.id, "unit", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  disabled={results.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Weitere Zeile hinzufügen
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Ergebnisse speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
