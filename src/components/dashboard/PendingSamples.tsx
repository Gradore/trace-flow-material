import { FlaskConical, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const samples = [
  {
    id: "PRB-2024-0156",
    batch: "CHG-2024-089",
    material: "GFK-UP",
    status: "pending",
    priority: "high",
    createdAt: "vor 2 Std.",
  },
  {
    id: "PRB-2024-0155",
    batch: "CHG-2024-088",
    material: "PP",
    status: "in_analysis",
    priority: "normal",
    createdAt: "vor 4 Std.",
  },
  {
    id: "PRB-2024-0154",
    batch: "CHG-2024-087",
    material: "PA6",
    status: "pending",
    priority: "normal",
    createdAt: "vor 6 Std.",
  },
];

const statusConfig = {
  pending: { label: "Ausstehend", icon: Clock, class: "status-badge-warning" },
  in_analysis: { label: "In Analyse", icon: FlaskConical, class: "status-badge-info" },
  approved: { label: "Freigegeben", icon: CheckCircle, class: "status-badge-success" },
  rejected: { label: "Abgelehnt", icon: AlertTriangle, class: "status-badge-destructive" },
};

export function PendingSamples() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Offene Proben</h3>
        <Button variant="ghost" size="sm" className="text-primary">
          Alle anzeigen
        </Button>
      </div>
      <div className="space-y-3">
        {samples.map((sample) => {
          const status = statusConfig[sample.status as keyof typeof statusConfig];
          const StatusIcon = status.icon;
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
                  <p className="text-sm font-medium text-foreground">{sample.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {sample.batch} • {sample.material}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("status-badge", status.class)}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </span>
                {sample.priority === "high" && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
