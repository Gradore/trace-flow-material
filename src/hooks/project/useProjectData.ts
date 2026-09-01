import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PATENT_TASK_CODE } from "@/lib/project/constants";
import type {
  AiAnalysis, AnalysisResult, Communication, DoeSeries, EmailTemplate,
  FractionAnalysis, FractionSpec, MaterialBatch, OutputFraction, Partner,
  PartnerContact, Phase, ProductTest, ProductTestResult, ProjectRisk,
  ProjectTask, TaskDependency, TestRun, TestRunParameter,
} from "@/lib/project/types";

export const projectKeys = {
  partners: ["project", "partners"] as const,
  contacts: ["project", "contacts"] as const,
  phases: ["project", "phases"] as const,
  tasks: ["project", "tasks"] as const,
  taskDeps: ["project", "task-dependencies"] as const,
  batches: ["project", "material-batches"] as const,
  doeSeries: ["project", "doe-series"] as const,
  testRuns: ["project", "test-runs"] as const,
  testRunParams: ["project", "test-run-parameters"] as const,
  fractionSpecs: ["project", "fraction-specs"] as const,
  fractions: ["project", "output-fractions"] as const,
  analyses: ["project", "analyses"] as const,
  analysisResults: ["project", "analysis-results"] as const,
  productTests: ["project", "product-tests"] as const,
  productTestResults: ["project", "product-test-results"] as const,
  templates: ["project", "email-templates"] as const,
  communications: ["project", "communications"] as const,
  ai: ["project", "ai-analyses"] as const,
  risks: ["project", "risks"] as const,
};

/** Everything the project module touches - used to refresh after a write. */
const ALL_KEYS = Object.values(projectKeys);

function fail(context: string, error: { message: string }): never {
  console.error(`${context}:`, error);
  throw new Error(error.message);
}

/* ------------------------------------------------------------------ reads */

export function usePartners() {
  return useQuery({
    queryKey: projectKeys.partners,
    queryFn: async (): Promise<Partner[]> => {
      const { data, error } = await supabase
        .from("project_partners").select("*").order("is_fixed_partner", { ascending: false }).order("name");
      if (error) fail("usePartners", error);
      return data ?? [];
    },
  });
}

export function usePartnerContacts(partnerId?: string) {
  return useQuery({
    queryKey: [...projectKeys.contacts, partnerId ?? "all"],
    queryFn: async (): Promise<PartnerContact[]> => {
      let q = supabase.from("project_contacts").select("*").order("is_primary", { ascending: false });
      if (partnerId) q = q.eq("partner_id", partnerId);
      const { data, error } = await q;
      if (error) fail("usePartnerContacts", error);
      return data ?? [];
    },
  });
}

export function usePhases() {
  return useQuery({
    queryKey: projectKeys.phases,
    queryFn: async (): Promise<Phase[]> => {
      const { data, error } = await supabase.from("project_phases").select("*").order("order_num");
      if (error) fail("usePhases", error);
      return data ?? [];
    },
  });
}

export function useProjectTasks() {
  return useQuery({
    queryKey: projectKeys.tasks,
    queryFn: async (): Promise<ProjectTask[]> => {
      const { data, error } = await supabase.from("project_tasks").select("*").order("code");
      if (error) fail("useProjectTasks", error);
      return data ?? [];
    },
  });
}

export function useTaskDependencies() {
  return useQuery({
    queryKey: projectKeys.taskDeps,
    queryFn: async (): Promise<TaskDependency[]> => {
      const { data, error } = await supabase.from("project_task_dependencies").select("*");
      if (error) fail("useTaskDependencies", error);
      return data ?? [];
    },
  });
}

export function useMaterialBatches() {
  return useQuery({
    queryKey: projectKeys.batches,
    queryFn: async (): Promise<MaterialBatch[]> => {
      const { data, error } = await supabase
        .from("material_batches").select("*").order("received_date", { ascending: false });
      if (error) fail("useMaterialBatches", error);
      return data ?? [];
    },
  });
}

export function useDoeSeries() {
  return useQuery({
    queryKey: projectKeys.doeSeries,
    queryFn: async (): Promise<DoeSeries[]> => {
      const { data, error } = await supabase.from("doe_series").select("*").order("code");
      if (error) fail("useDoeSeries", error);
      return data ?? [];
    },
  });
}

export function useTestRuns() {
  return useQuery({
    queryKey: projectKeys.testRuns,
    queryFn: async (): Promise<TestRun[]> => {
      const { data, error } = await supabase
        .from("test_runs").select("*").order("planned_date", { ascending: false, nullsFirst: false });
      if (error) fail("useTestRuns", error);
      return data ?? [];
    },
  });
}

export function useTestRunParameters(testRunId?: string) {
  return useQuery({
    queryKey: [...projectKeys.testRunParams, testRunId ?? "all"],
    queryFn: async (): Promise<TestRunParameter[]> => {
      let q = supabase.from("test_run_parameters").select("*");
      if (testRunId) q = q.eq("test_run_id", testRunId);
      const { data, error } = await q;
      if (error) fail("useTestRunParameters", error);
      return data ?? [];
    },
  });
}

export function useFractionSpecs() {
  return useQuery({
    queryKey: projectKeys.fractionSpecs,
    queryFn: async (): Promise<FractionSpec[]> => {
      const { data, error } = await supabase.from("fraction_specs").select("*").order("id");
      if (error) fail("useFractionSpecs", error);
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useOutputFractions() {
  return useQuery({
    queryKey: projectKeys.fractions,
    queryFn: async (): Promise<OutputFraction[]> => {
      const { data, error } = await supabase
        .from("output_fractions").select("*").order("created_at", { ascending: false });
      if (error) fail("useOutputFractions", error);
      return data ?? [];
    },
  });
}

export function useFractionAnalyses() {
  return useQuery({
    queryKey: projectKeys.analyses,
    queryFn: async (): Promise<FractionAnalysis[]> => {
      const { data, error } = await supabase
        .from("fraction_analyses").select("*").order("created_at", { ascending: false });
      if (error) fail("useFractionAnalyses", error);
      return data ?? [];
    },
  });
}

export function useAnalysisResults(analysisId?: string) {
  return useQuery({
    queryKey: [...projectKeys.analysisResults, analysisId ?? "all"],
    queryFn: async (): Promise<AnalysisResult[]> => {
      let q = supabase.from("fraction_analysis_results").select("*").order("parameter_key");
      if (analysisId) q = q.eq("analysis_id", analysisId);
      const { data, error } = await q;
      if (error) fail("useAnalysisResults", error);
      return data ?? [];
    },
  });
}

export function useProductTests() {
  return useQuery({
    queryKey: projectKeys.productTests,
    queryFn: async (): Promise<ProductTest[]> => {
      const { data, error } = await supabase
        .from("product_tests").select("*").order("created_at", { ascending: false });
      if (error) fail("useProductTests", error);
      return data ?? [];
    },
  });
}

export function useProductTestResults(productTestId?: string) {
  return useQuery({
    queryKey: [...projectKeys.productTestResults, productTestId ?? "all"],
    queryFn: async (): Promise<ProductTestResult[]> => {
      let q = supabase.from("product_test_results").select("*").order("age_days");
      if (productTestId) q = q.eq("product_test_id", productTestId);
      const { data, error } = await q;
      if (error) fail("useProductTestResults", error);
      return data ?? [];
    },
  });
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: projectKeys.templates,
    queryFn: async (): Promise<EmailTemplate[]> => {
      const { data, error } = await supabase.from("project_email_templates").select("*").order("code");
      if (error) fail("useEmailTemplates", error);
      return data ?? [];
    },
  });
}

export function useCommunications(partnerId?: string) {
  return useQuery({
    queryKey: [...projectKeys.communications, partnerId ?? "all"],
    queryFn: async (): Promise<Communication[]> => {
      let q = supabase.from("project_communications").select("*").order("occurred_at", { ascending: false });
      if (partnerId) q = q.eq("partner_id", partnerId);
      const { data, error } = await q;
      if (error) fail("useCommunications", error);
      return data ?? [];
    },
  });
}

export function useAiAnalyses(analysisType?: string) {
  return useQuery({
    queryKey: [...projectKeys.ai, analysisType ?? "all"],
    queryFn: async (): Promise<AiAnalysis[]> => {
      let q = supabase.from("ai_analyses").select("*").order("created_at", { ascending: false }).limit(100);
      if (analysisType) q = q.eq("analysis_type", analysisType);
      const { data, error } = await q;
      if (error) fail("useAiAnalyses", error);
      return data ?? [];
    },
  });
}

export function useProjectRisks() {
  return useQuery({
    queryKey: projectKeys.risks,
    queryFn: async (): Promise<ProjectRisk[]> => {
      const { data, error } = await supabase
        .from("project_risks").select("*").order("severity", { ascending: false });
      if (error) fail("useProjectRisks", error);
      return data ?? [];
    },
  });
}

/** Is the patent application (P0-2) filed? Gates every phase-2 activity. */
export function usePatentFiled() {
  const { data: tasks, isLoading } = useProjectTasks();
  const patentTask = tasks?.find((t) => t.code === PATENT_TASK_CODE);
  return {
    isLoading,
    patentTask: patentTask ?? null,
    isFiled: patentTask?.status === "done",
  };
}

/* ----------------------------------------------------------------- writes */

type ProjectTable =
  | "project_partners" | "project_contacts" | "project_phases" | "project_tasks"
  | "material_batches" | "doe_series" | "test_runs" | "test_run_parameters"
  | "fraction_specs" | "output_fractions" | "fraction_analyses"
  | "fraction_analysis_results" | "product_tests" | "product_test_results"
  | "project_email_templates" | "project_communications" | "ai_analyses"
  | "project_risks" | "project_task_dependencies";

/**
 * Generic write hook. Every project write invalidates the whole project
 * namespace: the entities are densely cross-linked (a fraction changes a run's
 * yield, a task changes the IP gate) and the data volume is small.
 */
export function useProjectMutation<TVars>(
  run: (vars: TVars) => Promise<unknown>,
  options?: { successMessage?: string; errorMessage?: string; onDone?: () => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      ALL_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      if (options?.successMessage) {
        toast({ title: options.successMessage });
      }
      options?.onDone?.();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: options?.errorMessage ?? "Speichern fehlgeschlagen",
        description: error.message,
      });
    },
  });
}

export function useInvalidateProject() {
  const queryClient = useQueryClient();
  return () => ALL_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
}

export async function nextProjectCode(
  kind: "test_run" | "material_batch" | "analysis" | "product_test" | "doe_series",
): Promise<string> {
  const { data, error } = await supabase.rpc("next_project_code", { _kind: kind });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function nextFractionCode(testRunId: string, targetFractionId: string): Promise<string> {
  const { data, error } = await supabase.rpc("next_fraction_code", {
    _test_run_id: testRunId,
    _target_fraction_id: targetFractionId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export type { ProjectTable };
