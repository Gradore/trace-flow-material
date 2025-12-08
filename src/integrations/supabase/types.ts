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
      output_materials: {
        Row: {
          attributes: Json | null
          batch_id: string
          container_id: string | null
          created_at: string
          created_by: string | null
          destination: string | null
          id: string
          output_id: string
          output_type: string
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
          id?: string
          output_id: string
          output_type: string
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
          id?: string
          output_id?: string
          output_type?: string
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
            foreignKeyName: "output_materials_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "samples"
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
          email: string
          id: string
          name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          id: string
          material_input_id: string | null
          notes: string | null
          processing_step_id: string | null
          sample_id: string
          sampled_at: string
          sampler_id: string | null
          sampler_name: string
          status: string
          updated_at: string
        }
        Insert: {
          analyzed_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          material_input_id?: string | null
          notes?: string | null
          processing_step_id?: string | null
          sample_id: string
          sampled_at?: string
          sampler_id?: string | null
          sampler_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          analyzed_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          material_input_id?: string | null
          notes?: string | null
          processing_step_id?: string | null
          sample_id?: string
          sampled_at?: string
          sampler_id?: string | null
          sampler_name?: string
          status?: string
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
            foreignKeyName: "samples_material_input_id_fkey"
            columns: ["material_input_id"]
            isOneToOne: false
            referencedRelation: "material_inputs"
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
      generate_unique_id: { Args: { prefix: string }; Returns: string }
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
    }
    Enums: {
      app_role: "admin" | "intake" | "production" | "qa" | "customer"
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
      app_role: ["admin", "intake", "production", "qa", "customer"],
    },
  },
} as const
