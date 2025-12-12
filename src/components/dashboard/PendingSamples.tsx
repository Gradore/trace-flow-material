import { FlaskConical, Clock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const statusConfig = {
  pending: { label: "Ausstehend", icon: Clock, class: "status-badge-warning" },
  in_analysis: { label: "In Analyse", icon: FlaskConical, class: "status-badge-info" },
  approved: { label: "Freigegeben", icon: CheckCircle, class: "status-badge-success" },
  rejected: { label: "Abgelehnt", icon: AlertTriangle, class: "status-badge-destructive" },
};

export function PendingSamples() {
  const navigate = useNavigate();

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ["pending-samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select(`
          *,
          material_inputs (
            input_id,
            material_type,
            material_subtype
          )
        `)
        .in("status", ["pending", "in_analysis"])
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  const getMaterialLabel = (sample: typeof samples[0]) => {
    const type = sample.material_inputs?.material_type || "";
    const subtype = sample.material_inputs?.material_subtype || "";
    return subtype ? `${type}-${subtype}` : type;
  };

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Offene Proben</h3>
        <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate("/sampling")}>
          Alle anzeigen
        </Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : samples.length === 0 ? (
        <div className="text-center py-8">
          <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Keine offenen Proben</p>
        </div>
      ) : (
        <div className="space-y-3">
          {samples.map((sample) => {
            const status = statusConfig[sample.status as keyof typeof statusConfig] || statusConfig.pending;
            const StatusIcon = status.icon;
            const createdAt = formatDistanceToNow(new Date(sample.created_at), { addSuffix: false, locale: de });
            
            return (
              <div
                key={sample.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <FlaskConical className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{sample.sample_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {sample.material_inputs?.input_id || "-"} • {getMaterialLabel(sample)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("status-badge", status.class)}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                  <span className="text-xs text-muted-foreground">vor {createdAt}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
