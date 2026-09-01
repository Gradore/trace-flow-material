export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      project_partners: {
        Row: {
          id: string
          name: string
          category: string
          subcategory: string | null
          street: string | null
          postal_code: string | null
          city: string | null
          country: string | null
          website: string | null
          phone: string | null
          email: string | null
          status: string
          suitability_rating: number | null
          is_fixed_partner: boolean
          material_classes: string[] | null
          fraction_ids: string[] | null
          notes: string | null
          company_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string
          subcategory?: string | null
          street?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string | null
          website?: string | null
          phone?: string | null
          email?: string | null
          status?: string
          suitability_rating?: number | null
          is_fixed_partner?: boolean
          material_classes?: string[] | null
          fraction_ids?: string[] | null
          notes?: string | null
          company_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          subcategory?: string | null
          street?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string | null
          website?: string | null
          phone?: string | null
          email?: string | null
          status?: string
          suitability_rating?: number | null
          is_fixed_partner?: boolean
          material_classes?: string[] | null
          fraction_ids?: string[] | null
          notes?: string | null
          company_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_partners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contacts: {
        Row: {
          id: string
          partner_id: string
          name: string
          role: string | null
          department: string | null
          email: string | null
          phone: string | null
          mobile: string | null
          is_primary: boolean
          is_decision_maker: boolean
          last_contact_date: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          partner_id: string
          name: string
          role?: string | null
          department?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          is_primary?: boolean
          is_decision_maker?: boolean
          last_contact_date?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          partner_id?: string
          name?: string
          role?: string | null
          department?: string | null
          email?: string | null
          phone?: string | null
          mobile?: string | null
          is_primary?: boolean
          is_decision_maker?: boolean
          last_contact_date?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "project_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          order_num: number
          status: string
          planned_start: string | null
          planned_end: string | null
          actual_start: string | null
          actual_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          order_num?: number
          status?: string
          planned_start?: string | null
          planned_end?: string | null
          actual_start?: string | null
          actual_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          order_num?: number
          status?: string
          planned_start?: string | null
          planned_end?: string | null
          actual_start?: string | null
          actual_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          id: string
          code: string
          phase_id: string | null
          title: string
          description: string | null
          status: string
          priority: string
          due_date: string | null
          estimated_duration_weeks: number | null
          estimated_cost_eur: number | null
          actual_cost_eur: number | null
          assignee: string | null
          partner_id: string | null
          blocker_reason: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          phase_id?: string | null
          title: string
          description?: string | null
          status?: string
          priority?: string
          due_date?: string | null
          estimated_duration_weeks?: number | null
          estimated_cost_eur?: number | null
          actual_cost_eur?: number | null
          assignee?: string | null
          partner_id?: string | null
          blocker_reason?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          phase_id?: string | null
          title?: string
          description?: string | null
          status?: string
          priority?: string
          due_date?: string | null
          estimated_duration_weeks?: number | null
          estimated_cost_eur?: number | null
          actual_cost_eur?: number | null
          assignee?: string | null
          partner_id?: string | null
          blocker_reason?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "project_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_dependencies: {
        Row: {
          task_id: string
          depends_on_task_id: string
        }
        Insert: {
          task_id: string
          depends_on_task_id: string
        }
        Update: {
          task_id?: string
          depends_on_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      material_batches: {
        Row: {
          id: string
          batch_code: string
          supplier_partner_id: string | null
          material_class: string
          resin_type: string | null
          weight_kg: number
          received_date: string | null
          declared_fiber_content_pct: number | null
          declared_filler: string | null
          contamination_notes: string | null
          storage_location: string | null
          status: string
          notes: string | null
          material_input_id: string | null
          container_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          batch_code: string
          supplier_partner_id?: string | null
          material_class?: string
          resin_type?: string | null
          weight_kg?: number
          received_date?: string | null
          declared_fiber_content_pct?: number | null
          declared_filler?: string | null
          contamination_notes?: string | null
          storage_location?: string | null
          status?: string
          notes?: string | null
          material_input_id?: string | null
          container_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          batch_code?: string
          supplier_partner_id?: string | null
          material_class?: string
          resin_type?: string | null
          weight_kg?: number
          received_date?: string | null
          declared_fiber_content_pct?: number | null
          declared_filler?: string | null
          contamination_notes?: string | null
          storage_location?: string | null
          status?: string
          notes?: string | null
          material_input_id?: string | null
          container_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_batches_supplier_partner_id_fkey"
            columns: ["supplier_partner_id"]
            isOneToOne: false
            referencedRelation: "project_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_batches_material_input_id_fkey"
            columns: ["material_input_id"]
            isOneToOne: false
            referencedRelation: "material_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_batches_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
      doe_series: {
        Row: {
          id: string
          code: string
          name: string
          process_line: string
          description: string | null
          factors: Json
          responses: string[] | null
          planned_runs: number
          design_type: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          process_line?: string
          description?: string | null
          factors?: Json
          responses?: string[] | null
          planned_runs?: number
          design_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          process_line?: string
          description?: string | null
          factors?: Json
          responses?: string[] | null
          planned_runs?: number
          design_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_runs: {
        Row: {
          id: string
          run_code: string
          title: string
          partner_id: string | null
          machine_name: string | null
          machine_type: string | null
          input_batch_id: string | null
          input_weight_kg: number | null
          process_line: string
          planned_date: string | null
          actual_date: string | null
          status: string
          doe_run_number: number | null
          doe_series_id: string | null
          cost_eur: number | null
          responsible: string | null
          summary: string | null
          ai_interpretation: string | null
          ai_interpreted_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          run_code: string
          title: string
          partner_id?: string | null
          machine_name?: string | null
          machine_type?: string | null
          input_batch_id?: string | null
          input_weight_kg?: number | null
          process_line?: string
          planned_date?: string | null
          actual_date?: string | null
          status?: string
          doe_run_number?: number | null
          doe_series_id?: string | null
          cost_eur?: number | null
          responsible?: string | null
          summary?: string | null
          ai_interpretation?: string | null
          ai_interpreted_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          run_code?: string
          title?: string
          partner_id?: string | null
          machine_name?: string | null
          machine_type?: string | null
          input_batch_id?: string | null
          input_weight_kg?: number | null
          process_line?: string
          planned_date?: string | null
          actual_date?: string | null
          status?: string
          doe_run_number?: number | null
          doe_series_id?: string | null
          cost_eur?: number | null
          responsible?: string | null
          summary?: string | null
          ai_interpretation?: string | null
          ai_interpreted_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "project_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_input_batch_id_fkey"
            columns: ["input_batch_id"]
            isOneToOne: false
            referencedRelation: "material_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_runs_doe_series_id_fkey"
            columns: ["doe_series_id"]
            isOneToOne: false
            referencedRelation: "doe_series"
            referencedColumns: ["id"]
          },
        ]
      }
      test_run_parameters: {
        Row: {
          id: string
          test_run_id: string
          parameter_key: string
          value_numeric: number | null
          value_text: string | null
          unit: string | null
          created_at: string
        }
        Insert: {
          id?: string
          test_run_id: string
          parameter_key: string
          value_numeric?: number | null
          value_text?: string | null
          unit?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          test_run_id?: string
          parameter_key?: string
          value_numeric?: number | null
          value_text?: string | null
          unit?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_run_parameters_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      fraction_specs: {
        Row: {
          id: string
          name: string
          fiber_length_min_mm: number | null
          fiber_length_max_mm: number | null
          glass_content_min_pct: number | null
          moisture_max_pct: number | null
          fines_max_pct: number | null
          application: string | null
          target_price_eur_t: number | null
          process_line: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          fiber_length_min_mm?: number | null
          fiber_length_max_mm?: number | null
          glass_content_min_pct?: number | null
          moisture_max_pct?: number | null
          fines_max_pct?: number | null
          application?: string | null
          target_price_eur_t?: number | null
          process_line?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          fiber_length_min_mm?: number | null
          fiber_length_max_mm?: number | null
          glass_content_min_pct?: number | null
          moisture_max_pct?: number | null
          fines_max_pct?: number | null
          application?: string | null
          target_price_eur_t?: number | null
          process_line?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      output_fractions: {
        Row: {
          id: string
          fraction_code: string
          test_run_id: string | null
          target_fraction_id: string | null
          weight_kg: number
          yield_pct: number | null
          storage_location: string | null
          retained_sample_kg: number | null
          status: string
          released_for_product_test: boolean
          notes: string | null
          output_material_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          fraction_code: string
          test_run_id?: string | null
          target_fraction_id?: string | null
          weight_kg?: number
          yield_pct?: number | null
          storage_location?: string | null
          retained_sample_kg?: number | null
          status?: string
          released_for_product_test?: boolean
          notes?: string | null
          output_material_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          fraction_code?: string
          test_run_id?: string | null
          target_fraction_id?: string | null
          weight_kg?: number
          yield_pct?: number | null
          storage_location?: string | null
          retained_sample_kg?: number | null
          status?: string
          released_for_product_test?: boolean
          notes?: string | null
          output_material_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "output_fractions_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "output_fractions_target_fraction_id_fkey"
            columns: ["target_fraction_id"]
            isOneToOne: false
            referencedRelation: "fraction_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "output_fractions_output_material_id_fkey"
            columns: ["output_material_id"]
            isOneToOne: false
            referencedRelation: "output_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      fraction_analyses: {
        Row: {
          id: string
          analysis_code: string
          output_fraction_id: string | null
          lab_partner_id: string | null
          method: string | null
          sample_sent_date: string | null
          result_date: string | null
          status: string
          cost_eur: number | null
          ai_interpretation: string | null
          ai_interpreted_at: string | null
          notes: string | null
          sample_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          analysis_code: string
          output_fraction_id?: string | null
          lab_partner_id?: string | null
          method?: string | null
          sample_sent_date?: string | null
          result_date?: string | null
          status?: string
          cost_eur?: number | null
          ai_interpretation?: string | null
          ai_interpreted_at?: string | null
          notes?: string | null
          sample_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          analysis_code?: string
          output_fraction_id?: string | null
          lab_partner_id?: string | null
          method?: string | null
          sample_sent_date?: string | null
          result_date?: string | null
          status?: string
          cost_eur?: number | null
          ai_interpretation?: string | null
          ai_interpreted_at?: string | null
          notes?: string | null
          sample_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraction_analyses_output_fraction_id_fkey"
            columns: ["output_fraction_id"]
            isOneToOne: false
            referencedRelation: "output_fractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraction_analyses_lab_partner_id_fkey"
            columns: ["lab_partner_id"]
            isOneToOne: false
            referencedRelation: "project_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraction_analyses_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      fraction_analysis_results: {
        Row: {
          id: string
          analysis_id: string
          parameter_key: string
          value_numeric: number | null
          value_text: string | null
          unit: string | null
          target_value: number | null
          spec_min: number | null
          spec_max: number | null
          pass_fail: boolean | null
          measured_at: string
        }
        Insert: {
          id?: string
          analysis_id: string
          parameter_key: string
          value_numeric?: number | null
          value_text?: string | null
          unit?: string | null
          target_value?: number | null
          spec_min?: number | null
          spec_max?: number | null
          pass_fail?: boolean | null
          measured_at?: string
        }
        Update: {
          id?: string
          analysis_id?: string
          parameter_key?: string
          value_numeric?: number | null
          value_text?: string | null
          unit?: string | null
          target_value?: number | null
          spec_min?: number | null
          spec_max?: number | null
          pass_fail?: boolean | null
          measured_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraction_analysis_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "fraction_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tests: {
        Row: {
          id: string
          test_code: string
          title: string
          category: string
          partner_id: string | null
          output_fraction_id: string | null
          dosage_pct: number | null
          recipe_notes: string | null
          planned_date: string | null
          actual_date: string | null
          status: string
          cost_eur: number | null
          summary: string | null
          ai_interpretation: string | null
          ai_interpreted_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          test_code: string
          title: string
          category?: string
          partner_id?: string | null
          output_fraction_id?: string | null
          dosage_pct?: number | null
          recipe_notes?: string | null
          planned_date?: string | null
          actual_date?: string | null
          status?: string
          cost_eur?: number | null
          summary?: string | null
          ai_interpretation?: string | null
          ai_interpreted_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          test_code?: string
          title?: string
          category?: string
          partner_id?: string | null
          output_fraction_id?: string | null
          dosage_pct?: number | null
          recipe_notes?: string | null
          planned_date?: string | null
          actual_date?: string | null
          status?: string
          cost_eur?: number | null
          summary?: string | null
          ai_interpretation?: string | null
          ai_interpreted_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "project_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tests_output_fraction_id_fkey"
            columns: ["output_fraction_id"]
            isOneToOne: false
            referencedRelation: "output_fractions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_test_results: {
        Row: {
          id: string
          product_test_id: string
          parameter_key: string
          value_numeric: number | null
          unit: string | null
          age_days: number | null
          baseline_value: number | null
          delta_pct: number | null
          measured_at: string
        }
        Insert: {
          id?: string
          product_test_id: string
          parameter_key: string
          value_numeric?: number | null
          unit?: string | null
          age_days?: number | null
          baseline_value?: number | null
          delta_pct?: number | null
          measured_at?: string
        }
        Update: {
          id?: string
          product_test_id?: string
          parameter_key?: string
          value_numeric?: number | null
          unit?: string | null
          age_days?: number | null
          baseline_value?: number | null
          delta_pct?: number | null
          measured_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_test_results_product_test_id_fkey"
            columns: ["product_test_id"]
            isOneToOne: false
            referencedRelation: "product_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      project_email_templates: {
        Row: {
          id: string
          code: string
          name: string
          category: string
          subject: string
          body_md: string
          placeholders: string[] | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          category?: string
          subject: string
          body_md: string
          placeholders?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          category?: string
          subject?: string
          body_md?: string
          placeholders?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_communications: {
        Row: {
          id: string
          partner_id: string | null
          contact_id: string | null
          direction: string
          channel: string
          subject: string | null
          body: string | null
          template_id: string | null
          occurred_at: string
          linked_task_id: string | null
          linked_test_run_id: string | null
          ai_summary: string | null
          ai_action_items: Json | null
          ai_sentiment: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          partner_id?: string | null
          contact_id?: string | null
          direction?: string
          channel?: string
          subject?: string | null
          body?: string | null
          template_id?: string | null
          occurred_at?: string
          linked_task_id?: string | null
          linked_test_run_id?: string | null
          ai_summary?: string | null
          ai_action_items?: Json | null
          ai_sentiment?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          partner_id?: string | null
          contact_id?: string | null
          direction?: string
          channel?: string
          subject?: string | null
          body?: string | null
          template_id?: string | null
          occurred_at?: string
          linked_task_id?: string | null
          linked_test_run_id?: string | null
          ai_summary?: string | null
          ai_action_items?: Json | null
          ai_sentiment?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_communications_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "project_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_communications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "project_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_communications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_communications_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_communications_linked_test_run_id_fkey"
            columns: ["linked_test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_analyses: {
        Row: {
          id: string
          analysis_type: string
          scope_type: string
          scope_id: string | null
          input_context: Json | null
          output_md: string | null
          recommendations: Json | null
          confidence: string | null
          model: string | null
          tokens_used: number | null
          created_for_user: string | null
          acknowledged_at: string | null
          acted_upon: boolean
          created_at: string
        }
        Insert: {
          id?: string
          analysis_type: string
          scope_type?: string
          scope_id?: string | null
          input_context?: Json | null
          output_md?: string | null
          recommendations?: Json | null
          confidence?: string | null
          model?: string | null
          tokens_used?: number | null
          created_for_user?: string | null
          acknowledged_at?: string | null
          acted_upon?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          analysis_type?: string
          scope_type?: string
          scope_id?: string | null
          input_context?: Json | null
          output_md?: string | null
          recommendations?: Json | null
          confidence?: string | null
          model?: string | null
          tokens_used?: number | null
          created_for_user?: string | null
          acknowledged_at?: string | null
          acted_upon?: boolean
          created_at?: string
        }
        Relationships: []
      }
      project_risks: {
        Row: {
          id: string
          title: string
          description: string | null
          category: string
          probability: number
          impact: number
          severity: number | null
          mitigation_plan: string | null
          owner: string | null
          status: string
          phase_id: string | null
          ai_suggested: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          category?: string
          probability?: number
          impact?: number
          mitigation_plan?: string | null
          owner?: string | null
          status?: string
          phase_id?: string | null
          ai_suggested?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          category?: string
          probability?: number
          impact?: number
          mitigation_plan?: string | null
          owner?: string | null
          status?: string
          phase_id?: string | null
          ai_suggested?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_risks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_id: string
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          industry: string | null
          name: string
          required_properties: Json | null
          source: string | null
          typical_materials: string[] | null
          updated_at: string
        }
        Insert: {
          application_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          name: string
          required_properties?: Json | null
          source?: string | null
          typical_materials?: string[] | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          industry?: string | null
          name?: string
          required_properties?: Json | null
          source?: string | null
          typical_materials?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      batch_allocations: {
        Row: {
          allocated_at: string
          allocated_by: string | null
          allocated_weight_kg: number
          created_at: string
          id: string
          notes: string | null
          order_id: string
          output_material_id: string
        }
        Insert: {
          allocated_at?: string
          allocated_by?: string | null
          allocated_weight_kg: number
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          output_material_id: string
        }
        Update: {
          allocated_at?: string
          allocated_by?: string | null
          allocated_weight_kg?: number
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          output_material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_allocations_output_material_id_fkey"
            columns: ["output_material_id"]
            isOneToOne: false
            referencedRelation: "output_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          status: string
          tax_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: string
          tax_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          status?: string
          tax_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_contracts: {
        Row: {
          company_id: string
          contract_number: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          delivery_terms: string | null
          extracted_data: Json | null
          freight_payer: string | null
          id: string
          material_type: string | null
          notes: string | null
          payment_terms: string | null
          pdf_url: string | null
          price_per_kg: number | null
          status: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          company_id: string
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          delivery_terms?: string | null
          extracted_data?: Json | null
          freight_payer?: string | null
          id?: string
          material_type?: string | null
          notes?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          price_per_kg?: number | null
          status?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          delivery_terms?: string | null
          extracted_data?: Json | null
          freight_payer?: string | null
          id?: string
          material_type?: string | null
          notes?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          price_per_kg?: number | null
          status?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_documents: {
        Row: {
          company_id: string
          created_at: string
          document_type: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          notes: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_type?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          notes?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          notes?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean | null
          last_name: string
          notes: string | null
          phone: string | null
          position: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean | null
          last_name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      containers: {
        Row: {
          container_id: string
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          qr_code: string | null
          status: string
          type: string
          updated_at: string
          volume_liters: number | null
          weight_kg: number | null
        }
        Insert: {
          container_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          qr_code?: string | null
          status?: string
          type: string
          updated_at?: string
          volume_liters?: number | null
          weight_kg?: number | null
        }
        Update: {
          container_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          qr_code?: string | null
          status?: string
          type?: string
          updated_at?: string
          volume_liters?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      datasheet_analyses: {
        Row: {
          analysis_id: string
          analysis_summary: string | null
          analyzed_at: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          error_message: string | null
          extracted_properties: Json | null
          id: string
          manufacturer: string | null
          material_grade: string | null
          material_type: string | null
          original_filename: string | null
          status: string | null
          suggested_applications: string[] | null
          suggested_recipes: string[] | null
        }
        Insert: {
          analysis_id: string
          analysis_summary?: string | null
          analyzed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          error_message?: string | null
          extracted_properties?: Json | null
          id?: string
          manufacturer?: string | null
          material_grade?: string | null
          material_type?: string | null
          original_filename?: string | null
          status?: string | null
          suggested_applications?: string[] | null
          suggested_recipes?: string[] | null
        }
        Update: {
          analysis_id?: string
          analysis_summary?: string | null
          analyzed_at?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          error_message?: string | null
          extracted_properties?: Json | null
          id?: string
          manufacturer?: string | null
          material_grade?: string | null
          material_type?: string | null
          original_filename?: string | null
          status?: string | null
          suggested_applications?: string[] | null
          suggested_recipes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "datasheet_analyses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datasheet_analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          batch_reference: string | null
          created_at: string
          created_by: string | null
          id: string
          material_description: string
          material_input_id: string | null
          note_id: string
          output_material_id: string | null
          partner_name: string
          pdf_url: string | null
          qr_code: string | null
          type: string
          waste_code: string | null
          weight_kg: number
        }
        Insert: {
          batch_reference?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          material_description: string
          material_input_id?: string | null
          note_id: string
          output_material_id?: string | null
          partner_name: string
          pdf_url?: string | null
          qr_code?: string | null
          type: string
          waste_code?: string | null
          weight_kg: number
        }
        Update: {
          batch_reference?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          material_description?: string
          material_input_id?: string | null
          note_id?: string
          output_material_id?: string | null
          partner_name?: string
          pdf_url?: string | null
          qr_code?: string | null
          type?: string
          waste_code?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_material_input_id_fkey"
            columns: ["material_input_id"]
            isOneToOne: false
            referencedRelation: "material_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_output_material_id_fkey"
            columns: ["output_material_id"]
            isOneToOne: false
            referencedRelation: "output_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          container_id: string | null
          created_at: string
          delivery_note_id: string | null
          file_size: number | null
          file_type: string
          file_url: string
          linked_to_type: string | null
          linked_to_id: string | null
          document_type: string | null
          ai_summary: string | null
          ai_extracted_data: Json | null
          id: string
          material_input_id: string | null
          name: string
          output_material_id: string | null
          sample_id: string | null
          tag: string | null
          uploaded_by: string | null
        }
        Insert: {
          container_id?: string | null
          created_at?: string
          delivery_note_id?: string | null
          file_size?: number | null
          file_type: string
          file_url: string
          linked_to_type?: string | null
          linked_to_id?: string | null
          document_type?: string | null
          ai_summary?: string | null
          ai_extracted_data?: Json | null
          id?: string
          material_input_id?: string | null
          name: string
          output_material_id?: string | null
          sample_id?: string | null
          tag?: string | null
          uploaded_by?: string | null
        }
        Update: {
          container_id?: string | null
          created_at?: string
          delivery_note_id?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          linked_to_type?: string | null
          linked_to_id?: string | null
          document_type?: string | null
          ai_summary?: string | null
          ai_extracted_data?: Json | null
          id?: string
          material_input_id?: string | null
          name?: string
          output_material_id?: string | null
          sample_id?: string | null
          tag?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_material_input_id_fkey"
            columns: ["material_input_id"]
            isOneToOne: false
            referencedRelation: "material_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_output_material_id_fkey"
            columns: ["output_material_id"]
            isOneToOne: false
            referencedRelation: "output_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_id: string
          id: string
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          serial_number: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_id: string
          id?: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          id?: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          completed_date: string | null
          created_at: string
          created_by: string | null
          description: string | null
          equipment_id: string
          id: string
          interval_days: number | null
          maintenance_id: string
          maintenance_type: string
          next_due_date: string | null
          notes: string | null
          performed_by: string | null
          priority: string | null
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_id: string
          id?: string
          interval_days?: number | null
          maintenance_id: string
          maintenance_type: string
          next_due_date?: string | null
          notes?: string | null
          performed_by?: string | null
          priority?: string | null
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_id?: string
          id?: string
          interval_days?: number | null
          maintenance_id?: string
          maintenance_type?: string
          next_due_date?: string | null
          notes?: string | null
          performed_by?: string | null
          priority?: string | null
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturer_matches: {
        Row: {
          address: string | null
          application_areas: string[] | null
          company_id: string | null
          confidence_score: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          manufacturer_name: string
          notes: string | null
          product_name: string | null
          search_query: string
          source: string | null
          source_urls: string[] | null
          website: string | null
        }
        Insert: {
          address?: string | null
          application_areas?: string[] | null
          company_id?: string | null
          confidence_score?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer_name: string
          notes?: string | null
          product_name?: string | null
          search_query: string
          source?: string | null
          source_urls?: string[] | null
          website?: string | null
        }
        Update: {
          address?: string | null
          application_areas?: string[] | null
          company_id?: string | null
          confidence_score?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer_name?: string
          notes?: string | null
          product_name?: string | null
          search_query?: string
          source?: string | null
          source_urls?: string[] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturer_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturer_matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_announcements: {
        Row: {
          announcement_id: string
          company_id: string
          confirmed_date: string | null
          confirmed_time_slot: string | null
          contact_id: string | null
          container_count: number | null
          container_type: string
          created_at: string
          created_by: string | null
          estimated_weight_kg: number
          freight_payer: string | null
          id: string
          material_input_id: string | null
          material_subtype: string | null
          material_type: string
          notes: string | null
          preferred_date: string | null
          preferred_time_slot: string | null
          price_per_kg: number | null
          status: string
          updated_at: string
          waste_code: string | null
        }
        Insert: {
          announcement_id: string
          company_id: string
          confirmed_date?: string | null
          confirmed_time_slot?: string | null
          contact_id?: string | null
          container_count?: number | null
          container_type: string
          created_at?: string
          created_by?: string | null
          estimated_weight_kg: number
          freight_payer?: string | null
          id?: string
          material_input_id?: string | null
          material_subtype?: string | null
          material_type: string
          notes?: string | null
          preferred_date?: string | null
          preferred_time_slot?: string | null
          price_per_kg?: number | null
          status?: string
          updated_at?: string
          waste_code?: string | null
        }
        Update: {
          announcement_id?: string
          company_id?: string
          confirmed_date?: string | null
          confirmed_time_slot?: string | null
          contact_id?: string | null
          container_count?: number | null
          container_type?: string
          created_at?: string
          created_by?: string | null
          estimated_weight_kg?: number
          freight_payer?: string | null
          id?: string
          material_input_id?: string | null
          material_subtype?: string | null
          material_type?: string
          notes?: string | null
          preferred_date?: string | null
          preferred_time_slot?: string | null
          price_per_kg?: number | null
          status?: string
          updated_at?: string
          waste_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_announcements_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_announcements_material_input_id_fkey"
            columns: ["material_input_id"]
            isOneToOne: false
            referencedRelation: "material_inputs"
            referencedColumns: ["id"]
          },
        ]
      }
      material_flow_history: {
        Row: {
          container_id: string | null
          created_at: string
          created_by: string | null
          delivery_note_id: string | null
          event_description: string
          event_details: Json | null
          event_type: string
          id: string
          material_input_id: string | null
          output_material_id: string | null
          processing_step_id: string | null
          sample_id: string | null
        }
        Insert: {
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_note_id?: string | null
          event_description: string
          event_details?: Json | null
          event_type: string
          id?: string
          material_input_id?: string | null
          output_material_id?: string | null
          processing_step_id?: string | null
          sample_id?: string | null
        }
        Update: {
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_note_id?: string | null
          event_description?: string
          event_details?: Json | null
          event_type?: string
          id?: string
          material_input_id?: string | null
          output_material_id?: string | null
          processing_step_id?: string | null
          sample_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_flow_history_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_flow_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_flow_history_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_flow_history_material_input_id_fkey"
            columns: ["material_input_id"]
            isOneToOne: false
            referencedRelation: "material_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_flow_history_output_material_id_fkey"
            columns: ["output_material_id"]
            isOneToOne: false
            referencedRelation: "output_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_flow_history_processing_step_id_fkey"
            columns: ["processing_step_id"]
            isOneToOne: false
            referencedRelation: "processing_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_flow_history_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      material_inputs: {
        Row: {
          container_id: string | null
          created_at: string
          created_by: string | null
          id: string
          input_id: string
          material_subtype: string | null
          material_type: string
          notes: string | null
          received_at: string
          status: string
          supplier: string
          updated_at: string
          waste_code: string | null
          weight_kg: number
        }
        Insert: {
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          input_id: string
          material_subtype?: string | null
          material_type: string
          notes?: string | null
          received_at?: string
          status?: string
          supplier: string
          updated_at?: string
          waste_code?: string | null
          weight_kg: number
        }
        Update: {
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          input_id?: string
          material_subtype?: string | null
          material_type?: string
          notes?: string | null
          received_at?: string
          status?: string
          supplier?: string
          updated_at?: string
          waste_code?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_inputs_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_inputs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          related_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_recipe_matches: {
        Row: {
          application_id: string | null
          created_at: string
          id: string
          match_reason: string | null
          match_score: number | null
          order_id: string
          recipe_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          id?: string
          match_reason?: string | null
          match_score?: number | null
          order_id: string
          recipe_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string
          id?: string
          match_reason?: string | null
          match_score?: number | null
          order_id?: string
          recipe_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_recipe_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_recipe_matches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_recipe_matches_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_recipe_matches_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivery_address: string | null
          delivery_deadline: string
          delivery_note_id: string | null
          delivery_partner: string | null
          id: string
          notes: string | null
          order_id: string
          output_material_id: string | null
          product_category: string
          product_grain_size: string
          product_name: string | null
          product_subcategory: string
          production_deadline: string
          quantity_kg: number
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_deadline: string
          delivery_note_id?: string | null
          delivery_partner?: string | null
          id?: string
          notes?: string | null
          order_id: string
          output_material_id?: string | null
          product_category: string
          product_grain_size: string
          product_name?: string | null
          product_subcategory: string
          production_deadline: string
          quantity_kg: number
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_deadline?: string
          delivery_note_id?: string | null
          delivery_partner?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          output_material_id?: string | null
          product_category?: string
          product_grain_size?: string
          product_name?: string | null
          product_subcategory?: string
          production_deadline?: string
          quantity_kg?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_delivery_note"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_output_material"
            columns: ["output_material_id"]
            isOneToOne: false
            referencedRelation: "output_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      output_materials: {
        Row: {
          attributes: Json | null
          batch_id: string
          container_id: string | null
          created_at: string
          created_by: string | null
          destination: string | null
          fiber_size: string | null
          id: string
          output_id: string
          output_type: string
          processing_step_id: string | null
          qr_code: string | null
          quality_grade: string | null
          sample_id: string | null
          status: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          attributes?: Json | null
          batch_id: string
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          fiber_size?: string | null
          id?: string
          output_id: string
          output_type: string
          processing_step_id?: string | null
          qr_code?: string | null
          quality_grade?: string | null
          sample_id?: string | null
          status?: string
          updated_at?: string
          weight_kg: number
        }
        Update: {
          attributes?: Json | null
          batch_id?: string
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          fiber_size?: string | null
          id?: string
          output_id?: string
          output_type?: string
          processing_step_id?: string | null
          qr_code?: string | null
          quality_grade?: string | null
          sample_id?: string | null
          status?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "output_materials_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "output_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "output_materials_processing_step_id_fkey"
            columns: ["processing_step_id"]
            isOneToOne: false
            referencedRelation: "processing_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "output_materials_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_registrations: {
        Row: {
          company_id: string | null
          company_name: string | null
          created_at: string
          email: string
          id: string
          name: string
          rejection_reason: string | null
          requested_role: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          rejection_reason?: string | null
          requested_role: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          rejection_reason?: string | null
          requested_role?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_registrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_registrations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_requests: {
        Row: {
          assigned_to: string | null
          company_id: string
          confirmed_date: string | null
          contact_id: string | null
          container_id: string | null
          created_at: string
          created_by: string | null
          freight_payer: string | null
          id: string
          material_description: string
          notes: string | null
          payment_terms: string | null
          pickup_address: string | null
          preferred_date: string | null
          preferred_time_slot: string | null
          request_id: string
          status: string
          transport_cost: number | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          confirmed_date?: string | null
          contact_id?: string | null
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          freight_payer?: string | null
          id?: string
          material_description: string
          notes?: string | null
          payment_terms?: string | null
          pickup_address?: string | null
          preferred_date?: string | null
          preferred_time_slot?: string | null
          request_id: string
          status?: string
          transport_cost?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          confirmed_date?: string | null
          contact_id?: string | null
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          freight_payer?: string | null
          id?: string
          material_description?: string
          notes?: string | null
          payment_terms?: string | null
          pickup_address?: string | null
          preferred_date?: string | null
          preferred_time_slot?: string | null
          request_id?: string
          status?: string
          transport_cost?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_requests_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          material_input_id: string
          notes: string | null
          operator_id: string | null
          processing_id: string
          progress: number | null
          started_at: string | null
          status: string
          step_order: number
          step_type: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          material_input_id: string
          notes?: string | null
          operator_id?: string | null
          processing_id: string
          progress?: number | null
          started_at?: string | null
          status?: string
          step_order: number
          step_type: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          material_input_id?: string
          notes?: string | null
          operator_id?: string | null
          processing_id?: string
          progress?: number | null
          started_at?: string | null
          status?: string
          step_order?: number
          step_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_steps_material_input_id_fkey"
            columns: ["material_input_id"]
            isOneToOne: false
            referencedRelation: "material_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_steps_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          role?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      recipes: {
        Row: {
          applications: string[] | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          material_composition: Json | null
          name: string
          recipe_id: string
          recommended_for: string[] | null
          source: string | null
          target_properties: Json | null
          updated_at: string
        }
        Insert: {
          applications?: string[] | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          material_composition?: Json | null
          name: string
          recipe_id: string
          recommended_for?: string[] | null
          source?: string | null
          target_properties?: Json | null
          updated_at?: string
        }
        Update: {
          applications?: string[] | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          material_composition?: Json | null
          name?: string
          recipe_id?: string
          recommended_for?: string[] | null
          source?: string | null
          target_properties?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_results: {
        Row: {
          created_at: string
          id: string
          parameter_name: string
          parameter_value: string
          sample_id: string
          unit: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          parameter_name: string
          parameter_value: string
          sample_id: string
          unit?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          parameter_name?: string
          parameter_value?: string
          sample_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sample_results_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
            referencedColumns: ["id"]
          },
        ]
      }
      samples: {
        Row: {
          analyzed_at: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          customer_order_id: string | null
          id: string
          is_retention_sample: boolean
          material_input_id: string | null
          notes: string | null
          output_material_id: string | null
          processing_step_id: string | null
          retention_purpose: string | null
          sample_id: string
          sampled_at: string
          sampler_id: string | null
          sampler_name: string
          status: string
          storage_location: string | null
          updated_at: string
        }
        Insert: {
          analyzed_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_order_id?: string | null
          id?: string
          is_retention_sample?: boolean
          material_input_id?: string | null
          notes?: string | null
          output_material_id?: string | null
          processing_step_id?: string | null
          retention_purpose?: string | null
          sample_id: string
          sampled_at?: string
          sampler_id?: string | null
          sampler_name: string
          status?: string
          storage_location?: string | null
          updated_at?: string
        }
        Update: {
          analyzed_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_order_id?: string | null
          id?: string
          is_retention_sample?: boolean
          material_input_id?: string | null
          notes?: string | null
          output_material_id?: string | null
          processing_step_id?: string | null
          retention_purpose?: string | null
          sample_id?: string
          sampled_at?: string
          sampler_id?: string | null
          sampler_name?: string
          status?: string
          storage_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "samples_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_customer_order_id_fkey"
            columns: ["customer_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_material_input_id_fkey"
            columns: ["material_input_id"]
            isOneToOne: false
            referencedRelation: "material_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_output_material_id_fkey"
            columns: ["output_material_id"]
            isOneToOne: false
            referencedRelation: "output_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_processing_step_id_fkey"
            columns: ["processing_step_id"]
            isOneToOne: false
            referencedRelation: "processing_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "samples_sampler_id_fkey"
            columns: ["sampler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_view_admin: boolean | null
          can_view_api_docs: boolean | null
          can_view_audit_logs: boolean | null
          can_view_companies: boolean | null
          can_view_containers: boolean | null
          can_view_dashboard: boolean | null
          can_view_delivery_notes: boolean | null
          can_view_documents: boolean | null
          can_view_intake: boolean | null
          can_view_logistics: boolean | null
          can_view_maintenance: boolean | null
          can_view_orders: boolean | null
          can_view_output: boolean | null
          can_view_processing: boolean | null
          can_view_recipe_matching: boolean | null
          can_view_reporting: boolean | null
          can_view_sales_search: boolean | null
          can_view_sampling: boolean | null
          can_view_settings: boolean | null
          can_view_traceability: boolean | null
          can_view_users: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_view_admin?: boolean | null
          can_view_api_docs?: boolean | null
          can_view_audit_logs?: boolean | null
          can_view_companies?: boolean | null
          can_view_containers?: boolean | null
          can_view_dashboard?: boolean | null
          can_view_delivery_notes?: boolean | null
          can_view_documents?: boolean | null
          can_view_intake?: boolean | null
          can_view_logistics?: boolean | null
          can_view_maintenance?: boolean | null
          can_view_orders?: boolean | null
          can_view_output?: boolean | null
          can_view_processing?: boolean | null
          can_view_recipe_matching?: boolean | null
          can_view_reporting?: boolean | null
          can_view_sales_search?: boolean | null
          can_view_sampling?: boolean | null
          can_view_settings?: boolean | null
          can_view_traceability?: boolean | null
          can_view_users?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_view_admin?: boolean | null
          can_view_api_docs?: boolean | null
          can_view_audit_logs?: boolean | null
          can_view_companies?: boolean | null
          can_view_containers?: boolean | null
          can_view_dashboard?: boolean | null
          can_view_delivery_notes?: boolean | null
          can_view_documents?: boolean | null
          can_view_intake?: boolean | null
          can_view_logistics?: boolean | null
          can_view_maintenance?: boolean | null
          can_view_orders?: boolean | null
          can_view_output?: boolean | null
          can_view_processing?: boolean | null
          can_view_recipe_matching?: boolean | null
          can_view_reporting?: boolean | null
          can_view_sales_search?: boolean | null
          can_view_sampling?: boolean | null
          can_view_settings?: boolean | null
          can_view_traceability?: boolean | null
          can_view_users?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_order_deadlines: { Args: never; Returns: undefined }
      cleanup_rate_limit_log: { Args: never; Returns: undefined }
      generate_unique_id: { Args: { prefix: string }; Returns: string }
      get_default_permissions_for_role: {
        Args: { role_name: string }
        Returns: Json
      }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_internal_staff: { Args: { _user_id: string }; Returns: boolean }
      is_patent_filed: { Args: never; Returns: boolean }
      set_user_role: { Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] }; Returns: undefined }
      next_project_code: { Args: { _kind: string }; Returns: string }
      next_fraction_code: { Args: { _test_run_id: string; _target_fraction_id: string }; Returns: string }
      log_audit:
        | {
            Args: {
              _action: string
              _changed_fields?: string[]
              _new_data?: Json
              _old_data?: Json
              _record_id: string
              _table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              _action: string
              _changed_fields?: string[]
              _new_data?: Json
              _old_data?: Json
              _record_id: string
              _table_name: string
            }
            Returns: string
          }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "intake"
        | "production"
        | "qa"
        | "customer"
        | "supplier"
        | "logistics"
        | "betriebsleiter"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "intake",
        "production",
        "qa",
        "customer",
        "supplier",
        "logistics",
        "betriebsleiter",
      ],
    },
  },
} as const
