/**
 * Bridges between the project module and the operational part of the app.
 * The project plan is not a silo: a project partner becomes a company, a
 * material batch becomes a goods receipt, an output fraction becomes stock,
 * and an analysis becomes a sample with results.
 */
import { supabase } from "@/integrations/supabase/client";
import type { FractionAnalysis, MaterialBatch, OutputFraction, Partner } from "./types";
import { MATERIAL_CLASSES } from "./constants";

const COMPANY_TYPE_BY_CATEGORY: Record<string, string> = {
  machine_manufacturer: "supplier",
  material_supplier: "supplier",
  lab: "supplier",
  research_institute: "supplier",
  product_partner: "customer",
  customer: "customer",
  toll_processor: "supplier",
  consultant: "supplier",
};

/** Creates (or links) a company record for a project partner. */
export async function linkPartnerToCompany(partner: Partner): Promise<string> {
  if (partner.company_id) return partner.company_id;

  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", partner.name)
    .maybeSingle();

  let companyId = existing?.id ?? null;

  if (!companyId) {
    const { data: companyCode, error: codeError } = await supabase.rpc("generate_unique_id", { prefix: "FIR" });
    if (codeError) throw new Error(codeError.message);

    const { data: created, error } = await supabase
      .from("companies")
      .insert({
        company_id: companyCode,
        name: partner.name,
        type: COMPANY_TYPE_BY_CATEGORY[partner.category] ?? "supplier",
        status: "active",
        address: partner.street,
        postal_code: partner.postal_code,
        city: partner.city,
        country: partner.country,
        email: partner.email,
        phone: partner.phone,
        notes: `Aus Projektpartner übernommen (${partner.category}).`,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    companyId = created.id;
  }

  const { error: linkError } = await supabase
    .from("project_partners")
    .update({ company_id: companyId })
    .eq("id", partner.id);
  if (linkError) throw new Error(linkError.message);

  return companyId;
}

/** Creates a goods receipt (material_inputs) from a project material batch. */
export async function linkBatchToMaterialInput(
  batch: MaterialBatch,
  supplierName: string,
): Promise<string> {
  if (batch.material_input_id) return batch.material_input_id;

  const { data: inputId, error: codeError } = await supabase.rpc("generate_unique_id", { prefix: "ME" });
  if (codeError) throw new Error(codeError.message);

  const materialClass = MATERIAL_CLASSES.find((m) => m.id === batch.material_class);

  const { data: created, error } = await supabase
    .from("material_inputs")
    .insert({
      input_id: inputId,
      supplier: supplierName || "Unbekannt",
      material_type: "GFK",
      material_subtype: materialClass ? `${materialClass.id} — ${materialClass.label}` : batch.material_class,
      weight_kg: batch.weight_kg,
      received_at: batch.received_date ? new Date(batch.received_date).toISOString() : new Date().toISOString(),
      status: "received",
      container_id: batch.container_id,
      notes: `Projektcharge ${batch.batch_code}${batch.notes ? ` — ${batch.notes}` : ""}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: linkError } = await supabase
    .from("material_batches")
    .update({ material_input_id: created.id })
    .eq("id", batch.id);
  if (linkError) throw new Error(linkError.message);

  return created.id;
}

/** Books an output fraction into the operational output_materials stock. */
export async function linkFractionToOutputMaterial(fraction: OutputFraction): Promise<string> {
  if (fraction.output_material_id) return fraction.output_material_id;

  const { data: outputId, error: codeError } = await supabase.rpc("generate_unique_id", { prefix: "AUS" });
  if (codeError) throw new Error(codeError.message);

  const { data: created, error } = await supabase
    .from("output_materials")
    .insert({
      output_id: outputId,
      batch_id: fraction.fraction_code,
      output_type: fraction.target_fraction_id ?? "Fraktion",
      weight_kg: fraction.weight_kg,
      status: fraction.released_for_product_test ? "released" : "produced",
      quality_grade: fraction.target_fraction_id,
      attributes: {
        source: "project_module",
        fraction_code: fraction.fraction_code,
        target_fraction_id: fraction.target_fraction_id,
        yield_pct: fraction.yield_pct,
        storage_location: fraction.storage_location,
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: linkError } = await supabase
    .from("output_fractions")
    .update({ output_material_id: created.id })
    .eq("id", fraction.id);
  if (linkError) throw new Error(linkError.message);

  return created.id;
}

/** Creates an operational sample record for a fraction analysis. */
export async function linkAnalysisToSample(
  analysis: FractionAnalysis,
  fraction: OutputFraction | null,
  samplerName: string,
): Promise<string> {
  if (analysis.sample_id) return analysis.sample_id;

  const { data: sampleCode, error: codeError } = await supabase.rpc("generate_unique_id", { prefix: "PRB" });
  if (codeError) throw new Error(codeError.message);

  const { data: created, error } = await supabase
    .from("samples")
    .insert({
      sample_id: sampleCode,
      sampler_name: samplerName || "Projekt",
      status: analysis.status === "completed" ? "analyzed" : "pending",
      sampled_at: analysis.sample_sent_date
        ? new Date(analysis.sample_sent_date).toISOString()
        : new Date().toISOString(),
      analyzed_at: analysis.result_date ? new Date(analysis.result_date).toISOString() : null,
      output_material_id: fraction?.output_material_id ?? null,
      notes: `Projektanalytik ${analysis.analysis_code}${fraction ? ` für Fraktion ${fraction.fraction_code}` : ""}${analysis.method ? ` (${analysis.method})` : ""}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: linkError } = await supabase
    .from("fraction_analyses")
    .update({ sample_id: created.id })
    .eq("id", analysis.id);
  if (linkError) throw new Error(linkError.message);

  return created.id;
}

/** Copies analysis results into the operational sample_results table. */
export async function pushResultsToSample(
  sampleId: string,
  results: { parameter_key: string; value_numeric: number | null; value_text: string | null; unit: string | null }[],
): Promise<number> {
  const rows = results
    .filter((r) => r.value_numeric !== null || r.value_text)
    .map((r) => ({
      sample_id: sampleId,
      parameter_name: r.parameter_key,
      parameter_value: r.value_numeric !== null ? String(r.value_numeric) : (r.value_text ?? ""),
      unit: r.unit,
    }));
  if (!rows.length) return 0;

  const { error } = await supabase.from("sample_results").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
