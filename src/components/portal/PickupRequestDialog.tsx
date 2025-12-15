import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PickupRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  contactId: string;
}

const TIME_SLOTS = [
  { value: "morning", label: "Vormittag (8-12 Uhr)" },
  { value: "afternoon", label: "Nachmittag (12-17 Uhr)" },
  { value: "flexible", label: "Flexibel" },
];

export function PickupRequestDialog({
  open,
  onOpenChange,
  companyId,
  contactId,
}: PickupRequestDialogProps) {
  const [formData, setFormData] = useState({
    material_description: "",
    weight_kg: "",
    pickup_address: "",
    preferred_date: undefined as Date | undefined,
    preferred_time_slot: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  const generateRequestId = async () => {
    const { data } = await supabase.rpc("generate_unique_id", { prefix: "ABH" });
    return data || `ABH-${Date.now()}`;
  };

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const requestId = await generateRequestId();
      const { error } = await supabase.from("pickup_requests").insert({
        request_id: requestId,
        company_id: companyId,
        contact_id: contactId,
        material_description: data.material_description,
        weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
        pickup_address: data.pickup_address || null,
        preferred_date: data.preferred_date?.toISOString().split("T")[0] || null,
        preferred_time_slot: data.preferred_time_slot || null,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-pickup-requests"] });
      toast.success("Abholungsanfrage erstellt");
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      material_description: "",
      weight_kg: "",
      pickup_address: "",
      preferred_date: undefined,
      preferred_time_slot: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material_description.trim()) {
      toast.error("Bitte geben Sie eine Materialbeschreibung ein");
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abholung anfordern</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Materialbeschreibung *</Label>
            <Input
              value={formData.material_description}
              onChange={(e) =>
                setFormData({ ...formData, material_description: e.target.value })
              }
              placeholder="z.B. GFK-Abfälle, EP-Harz"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Geschätztes Gewicht (kg)</Label>
              <Input
                type="number"
                value={formData.weight_kg}
                onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                min="0"
                step="0.1"
              />
            </div>

            <div className="space-y-2">
              <Label>Wunschtermin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.preferred_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.preferred_date
                      ? format(formData.preferred_date, "dd.MM.yyyy", { locale: de })
                      : "Datum wählen..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.preferred_date}
                    onSelect={(date) => setFormData({ ...formData, preferred_date: date })}
                    disabled={(date) => date < new Date()}
                    locale={de}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Zeitfenster</Label>
              <Select
                value={formData.preferred_time_slot}
                onValueChange={(value) =>
                  setFormData({ ...formData, preferred_time_slot: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Abholadresse</Label>
            <Textarea
              value={formData.pickup_address}
              onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
              placeholder="Falls abweichend von Firmenadresse"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Bemerkungen</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Senden..." : "Anfrage senden"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
