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
          inspected_at: string | null
          inspected_by: string | null
          live_activity_id: string | null
          manager_completion_pct: number | null
          manager_force_closed: boolean
          manager_notes: string | null
          manager_photo_urls: string[]
          notes: string | null
          operative_count: number
          photo_urls: string[]
          progress_status: string
          project_id: string
          qs_notes: string | null
          qs_rejection_reason: string | null
          qs_remeasure_required: boolean
          qs_status: string
          qs_verified_pct: number | null
          scheduled_finish: string
          start_time: string
          subcontractor_id: string
          trade_package: string | null
          updated_at: string
          workface_id: string | null
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
          inspected_at?: string | null
          inspected_by?: string | null
          live_activity_id?: string | null
          manager_completion_pct?: number | null
          manager_force_closed?: boolean
          manager_notes?: string | null
          manager_photo_urls?: string[]
          notes?: string | null
          operative_count: number
          photo_urls?: string[]
          progress_status: string
          project_id: string
          qs_notes?: string | null
          qs_rejection_reason?: string | null
          qs_remeasure_required?: boolean
          qs_status?: string
          qs_verified_pct?: number | null
          scheduled_finish: string
          start_time: string
          subcontractor_id: string
          trade_package?: string | null
          updated_at?: string
          workface_id?: string | null
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
          inspected_at?: string | null
          inspected_by?: string | null
          live_activity_id?: string | null
          manager_completion_pct?: number | null
          manager_force_closed?: boolean
          manager_notes?: string | null
          manager_photo_urls?: string[]
          notes?: string | null
          operative_count?: number
          photo_urls?: string[]
          progress_status?: string
          project_id?: string
          qs_notes?: string | null
          qs_rejection_reason?: string | null
          qs_remeasure_required?: boolean
          qs_status?: string
          qs_verified_pct?: number | null
          scheduled_finish?: string
          start_time?: string
          subcontractor_id?: string
          trade_package?: string | null
          updated_at?: string
          workface_id?: string | null
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
            foreignKeyName: "daily_site_diaries_workface_id_fkey"
            columns: ["workface_id"]
            isOneToOne: false
            referencedRelation: "workfaces"
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
      diary_amendments: {
        Row: {
          changed_by: string
          created_at: string
          diary_id: string
          id: string
          new_manager_completion_pct: number | null
          new_qs_status: string | null
          new_qs_verified_pct: number | null
          previous_manager_completion_pct: number | null
          previous_qs_status: string | null
          previous_qs_verified_pct: number | null
          project_id: string
          reason: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          diary_id: string
          id?: string
          new_manager_completion_pct?: number | null
          new_qs_status?: string | null
          new_qs_verified_pct?: number | null
          previous_manager_completion_pct?: number | null
          previous_qs_status?: string | null
          previous_qs_verified_pct?: number | null
          project_id: string
          reason: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          diary_id?: string
          id?: string
          new_manager_completion_pct?: number | null
          new_qs_status?: string | null
          new_qs_verified_pct?: number | null
          previous_manager_completion_pct?: number | null
          previous_qs_status?: string | null
          previous_qs_verified_pct?: number | null
          project_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_amendments_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "daily_site_diaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_amendments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
      ifc_model_elements: {
        Row: {
          created_at: string
          express_id: number | null
          global_id: string
          id: string
          ifc_type: string
          long_name: string | null
          model_id: string
          name: string | null
          object_type: string | null
          storey: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          express_id?: number | null
          global_id: string
          id?: string
          ifc_type?: string
          long_name?: string | null
          model_id: string
          name?: string | null
          object_type?: string | null
          storey?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          express_id?: number | null
          global_id?: string
          id?: string
          ifc_type?: string
          long_name?: string | null
          model_id?: string
          name?: string | null
          object_type?: string | null
          storey?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ifc_model_elements_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "project_ifc_models"
            referencedColumns: ["id"]
          },
        ]
      }
      live_site_activity: {
        Row: {
          activity_id: string | null
          created_at: string
          drawing_id: string | null
          hazard_scanned: boolean
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
          workface_id: string | null
          x_pct: number
          y_pct: number
          zone_id: string | null
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          drawing_id?: string | null
          hazard_scanned?: boolean
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
          workface_id?: string | null
          x_pct: number
          y_pct: number
          zone_id?: string | null
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          drawing_id?: string | null
          hazard_scanned?: boolean
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
          workface_id?: string | null
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
            foreignKeyName: "live_site_activity_workface_id_fkey"
            columns: ["workface_id"]
            isOneToOne: false
            referencedRelation: "workfaces"
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
          extraction_started_at: string | null
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
          extraction_started_at?: string | null
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
          extraction_started_at?: string | null
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
      look_aheads: {
        Row: {
          created_at: string
          date: string
          id: string
          is_high_risk: boolean
          permit_required: boolean
          recorded_by: string | null
          subcontractor_id: string
          updated_at: string
          work_plan: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          is_high_risk?: boolean
          permit_required?: boolean
          recorded_by?: string | null
          subcontractor_id: string
          updated_at?: string
          work_plan?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_high_risk?: boolean
          permit_required?: boolean
          recorded_by?: string | null
          subcontractor_id?: string
          updated_at?: string
          work_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "look_aheads_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link_to: string | null
          project_id: string | null
          read_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link_to?: string | null
          project_id?: string | null
          read_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_to?: string | null
          project_id?: string | null
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      org_activity_types: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_activity_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          is_standard: boolean
          org_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          is_standard?: boolean
          org_id: string
          role: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          is_standard?: boolean
          org_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          is_standard: boolean
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_standard?: boolean
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_standard?: boolean
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          company_number: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          registered_address: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          company_number?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          registered_address?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          company_number?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          registered_address?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      permit_events: {
        Row: {
          activity_id: string | null
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          permit_id: string | null
          project_id: string
          reason: string | null
        }
        Insert: {
          activity_id?: string | null
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          permit_id?: string | null
          project_id: string
          reason?: string | null
        }
        Update: {
          activity_id?: string | null
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          permit_id?: string | null
          project_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permit_events_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_events_permit_id_fkey"
            columns: ["permit_id"]
            isOneToOne: false
            referencedRelation: "permits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permit_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      private_programme_tasks: {
        Row: {
          created_at: string
          end_date: string
          id: string
          local_ref: string
          package_label: string | null
          programme_id: string
          seq: number
          start_date: string
          status: string
          task_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          local_ref?: string
          package_label?: string | null
          programme_id: string
          seq?: number
          start_date: string
          status?: string
          task_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          local_ref?: string
          package_label?: string | null
          programme_id?: string
          seq?: number
          start_date?: string
          status?: string
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_programme_tasks_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "private_programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      private_programmes: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_user_id: string
          packages: string[]
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_user_id: string
          packages?: string[]
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_user_id?: string
          packages?: string[]
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_programmes_project_id_fkey"
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
          org_id: string | null
          selected_role: string | null
          trial_ends_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          org_id?: string | null
          selected_role?: string | null
          trial_ends_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          org_id?: string | null
          selected_role?: string | null
          trial_ends_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
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
      programme_package_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          package_key: string
          project_id: string
          source_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          package_key: string
          project_id: string
          source_label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          package_key?: string
          project_id?: string
          source_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_package_links_project_id_fkey"
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
          duration_days: number | null
          end_date: string
          id: string
          location: string | null
          package_ref: string | null
          plain_english: string
          predecessors: string[]
          programme_upload_id: string
          project_id: string
          start_date: string
          task_name: string
          task_ref: string | null
          trade: string | null
        }
        Insert: {
          allowed_days?: number | null
          created_at?: string
          duration_days?: number | null
          end_date: string
          id?: string
          location?: string | null
          package_ref?: string | null
          plain_english: string
          predecessors?: string[]
          programme_upload_id: string
          project_id: string
          start_date: string
          task_name: string
          task_ref?: string | null
          trade?: string | null
        }
        Update: {
          allowed_days?: number | null
          created_at?: string
          duration_days?: number | null
          end_date?: string
          id?: string
          location?: string | null
          package_ref?: string | null
          plain_english?: string
          predecessors?: string[]
          programme_upload_id?: string
          project_id?: string
          start_date?: string
          task_name?: string
          task_ref?: string | null
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
          is_test: boolean
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
          is_test?: boolean
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
          is_test?: boolean
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
      project_activity_descriptions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          label: string
          project_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          label: string
          project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activity_descriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_bible_reports: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          project_id: string
          site_document_id: string
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          id?: string
          project_id: string
          site_document_id: string
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          site_document_id?: string
          source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_bible_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_bible_reports_site_document_id_fkey"
            columns: ["site_document_id"]
            isOneToOne: false
            referencedRelation: "site_documents"
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
          org_id: string
          photo_path: string | null
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
          org_id: string
          photo_path?: string | null
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
          org_id?: string
          photo_path?: string | null
          project_admin_id?: string | null
          project_number?: string | null
          scope_brief?: string | null
          site_address?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
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
      registers: {
        Row: {
          asset_name: string | null
          certificate_url: string | null
          created_at: string
          id: string
          inspection_date: string | null
          inspector: string | null
          next_inspection_due: string | null
          recorded_by: string | null
          subcontractor_id: string
          type: string
          updated_at: string
        }
        Insert: {
          asset_name?: string | null
          certificate_url?: string | null
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspector?: string | null
          next_inspection_due?: string | null
          recorded_by?: string | null
          subcontractor_id: string
          type: string
          updated_at?: string
        }
        Update: {
          asset_name?: string | null
          certificate_url?: string | null
          created_at?: string
          id?: string
          inspection_date?: string | null
          inspector?: string | null
          next_inspection_due?: string | null
          recorded_by?: string | null
          subcontractor_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registers_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      short_term_programme_annotations: {
        Row: {
          author_user_id: string
          created_at: string
          id: string
          note: string
          programme_id: string
          task_id: string | null
        }
        Insert: {
          author_user_id: string
          created_at?: string
          id?: string
          note: string
          programme_id: string
          task_id?: string | null
        }
        Update: {
          author_user_id?: string
          created_at?: string
          id?: string
          note?: string
          programme_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "short_term_programme_annotations_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "short_term_programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_term_programme_annotations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "short_term_programme_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      short_term_programme_tasks: {
        Row: {
          created_at: string
          end_date: string
          id: string
          local_ref: string
          predecessors: string[]
          programme_id: string
          seq: number
          start_date: string
          status: string
          task_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          local_ref: string
          predecessors?: string[]
          programme_id: string
          seq?: number
          start_date: string
          status?: string
          task_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          local_ref?: string
          predecessors?: string[]
          programme_id?: string
          seq?: number
          start_date?: string
          status?: string
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_term_programme_tasks_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "short_term_programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      short_term_programmes: {
        Row: {
          company_name: string
          created_at: string
          created_by: string
          created_via: string
          id: string
          package_invite_id: string
          package_label: string
          project_id: string
          site_document_id: string | null
          site_manager_accepted_at: string | null
          site_manager_accepted_by: string | null
          site_manager_user_id: string | null
          status: string
          subcontractor_accepted_at: string | null
          subcontractor_accepted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          created_by: string
          created_via: string
          id?: string
          package_invite_id: string
          package_label: string
          project_id: string
          site_document_id?: string | null
          site_manager_accepted_at?: string | null
          site_manager_accepted_by?: string | null
          site_manager_user_id?: string | null
          status?: string
          subcontractor_accepted_at?: string | null
          subcontractor_accepted_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          created_by?: string
          created_via?: string
          id?: string
          package_invite_id?: string
          package_label?: string
          project_id?: string
          site_document_id?: string | null
          site_manager_accepted_at?: string | null
          site_manager_accepted_by?: string | null
          site_manager_user_id?: string | null
          status?: string
          subcontractor_accepted_at?: string | null
          subcontractor_accepted_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_term_programmes_package_invite_id_fkey"
            columns: ["package_invite_id"]
            isOneToOne: false
            referencedRelation: "subcontractor_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_term_programmes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_term_programmes_site_document_id_fkey"
            columns: ["site_document_id"]
            isOneToOne: false
            referencedRelation: "site_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      site_documents: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          bucket: string
          content_hash: string | null
          created_at: string
          extraction_error: string | null
          extraction_status: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          revision_of: string | null
          superseded_by: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          bucket?: string
          content_hash?: string | null
          created_at?: string
          extraction_error?: string | null
          extraction_status?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          revision_of?: string | null
          superseded_by?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          bucket?: string
          content_hash?: string | null
          created_at?: string
          extraction_error?: string | null
          extraction_status?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          revision_of?: string | null
          superseded_by?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_documents_revision_of_fkey"
            columns: ["revision_of"]
            isOneToOne: false
            referencedRelation: "site_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "site_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      snag_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          org_id: string
          snag_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          org_id: string
          snag_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          org_id?: string
          snag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snag_comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snag_comments_snag_id_fkey"
            columns: ["snag_id"]
            isOneToOne: false
            referencedRelation: "snags"
            referencedColumns: ["id"]
          },
        ]
      }
      snag_projects: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          org_id: string
          site_address: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          org_id: string
          site_address?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          org_id?: string
          site_address?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snag_projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      snags: {
        Row: {
          cause: string | null
          created_at: string
          created_by: string
          defect_title: string
          description: string | null
          hs_notes: string | null
          id: string
          org_id: string
          photo_path: string
          project_id: string | null
          rectification_option_a: string | null
          rectification_option_b: string | null
          regulatory_citations: Json
          severity: string
          snag_project_id: string | null
          status: string
          trade: string | null
          tradesman_hack: string | null
          updated_at: string
        }
        Insert: {
          cause?: string | null
          created_at?: string
          created_by: string
          defect_title: string
          description?: string | null
          hs_notes?: string | null
          id?: string
          org_id: string
          photo_path: string
          project_id?: string | null
          rectification_option_a?: string | null
          rectification_option_b?: string | null
          regulatory_citations?: Json
          severity?: string
          snag_project_id?: string | null
          status?: string
          trade?: string | null
          tradesman_hack?: string | null
          updated_at?: string
        }
        Update: {
          cause?: string | null
          created_at?: string
          created_by?: string
          defect_title?: string
          description?: string | null
          hs_notes?: string | null
          id?: string
          org_id?: string
          photo_path?: string
          project_id?: string | null
          rectification_option_a?: string | null
          rectification_option_b?: string | null
          regulatory_citations?: Json
          severity?: string
          snag_project_id?: string | null
          status?: string
          trade?: string | null
          tradesman_hack?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snags_snag_project_id_fkey"
            columns: ["snag_project_id"]
            isOneToOne: false
            referencedRelation: "snag_projects"
            referencedColumns: ["id"]
          },
        ]
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
          package_manager_id: string | null
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
          package_manager_id?: string | null
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
          package_manager_id?: string | null
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
      subcontractor_pack_issues: {
        Row: {
          byte_size: number | null
          counts: Json
          created_at: string
          filename: string
          generated_at: string
          generated_by: string
          id: string
          org_id: string | null
          project_id: string
          range_end: string | null
          range_start: string | null
          storage_path: string
          subcontractor_id: string
          updated_at: string
          version: number
        }
        Insert: {
          byte_size?: number | null
          counts?: Json
          created_at?: string
          filename: string
          generated_at?: string
          generated_by: string
          id?: string
          org_id?: string | null
          project_id: string
          range_end?: string | null
          range_start?: string | null
          storage_path: string
          subcontractor_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          byte_size?: number | null
          counts?: Json
          created_at?: string
          filename?: string
          generated_at?: string
          generated_by?: string
          id?: string
          org_id?: string | null
          project_id?: string
          range_end?: string | null
          range_start?: string | null
          storage_path?: string
          subcontractor_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcontractor_pack_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontractor_pack_issues_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontractors: {
        Row: {
          company_name: string
          created_at: string
          id: string
          manager_name: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          id?: string
          manager_name?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          manager_name?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcontractors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      toolbox_talks: {
        Row: {
          attachment_url: string | null
          attendance_list: Json
          created_at: string
          date: string
          id: string
          notes: string | null
          presenter: string | null
          recorded_by: string | null
          subcontractor_id: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          attendance_list?: Json
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          presenter?: string | null
          recorded_by?: string | null
          subcontractor_id: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          attendance_list?: Json
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          presenter?: string | null
          recorded_by?: string | null
          subcontractor_id?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_talks_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
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
          drawing_id: string | null
          id: string
          level: string | null
          logistics_plan_id: string | null
          name: string
          project_id: string
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          drawing_id?: string | null
          id?: string
          level?: string | null
          logistics_plan_id?: string | null
          name: string
          project_id: string
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          drawing_id?: string | null
          id?: string
          level?: string | null
          logistics_plan_id?: string | null
          name?: string
          project_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_zones_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "project_drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_zones_logistics_plan_id_fkey"
            columns: ["logistics_plan_id"]
            isOneToOne: false
            referencedRelation: "logistics_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          card_expiry: string | null
          card_number: string | null
          card_type: string | null
          competency_card_url: string | null
          created_at: string
          id: string
          name: string
          recorded_by: string | null
          role: string | null
          subcontractor_id: string
          updated_at: string
        }
        Insert: {
          card_expiry?: string | null
          card_number?: string | null
          card_type?: string | null
          competency_card_url?: string | null
          created_at?: string
          id?: string
          name: string
          recorded_by?: string | null
          role?: string | null
          subcontractor_id: string
          updated_at?: string
        }
        Update: {
          card_expiry?: string | null
          card_number?: string | null
          card_type?: string | null
          competency_card_url?: string | null
          created_at?: string
          id?: string
          name?: string
          recorded_by?: string | null
          role?: string | null
          subcontractor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_subcontractor_id_fkey"
            columns: ["subcontractor_id"]
            isOneToOne: false
            referencedRelation: "subcontractors"
            referencedColumns: ["id"]
          },
        ]
      }
      workfaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          package_invite_id: string | null
          project_id: string
          source: string
          stage: string | null
          status: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          package_invite_id?: string | null
          project_id: string
          source?: string
          stage?: string | null
          status?: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          package_invite_id?: string | null
          project_id?: string
          source?: string
          stage?: string | null
          status?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workfaces_package_invite_id_fkey"
            columns: ["package_invite_id"]
            isOneToOne: false
            referencedRelation: "subcontractor_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workfaces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workfaces_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "work_zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_org_invite: {
        Args: { _token: string }
        Returns: {
          out_org_id: string
          out_role: string
        }[]
      }
      accept_short_term_programme: {
        Args: { _programme_id: string }
        Returns: string
      }
      accept_subcontractor_invite: {
        Args: { _token_hash: string }
        Returns: {
          project_id: string
          trade_packages: string[]
        }[]
      }
      add_site_manager_to_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: undefined
      }
      amend_approved_diary: {
        Args: {
          _diary_id: string
          _new_manager_completion_pct: number
          _reason: string
        }
        Returns: string
      }
      backfill_pin_activities: {
        Args: { _project_id?: string }
        Returns: number
      }
      can_admin_site_document: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_project_photo: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_site_document: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      designate_subcontractor_pm_seat: {
        Args: { _invite_id: string }
        Returns: string
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_owner_org_membership: {
        Args: { _org_id: string }
        Returns: boolean
      }
      get_subcontractor_project_id: {
        Args: { sub_id: string }
        Returns: string
      }
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
      high_risk_categories: { Args: never; Returns: string[] }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
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
      issue_activity_permit: {
        Args: {
          _activity_id: string
          _permit_type: string
          _valid_hours?: number
        }
        Returns: string
      }
      issue_pin_permit: {
        Args: { _pin_id: string; _valid_hours?: number }
        Returns: string
      }
      list_project_site_managers: {
        Args: { _project_id: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      list_project_subcontractor_directory: {
        Args: { _project_id: string }
        Returns: {
          accepted_at: string
          company_name: string
          created_at: string
          id: string
          pm_name: string
          supervisor_name: string
          trade_packages: string[]
        }[]
      }
      list_unassigned_site_managers: {
        Args: { _project_id: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      manager_authorise_diary: {
        Args: {
          _diary_id: string
          _manager_completion_pct: number
          _manager_notes?: string
          _manager_photo_urls?: string[]
        }
        Returns: undefined
      }
      manager_force_checkout: {
        Args: { _completion_pct: number; _notes: string; _pin_id: string }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_invite_companies: {
        Args: { _project_id: string; _user_id: string }
        Returns: string[]
      }
      org_admin_count: { Args: { _org_id: string }; Returns: number }
      project_delete_cascade_gaps: {
        Args: never
        Returns: {
          child_column: string
          child_table: string
          delete_rule: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      revoke_permit: {
        Args: { _permit_id: string; _reason?: string }
        Returns: boolean
      }
      send_short_term_programme_for_approval: {
        Args: { _programme_id: string }
        Returns: undefined
      }
      site_document_project_ids: {
        Args: { _document_id: string }
        Returns: string[]
      }
      stp_role_for: {
        Args: { _programme_id: string; _user_id: string }
        Returns: string
      }
      stp_visible: {
        Args: {
          _package_invite_id: string
          _project_id: string
          _user_id: string
        }
        Returns: boolean
      }
      subcontractor_project_id: { Args: { _sub_id: string }; Returns: string }
      subcontractor_seat_usage: {
        Args: { _company_name: string; _project_id: string }
        Returns: {
          admin_cap: number
          admin_used: number
          pm_cap: number
          pm_used: number
          readonly_cap: number
          readonly_used: number
          total_cap: number
        }[]
      }
      suggest_workfaces: { Args: { _project_id: string }; Returns: string[] }
      workface_approved_completion: {
        Args: { _project_id: string }
        Returns: {
          pct: number
          workface_id: string
        }[]
      }
      zone_approved_completion: {
        Args: { _project_id: string }
        Returns: {
          total_pct: number
          zone_id: string
        }[]
      }
      zone_runtime_progress: {
        Args: { _project_id: string }
        Returns: {
          all_workfaces_complete: boolean
          progress_pct: number
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
