import { cn } from "@/lib/utils";
import { Package, Inbox, FlaskConical, FileCheck, FileOutput, FileText, Truck, Loader2, Activity, Settings, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

// Keys must match the EventType union written by useMaterialFlowHistory.logEvent
const eventTypeConfig: Record<string, { icon: typeof Inbox; iconColor: string }> = {
  intake_received: { icon: Inbox, iconColor: "bg-info/10 text-info" },
  container_assigned: { icon: Package, iconColor: "bg-primary/10 text-primary" },
  processing_started: { icon: Settings, iconColor: "bg-secondary text-secondary-foreground" },
  processing_completed: { icon: CheckCircle, iconColor: "bg-success/10 text-success" },
  sample_created: { icon: FlaskConical, iconColor: "bg-warning/10 text-warning" },
  sample_analyzed: { icon: FlaskConical, iconColor: "bg-info/10 text-info" },
  sample_approved: { icon: FileCheck, iconColor: "bg-success/10 text-success" },
  sample_rejected: { icon: AlertCircle, iconColor: "bg-destructive/10 text-destructive" },
  output_created: { icon: FileOutput, iconColor: "bg-success/10 text-success" },
  delivery_note_created: { icon: Truck, iconColor: "bg-accent/10 text-accent" },
  document_uploaded: { icon: FileText, iconColor: "bg-secondary text-secondary-foreground" },
};

const fallbackEventConfig = { icon: Activity, iconColor: "bg-secondary text-secondary-foreground" };

export function RecentActivity() {
  const { data: activities = [], isLoading, isError } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_flow_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-lg font-semibold text-foreground mb-4">Letzte Aktivitäten</h3>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">Aktivitäten konnten nicht geladen werden.</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Keine Aktivitäten vorhanden</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => {
            const config = eventTypeConfig[activity.event_type] || fallbackEventConfig;
            const Icon = config.icon;
            const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: false, locale: de });
            
            // Parse event details if available
            const details = activity.event_details as Record<string, unknown> | null;
            const description = details?.description as string || "";
            
            return (
              <div key={activity.id} className="flex items-start gap-3 group">
                <div className={cn("p-2 rounded-lg shrink-0 transition-transform group-hover:scale-110", config.iconColor)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{activity.event_description}</p>
                  {description && (
                    <p className="text-xs text-muted-foreground truncate">{description}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground/70 shrink-0">vor {timeAgo}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
