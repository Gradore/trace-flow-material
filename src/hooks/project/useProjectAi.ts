import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { projectKeys } from "./useProjectData";
import type { AiAnalysis } from "@/lib/project/types";

export type AiAnalysisType =
  | "daily_briefing" | "test_interpretation" | "doe_optimization" | "next_actions"
  | "partner_followup" | "spec_conformity" | "risk_scan" | "weekly_report";

interface RequestArgs {
  analysisType: AiAnalysisType;
  scopeType?: "global" | "phase" | "test_run" | "product_test" | "partner" | "output_fraction" | "doe_series";
  scopeId?: string | null;
}

/**
 * Requests an AI evaluation. The model call and the API key live in the
 * `project-ai` edge function - never in the client.
 */
export function useRequestAiAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ analysisType, scopeType = "global", scopeId = null }: RequestArgs): Promise<AiAnalysis> => {
      const { data, error } = await supabase.functions.invoke("project-ai", {
        body: { analysisType, scopeType, scopeId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data.analysis as AiAnalysis;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.ai });
      queryClient.invalidateQueries({ queryKey: projectKeys.testRuns });
      queryClient.invalidateQueries({ queryKey: projectKeys.analyses });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "KI-Auswertung erstellt" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "KI-Auswertung fehlgeschlagen", description: error.message });
    },
  });
}

export function useAcknowledgeAiAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, actedUpon }: { id: string; actedUpon?: boolean }) => {
      // ai_analyses UPDATE is gated on is_internal_staff(); a filtered row
      // returns zero rows and no error, so the write has to be read back.
      const { data, error } = await supabase
        .from("ai_analyses")
        .update({
          acknowledged_at: new Date().toISOString(),
          ...(actedUpon === undefined ? {} : { acted_upon: actedUpon }),
        })
        .eq("id", id)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Keine Berechtigung oder Auswertung nicht gefunden.");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.ai }),
    onError: (error: Error) =>
      toast({ variant: "destructive", title: "Fehler", description: error.message }),
  });
}
