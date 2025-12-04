import { Package, Inbox, FlaskConical, FileOutput, Truck, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MaterialOverview } from "@/components/dashboard/MaterialOverview";
import { PendingSamples } from "@/components/dashboard/PendingSamples";

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Übersicht über alle Materialflüsse und Aktivitäten</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Aktive Container"
          value={156}
          icon={Package}
          variant="primary"
          trend={{ value: 12, positive: true }}
        />
        <StatCard
          title="Offene Eingänge"
          value={23}
          icon={Inbox}
          variant="warning"
        />
        <StatCard
          title="In Verarbeitung"
          value={8}
          subtitle="4 Chargen"
          icon={FlaskConical}
          variant="default"
        />
        <StatCard
          title="Offene Proben"
          value={12}
          icon={FlaskConical}
          variant="warning"
        />
        <StatCard
          title="Ausgangsmaterial"
          value="18.5t"
          subtitle="diesen Monat"
          icon={FileOutput}
          variant="success"
          trend={{ value: 8, positive: true }}
        />
        <StatCard
          title="Lieferscheine"
          value={34}
          subtitle="diesen Monat"
          icon={Truck}
          variant="default"
        />
      </div>

      {/* Alert Banner */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">3 Chargen warten auf Probenfreigabe</p>
          <p className="text-xs text-muted-foreground">Chargen können ohne genehmigte Probe nicht freigegeben werden</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <PendingSamples />
          <RecentActivity />
        </div>
        <div>
          <MaterialOverview />
        </div>
      </div>
    </div>
  );
}
