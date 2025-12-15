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

interface AnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  contactId: string;
}

const MATERIAL_TYPES = [
  { value: "GFK", label: "GFK (Glasfaserverstärkter Kunststoff)" },
  { value: "PP", label: "Polypropylen (PP)" },
  { value: "PA", label: "Polyamid (PA)" },
];

const GFK_SUBTYPES = [
  { value: "UP", label: "UP-Harz" },
  { value: "EP", label: "EP-Harz" },
  { value: "VE", label: "VE-Harz" },
  { value: "PU", label: "PU-Harz" },
  { value: "PET", label: "PET" },
];

const PA_SUBTYPES = [
  { value: "PA6", label: "PA6" },
  { value: "PA66", label: "PA66" },
];

const CONTAINER_TYPES = [
  { value: "container", label: "Container" },
  { value: "bigbag", label: "BigBag" },
  { value: "palette", label: "Palette" },
  { value: "lose", label: "Lose" },
  { value: "other", label: "Sonstiges" },
];

const TIME_SLOTS = [
  { value: "morning", label: "Vormittag (8-12 Uhr)" },
  { value: "afternoon", label: "Nachmittag (12-17 Uhr)" },
  { value: "flexible", label: "Flexibel" },
];

export function AnnouncementDialog({
  open,
  onOpenChange,
  companyId,
  contactId,
}: AnnouncementDialogProps) {
  const [formData, setFormData] = useState({
    material_type: "",
    material_subtype: "",
    estimated_weight_kg: "",
    container_type: "",
    container_count: "1",
    waste_code: "",
    preferred_date: undefined as Date | undefined,
    preferred_time_slot: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  const generateAnnouncementId = async () => {
    const { data } = await supabase.rpc("generate_unique_id", { prefix: "ANM" });
    return data || `ANM-${Date.now()}`;
  };

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const announcementId = await generateAnnouncementId();
      const { error } = await supabase.from("material_announcements").insert({
        announcement_id: announcementId,
        company_id: companyId,
        contact_id: contactId,
        material_type: data.material_type,
        material_subtype: data.material_subtype || null,
        estimated_weight_kg: parseFloat(data.estimated_weight_kg),
        container_type: data.container_type,
        container_count: parseInt(data.container_count),
        waste_code: data.waste_code || null,
        preferred_date: data.preferred_date?.toISOString().split("T")[0] || null,
        preferred_time_slot: data.preferred_time_slot || null,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-announcements"] });
      toast.success("Materialanmeldung erstellt");
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Fehler: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      material_type: "",
      material_subtype: "",
      estimated_weight_kg: "",
      container_type: "",
      container_count: "1",
      waste_code: "",
      preferred_date: undefined,
      preferred_time_slot: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material_type || !formData.estimated_weight_kg || !formData.container_type) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }
    mutation.mutate(formData);
  };

  const getSubtypes = () => {
    if (formData.material_type === "GFK") return GFK_SUBTYPES;
    if (formData.material_type === "PA") return PA_SUBTYPES;
    return [];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Material anmelden</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Materialtyp *</Label>
              <Select
                value={formData.material_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, material_type: value, material_subtype: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {getSubtypes().length > 0 && (
              <div className="space-y-2">
                <Label>Untertyp</Label>
                <Select
                  value={formData.material_subtype}
                  onValueChange={(value) =>
                    setFormData({ ...formData, material_subtype: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getSubtypes().map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Geschätzte Menge (kg) *</Label>
              <Input
                type="number"
                value={formData.estimated_weight_kg}
                onChange={(e) =>
                  setFormData({ ...formData, estimated_weight_kg: e.target.value })
                }
                min="0"
                step="0.1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Abfallschlüssel</Label>
              <Input
                value={formData.waste_code}
                onChange={(e) => setFormData({ ...formData, waste_code: e.target.value })}
                placeholder="z.B. 17 02 03"
              />
            </div>

            <div className="space-y-2">
              <Label>Behälterart *</Label>
              <Select
                value={formData.container_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, container_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {CONTAINER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Anzahl Behälter</Label>
              <Input
                type="number"
                value={formData.container_count}
                onChange={(e) =>
                  setFormData({ ...formData, container_count: e.target.value })
                }
                min="1"
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

            <div className="space-y-2">
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
              {mutation.isPending ? "Senden..." : "Anmelden"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
