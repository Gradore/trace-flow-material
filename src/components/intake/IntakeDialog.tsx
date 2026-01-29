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
import { Inbox, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMaterialFlowHistory } from "@/hooks/useMaterialFlowHistory";

interface IntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntakeDialog({ open, onOpenChange }: IntakeDialogProps) {
  const [formData, setFormData] = useState({
    supplier: "",
    materialType: "",
    resinType: "",
    weight: "",
    wasteCode: "",
    container: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { logEvent } = useMaterialFlowHistory();
  const queryClient = useQueryClient();

  const { data: containers = [] } = useQuery({
    queryKey: ["containers-empty"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("containers")
        .select("id, container_id")
        .in("status", ["empty", "filling"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier || !formData.materialType || !formData.weight) {
      toast({ title: "Fehler", description: "Bitte alle Pflichtfelder ausfüllen.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate unique ID
      const { data: idData, error: idError } = await supabase.rpc("generate_unique_id", { prefix: "ME" });
      if (idError) throw idError;

      const inputId = idData as string;
      
      // Use base material type for DB constraint (gfk, pp, pa)
      // Subtype is stored separately in material_subtype
      const materialType = formData.materialType;

      const { data: insertedData, error } = await supabase.from("material_inputs").insert({
        input_id: inputId,
        supplier: formData.supplier,
        material_type: materialType,
        material_subtype: formData.resinType || null,
        weight_kg: parseFloat(formData.weight),
        waste_code: formData.wasteCode || null,
        container_id: formData.container && formData.container !== "new" ? formData.container : null,
        status: "received",
      }).select().single();

      if (error) throw error;

      // Update container status if assigned
      if (formData.container && formData.container !== "new") {
        await supabase
          .from("containers")
          .update({ status: "filling" })
          .eq("id", formData.container);
      }

      // Log event
      await logEvent({
        eventType: 'intake_received',
        eventDescription: `Materialeingang ${inputId} von ${formData.supplier} erfasst`,
        eventDetails: {
          input_id: inputId,
          supplier: formData.supplier,
          material_type: materialType,
          weight_kg: parseFloat(formData.weight),
          waste_code: formData.wasteCode || null,
        },
        materialInputId: insertedData?.id,
        containerId: formData.container && formData.container !== "new" ? formData.container : undefined,
      });

      toast({
        title: "Materialeingang erfasst",
        description: `${inputId} wurde erfolgreich erstellt.`,
      });

      queryClient.invalidateQueries({ queryKey: ['material-inputs'] });
      setFormData({ supplier: "", materialType: "", resinType: "", weight: "", wasteCode: "", container: "" });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Eingang konnte nicht erstellt werden.",
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
            <Inbox className="h-5 w-5 text-primary" />
            Neuen Materialeingang erfassen
          </DialogTitle>
          <DialogDescription>
            Erfassen Sie eingehendes Material mit allen relevanten Daten.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basisdaten</TabsTrigger>
            <TabsTrigger value="material">Material</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Lieferant *</Label>
              <Input
                id="supplier"
                placeholder="z.B. Recycling GmbH"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Gewicht (kg) *</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="z.B. 2500"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wasteCode">Abfallschlüssel</Label>
                <Input
                  id="wasteCode"
                  placeholder="z.B. 07 02 13"
                  value={formData.wasteCode}
                  onChange={(e) => setFormData({ ...formData, wasteCode: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="container">Container zuweisen</Label>
              <Select
                value={formData.container}
                onValueChange={(value) => setFormData({ ...formData, container: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Container wählen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {containers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.container_id}
                    </SelectItem>
                  ))}
                  {containers.length === 0 && (
                    <SelectItem value="none" disabled>Keine Container verfügbar</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="material" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Materialart *</Label>
              <Select
                value={formData.materialType}
                onValueChange={(value) => setFormData({ ...formData, materialType: value, resinType: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Materialart wählen" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="gfk">GFK (Glasfaserverstärkter Kunststoff)</SelectItem>
                  <SelectItem value="pp">Polypropylen (PP)</SelectItem>
                  <SelectItem value="pa">Polyamid (PA)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.materialType === "gfk" && (
              <div className="space-y-2">
                <Label>Harztyp</Label>
                <Select
                  value={formData.resinType}
                  onValueChange={(value) => setFormData({ ...formData, resinType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Harztyp wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="up">UP (Ungesättigter Polyester)</SelectItem>
                    <SelectItem value="ep">EP (Epoxid)</SelectItem>
                    <SelectItem value="ve">VE (Vinylester)</SelectItem>
                    <SelectItem value="pu">PU (Polyurethan)</SelectItem>
                    <SelectItem value="pet">PET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.materialType === "pa" && (
              <div className="space-y-2">
                <Label>PA-Typ</Label>
                <Select
                  value={formData.resinType}
                  onValueChange={(value) => setFormData({ ...formData, resinType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="PA-Typ wählen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="pa6">PA6</SelectItem>
                    <SelectItem value="pa66">PA66</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Eingang erfassen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
