import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Equipment {
  id: string;
  equipment_id: string;
  name: string;
}

interface MaintenanceRecord {
  id: string;
  maintenance_id: string;
  equipment_id: string;
  maintenance_type: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  next_due_date: string | null;
  interval_days: number | null;
  status: string;
  priority: string;
}

interface MaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment[];
  maintenance?: MaintenanceRecord | null;
}

export function MaintenanceDialog({ 
  open, 
  onOpenChange, 
  equipment,
  maintenance 
}: MaintenanceDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!maintenance;

  const [formData, setFormData] = useState({
    equipment_id: "",
    title: "",
    description: "",
    maintenance_type: "scheduled",
    next_due_date: "",
    interval_days: "",
    priority: "normal",
  });

  useEffect(() => {
    if (maintenance) {
      setFormData({
        equipment_id: maintenance.equipment_id,
        title: maintenance.title,
        description: maintenance.description || "",
        maintenance_type: maintenance.maintenance_type,
        next_due_date: maintenance.next_due_date || "",
        interval_days: maintenance.interval_days?.toString() || "",
        priority: maintenance.priority,
      });
    } else {
      setFormData({
        equipment_id: "",
        title: "",
        description: "",
        maintenance_type: "scheduled",
        next_due_date: "",
        interval_days: "",
        priority: "normal",
      });
    }
  }, [maintenance, open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const maintenanceId = `MAINT-${Date.now().toString(36).toUpperCase()}`;
      
      const { error } = await supabase
        .from("maintenance_records")
        .insert({
          maintenance_id: maintenanceId,
          equipment_id: formData.equipment_id,
          title: formData.title,
          description: formData.description || null,
          maintenance_type: formData.maintenance_type,
          next_due_date: formData.next_due_date || null,
          interval_days: formData.interval_days ? parseInt(formData.interval_days) : null,
          priority: formData.priority,
          status: "pending",
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-records"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-overview"] });
      toast.success("Wartung erstellt");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Fehler beim Erstellen: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("maintenance_records")
        .update({
          equipment_id: formData.equipment_id,
          title: formData.title,
          description: formData.description || null,
          maintenance_type: formData.maintenance_type,
          next_due_date: formData.next_due_date || null,
          interval_days: formData.interval_days ? parseInt(formData.interval_days) : null,
          priority: formData.priority,
        })
        .eq("id", maintenance!.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-records"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-overview"] });
      toast.success("Wartung aktualisiert");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Fehler beim Aktualisieren: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Wartung bearbeiten" : "Neue Wartung erstellen"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Anlage *</Label>
            <Select
              value={formData.equipment_id}
              onValueChange={(value) => setFormData({ ...formData, equipment_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Anlage wählen" />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="z.B. Ölwechsel, Filterwechsel..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detaillierte Beschreibung der Wartungsarbeiten..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Wartungstyp</Label>
              <Select
                value={formData.maintenance_type}
                onValueChange={(value) => setFormData({ ...formData, maintenance_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Geplant</SelectItem>
                  <SelectItem value="inspection">Inspektion</SelectItem>
                  <SelectItem value="repair">Reparatur</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="critical">Kritisch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fälligkeitsdatum</Label>
              <Input
                type="date"
                value={formData.next_due_date}
                onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Intervall (Tage)</Label>
              <Input
                type="number"
                value={formData.interval_days}
                onChange={(e) => setFormData({ ...formData, interval_days: e.target.value })}
                placeholder="z.B. 30, 90, 365"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isPending || !formData.equipment_id || !formData.title}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
