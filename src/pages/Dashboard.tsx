import { Package, Inbox, FlaskConical, FileOutput, Truck, AlertTriangle, Loader2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MaterialOverview } from "@/components/dashboard/MaterialOverview";
import { PendingSamples } from "@/components/dashboard/PendingSamples";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isToday, startOfMonth, endOfMonth } from "date-fns";

export default function Dashboard() {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  // Fetch containers count
  const { data: containerStats } = useQuery({
    queryKey: ["dashboard-containers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("containers")
        .select("status");
      
      if (error) throw error;
      
      const active = data.filter(c => c.status !== 'empty').length;
      const total = data.length;
      return { active, total };
    },
  });

  // Fetch material inputs (open intakes)
  const { data: intakeStats } = useQuery({
    queryKey: ["dashboard-intakes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_inputs")
        .select("status");
      
      if (error) throw error;
      
      const open = data.filter(i => i.status === 'received').length;
      return { open };
    },
  });

  // Fetch processing stats
  const { data: processingStats } = useQuery({
    queryKey: ["dashboard-processing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processing_steps")
        .select("status, processing_id");
      
      if (error) throw error;
      
      const inProgress = data.filter(p => p.status === 'running' || p.status === 'paused').length;
      const batches = new Set(data.filter(p => p.status !== 'completed').map(p => p.processing_id)).size;
      return { inProgress, batches };
    },
  });

  // Fetch samples (open)
  const { data: sampleStats } = useQuery({
    queryKey: ["dashboard-samples"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("samples")
        .select("status");
      
      if (error) throw error;
      
      const open = data.filter(s => s.status === 'pending' || s.status === 'in_analysis').length;
      const awaitingApproval = data.filter(s => s.status === 'pending').length;
      return { open, awaitingApproval };
    },
  });

  // Fetch output materials (this month)
  const { data: outputStats } = useQuery({
    queryKey: ["dashboard-outputs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("weight_kg, created_at");
      
      if (error) throw error;
      
      const thisMonth = data.filter(o => {
        const date = new Date(o.created_at);
        return date >= monthStart && date <= monthEnd;
      });
      
      const totalWeight = thisMonth.reduce((sum, o) => sum + Number(o.weight_kg || 0), 0);
      return { totalWeight: (totalWeight / 1000).toFixed(1) + "t" };
    },
  });

  // Fetch delivery notes (this month)
  const { data: deliveryStats } = useQuery({
    queryKey: ["dashboard-delivery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_notes")
        .select("created_at");
      
      if (error) throw error;
      
      const thisMonth = data.filter(d => {
        const date = new Date(d.created_at);
        return date >= monthStart && date <= monthEnd;
      }).length;
      
      return { thisMonth };
    },
  });

  // Check for batches awaiting sample approval
  const awaitingApproval = sampleStats?.awaitingApproval || 0;

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">Übersicht über alle Materialflüsse und Aktivitäten</p>
      </div>

      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4">
        <StatCard
          title="Aktive Container"
          value={containerStats?.active ?? "-"}
          icon={Package}
          variant="primary"
        />
        <StatCard
          title="Offene Eingänge"
          value={intakeStats?.open ?? "-"}
          icon={Inbox}
          variant="warning"
        />
        <StatCard
          title="In Verarbeitung"
          value={processingStats?.inProgress ?? "-"}
          subtitle={processingStats?.batches ? `${processingStats.batches} Chargen` : undefined}
          icon={FlaskConical}
          variant="default"
        />
        <StatCard
          title="Offene Proben"
          value={sampleStats?.open ?? "-"}
          icon={FlaskConical}
          variant="warning"
        />
        <StatCard
          title="Ausgangsmaterial"
          value={outputStats?.totalWeight ?? "-"}
          subtitle="diesen Monat"
          icon={FileOutput}
          variant="success"
        />
        <StatCard
          title="Lieferscheine"
          value={deliveryStats?.thisMonth ?? "-"}
          subtitle="diesen Monat"
          icon={Truck}
          variant="default"
        />
      </div>

      {/* Alert Banner */}
      {awaitingApproval > 0 && (
        <div className="flex items-center gap-3 p-3 md:p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{awaitingApproval} Chargen warten auf Probenfreigabe</p>
            <p className="text-xs text-muted-foreground hidden sm:block">Chargen können ohne genehmigte Probe nicht freigegeben werden</p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
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
