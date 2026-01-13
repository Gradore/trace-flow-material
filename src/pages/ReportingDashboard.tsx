import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, FlaskConical, ClipboardList, Truck, CheckCircle, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { de } from "date-fns/locale";

export default function ReportingDashboard() {
  // Material intake stats
  const { data: intakeStats, isLoading: intakeLoading } = useQuery({
    queryKey: ['reporting-intake'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_inputs')
        .select('weight_kg, status, received_at, material_type');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const totalWeight = data?.reduce((sum, item) => sum + Number(item.weight_kg), 0) || 0;
      const byStatus = data?.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      return { total, totalWeight, byStatus };
    },
  });

  // Samples stats
  const { data: sampleStats, isLoading: samplesLoading } = useQuery({
    queryKey: ['reporting-samples'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('samples')
        .select('status, sampled_at');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const approved = data?.filter(s => s.status === 'approved').length || 0;
      const pending = data?.filter(s => s.status === 'pending').length || 0;
      const rejected = data?.filter(s => s.status === 'rejected').length || 0;
      const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
      
      return { total, approved, pending, rejected, approvalRate };
    },
  });

  // Orders stats
  const { data: orderStats, isLoading: ordersLoading } = useQuery({
    queryKey: ['reporting-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('status, quantity_kg, production_deadline, delivery_deadline');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const totalQuantity = data?.reduce((sum, item) => sum + Number(item.quantity_kg), 0) || 0;
      const byStatus = data?.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const today = new Date();
      const overdue = data?.filter(o => 
        o.status !== 'completed' && o.status !== 'delivered' && 
        new Date(o.delivery_deadline) < today
      ).length || 0;
      
      return { total, totalQuantity, byStatus, overdue };
    },
  });

  // Processing stats
  const { data: processingStats, isLoading: processingLoading } = useQuery({
    queryKey: ['reporting-processing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processing_steps')
        .select('status, step_type');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const completed = data?.filter(p => p.status === 'completed').length || 0;
      const inProgress = data?.filter(p => p.status === 'running' || p.status === 'paused' || p.status === 'sample_required').length || 0;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      return { total, completed, inProgress, completionRate };
    },
  });

  // Output materials
  const { data: outputStats, isLoading: outputLoading } = useQuery({
    queryKey: ['reporting-output'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('output_materials')
        .select('weight_kg, output_type, status');
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const totalWeight = data?.reduce((sum, item) => sum + Number(item.weight_kg), 0) || 0;
      const inStock = data?.filter(o => o.status === 'in_stock').length || 0;
      
      const byType = data?.reduce((acc, item) => {
        acc[item.output_type] = (acc[item.output_type] || 0) + Number(item.weight_kg);
        return acc;
      }, {} as Record<string, number>) || {};
      
      return { total, totalWeight, inStock, byType };
    },
  });

  const statusColors = ['#16a34a', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];
  
  const samplePieData = sampleStats ? [
    { name: 'Genehmigt', value: sampleStats.approved, color: '#16a34a' },
    { name: 'Ausstehend', value: sampleStats.pending, color: '#f59e0b' },
    { name: 'Abgelehnt', value: sampleStats.rejected, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  const orderStatusData = orderStats?.byStatus 
    ? Object.entries(orderStats.byStatus).map(([status, count], idx) => ({
        name: status === 'pending' ? 'Ausstehend' 
          : status === 'in_production' ? 'In Produktion'
          : status === 'completed' ? 'Abgeschlossen'
          : status === 'delivered' ? 'Geliefert'
          : status,
        value: count,
        fill: statusColors[idx % statusColors.length],
      }))
    : [];

  const outputTypeData = outputStats?.byType
    ? Object.entries(outputStats.byType).map(([type, weight]) => ({
        name: type,
        weight: Math.round(weight),
      }))
    : [];

  const isLoading = intakeLoading || samplesLoading || ordersLoading || processingLoading || outputLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reporting Dashboard</h1>
        <p className="text-muted-foreground">Übersicht der wichtigsten Kennzahlen</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materialeingang</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {intakeLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{intakeStats?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {((intakeStats?.totalWeight || 0) / 1000).toFixed(1)} t Gesamtgewicht
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proben</CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {samplesLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{sampleStats?.approvalRate || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  Genehmigungsrate ({sampleStats?.approved || 0}/{sampleStats?.total || 0})
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aufträge</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{orderStats?.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {orderStats?.overdue || 0} überfällig
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lagerbestand</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {outputLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{((outputStats?.totalWeight || 0) / 1000).toFixed(1)} t</div>
                <p className="text-xs text-muted-foreground">
                  {outputStats?.inStock || 0} Chargen verfügbar
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">Abgeschlossen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {processingStats?.completionRate || 0}%
            </div>
            <p className="text-xs text-green-600 dark:text-green-500">
              Verarbeitungsschritte abgeschlossen
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-300">Ausstehend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {sampleStats?.pending || 0}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Proben warten auf Analyse
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-sm font-medium text-red-800 dark:text-red-300">Überfällig</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {orderStats?.overdue || 0}
            </div>
            <p className="text-xs text-red-600 dark:text-red-500">
              Aufträge überschritten Deadline
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Proben Status</CardTitle>
            <CardDescription>Verteilung nach Genehmigungsstatus</CardDescription>
          </CardHeader>
          <CardContent>
            {samplesLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : samplePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={samplePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {samplePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Keine Daten verfügbar
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ausgangsmaterial nach Typ</CardTitle>
            <CardDescription>Gewicht in kg</CardDescription>
          </CardHeader>
          <CardContent>
            {outputLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : outputTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={outputTypeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="weight" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Keine Daten verfügbar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Status */}
      <Card>
        <CardHeader>
          <CardTitle>Auftragsstatus Übersicht</CardTitle>
          <CardDescription>Anzahl Aufträge nach Status</CardDescription>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : orderStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={orderStatusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Keine Aufträge verfügbar
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
