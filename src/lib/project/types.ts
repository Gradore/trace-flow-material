import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type Partner = Tables["project_partners"]["Row"];
export type PartnerInsert = Tables["project_partners"]["Insert"];
export type PartnerContact = Tables["project_contacts"]["Row"];
export type Phase = Tables["project_phases"]["Row"];
export type ProjectTask = Tables["project_tasks"]["Row"];
export type TaskDependency = Tables["project_task_dependencies"]["Row"];
export type MaterialBatch = Tables["material_batches"]["Row"];
export type DoeSeries = Tables["doe_series"]["Row"];
export type TestRun = Tables["test_runs"]["Row"];
export type TestRunParameter = Tables["test_run_parameters"]["Row"];
export type FractionSpec = Tables["fraction_specs"]["Row"];
export type OutputFraction = Tables["output_fractions"]["Row"];
export type FractionAnalysis = Tables["fraction_analyses"]["Row"];
export type AnalysisResult = Tables["fraction_analysis_results"]["Row"];
export type ProductTest = Tables["product_tests"]["Row"];
export type ProductTestResult = Tables["product_test_results"]["Row"];
export type EmailTemplate = Tables["project_email_templates"]["Row"];
export type Communication = Tables["project_communications"]["Row"];
export type AiAnalysis = Tables["ai_analyses"]["Row"];
export type ProjectRisk = Tables["project_risks"]["Row"];

/** A DoE factor as stored in doe_series.factors (jsonb). */
export interface DoeFactor {
  key: string;
  label: string;
  unit?: string;
  levels: (string | number)[];
}

export function parseDoeFactors(value: unknown): DoeFactor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const f = entry as Record<string, unknown>;
    if (typeof f.key !== "string" || !Array.isArray(f.levels)) return [];
    return [{
      key: f.key,
      label: typeof f.label === "string" ? f.label : f.key,
      unit: typeof f.unit === "string" ? f.unit : undefined,
      levels: f.levels as (string | number)[],
    }];
  });
}
