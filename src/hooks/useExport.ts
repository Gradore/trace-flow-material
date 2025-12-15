import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type ExportType = "material_inputs" | "containers" | "samples" | "output_materials" | "delivery_notes";

const headers: Record<ExportType, string[]> = {
  material_inputs: ["ID", "Lieferant", "Materialart", "Untertyp", "Gewicht (kg)", "Abfallschlüssel", "Status", "Empfangen am", "Bemerkungen"],
  containers: ["Container-ID", "Typ", "Standort", "Status", "Gewicht (kg)", "Volumen (L)", "Erstellt am"],
  samples: ["Proben-ID", "Probenehmer", "Status", "Probenahme", "Analysiert am", "Freigegeben am", "Bemerkungen"],
  output_materials: ["Output-ID", "Batch-ID", "Typ", "Qualitätsgrad", "Gewicht (kg)", "Ziel", "Status", "Erstellt am"],
  delivery_notes: ["Lieferschein-ID", "Typ", "Partner", "Material", "Gewicht (kg)", "Abfallschlüssel", "Erstellt am"],
};

const mappers: Record<ExportType, (row: any) => string[]> = {
  material_inputs: (row) => [
    row.input_id,
    row.supplier,
    row.material_type,
    row.material_subtype || "",
    row.weight_kg,
    row.waste_code || "",
    row.status,
    new Date(row.received_at).toLocaleDateString("de-DE"),
    row.notes || "",
  ],
  containers: (row) => [
    row.container_id,
    row.type,
    row.location || "",
    row.status,
    row.weight_kg || "",
    row.volume_liters || "",
    new Date(row.created_at).toLocaleDateString("de-DE"),
  ],
  samples: (row) => [
    row.sample_id,
    row.sampler_name,
    row.status,
    new Date(row.sampled_at).toLocaleDateString("de-DE"),
    row.analyzed_at ? new Date(row.analyzed_at).toLocaleDateString("de-DE") : "",
    row.approved_at ? new Date(row.approved_at).toLocaleDateString("de-DE") : "",
    row.notes || "",
  ],
  output_materials: (row) => [
    row.output_id,
    row.batch_id,
    row.output_type,
    row.quality_grade || "",
    row.weight_kg,
    row.destination || "",
    row.status,
    new Date(row.created_at).toLocaleDateString("de-DE"),
  ],
  delivery_notes: (row) => [
    row.note_id,
    row.type === "incoming" ? "Eingang" : "Ausgang",
    row.partner_name,
    row.material_description,
    row.weight_kg,
    row.waste_code || "",
    new Date(row.created_at).toLocaleDateString("de-DE"),
  ],
};

const tableNames: Record<ExportType, string> = {
  material_inputs: "Materialeingänge",
  containers: "Container",
  samples: "Proben",
  output_materials: "Ausgangsmaterialien",
  delivery_notes: "Lieferscheine",
};

export function useExport() {
  const exportToCSV = async (type: ExportType) => {
    try {
      const { data, error } = await supabase
        .from(type)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({ title: "Keine Daten zum Exportieren", variant: "destructive" });
        return;
      }

      const header = headers[type];
      const mapper = mappers[type];

      const csvContent = [
        header.join(";"),
        ...data.map((row) => mapper(row).map(cell => `"${cell}"`).join(";")),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${tableNames[type]}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: `${tableNames[type]} exportiert`, description: `${data.length} Einträge` });
    } catch (error: any) {
      toast({ title: "Export fehlgeschlagen", description: error.message, variant: "destructive" });
    }
  };

  const exportDataToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (!data || data.length === 0) {
      toast({ title: "Keine Daten zum Exportieren", variant: "destructive" });
      return;
    }

    const header = Object.keys(data[0]);
    const csvContent = [
      header.join(";"),
      ...data.map((row) => header.map(key => `"${row[key] ?? ""}"`).join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: `${filename} exportiert`, description: `${data.length} Einträge` });
  };

  return { exportToCSV, exportDataToCSV };
}
