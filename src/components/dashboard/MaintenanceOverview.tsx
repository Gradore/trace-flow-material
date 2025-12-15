import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wrench, AlertTriangle, CheckCircle2, Clock, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isPast, isToday, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Equipment {
  id: string;
  equipment_id: string;
  name: string;
  type: string;
  status: string;
}

interface MaintenanceRecord {
  id: string;
  maintenance_id: string;
  equipment_id: string;
  maintenance_type: string;
  title: string;
  scheduled_date: string | null;
  next_due_date: string | null;
  status: string;
  priority: string;
  equipment?: Equipment;
}

export function MaintenanceOverview() {
  const { data: equipment = [], isLoading: loadingEquipment } = useQuery({
    queryKey: ["equipment-list"],
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
    queryKey: ["maintenance-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_records")
        .select("*, equipment(*)")
        .in("status", ["pending", "in_progress", "overdue"])
        .order("next_due_date", { ascending: true });
      
      if (error) throw error;
      return data as MaintenanceRecord[];
    },
  });

  const isLoading = loadingEquipment || loadingMaintenance;

  // Identify overdue or upcoming maintenance
  const now = new Date();
  const upcomingMaintenance = maintenanceRecords.filter(m => {
    if (!m.next_due_date) return false;
    const dueDate = new Date(m.next_due_date);
    return dueDate <= addDays(now, 7); // Due within 7 days
  });

  const overdueMaintenance = maintenanceRecords.filter(m => {
    if (!m.next_due_date) return false;
    return isPast(new Date(m.next_due_date)) && m.status !== 'completed';
  });

  // Equipment status summary
  const equipmentWithIssues = equipment.filter(e => 
    overdueMaintenance.some(m => m.equipment_id === e.id)
  );

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Wartungsübersicht
          </CardTitle>
          <Link to="/maintenance">
            <Button variant="ghost" size="sm" className="text-xs">
              Alle anzeigen
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-secondary/50">
                <div className="text-xl font-bold text-foreground">{equipment.length}</div>
                <div className="text-xs text-muted-foreground">Anlagen</div>
              </div>
              <div className={cn(
                "text-center p-2 rounded-lg",
                overdueMaintenance.length > 0 ? "bg-destructive/10" : "bg-secondary/50"
              )}>
                <div className={cn(
                  "text-xl font-bold",
                  overdueMaintenance.length > 0 ? "text-destructive" : "text-foreground"
                )}>
                  {overdueMaintenance.length}
                </div>
                <div className="text-xs text-muted-foreground">Überfällig</div>
              </div>
              <div className={cn(
                "text-center p-2 rounded-lg",
                upcomingMaintenance.length > 0 ? "bg-warning/10" : "bg-secondary/50"
              )}>
                <div className={cn(
                  "text-xl font-bold",
                  upcomingMaintenance.length > 0 ? "text-warning" : "text-foreground"
                )}>
                  {upcomingMaintenance.length}
                </div>
                <div className="text-xs text-muted-foreground">Diese Woche</div>
              </div>
            </div>

            {/* Overdue Alert */}
            {overdueMaintenance.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-destructive">
                    {overdueMaintenance.length} überfällige Wartung{overdueMaintenance.length > 1 ? 'en' : ''}
                  </span>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {equipmentWithIssues.map(e => e.name).join(", ")}
                  </p>
                </div>
              </div>
            )}

            {/* Equipment List with Status */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Anlagenstatus</h4>
              <div className="space-y-1.5">
                {equipment.slice(0, 6).map((eq) => {
                  const hasOverdue = overdueMaintenance.some(m => m.equipment_id === eq.id);
                  const hasUpcoming = upcomingMaintenance.some(m => m.equipment_id === eq.id);
                  const nextMaintenance = maintenanceRecords.find(m => m.equipment_id === eq.id);
                  
                  return (
                    <div
                      key={eq.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg border",
                        hasOverdue ? "border-destructive/30 bg-destructive/5" :
                        hasUpcoming ? "border-warning/30 bg-warning/5" :
                        "border-border bg-background/50"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {hasOverdue ? (
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                        ) : hasUpcoming ? (
                          <Clock className="h-4 w-4 text-warning shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">{eq.name}</span>
                      </div>
                      {nextMaintenance?.next_due_date && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(nextMaintenance.next_due_date), "dd.MM.", { locale: de })}
                        </span>
                      )}
                    </div>
                  );
                })}
                {equipment.length > 6 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{equipment.length - 6} weitere Anlagen
                  </p>
                )}
              </div>
            </div>

            {/* Upcoming Maintenance Tasks */}
            {upcomingMaintenance.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-sm font-medium text-muted-foreground">Anstehende Wartungen</h4>
                <div className="space-y-1.5">
                  {upcomingMaintenance.slice(0, 3).map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{m.title}</span>
                      </div>
                      <Badge 
                        variant={isPast(new Date(m.next_due_date!)) ? "destructive" : "secondary"}
                        className="shrink-0 text-xs"
                      >
                        {format(new Date(m.next_due_date!), "dd.MM.", { locale: de })}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
