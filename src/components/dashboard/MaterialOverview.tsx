import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package } from "lucide-react";

const materialColors: Record<string, string> = {
  glass_fiber: "bg-primary",
  resin_powder: "bg-info",
  pp_regrind: "bg-warning",
  pa_regrind: "bg-accent",
};

const materialLabels: Record<string, string> = {
  glass_fiber: "Recycelte Glasfasern",
  resin_powder: "Harzpulver",
  pp_regrind: "PP Regranulat",
  pa_regrind: "PA Regranulat",
};

export function MaterialOverview() {
  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ["output-materials-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("output_type, weight_kg, status")
        .eq("status", "in_stock");
      
      if (error) throw error;
      return data;
    },
  });

  // Aggregate by output type
  const aggregated = outputs.reduce((acc, output) => {
    const type = output.output_type;
    if (!acc[type]) {
      acc[type] = 0;
    }
    acc[type] += Number(output.weight_kg || 0);
    return acc;
  }, {} as Record<string, number>);

  const totalStock = Object.values(aggregated).reduce((sum, val) => sum + val, 0);

  const materials = Object.entries(aggregated).map(([type, stock]) => ({
    name: materialLabels[type] || type,
    stock,
    unit: "kg",
    color: materialColors[type] || "bg-secondary",
    percentage: totalStock > 0 ? (stock / totalStock) * 100 : 0,
  }));

  // Sort by stock descending
  materials.sort((a, b) => b.stock - a.stock);

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-lg font-semibold text-foreground mb-4">Materialbestand</h3>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Kein Material auf Lager</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {materials.map((material) => (
              <div key={material.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{material.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {material.stock.toLocaleString("de-DE")} {material.unit}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", material.color)}
                    style={{ width: `${material.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gesamtbestand</span>
              <span className="text-lg font-bold text-foreground">{totalStock.toLocaleString("de-DE")} kg</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
