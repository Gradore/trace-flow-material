import { cn } from "@/lib/utils";

const materials = [
  { name: "GFK-UP", stock: 12500, unit: "kg", color: "bg-primary", percentage: 45 },
  { name: "GFK-EP", stock: 8200, unit: "kg", color: "bg-info", percentage: 30 },
  { name: "PP Regranulat", stock: 4500, unit: "kg", color: "bg-warning", percentage: 16 },
  { name: "PA6 Regranulat", stock: 2400, unit: "kg", color: "bg-accent", percentage: 9 },
];

export function MaterialOverview() {
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-lg font-semibold text-foreground mb-4">Materialbestand</h3>
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
          <span className="text-lg font-bold text-foreground">27.600 kg</span>
        </div>
      </div>
    </div>
  );
}
