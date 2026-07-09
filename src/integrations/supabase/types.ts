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
      bespoke_upgrade_requests: {
        Row: {
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          feature_key: string | null
          id: string
          message: string | null
          project_id: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          feature_key?: string | null
          id?: string
          message?: string | null
          project_id: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          feature_key?: string | null
          id?: string
          message?: string | null
          project_id?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bespoke_upgrade_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_programme_playbooks: {
        Row: {
          ai_daily_summary: string
          created_at: string
          id: string
          playbook_date: string
          programme_upload_id: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          ai_daily_summary: string
          created_at?: string
          id?: string
          playbook_date: string
          programme_upload_id?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          ai_daily_summary?: string
          created_at?: string
          id?: string
          playbook_date?: string
          programme_upload_id?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_programme_playbooks_programme_upload_id_fkey"
            columns: ["programme_upload_id"]
            isOneToOne: false
            referencedRelation: "programme_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_programme_playbooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          force_closed_by: string | null
          hours_logged: number
          id: string
          ifc_synced: boolean
          live_activity_id: string | null
          manager_force_closed: boolean
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
          force_closed_by?: string | null
          hours_logged: number
          id?: string
          ifc_synced?: boolean
          live_activity_id?: string | null
          manager_force_closed?: boolean
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
          force_closed_by?: string | null
          hours_logged?: number
          id?: string
          ifc_synced?: boolean
          live_activity_id?: string | null
          manager_force_closed?: boolean
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
      ifc_element_mappings: {
        Row: {
          created_at: string
          global_id: string
          id: string
          model_id: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          global_id: string
          id?: string
          model_id: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          global_id?: string
          id?: string
          model_id?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ifc_element_mappings_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "project_ifc_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ifc_element_mappings_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "work_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      live_site_activity: {
        Row: {
          activity_id: string | null
          created_at: string
          drawing_id: string | null
          high_risk_flags: string[]
          id: string
          notes: string | null
          operative_count: number
          permit_required: boolean
          permit_status: string
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
          activity_id?: string | null
          created_at?: string
          drawing_id?: string | null
          high_risk_flags?: string[]
          id?: string
          notes?: string | null
          operative_count?: number
          permit_required?: boolean
          permit_status?: string
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
          activity_id?: string | null
          created_at?: string
          drawing_id?: string | null
          high_risk_flags?: string[]
          id?: string
          notes?: string | null
          operative_count?: number
          permit_required?: boolean
          permit_status?: string
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
            foreignKeyName: "live_site_activity_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          selected_role: string | null
          trial_ends_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          selected_role?: string | null
          trial_ends_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          selected_role?: string | null
          trial_ends_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programme_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          progress: number
          project_id: string
          stage: string | null
          stats: Json
          status: string
          strategy: string | null
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          progress?: number
          project_id: string
          stage?: string | null
          stats?: Json
          status?: string
          strategy?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          progress?: number
          project_id?: string
          stage?: string | null
          stats?: Json
          status?: string
          strategy?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_jobs_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "programme_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_manager_notes: {
        Row: {
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          id: string
          note_date: string
          project_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          note_date: string
          project_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          note_date?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_manager_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_reference_tasks: {
        Row: {
          allowed_days: number | null
          created_at: string
          end_date: string
          id: string
          location: string | null
          plain_english: string
          programme_upload_id: string
          project_id: string
          start_date: string
          task_name: string
          trade: string | null
        }
        Insert: {
          allowed_days?: number | null
          created_at?: string
          end_date: string
          id?: string
          location?: string | null
          plain_english: string
          programme_upload_id: string
          project_id: string
          start_date: string
          task_name: string
          trade?: string | null
        }
        Update: {
          allowed_days?: number | null
          created_at?: string
          end_date?: string
          id?: string
          location?: string | null
          plain_english?: string
          programme_upload_id?: string
          project_id?: string
          start_date?: string
          task_name?: string
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_reference_tasks_programme_upload_id_fkey"
            columns: ["programme_upload_id"]
            isOneToOne: false
            referencedRelation: "programme_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_reference_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_uploads: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          project_id: string
          status: string
          storage_path: string | null
          task_count: number
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          project_id: string
          status?: string
          storage_path?: string | null
          task_count?: number
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          status?: string
          storage_path?: string | null
          task_count?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_uploads_project_id_fkey"
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
          in_dabs: boolean
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
          in_dabs?: boolean
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
          in_dabs?: boolean
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
      project_ifc_models: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          original_filename: string
          project_id: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          original_filename: string
          project_id: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          original_filename?: string
          project_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_ifc_models_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      project_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          project_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          project_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_subscriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_weather_readings: {
        Row: {
          apparent_c: number | null
          captured_at: string
          created_at: string
          humidity_pct: number | null
          id: string
          precip_mm: number | null
          project_id: string
          raw: Json | null
          source: string
          summary: string | null
          temperature_c: number | null
          weather_code: number | null
          wind_kph: number | null
        }
        Insert: {
          apparent_c?: number | null
          captured_at?: string
          created_at?: string
          humidity_pct?: number | null
          id?: string
          precip_mm?: number | null
          project_id: string
          raw?: Json | null
          source?: string
          summary?: string | null
          temperature_c?: number | null
          weather_code?: number | null
          wind_kph?: number | null
        }
        Update: {
          apparent_c?: number | null
          captured_at?: string
          created_at?: string
          humidity_pct?: number | null
          id?: string
          precip_mm?: number | null
          project_id?: string
          raw?: Json | null
          source?: string
          summary?: string | null
          temperature_c?: number | null
          weather_code?: number | null
          wind_kph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_weather_readings_project_id_fkey"
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
          latitude: number | null
          longitude: number | null
          master_admin_id: string | null
          name: string
          project_admin_id: string | null
          project_number: string | null
          scope_brief: string | null
          site_address: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          master_admin_id?: string | null
          name: string
          project_admin_id?: string | null
          project_number?: string | null
          scope_brief?: string | null
          site_address: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          master_admin_id?: string | null
          name?: string
          project_admin_id?: string | null
          project_number?: string | null
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
      subcontractor_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_name: string
          corporate_email: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          office_phone: string | null
          pm_email: string | null
          pm_mobile: string | null
          pm_name: string | null
          project_id: string
          registered_address: string | null
          revoked_at: string | null
          seat_role: string
          supervisor_email: string | null
          supervisor_mobile: string | null
          supervisor_name: string | null
          token_hash: string
          trade_packages: string[]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_name: string
          corporate_email?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          office_phone?: string | null
          pm_email?: string | null
          pm_mobile?: string | null
          pm_name?: string | null
          project_id: string
          registered_address?: string | null
          revoked_at?: string | null
          seat_role?: string
          supervisor_email?: string | null
          supervisor_mobile?: string | null
          supervisor_name?: string | null
          token_hash: string
          trade_packages?: string[]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_name?: string
          corporate_email?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          office_phone?: string | null
          pm_email?: string | null
          pm_mobile?: string | null
          pm_name?: string | null
          project_id?: string
          registered_address?: string | null
          revoked_at?: string | null
          seat_role?: string
          supervisor_email?: string | null
          supervisor_mobile?: string | null
          supervisor_name?: string | null
          token_hash?: string
          trade_packages?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      accept_subcontractor_invite: {
        Args: { _token_hash: string }
        Returns: {
          project_id: string
          trade_packages: string[]
        }[]
      }
      can_admin_site_document: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_site_document: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      dev_claim_master_admin: { Args: { _project_id?: string }; Returns: Json }
      has_feature: {
        Args: { _feature: string; _project_id: string }
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
      issue_pin_permit: {
        Args: { _pin_id: string; _valid_hours?: number }
        Returns: string
      }
      manager_force_checkout: {
        Args: { _completion_pct: number; _notes: string; _pin_id: string }
        Returns: string
      }
      site_document_project_ids: {
        Args: { _document_id: string }
        Returns: string[]
      }
      subcontractor_seat_usage: {
        Args: { _company_name: string; _project_id: string }
        Returns: {
          admin_cap: number
          admin_used: number
          readonly_cap: number
          readonly_used: number
          total_cap: number
        }[]
      }
      zone_approved_completion: {
        Args: { _project_id: string }
        Returns: {
          total_pct: number
          zone_id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "master_admin"
        | "project_admin"
        | "site_manager"
        | "subcontractor"
        | "apprentice"
        | "qs"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
      subscription_tier: "baseline" | "structure" | "apex"
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
        "apprentice",
        "qs",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
      subscription_tier: ["baseline", "structure", "apex"],
    },
  },
} as const
