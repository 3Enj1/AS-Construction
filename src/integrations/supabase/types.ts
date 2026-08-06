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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          for_role: Database["public"]["Enums"]["app_role"] | null
          for_user_id: string | null
          id: string
          is_read: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          link_url: string | null
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          for_role?: Database["public"]["Enums"]["app_role"] | null
          for_user_id?: string | null
          id?: string
          is_read?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          link_url?: string | null
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          for_role?: Database["public"]["Enums"]["app_role"] | null
          for_user_id?: string | null
          id?: string
          is_read?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          link_url?: string | null
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_for_user_id_fkey"
            columns: ["for_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepted_terms_at: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          auth_user_id: string
          avatar_url: string | null
          created_at: string
          email: string
          employee_code: string
          full_name: string
          has_accepted_terms: boolean
          id: string
          is_active: boolean
          is_archived: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          accepted_terms_at?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          auth_user_id: string
          avatar_url?: string | null
          created_at?: string
          email: string
          employee_code: string
          full_name: string
          has_accepted_terms?: boolean
          id?: string
          is_active?: boolean
          is_archived?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          accepted_terms_at?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          auth_user_id?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          employee_code?: string
          full_name?: string
          has_accepted_terms?: boolean
          id?: string
          is_active?: boolean
          is_archived?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      project_phases: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          phase_name: string
          project_id: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          phase_name: string
          project_id: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          phase_name?: string
          project_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          template_name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          template_name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          project_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          project_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          architect_notes: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          assigned_project_manager_id: string | null
          assigned_site_supervisor_id: string | null
          budget: number | null
          client_contact: string | null
          client_name: string | null
          client_profile_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          engineer_notes: string | null
          expected_completion_date: string | null
          id: string
          is_archived: boolean
          permit_approval_status: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_name: string
          project_type: string | null
          quantity_surveyor_notes: string | null
          site_address: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          subcontractor_notes: string | null
          updated_at: string
        }
        Insert: {
          architect_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_project_manager_id?: string | null
          assigned_site_supervisor_id?: string | null
          budget?: number | null
          client_contact?: string | null
          client_name?: string | null
          client_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          engineer_notes?: string | null
          expected_completion_date?: string | null
          id?: string
          is_archived?: boolean
          permit_approval_status?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_name: string
          project_type?: string | null
          quantity_surveyor_notes?: string | null
          site_address?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          subcontractor_notes?: string | null
          updated_at?: string
        }
        Update: {
          architect_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_project_manager_id?: string | null
          assigned_site_supervisor_id?: string | null
          budget?: number | null
          client_contact?: string | null
          client_name?: string | null
          client_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          engineer_notes?: string | null
          expected_completion_date?: string | null
          id?: string
          is_archived?: boolean
          permit_approval_status?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_name?: string
          project_type?: string | null
          quantity_surveyor_notes?: string | null
          site_address?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          subcontractor_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_project_manager_id_fkey"
            columns: ["assigned_project_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_assigned_site_supervisor_id_fkey"
            columns: ["assigned_site_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          attachment_url: string | null
          created_at: string
          id: string
          message: string
          project_id: string
          sender_id: string
          task_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          message: string
          project_id: string
          sender_id: string
          task_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          sender_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_photos: {
        Row: {
          created_at: string
          file_type: string | null
          file_url: string
          id: string
          note: string | null
          project_id: string
          task_id: string | null
          upload_category: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_type?: string | null
          file_url: string
          id?: string
          note?: string | null
          project_id: string
          task_id?: string | null
          upload_category?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_type?: string | null
          file_url?: string
          id?: string
          note?: string | null
          project_id?: string
          task_id?: string | null
          upload_category?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_suggestions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          photo_url: string | null
          project_id: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_by: string
          title: string
          urgency: Database["public"]["Enums"]["priority_level"] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          photo_url?: string | null
          project_id: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by: string
          title: string
          urgency?: Database["public"]["Enums"]["priority_level"] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          photo_url?: string | null
          project_id?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string
          title?: string
          urgency?: Database["public"]["Enums"]["priority_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "task_suggestions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_suggestions_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          default_priority: Database["public"]["Enums"]["priority_level"]
          estimated_duration_days: number | null
          id: string
          phase_description: string | null
          phase_name: string
          project_template_id: string
          sort_order: number
          task_description: string | null
          task_title: string
        }
        Insert: {
          created_at?: string
          default_priority?: Database["public"]["Enums"]["priority_level"]
          estimated_duration_days?: number | null
          id?: string
          phase_description?: string | null
          phase_name: string
          project_template_id: string
          sort_order?: number
          task_description?: string | null
          task_title: string
        }
        Update: {
          created_at?: string
          default_priority?: Database["public"]["Enums"]["priority_level"]
          estimated_duration_days?: number | null
          id?: string
          phase_description?: string | null
          phase_name?: string
          project_template_id?: string
          sort_order?: number
          task_description?: string | null
          task_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_project_template_id_fkey"
            columns: ["project_template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          created_at: string
          id: string
          note: string | null
          project_id: string
          task_id: string
          update_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          project_id: string
          task_id: string
          update_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          project_id?: string
          task_id?: string
          update_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          assigned_supervisor_id: string | null
          assigned_user_id: string | null
          client_visible: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_archived: boolean
          phase_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["task_status"]
          submitted_for_review_at: string | null
          task_title: string
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_supervisor_id?: string | null
          assigned_user_id?: string | null
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          phase_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          submitted_for_review_at?: string | null
          task_title: string
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_supervisor_id?: string | null
          assigned_user_id?: string | null
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          phase_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          submitted_for_review_at?: string | null
          task_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_supervisor_id_fkey"
            columns: ["assigned_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
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
      materials: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          name: string
          stock: number
          supplier: string | null
          threshold: number
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          name: string
          stock?: number
          supplier?: string | null
          threshold?: number
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          stock?: number
          supplier?: string | null
          threshold?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          created_at: string
          id: string
          is_urgent: boolean
          material_id: string
          notes: string | null
          project_id: string
          quantity: number
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["material_request_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_urgent?: boolean
          material_id: string
          notes?: string | null
          project_id: string
          quantity: number
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["material_request_status"]
        }
        Update: {
          created_at?: string
          id?: string
          is_urgent?: boolean
          material_id?: string
          notes?: string | null
          project_id?: string
          quantity?: number
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["material_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          material_id: string
          note: string | null
          project_id: string | null
          qty_delta: number
          task_id: string | null
          type: Database["public"]["Enums"]["material_transaction_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          material_id: string
          note?: string | null
          project_id?: string | null
          qty_delta: number
          task_id?: string | null
          type: Database["public"]["Enums"]["material_transaction_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          material_id?: string
          note?: string | null
          project_id?: string | null
          qty_delta?: number
          task_id?: string | null
          type?: Database["public"]["Enums"]["material_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "material_transactions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          break_minutes: number
          break_started_at: string | null
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          profile_id: string
          project_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          break_minutes?: number
          break_started_at?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          profile_id: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          break_minutes?: number
          break_started_at?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          id: string
          message: string
          project_id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message: string
          project_id: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: { Args: { _project_id: string }; Returns: boolean }
      resolve_employee_email: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "project_manager"
        | "site_supervisor"
        | "worker"
        | "subcontractor"
        | "client"
      attendance_status: "active" | "on_break" | "completed"
      material_request_status: "pending" | "approved" | "denied" | "delivered"
      material_transaction_type: "delivery" | "usage" | "adjustment"
      notification_kind: "info" | "warning" | "success" | "danger"
      priority_level: "low" | "medium" | "high" | "urgent"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
        | "archived"
      task_status:
        | "not_started"
        | "assigned"
        | "in_progress"
        | "blocked"
        | "awaiting_materials"
        | "submitted_for_review"
        | "approved"
        | "rejected"
        | "overdue"
        | "archived"
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
        "project_manager",
        "site_supervisor",
        "worker",
        "subcontractor",
        "client",
      ],
      attendance_status: ["active", "on_break", "completed"],
      material_request_status: ["pending", "approved", "denied", "delivered"],
      material_transaction_type: ["delivery", "usage", "adjustment"],
      notification_kind: ["info", "warning", "success", "danger"],
      priority_level: ["low", "medium", "high", "urgent"],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
        "archived",
      ],
      task_status: [
        "not_started",
        "assigned",
        "in_progress",
        "blocked",
        "awaiting_materials",
        "submitted_for_review",
        "approved",
        "rejected",
        "overdue",
        "archived",
      ],
    },
  },
} as const
