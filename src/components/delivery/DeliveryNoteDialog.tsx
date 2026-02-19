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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
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
import { supabase } from "@/integrations/supabase/client";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface DeliveryNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MaterialInput {
  id: string;
  input_id: string;
  material_type: string;
  weight_kg: number;
  supplier: string;
}

interface OutputMaterial {
  id: string;
  output_id: string;
  output_type: string;
  weight_kg: number;
  destination: string | null;
}

export function DeliveryNoteDialog({ open, onOpenChange }: DeliveryNoteDialogProps) {
  const [formData, setFormData] = useState({
    type: "incoming" as "incoming" | "outgoing",
    partner: "",
    material: "",
    weight: "",
    wasteCode: "",
    linkedId: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [materialInputs, setMaterialInputs] = useState<MaterialInput[]>([]);
  const [outputMaterials, setOutputMaterials] = useState<OutputMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { logEvent } = useMaterialFlowHistory();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formData.type]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (formData.type === 'incoming') {
        const { data, error } = await supabase
          .from('material_inputs')
          .select('id, input_id, material_type, weight_kg, supplier')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setMaterialInputs(data || []);
      } else {
        const { data, error } = await supabase
          .from('output_materials')
          .select('id, output_id, output_type, weight_kg, destination')
          .eq('status', 'in_stock')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setOutputMaterials(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkedItemChange = (id: string) => {
    setFormData(prev => ({ ...prev, linkedId: id }));
    
    if (formData.type === 'incoming') {
      const item = materialInputs.find(m => m.id === id);
      if (item) {
        setFormData(prev => ({
          ...prev,
          linkedId: id,
          partner: item.supplier,
          material: item.material_type,
          weight: item.weight_kg.toString(),
        }));
      }
    } else {
      const item = outputMaterials.find(m => m.id === id);
      if (item) {
        setFormData(prev => ({
          ...prev,
          linkedId: id,
          partner: item.destination || '',
          material: item.output_type,
          weight: item.weight_kg.toString(),
        }));
      }
    }
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.partner.trim()) {
      errors.push(formData.type === "incoming" ? "Lieferant ist erforderlich" : "Kunde ist erforderlich");
    }
    
    if (!formData.material) {
      errors.push("Material ist erforderlich");
    }
    
    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      errors.push("Gültiges Gewicht (> 0 kg) ist erforderlich");
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({
        title: "Fehlende Angaben",
        description: validationErrors.join(". "),
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    try {
      // Generate note ID using database function
      const { data: noteIdData, error: idError } = await supabase
        .rpc('generate_unique_id', { prefix: 'LS' });
      
      if (idError) {
        console.error('ID generation error:', idError);
        throw new Error("Lieferschein-ID konnte nicht generiert werden. Bitte versuchen Sie es erneut.");
      }
      
      if (!noteIdData) {
        throw new Error("Lieferschein-ID wurde nicht erstellt.");
      }
      
      const noteId = noteIdData;
      const qrUrl = buildDeliveryNoteQRUrl(noteId);
      
      // Generate PDF
      let pdfBlob: Blob;
      try {
        pdfBlob = await generateDeliveryNotePDF(
          {
            noteId,
            type: formData.type,
            date: new Date().toLocaleDateString("de-DE"),
            partner: formData.partner.trim(),
            material: formData.material,
            weight: `${formData.weight} kg`,
            wasteCode: formData.wasteCode || undefined,
          },
          qrUrl
        );
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        throw new Error("PDF konnte nicht erstellt werden. Bitte prüfen Sie Ihre Eingaben.");
      }
      
      // Upload PDF to storage
      const fileName = `${noteId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`delivery-notes/${fileName}`, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        // Continue anyway - PDF will still be downloaded
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(`delivery-notes/${fileName}`);

      // Save to database
      const { data: savedNote, error: dbError } = await supabase
        .from('delivery_notes')
        .insert({
          note_id: noteId,
          type: formData.type,
          partner_name: formData.partner.trim(),
          material_description: formData.material,
          weight_kg: parseFloat(formData.weight),
          waste_code: formData.wasteCode || null,
          qr_code: qrUrl,
          pdf_url: urlData?.publicUrl || null,
          material_input_id: formData.type === 'incoming' && formData.linkedId ? formData.linkedId : null,
          output_material_id: formData.type === 'outgoing' && formData.linkedId ? formData.linkedId : null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        if (dbError.code === '42501') {
          throw new Error("Keine Berechtigung zum Erstellen von Lieferscheinen. Bitte kontaktieren Sie den Administrator.");
        }
        throw new Error("Lieferschein konnte nicht in der Datenbank gespeichert werden.");
      }

      // Log event (non-blocking)
      logEvent({
        eventType: 'delivery_note_created',
        eventDescription: `Lieferschein ${noteId} erstellt (${formData.type === 'incoming' ? 'Eingang' : 'Ausgang'})`,
        eventDetails: {
          note_id: noteId,
          type: formData.type,
          partner: formData.partner,
          material: formData.material,
          weight_kg: parseFloat(formData.weight),
        },
        materialInputId: formData.type === 'incoming' && formData.linkedId ? formData.linkedId : undefined,
        outputMaterialId: formData.type === 'outgoing' && formData.linkedId ? formData.linkedId : undefined,
        deliveryNoteId: savedNote?.id,
      }).catch(console.error);

      // Update output material status if outgoing
      if (formData.type === 'outgoing' && formData.linkedId) {
        await supabase
          .from('output_materials')
          .update({ status: 'shipped' })
          .eq('id', formData.linkedId);
      }
      
      // Download PDF
      downloadPDF(pdfBlob, `Lieferschein_${noteId}.pdf`);
      
      toast({
        title: "Lieferschein erstellt",
        description: `${noteId} wurde gespeichert und als PDF heruntergeladen.`,
      });

      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['output-materials'] });
      
      setFormData({
        type: "incoming",
        partner: "",
        material: "",
        weight: "",
        wasteCode: "",
        linkedId: "",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating delivery note:", error);
      const message = error instanceof Error ? error.message : "Der Lieferschein konnte nicht erstellt werden.";
      toast({
        title: "Fehler bei der Erstellung",
        description: message,
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
              onValueChange={(value) => setFormData({ 
                ...formData, 
                type: value as "incoming" | "outgoing",
                linkedId: "",
                partner: "",
                material: "",
                weight: "",
              })}
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
            <Label>{formData.type === 'incoming' ? 'Materialeingang verknüpfen' : 'Ausgangsmaterial verknüpfen'}</Label>
            <Combobox
              options={formData.type === 'incoming' 
                ? materialInputs.map((item) => ({
                    value: item.id,
                    label: `${item.input_id} - ${item.material_type}`,
                    description: `${item.weight_kg} kg von ${item.supplier}`,
                  }))
                : outputMaterials.map((item) => ({
                    value: item.id,
                    label: `${item.output_id} - ${item.output_type}`,
                    description: `${item.weight_kg} kg`,
                  }))
              }
              value={formData.linkedId}
              onValueChange={handleLinkedItemChange}
              placeholder="Optional: Verknüpfung wählen..."
              searchPlaceholder="Suchen..."
              emptyText={formData.type === 'incoming' ? "Keine Materialeingänge verfügbar" : "Kein Ausgangsmaterial verfügbar"}
              isLoading={isLoading}
              disabled={isLoading}
            />
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
              Nach dem Erstellen wird der Lieferschein als PDF mit QR-Code generiert und in der Datenbank gespeichert.
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
