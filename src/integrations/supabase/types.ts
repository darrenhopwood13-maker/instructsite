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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          description: string
          drawing_id: string | null
          high_risk_flags: string[]
          id: string
          permit_status: string
          project_id: string
          subcontractor_id: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          drawing_id?: string | null
          high_risk_flags?: string[]
          id?: string
          permit_status?: string
          project_id: string
          subcontractor_id: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          drawing_id?: string | null
          high_risk_flags?: string[]
          id?: string
          permit_status?: string
          project_id?: string
          subcontractor_id?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "project_drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "work_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_site_diaries: {
        Row: {
          checkout_time: string
          completion_pct: number
          created_at: string
          drawing_id: string | null
          hours_logged: number
          id: string
          ifc_synced: boolean
          live_activity_id: string | null
          notes: string | null
          operative_count: number
          photo_urls: string[]
          progress_status: string
          project_id: string
          qs_status: string
          scheduled_finish: string
          start_time: string
          subcontractor_id: string
          trade_package: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          checkout_time?: string
          completion_pct: number
          created_at?: string
          drawing_id?: string | null
          hours_logged: number
          id?: string
          ifc_synced?: boolean
          live_activity_id?: string | null
          notes?: string | null
          operative_count: number
          photo_urls?: string[]
          progress_status: string
          project_id: string
          qs_status?: string
          scheduled_finish: string
          start_time: string
          subcontractor_id: string
          trade_package?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          checkout_time?: string
          completion_pct?: number
          created_at?: string
          drawing_id?: string | null
          hours_logged?: number
          id?: string
          ifc_synced?: boolean
          live_activity_id?: string | null
          notes?: string | null
          operative_count?: number
          photo_urls?: string[]
          progress_status?: string
          project_id?: string
          qs_status?: string
          scheduled_finish?: string
          start_time?: string
          subcontractor_id?: string
          trade_package?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_site_diaries_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "project_drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_site_diaries_live_activity_id_fkey"
            columns: ["live_activity_id"]
            isOneToOne: false
            referencedRelation: "live_site_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_site_diaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_site_diaries_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "work_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      document_contents: {
        Row: {
          char_count: number
          content: string
          created_at: string
          document_id: string
          extracted_at: string | null
          extraction_error: string | null
          extraction_status: string
          id: string
          updated_at: string
        }
        Insert: {
          char_count?: number
          content?: string
          created_at?: string
          document_id: string
          extracted_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          updated_at?: string
        }
        Update: {
          char_count?: number
          content?: string
          created_at?: string
          document_id?: string
          extracted_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_contents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "site_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      live_site_activity: {
        Row: {
          created_at: string
          drawing_id: string | null
          id: string
          notes: string | null
          operative_count: number
          project_id: string
          scheduled_finish: string
          start_time: string
          status: string
          subcontractor_id: string
          trade_package: string | null
          updated_at: string
          x_pct: number
          y_pct: number
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          drawing_id?: string | null
          id?: string
          notes?: string | null
          operative_count?: number
          project_id: string
          scheduled_finish: string
          start_time?: string
          status?: string
          subcontractor_id: string
          trade_package?: string | null
          updated_at?: string
          x_pct: number
          y_pct: number
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          drawing_id?: string | null
          id?: string
          notes?: string | null
          operative_count?: number
          project_id?: string
          scheduled_finish?: string
          start_time?: string
          status?: string
          subcontractor_id?: string
          trade_package?: string | null
          updated_at?: string
          x_pct?: number
          y_pct?: number
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_site_activity_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "project_drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_site_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_site_activity_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "work_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_plans: {
        Row: {
          created_at: string
          extracted_zones: Json
          extraction_error: string | null
          extraction_status: string
          id: string
          project_id: string
          site_document_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extracted_zones?: Json
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          project_id: string
          site_document_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_zones?: Json
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          project_id?: string
          site_document_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_plans_site_document_id_fkey"
            columns: ["site_document_id"]
            isOneToOne: true
            referencedRelation: "site_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      permits: {
        Row: {
          activity_id: string | null
          created_at: string
          id: string
          issued_by: string | null
          permit_type: string
          project_id: string
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          permit_type: string
          project_id: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          permit_type?: string
          project_id?: string
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permits_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_drawings: {
        Row: {
          created_at: string
          drawing_no: string | null
          extraction_error: string | null
          extraction_status: string
          id: string
          is_active: boolean
          level: string | null
          pack_id: string | null
          pack_name: string | null
          page_number: number | null
          project_id: string
          revision: string | null
          scale: string | null
          site_document_id: string
          title: string | null
          updated_at: string
          zone: string | null
        }
        Insert: {
          created_at?: string
          drawing_no?: string | null
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          is_active?: boolean
          level?: string | null
          pack_id?: string | null
          pack_name?: string | null
          page_number?: number | null
          project_id: string
          revision?: string | null
          scale?: string | null
          site_document_id: string
          title?: string | null
          updated_at?: string
          zone?: string | null
        }
        Update: {
          created_at?: string
          drawing_no?: string | null
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          is_active?: boolean
          level?: string | null
          pack_id?: string | null
          pack_name?: string | null
          page_number?: number | null
          project_id?: string
          revision?: string | null
          scale?: string | null
          site_document_id?: string
          title?: string | null
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_drawings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_drawings_site_document_id_fkey"
            columns: ["site_document_id"]
            isOneToOne: true
            referencedRelation: "site_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role_on_project: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role_on_project: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role_on_project?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          id: string
          master_admin_id: string | null
          name: string
          project_admin_id: string | null
          scope_brief: string | null
          site_address: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          master_admin_id?: string | null
          name: string
          project_admin_id?: string | null
          scope_brief?: string | null
          site_address: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          master_admin_id?: string | null
          name?: string
          project_admin_id?: string | null
          scope_brief?: string | null
          site_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      rams_documents: {
        Row: {
          created_at: string
          high_risk_flags: string[]
          id: string
          permit_required: boolean
          project_id: string
          site_document_id: string
          trade_package: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          high_risk_flags?: string[]
          id?: string
          permit_required?: boolean
          project_id: string
          site_document_id: string
          trade_package: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          high_risk_flags?: string[]
          id?: string
          permit_required?: boolean
          project_id?: string
          site_document_id?: string
          trade_package?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "rams_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rams_documents_site_document_id_fkey"
            columns: ["site_document_id"]
            isOneToOne: true
            referencedRelation: "site_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      site_documents: {
        Row: {
          bucket: string
          created_at: string
          extraction_error: string | null
          extraction_status: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          bucket?: string
          created_at?: string
          extraction_error?: string | null
          extraction_status?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          bucket?: string
          created_at?: string
          extraction_error?: string | null
          extraction_status?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          updated_at?: string
          uploaded_by?: string
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
      work_zones: {
        Row: {
          created_at: string
          id: string
          level: string | null
          name: string
          project_id: string
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string | null
          name: string
          project_id: string
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          project_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_admin_site_document: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_site_document: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_admin: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      site_document_project_ids: {
        Args: { _document_id: string }
        Returns: string[]
      }
    }
    Enums: {
      app_role:
        | "master_admin"
        | "project_admin"
        | "site_manager"
        | "subcontractor"
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
        "master_admin",
        "project_admin",
        "site_manager",
        "subcontractor",
      ],
    },
  },
} as const
