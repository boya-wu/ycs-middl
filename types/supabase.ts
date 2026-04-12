Connecting to db 5432
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      billing_decision_records: {
        Row: {
          billing_decision_id: string
          created_at: string
          id: string
          is_active: boolean
          time_record_id: string
        }
        Insert: {
          billing_decision_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          time_record_id: string
        }
        Update: {
          billing_decision_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          time_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_decision_records_billing_decision_id_fkey"
            columns: ["billing_decision_id"]
            isOneToOne: false
            referencedRelation: "billing_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_decision_records_billing_decision_id_fkey"
            columns: ["billing_decision_id"]
            isOneToOne: false
            referencedRelation: "decided_billing_decisions_summary"
            referencedColumns: ["billing_decision_id"]
          },
          {
            foreignKeyName: "billing_decision_records_billing_decision_id_fkey"
            columns: ["billing_decision_id"]
            isOneToOne: false
            referencedRelation: "pending_billing_decisions_summary"
            referencedColumns: ["billing_decision_id"]
          },
          {
            foreignKeyName: "billing_decision_records_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "decided_billing_decisions_summary"
            referencedColumns: ["time_record_id"]
          },
          {
            foreignKeyName: "billing_decision_records_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "pending_billing_decisions_summary"
            referencedColumns: ["time_record_id"]
          },
          {
            foreignKeyName: "billing_decision_records_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "time_records"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_decisions: {
        Row: {
          conflict_resolution_notes: string | null
          conflict_type: string | null
          created_at: string
          decision_maker_id: string | null
          decision_type: string
          final_md: number
          has_conflict: boolean
          id: string
          is_active: boolean
          is_billable: boolean
          is_conflict_resolved: boolean
          is_forced_md: boolean
          reason: string | null
          recommended_md: number | null
          updated_at: string
        }
        Insert: {
          conflict_resolution_notes?: string | null
          conflict_type?: string | null
          created_at?: string
          decision_maker_id?: string | null
          decision_type: string
          final_md: number
          has_conflict?: boolean
          id?: string
          is_active?: boolean
          is_billable?: boolean
          is_conflict_resolved?: boolean
          is_forced_md?: boolean
          reason?: string | null
          recommended_md?: number | null
          updated_at?: string
        }
        Update: {
          conflict_resolution_notes?: string | null
          conflict_type?: string | null
          created_at?: string
          decision_maker_id?: string | null
          decision_type?: string
          final_md?: number
          has_conflict?: boolean
          id?: string
          is_active?: boolean
          is_billable?: boolean
          is_conflict_resolved?: boolean
          is_forced_md?: boolean
          reason?: string | null
          recommended_md?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_decisions_decision_maker_id_fkey"
            columns: ["decision_maker_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      final_billings: {
        Row: {
          billing_date: string
          billing_decision_id: string
          created_at: string
          id: string
          md_amount: number
          project_rate_id: string
          status: string
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          billing_date: string
          billing_decision_id: string
          created_at?: string
          id?: string
          md_amount: number
          project_rate_id: string
          status?: string
          total_amount: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          billing_date?: string
          billing_decision_id?: string
          created_at?: string
          id?: string
          md_amount?: number
          project_rate_id?: string
          status?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_billings_billing_decision_id_fkey"
            columns: ["billing_decision_id"]
            isOneToOne: true
            referencedRelation: "billing_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_billings_billing_decision_id_fkey"
            columns: ["billing_decision_id"]
            isOneToOne: true
            referencedRelation: "decided_billing_decisions_summary"
            referencedColumns: ["billing_decision_id"]
          },
          {
            foreignKeyName: "final_billings_billing_decision_id_fkey"
            columns: ["billing_decision_id"]
            isOneToOne: true
            referencedRelation: "pending_billing_decisions_summary"
            referencedColumns: ["billing_decision_id"]
          },
          {
            foreignKeyName: "final_billings_project_rate_id_fkey"
            columns: ["project_rate_id"]
            isOneToOne: false
            referencedRelation: "project_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_rates: {
        Row: {
          created_at: string
          currency: string
          id: string
          project_id: string
          standard_rate: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          project_id: string
          standard_rate: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          project_id?: string
          standard_rate?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          created_at: string
          email: string
          employee_no: string | null
          id: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          employee_no?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          employee_no?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          budgeted_md: number | null
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          budgeted_md?: number | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          budgeted_md?: number | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_record_facility_workarea: {
        Row: {
          created_at: string
          factory_location: string
          id: string
          time_record_id: string
          work_area_code: string
        }
        Insert: {
          created_at?: string
          factory_location: string
          id?: string
          time_record_id: string
          work_area_code: string
        }
        Update: {
          created_at?: string
          factory_location?: string
          id?: string
          time_record_id?: string
          work_area_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_record_facility_workarea_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "decided_billing_decisions_summary"
            referencedColumns: ["time_record_id"]
          },
          {
            foreignKeyName: "time_record_facility_workarea_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "pending_billing_decisions_summary"
            referencedColumns: ["time_record_id"]
          },
          {
            foreignKeyName: "time_record_facility_workarea_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "time_records"
            referencedColumns: ["id"]
          },
        ]
      }
      time_records: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          department_name: string | null
          factory_location: string
          hours_worked: number | null
          id: string
          import_vendor_no: string | null
          notes: string | null
          record_date: string
          staff_id: string
          task_id: string | null
          updated_at: string
          work_area_code: string | null
        }
        Insert: {
          check_in_time: string
          check_out_time?: string | null
          created_at?: string
          department_name?: string | null
          factory_location: string
          hours_worked?: number | null
          id?: string
          import_vendor_no?: string | null
          notes?: string | null
          record_date: string
          staff_id: string
          task_id?: string | null
          updated_at?: string
          work_area_code?: string | null
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          department_name?: string | null
          factory_location?: string
          hours_worked?: number | null
          id?: string
          import_vendor_no?: string | null
          notes?: string | null
          record_date?: string
          staff_id?: string
          task_id?: string | null
          updated_at?: string
          work_area_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_records_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      decided_billing_decisions_summary: {
        Row: {
          billing_decision_id: string | null
          check_in_time: string | null
          check_out_time: string | null
          decision_type: string | null
          department_name: string | null
          factory_location: string | null
          final_md: number | null
          has_conflict: boolean | null
          has_decision: boolean | null
          hours_worked: number | null
          is_billable: boolean | null
          is_conflict_resolved: boolean | null
          merged_total_hours: number | null
          record_date: string | null
          reason: string | null
          staff_employee_no: string | null
          staff_id: string | null
          staff_name: string | null
          task_id: string | null
          time_record_id: string | null
          work_area_code: string | null
          facility_mapping_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_records_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_billing_decisions_summary: {
        Row: {
          billing_decision_id: string | null
          check_in_time: string | null
          check_out_time: string | null
          decision_type: string | null
          department_name: string | null
          factory_location: string | null
          facility_mapping_count: number | null
          final_md: number | null
          has_conflict: boolean | null
          has_decision: boolean | null
          hours_worked: number | null
          is_billable: boolean | null
          is_conflict_resolved: boolean | null
          merged_total_hours: number | null
          record_date: string | null
          staff_employee_no: string | null
          staff_id: string | null
          staff_name: string | null
          task_id: string | null
          time_record_id: string | null
          work_area_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_records_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_daily_factory_summary: {
        Row: {
          distinct_factory_count: number | null
          factory_locations: string | null
          record_date: string | null
          staff_id: string | null
          time_record_ids: string[] | null
          total_hours_worked: number | null
          total_record_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_billing_summary: {
        Row: {
          task_id: string | null
          used_md: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_records_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_billing_decision_transaction: {
        Args: {
          p_conflict_resolution_notes?: string
          p_conflict_type?: string
          p_decision_ids_to_deactivate?: string[]
          p_decision_maker_id?: string
          p_decision_type: string
          p_final_md: number
          p_has_conflict?: boolean
          p_is_billable?: boolean
          p_is_conflict_resolved?: boolean
          p_is_forced_md?: boolean
          p_reason?: string
          p_recommended_md?: number
          p_task_id?: string
          p_time_record_ids: string[]
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

