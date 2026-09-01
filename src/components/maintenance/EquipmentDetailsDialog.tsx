import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Settings2, Calendar, Plus, Edit2, Save, X } from "lucide-react";
import { format, isPast } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Equipment {
  id: string;
  equipment_id: string;
  name: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  status: string;
  location: string | null;
  serial_number?: string | null;
  notes?: string | null;
}

interface MaintenanceRecord {
  id: string;
  maintenance_id: string;
  title: string;
  maintenance_type: string;
  next_due_date: string | null;
  interval_days: number | null;
  status: string;
  priority: string;
}

interface EquipmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  onAddMaintenance: (equipmentId: string) => void;
}

export function EquipmentDetailsDialog({ 
  open, 
  onOpenChange, 
  equipment,
  onAddMaintenance
}: EquipmentDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    manufacturer: "",
    model: "",
    location: "",
    status: "active",
    notes: "",
  });

  // The `equipment` prop is a snapshot held by the parent page and is never refreshed,
  // so the record is re-read here to show saved changes immediately.
  const { data: equipmentDetail } = useQuery({
    queryKey: ["equipment-detail", equipment?.id],
    queryFn: async () => {
      if (!equipment?.id) return null;
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("id", equipment.id)
        .maybeSingle();

      if (error) throw error;
      return data as Equipment | null;
    },
    enabled: !!equipment?.id && open,
  });

  const currentEquipment = equipmentDetail ?? equipment;

  // Fetch maintenance records for this equipment
  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ["equipment-maintenance", equipment?.id],
    queryFn: async () => {
      if (!equipment?.id) return [];
      const { data, error } = await supabase
        .from("maintenance_records")
        .select("*")
        .eq("equipment_id", equipment.id)
        .order("next_due_date", { ascending: true });
      
      if (error) throw error;
      return data as MaintenanceRecord[];
    },
    enabled: !!equipment?.id && open,
  });

  useEffect(() => {
    if (equipment) {
      setFormData({
        name: equipment.name || "",
        type: equipment.type || "",
        manufacturer: equipment.manufacturer || "",
        model: equipment.model || "",
        location: equipment.location || "",
        status: equipment.status || "active",
        notes: equipment.notes || "",
      });
    }
    setIsEditing(false);
    // Only re-sync when a different equipment record is opened, so a background
    // refetch cannot discard the values the user is currently editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment?.id, open]);

  const handleStartEdit = () => {
    if (currentEquipment) {
      setFormData({
        name: currentEquipment.name || "",
        type: currentEquipment.type || "",
        manufacturer: currentEquipment.manufacturer || "",
        model: currentEquipment.model || "",
        location: currentEquipment.location || "",
        status: currentEquipment.status || "active",
        notes: currentEquipment.notes || "",
      });
    }
    setIsEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!equipment) return;
      // An RLS-filtered update returns zero rows and no error - request the row back.
      const { data, error } = await supabase
        .from("equipment")
        .update({
          name: formData.name,
          type: formData.type,
          manufacturer: formData.manufacturer || null,
          model: formData.model || null,
          location: formData.location || null,
          status: formData.status,
          notes: formData.notes || null,
        })
        .eq("id", equipment.id)
        .select("id");
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Datensatz nicht gefunden.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-detail", equipment?.id] });
      toast.success("Anlage erfolgreich aktualisiert");
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error("Fehler beim Aktualisieren: " + error.message);
    },
  });

  const pendingRecords = maintenanceRecords.filter(m => m.status === 'pending' || m.status === 'overdue');
  const hasMaintenancePlan = maintenanceRecords.some(m => m.interval_days && m.interval_days > 0);

  if (!equipment || !currentEquipment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            {currentEquipment.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Equipment Details */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">Anlagendetails</CardTitle>
              {!isEditing ? (
                <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Bearbeiten
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Abbrechen
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Speichern
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Typ</Label>
                      <Input
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      />
                    </div>
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
                      <Label>Standort</Label>
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
                    <Label>Bemerkungen</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Anlagen-ID</p>
                    <p className="font-medium">{currentEquipment.equipment_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Typ</p>
                    <p className="font-medium">{currentEquipment.type}</p>
                  </div>
                  {currentEquipment.manufacturer && (
                    <div>
                      <p className="text-muted-foreground">Hersteller</p>
                      <p className="font-medium">{currentEquipment.manufacturer}</p>
                    </div>
                  )}
                  {currentEquipment.model && (
                    <div>
                      <p className="text-muted-foreground">Modell</p>
                      <p className="font-medium">{currentEquipment.model}</p>
                    </div>
                  )}
                  {currentEquipment.location && (
                    <div>
                      <p className="text-muted-foreground">Standort</p>
                      <p className="font-medium">{currentEquipment.location}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={currentEquipment.status === 'active' ? 'secondary' : 'outline'}>
                      {currentEquipment.status === 'active' ? 'Aktiv' : currentEquipment.status === 'maintenance' ? 'In Wartung' : 'Inaktiv'}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Plan */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">
                Wartungsplan
                {hasMaintenancePlan && (
                  <Badge variant="secondary" className="ml-2">Aktiv</Badge>
                )}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => onAddMaintenance(equipment.id)}>
                <Plus className="h-4 w-4 mr-1" />
                Wartung hinzufügen
              </Button>
            </CardHeader>
            <CardContent>
              {maintenanceRecords.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Kein Wartungsplan hinterlegt</p>
                  <p className="text-xs mt-1">Fügen Sie eine Wartung mit Intervall hinzu, um einen Wartungsplan zu erstellen.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {maintenanceRecords.slice(0, 5).map((record) => (
                    <div 
                      key={record.id} 
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        record.status === 'completed' && "bg-muted/50",
                        record.next_due_date && isPast(new Date(record.next_due_date)) && record.status !== 'completed' && "border-destructive/50"
                      )}
                    >
                      <div>
                        <p className="font-medium text-sm">{record.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {record.interval_days && (
                            <Badge variant="outline" className="text-xs">
                              Alle {record.interval_days} Tage
                            </Badge>
                          )}
                          {record.next_due_date && record.status !== 'completed' && (
                            <span className={cn(
                              "text-xs",
                              isPast(new Date(record.next_due_date)) ? "text-destructive" : "text-muted-foreground"
                            )}>
                              Fällig: {format(new Date(record.next_due_date), "dd.MM.yyyy", { locale: de })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant={record.status === 'completed' ? 'secondary' : 'default'}
                        className={record.status === 'completed' ? 'bg-success/10 text-success' : ''}
                      >
                        {record.status === 'completed' ? 'Erledigt' : record.status === 'pending' ? 'Ausstehend' : record.status}
                      </Badge>
                    </div>
                  ))}
                  {maintenanceRecords.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{maintenanceRecords.length - 5} weitere Wartungen
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}