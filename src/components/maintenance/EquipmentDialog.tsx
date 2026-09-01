import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing equipment IDs, used to suggest the next free "EQ-xxx". */
  existingEquipmentIds: string[];
}

// Derives the next free EQ-number from the IDs already in use.
function suggestEquipmentId(existing: string[]): string {
  const numbers = existing
    .map((id) => /^EQ-(\d+)$/.exec(id.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => parseInt(match[1], 10));

  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `EQ-${String(next).padStart(3, "0")}`;
}

export function EquipmentDialog({
  open,
  onOpenChange,
  existingEquipmentIds,
}: EquipmentDialogProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    equipment_id: "",
    name: "",
    type: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    location: "",
    status: "active",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        equipment_id: suggestEquipmentId(existingEquipmentIds),
        name: "",
        type: "",
        manufacturer: "",
        model: "",
        serial_number: "",
        location: "",
        status: "active",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("equipment").insert({
        equipment_id: formData.equipment_id.trim(),
        name: formData.name.trim(),
        type: formData.type.trim(),
        manufacturer: formData.manufacturer.trim() || null,
        model: formData.model.trim() || null,
        serial_number: formData.serial_number.trim() || null,
        location: formData.location.trim() || null,
        status: formData.status,
        notes: formData.notes.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("Diese Anlagen-ID ist bereits vergeben.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-overview"] });
      toast.success("Anlage erfolgreich angelegt");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Equipment creation error:", error);
      toast.error(
        "Fehler beim Anlegen: " + (error.message || "Bitte überprüfen Sie Ihre Berechtigungen.")
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Neue Anlage anlegen</DialogTitle>
          <DialogDescription>
            Erfassen Sie eine Produktionsanlage, für die Wartungen geplant werden sollen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Anlagen-ID *</Label>
              <Input
                value={formData.equipment_id}
                onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
                placeholder="z.B. EQ-008"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="maintenance">In Wartung</SelectItem>
                  <SelectItem value="inactive">Inaktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="z.B. Granulator"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Typ *</Label>
            <Input
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              placeholder="z.B. Mühle, Siebanlage, Absaugung"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hersteller</Label>
              <Input
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Modell</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Seriennummer</Label>
              <Input
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Standort</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="z.B. Halle A"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bemerkungen</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                !formData.equipment_id.trim() ||
                !formData.name.trim() ||
                !formData.type.trim()
              }
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Anlegen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
