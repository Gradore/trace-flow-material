import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Layers, Beaker, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StockCategory {
  name: string;
  weight: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  subcategories?: { name: string; weight: number }[];
}

export function StockOverviewCard() {
  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ["stock-overview-detailed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("output_materials")
        .select("output_type, weight_kg, status, attributes, quality_grade")
        .eq("status", "in_stock");
      
      if (error) throw error;
      return data;
    },
  });

  // Categorize materials
  const categories: StockCategory[] = [];

  // GFK (raw composite material - before separation)
  const gfkMaterials = outputs.filter(o => 
    o.output_type === 'gfk' || 
    o.output_type === 'gfk_raw' ||
    o.output_type === 'composite'
  );
  const gfkWeight = gfkMaterials.reduce((sum, o) => sum + Number(o.weight_kg || 0), 0);
  if (gfkWeight > 0) {
    categories.push({
      name: "GFK Rohmaterial",
      weight: gfkWeight,
      color: "bg-blue-500",
      icon: Package,
    });
  }

  // Glass fibers - grouped by grain size and resin type
  const glassFiberMaterials = outputs.filter(o => 
    o.output_type === 'glass_fiber' || 
    o.output_type?.includes('glasfaser') ||
    o.output_type?.includes('fiber')
  );
  const glassFiberWeight = glassFiberMaterials.reduce((sum, o) => sum + Number(o.weight_kg || 0), 0);
  
  // Group by attributes (grain size, resin type)
  const glassFiberByType: Record<string, number> = {};
  glassFiberMaterials.forEach(m => {
    const attrs = m.attributes as Record<string, unknown> || {};
    const grainSize = attrs.grain_size || attrs.koernung || 'Standard';
    const resinType = attrs.resin_type || attrs.harztyp || '';
    const key = resinType ? `${grainSize} - ${resinType}` : String(grainSize);
    glassFiberByType[key] = (glassFiberByType[key] || 0) + Number(m.weight_kg || 0);
  });

  if (glassFiberWeight > 0) {
    categories.push({
      name: "Glasfaser",
      weight: glassFiberWeight,
      color: "bg-primary",
      icon: Layers,
      subcategories: Object.entries(glassFiberByType).map(([name, weight]) => ({ name, weight })),
    });
  }

  // Resin matrix - grouped by grain size and type
  const resinMaterials = outputs.filter(o => 
    o.output_type === 'resin_powder' || 
    o.output_type === 'resin' ||
    o.output_type?.includes('harz') ||
    o.output_type?.includes('matrix')
  );
  const resinWeight = resinMaterials.reduce((sum, o) => sum + Number(o.weight_kg || 0), 0);
  
  const resinByType: Record<string, number> = {};
  resinMaterials.forEach(m => {
    const attrs = m.attributes as Record<string, unknown> || {};
    const grainSize = attrs.grain_size || attrs.koernung || 'Standard';
    const resinType = attrs.resin_type || attrs.harztyp || '';
    const key = resinType ? `${grainSize} - ${resinType}` : String(grainSize);
    resinByType[key] = (resinByType[key] || 0) + Number(m.weight_kg || 0);
  });

  if (resinWeight > 0) {
    categories.push({
      name: "Harzmatrix",
      weight: resinWeight,
      color: "bg-info",
      icon: Beaker,
      subcategories: Object.entries(resinByType).map(([name, weight]) => ({ name, weight })),
    });
  }

  // Other materials (PP, PA, etc.)
  const otherMaterials = outputs.filter(o => 
    !['gfk', 'gfk_raw', 'composite', 'glass_fiber', 'resin_powder', 'resin'].includes(o.output_type) &&
    !o.output_type?.includes('glasfaser') &&
    !o.output_type?.includes('fiber') &&
    !o.output_type?.includes('harz') &&
    !o.output_type?.includes('matrix')
  );
  const otherWeight = otherMaterials.reduce((sum, o) => sum + Number(o.weight_kg || 0), 0);
  
  const otherByType: Record<string, number> = {};
  otherMaterials.forEach(m => {
    const typeName = getTypeName(m.output_type);
    otherByType[typeName] = (otherByType[typeName] || 0) + Number(m.weight_kg || 0);
  });

  if (otherWeight > 0) {
    categories.push({
      name: "Sonstige",
      weight: otherWeight,
      color: "bg-secondary",
      icon: Circle,
      subcategories: Object.entries(otherByType).map(([name, weight]) => ({ name, weight })),
    });
  }

  const totalStock = categories.reduce((sum, cat) => sum + cat.weight, 0);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Lagerbestand nach Kategorie
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Kein Material auf Lager</p>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <category.icon className={cn("h-4 w-4", category.color.replace('bg-', 'text-'))} />
                    <span className="font-medium text-foreground">{category.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatWeight(category.weight)}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", category.color)}
                    style={{ width: `${totalStock > 0 ? (category.weight / totalStock) * 100 : 0}%` }}
                  />
                </div>

                {/* Subcategories */}
                {category.subcategories && category.subcategories.length > 0 && (
                  <div className="pl-6 space-y-1">
                    {category.subcategories.slice(0, 5).map((sub) => (
                      <div key={sub.name} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{sub.name}</span>
                        <span className="text-muted-foreground">{formatWeight(sub.weight)}</span>
                      </div>
                    ))}
                    {category.subcategories.length > 5 && (
                      <span className="text-xs text-muted-foreground">
                        +{category.subcategories.length - 5} weitere
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Total */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Gesamtbestand</span>
                <span className="text-lg font-bold text-foreground">{formatWeight(totalStock)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatWeight(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)} t`;
  }
  return `${kg.toLocaleString("de-DE")} kg`;
}

function getTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    pp_regrind: "PP Regranulat",
    pa_regrind: "PA Regranulat",
    pp: "PP",
    pa: "PA",
    pa6: "PA6",
    pa66: "PA66",
  };
  return typeNames[type] || type;
}
