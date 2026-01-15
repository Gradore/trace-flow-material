import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Wrench, Settings2, AlertTriangle, CheckCircle2, 
  Clock, Calendar, Loader2, MoreHorizontal 
} from "lucide-react";
import { format, isPast, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MaintenanceDialog } from "@/components/maintenance/MaintenanceDialog";

interface Equipment {
  id: string;
  equipment_id: string;
  name: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  status: string;
  location: string | null;
}

interface MaintenanceRecord {
  id: string;
  maintenance_id: string;
  equipment_id: string;
  maintenance_type: string;
  title: string;
  description: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  next_due_date: string | null;
  interval_days: number | null;
  status: string;
  priority: string;
  equipment?: Equipment;
}

export default function Maintenance() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenanceRecord | null>(null);
  const queryClient = useQueryClient();

  const { data: equipment = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const { data: maintenanceRecords = [], isLoading: loadingMaintenance } = useQuery({
    queryKey: ["maintenance-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_records")
        .select("*, equipment(*)")
        .order("next_due_date", { ascending: true });
      
      if (error) throw error;
      return data as MaintenanceRecord[];
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (record: MaintenanceRecord) => {
      const now = new Date();
      
      // Always mark as completed first
      const updates: Record<string, unknown> = {
        status: 'completed',
        completed_date: now.toISOString().split('T')[0],
      };

      // If recurring, calculate next due date but keep status as completed for THIS record
      // We need to create a NEW record for the next occurrence
      if (record.interval_days) {
        const nextDueDate = format(addDays(now, record.interval_days), 'yyyy-MM-dd');
        
        // Update current record as completed
        const { error: updateError } = await supabase
          .from("maintenance_records")
          .update({
            status: 'completed',
            completed_date: now.toISOString().split('T')[0],
          })
          .eq("id", record.id);
        
        if (updateError) throw updateError;
        
        // Create new record for next occurrence
        const maintenanceId = `MAINT-${Date.now().toString(36).toUpperCase()}`;
        const { error: insertError } = await supabase
          .from("maintenance_records")
          .insert({
            maintenance_id: maintenanceId,
            equipment_id: record.equipment_id,
            title: record.title,
            description: record.description,
            maintenance_type: record.maintenance_type,
            priority: record.priority,
            interval_days: record.interval_days,
            next_due_date: nextDueDate,
            status: 'pending',
          });
        
        if (insertError) throw insertError;
      } else {
        // No interval - just mark as completed
        const { error } = await supabase
          .from("maintenance_records")
          .update(updates)
          .eq("id", record.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-records"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-overview"] });
      toast.success("Wartung als erledigt markiert");
    },
    onError: () => {
      toast.error("Fehler beim Aktualisieren");
    },
  });

  const isLoading = loadingEquipment || loadingMaintenance;

  const pendingRecords = maintenanceRecords.filter(m => 
    m.status === 'pending' || m.status === 'overdue'
  );
  const completedRecords = maintenanceRecords.filter(m => m.status === 'completed');

  const getStatusBadge = (record: MaintenanceRecord) => {
    if (record.status === 'completed') {
      return <Badge variant="secondary" className="bg-success/10 text-success">Erledigt</Badge>;
    }
    if (record.next_due_date && isPast(new Date(record.next_due_date))) {
      return <Badge variant="destructive">Überfällig</Badge>;
    }
    if (record.status === 'in_progress') {
      return <Badge className="bg-info/10 text-info">In Bearbeitung</Badge>;
    }
    return <Badge variant="secondary">Ausstehend</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Kritisch</Badge>;
      case 'high':
        return <Badge className="bg-warning/10 text-warning">Hoch</Badge>;
      case 'low':
        return <Badge variant="outline">Niedrig</Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wartung & Anlagen</h1>
          <p className="text-muted-foreground mt-1">Wartungspläne und Anlagenverwaltung</p>
        </div>
        <Button onClick={() => { setSelectedMaintenance(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Wartung
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="equipment" className="space-y-4">
          <TabsList>
            <TabsTrigger value="equipment" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Anlagen ({equipment.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Ausstehend ({pendingRecords.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Erledigt ({completedRecords.length})
            </TabsTrigger>
          </TabsList>

          {/* Equipment Tab */}
          <TabsContent value="equipment">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Anlagenübersicht</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {equipment.map((eq) => {
                    const eqMaintenance = maintenanceRecords.filter(m => m.equipment_id === eq.id);
                    const hasOverdue = eqMaintenance.some(m => 
                      m.next_due_date && isPast(new Date(m.next_due_date)) && m.status !== 'completed'
                    );
                    const nextMaintenance = eqMaintenance.find(m => m.status !== 'completed');

                    return (
                      <Card key={eq.id} className={cn(
                        "transition-colors",
                        hasOverdue && "border-destructive/50"
                      )}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {hasOverdue ? (
                                <AlertTriangle className="h-8 w-8 text-destructive" />
                              ) : (
                                <Settings2 className="h-8 w-8 text-primary" />
                              )}
                              <div>
                                <h3 className="font-semibold">{eq.name}</h3>
                                <p className="text-sm text-muted-foreground">{eq.type}</p>
                              </div>
                            </div>
                            <Badge variant={eq.status === 'active' ? 'secondary' : 'outline'}>
                              {eq.status === 'active' ? 'Aktiv' : eq.status}
                            </Badge>
                          </div>
                          {eq.manufacturer && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Hersteller: {eq.manufacturer}
                            </p>
                          )}
                          {nextMaintenance?.next_due_date && (
                            <div className={cn(
                              "mt-3 flex items-center gap-2 text-sm",
                              hasOverdue ? "text-destructive" : "text-muted-foreground"
                            )}>
                              <Calendar className="h-4 w-4" />
                              Nächste Wartung: {format(new Date(nextMaintenance.next_due_date), "dd.MM.yyyy", { locale: de })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Tab */}
          <TabsContent value="pending">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anlage</TableHead>
                      <TableHead>Wartung</TableHead>
                      <TableHead>Fällig</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priorität</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Keine ausstehenden Wartungen
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.equipment?.name || '-'}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{record.title}</p>
                              {record.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {record.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {record.next_due_date ? (
                              <span className={cn(
                                isPast(new Date(record.next_due_date)) && "text-destructive font-medium"
                              )}>
                                {format(new Date(record.next_due_date), "dd.MM.yyyy", { locale: de })}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(record)}</TableCell>
                          <TableCell>{getPriorityBadge(record.priority)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => completeMutation.mutate(record)}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Als erledigt markieren
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { 
                                  setSelectedMaintenance(record); 
                                  setDialogOpen(true); 
                                }}>
                                  <Wrench className="h-4 w-4 mr-2" />
                                  Bearbeiten
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Anlage</TableHead>
                      <TableHead>Wartung</TableHead>
                      <TableHead>Erledigt am</TableHead>
                      <TableHead>Nächste Fälligkeit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Keine erledigten Wartungen
                        </TableCell>
                      </TableRow>
                    ) : (
                      completedRecords.slice(0, 20).map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.equipment?.name || '-'}
                          </TableCell>
                          <TableCell>{record.title}</TableCell>
                          <TableCell>
                            {record.completed_date ? 
                              format(new Date(record.completed_date), "dd.MM.yyyy", { locale: de }) : '-'
                            }
                          </TableCell>
                          <TableCell>
                            {record.next_due_date ? 
                              format(new Date(record.next_due_date), "dd.MM.yyyy", { locale: de }) : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <MaintenanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipment={equipment}
        maintenance={selectedMaintenance}
      />
    </div>
  );
}
