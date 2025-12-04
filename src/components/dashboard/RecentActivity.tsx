import { cn } from "@/lib/utils";
import { Package, Inbox, FlaskConical, FileCheck, Truck } from "lucide-react";

const activities = [
  {
    id: 1,
    type: "intake",
    title: "Neuer Materialeingang",
    description: "GFK-UP von Lieferant Recycling GmbH",
    time: "vor 5 Min.",
    icon: Inbox,
    iconColor: "bg-info/10 text-info",
  },
  {
    id: 2,
    type: "sample",
    title: "Probe erstellt",
    description: "PRB-2024-0156 für Charge CHG-2024-089",
    time: "vor 12 Min.",
    icon: FlaskConical,
    iconColor: "bg-warning/10 text-warning",
  },
  {
    id: 3,
    type: "approved",
    title: "Probe freigegeben",
    description: "PRB-2024-0155 - QA bestätigt",
    time: "vor 28 Min.",
    icon: FileCheck,
    iconColor: "bg-success/10 text-success",
  },
  {
    id: 4,
    type: "container",
    title: "Container erstellt",
    description: "BigBag BB-2024-0234 zugewiesen",
    time: "vor 45 Min.",
    icon: Package,
    iconColor: "bg-primary/10 text-primary",
  },
  {
    id: 5,
    type: "delivery",
    title: "Lieferschein erstellt",
    description: "LS-2024-0089 für Kunde AutoParts AG",
    time: "vor 1 Std.",
    icon: Truck,
    iconColor: "bg-accent/10 text-accent",
  },
];

export function RecentActivity() {
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-lg font-semibold text-foreground mb-4">Letzte Aktivitäten</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 group">
            <div className={cn("p-2 rounded-lg shrink-0 transition-transform group-hover:scale-110", activity.iconColor)}>
              <activity.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
              <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
            </div>
            <span className="text-xs text-muted-foreground/70 shrink-0">{activity.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
