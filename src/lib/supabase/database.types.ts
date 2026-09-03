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
      admin_audit_events: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          next_state: Json
          permission: string | null
          previous_state: Json
          reason: string | null
          request_id: string | null
          source: string
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id: string
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          next_state?: Json
          permission?: string | null
          previous_state?: Json
          reason?: string | null
          request_id?: string | null
          source?: string
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          next_state?: Json
          permission?: string | null
          previous_state?: Json
          reason?: string | null
          request_id?: string | null
          source?: string
        }
        Relationships: []
      }
      aura_recommendation_dismissals: {
        Row: {
          dismissed_at: string
          period_end: string
          period_start: string
          recommendation_key: string
          request_id: string
          rule_key: string
          rule_version: number
          therapist_profile_id: string
        }
        Insert: {
          dismissed_at?: string
          period_end: string
          period_start: string
          recommendation_key: string
          request_id: string
          rule_key: string
          rule_version: number
          therapist_profile_id: string
        }
        Update: {
          dismissed_at?: string
          period_end?: string
          period_start?: string
          recommendation_key?: string
          request_id?: string
          rule_key?: string
          rule_version?: number
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aura_recommendation_dismissals_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendation_dismissals_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendation_dismissals_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendation_dismissals_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendation_dismissals_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "aura_recommendation_dismissals_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "aura_recommendation_dismissals_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aura_recommendations: {
        Row: {
          action_route_key: string | null
          body: string
          booking_id: string | null
          context: Json
          created_at: string
          dismissed_at: string | null
          evidence: Json
          expires_at: string | null
          generated_at: string
          id: string
          is_active: boolean
          patient_profile_id: string | null
          plan_required: Database["public"]["Enums"]["therapist_plan"]
          priority: number
          rule_version: number
          source_rule_key: string
          status: string
          therapist_profile_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_route_key?: string | null
          body: string
          booking_id?: string | null
          context?: Json
          created_at?: string
          dismissed_at?: string | null
          evidence?: Json
          expires_at?: string | null
          generated_at?: string
          id?: string
          is_active?: boolean
          patient_profile_id?: string | null
          plan_required?: Database["public"]["Enums"]["therapist_plan"]
          priority?: number
          rule_version?: number
          source_rule_key: string
          status?: string
          therapist_profile_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_route_key?: string | null
          body?: string
          booking_id?: string | null
          context?: Json
          created_at?: string
          dismissed_at?: string | null
          evidence?: Json
          expires_at?: string | null
          generated_at?: string
          id?: string
          is_active?: boolean
          patient_profile_id?: string | null
          plan_required?: Database["public"]["Enums"]["therapist_plan"]
          priority?: number
          rule_version?: number
          source_rule_key?: string
          status?: string
          therapist_profile_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aura_recommendations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "aura_recommendations_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aura_recommendations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "aura_recommendations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "aura_recommendations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_action_tokens: {
        Row: {
          claim_expires_at: string | null
          claim_id: string | null
          claimed_at: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          purpose: Database["public"]["Enums"]["auth_action_purpose"]
          recipient_email: string
          recipient_role: Database["public"]["Enums"]["user_role"]
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          claim_expires_at?: string | null
          claim_id?: string | null
          claimed_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          purpose: Database["public"]["Enums"]["auth_action_purpose"]
          recipient_email: string
          recipient_role: Database["public"]["Enums"]["user_role"]
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          claim_expires_at?: string | null
          claim_id?: string | null
          claimed_at?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: Database["public"]["Enums"]["auth_action_purpose"]
          recipient_email?: string
          recipient_role?: Database["public"]["Enums"]["user_role"]
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_action_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exception_booking_impacts: {
        Row: {
          booking_id: string
          created_at: string
          exception_id: string
          id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          exception_id: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          exception_id?: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_exception_booking_impact_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_booking_impact_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_booking_impact_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_booking_impact_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_booking_impact_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exception_booking_impact_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exception_booking_impact_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_booking_impacts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_booking_impacts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "availability_exception_booking_impacts_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "availability_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_booking_impacts_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exception_events: {
        Row: {
          actor_user_id: string | null
          booking_id: string | null
          created_at: string
          event_type: string
          exception_id: string | null
          id: string
          request_id: string
          result: Json
          series_id: string | null
          therapist_profile_id: string
        }
        Insert: {
          actor_user_id?: string | null
          booking_id?: string | null
          created_at?: string
          event_type: string
          exception_id?: string | null
          id?: string
          request_id: string
          result?: Json
          series_id?: string | null
          therapist_profile_id: string
        }
        Update: {
          actor_user_id?: string | null
          booking_id?: string | null
          created_at?: string
          event_type?: string
          exception_id?: string | null
          id?: string
          request_id?: string
          result?: Json
          series_id?: string | null
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_exception_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "availability_exception_events_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "availability_exceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "availability_exception_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exception_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exception_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exception_history: {
        Row: {
          ends_at: string
          id: number
          is_available: boolean
          operation: string
          recorded_at: string
          service_id: string | null
          source_exception_id: string
          starts_at: string
          therapist_profile_id: string
        }
        Insert: {
          ends_at: string
          id?: never
          is_available: boolean
          operation: string
          recorded_at?: string
          service_id?: string | null
          source_exception_id: string
          starts_at: string
          therapist_profile_id: string
        }
        Update: {
          ends_at?: string
          id?: never
          is_available?: boolean
          operation?: string
          recorded_at?: string
          service_id?: string | null
          source_exception_id?: string
          starts_at?: string
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_exception_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exception_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exception_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exception_series: {
        Row: {
          all_day: boolean
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          end_time: string | null
          id: string
          reason: string | null
          reason_code: string
          recurrence_ends_on: string
          recurrence_frequency: string
          service_id: string | null
          start_time: string | null
          starts_on: string
          status: string
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          all_day?: boolean
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          end_time?: string | null
          id?: string
          reason?: string | null
          reason_code: string
          recurrence_ends_on: string
          recurrence_frequency?: string
          service_id?: string | null
          start_time?: string | null
          starts_on: string
          status?: string
          therapist_profile_id: string
          timezone: string
          updated_at?: string
          version?: number
        }
        Update: {
          all_day?: boolean
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          reason_code?: string
          recurrence_ends_on?: string
          recurrence_frequency?: string
          service_id?: string | null
          start_time?: string | null
          starts_on?: string
          status?: string
          therapist_profile_id?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_exception_series_cancelled_by_user_id_fkey"
            columns: ["cancelled_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_series_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_series_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exception_series_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exception_series_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exception_series_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exception_series_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exception_series_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exception_series_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_series_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_series_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_series_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_series_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exception_series_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exception_series_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exception_series_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exceptions: {
        Row: {
          all_day: boolean
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          ends_at: string
          id: string
          is_available: boolean
          occurrence_date: string | null
          reason: string | null
          reason_code: string
          series_id: string | null
          service_id: string | null
          starts_at: string
          status: string
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          all_day?: boolean
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          ends_at: string
          id?: string
          is_available?: boolean
          occurrence_date?: string | null
          reason?: string | null
          reason_code?: string
          series_id?: string | null
          service_id?: string | null
          starts_at: string
          status?: string
          therapist_profile_id: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          all_day?: boolean
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          ends_at?: string
          id?: string
          is_available?: boolean
          occurrence_date?: string | null
          reason?: string | null
          reason_code?: string
          series_id?: string | null
          service_id?: string | null
          starts_at?: string
          status?: string
          therapist_profile_id?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_cancelled_by_user_id_fkey"
            columns: ["cancelled_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "availability_exception_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exceptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exceptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exceptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exceptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exceptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_exceptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_exceptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exceptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_exceptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rule_history: {
        Row: {
          day_of_week: number
          end_time: string
          id: number
          is_active: boolean
          operation: string
          recorded_at: string
          service_id: string | null
          source_rule_id: string
          start_time: string
          therapist_profile_id: string
          timezone: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: never
          is_active: boolean
          operation: string
          recorded_at?: string
          service_id?: string | null
          source_rule_id: string
          start_time: string
          therapist_profile_id: string
          timezone: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: never
          is_active?: boolean
          operation?: string
          recorded_at?: string
          service_id?: string | null
          source_rule_id?: string
          start_time?: string
          therapist_profile_id?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_rule_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rule_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rule_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rule_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rule_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_rule_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_rule_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          service_id: string
          start_time: string
          therapist_profile_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          service_id: string
          start_time: string
          therapist_profile_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          service_id?: string
          start_time?: string
          therapist_profile_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "availability_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_rules_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_rules_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "availability_rules_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          billing_reason: string | null
          created_at: string
          currency: string
          due_at: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_pdf: string | null
          metadata: Json
          paid_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_invoice_id: string
          stripe_subscription_id: string | null
          therapist_profile_id: string | null
          therapist_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          billing_reason?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          metadata?: Json
          paid_at?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_invoice_id: string
          stripe_subscription_id?: string | null
          therapist_profile_id?: string | null
          therapist_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          billing_reason?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          metadata?: Json
          paid_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_invoice_id?: string
          stripe_subscription_id?: string | null
          therapist_profile_id?: string | null
          therapist_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "billing_invoices_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "billing_invoices_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_therapist_subscription_id_fkey"
            columns: ["therapist_subscription_id"]
            isOneToOne: false
            referencedRelation: "therapist_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plan_prices: {
        Row: {
          created_at: string
          currency: string
          environment: string
          id: string
          interval: Database["public"]["Enums"]["billing_interval"] | null
          is_active: boolean
          is_public: boolean
          metadata: Json
          offer_key: string | null
          plan_id: string
          stripe_livemode: boolean
          stripe_lookup_key: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          unit_amount_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          interval?: Database["public"]["Enums"]["billing_interval"] | null
          is_active?: boolean
          is_public?: boolean
          metadata?: Json
          offer_key?: string | null
          plan_id: string
          stripe_livemode?: boolean
          stripe_lookup_key?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          unit_amount_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          interval?: Database["public"]["Enums"]["billing_interval"] | null
          is_active?: boolean
          is_public?: boolean
          metadata?: Json
          offer_key?: string | null
          plan_id?: string
          stripe_livemode?: boolean
          stripe_lookup_key?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          unit_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          code: Database["public"]["Enums"]["therapist_plan"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["therapist_plan"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["therapist_plan"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_events: {
        Row: {
          actor_profile_id: string | null
          booking_id: string
          created_at: string
          event_type: string
          id: string
          next_status: Database["public"]["Enums"]["booking_status"] | null
          payload: Json
          previous_status: Database["public"]["Enums"]["booking_status"] | null
          request_id: string | null
          source: string
        }
        Insert: {
          actor_profile_id?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          id?: string
          next_status?: Database["public"]["Enums"]["booking_status"] | null
          payload?: Json
          previous_status?: Database["public"]["Enums"]["booking_status"] | null
          request_id?: string | null
          source?: string
        }
        Update: {
          actor_profile_id?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: string
          next_status?: Database["public"]["Enums"]["booking_status"] | null
          payload?: Json
          previous_status?: Database["public"]["Enums"]["booking_status"] | null
          request_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
        ]
      }
      booking_holds: {
        Row: {
          buffer_after_minutes_snapshot: number
          buffer_before_minutes_snapshot: number
          cancelled_at: string | null
          consume_idempotency_key: string | null
          consumed_at: string | null
          consumed_booking_id: string | null
          created_at: string
          currency_snapshot: string
          ends_at: string
          expires_at: string
          id: string
          idempotency_key: string
          occupied_during: unknown
          patient_profile_id: string
          service_duration_minutes_snapshot: number
          service_id: string
          service_price_cents_snapshot: number
          service_title_snapshot: string
          snapshot_captured_at: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_hold_status"]
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          buffer_after_minutes_snapshot: number
          buffer_before_minutes_snapshot: number
          cancelled_at?: string | null
          consume_idempotency_key?: string | null
          consumed_at?: string | null
          consumed_booking_id?: string | null
          created_at?: string
          currency_snapshot: string
          ends_at: string
          expires_at: string
          id?: string
          idempotency_key: string
          occupied_during: unknown
          patient_profile_id: string
          service_duration_minutes_snapshot: number
          service_id: string
          service_price_cents_snapshot: number
          service_title_snapshot: string
          snapshot_captured_at?: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_hold_status"]
          therapist_profile_id: string
          timezone: string
          updated_at?: string
          version?: number
        }
        Update: {
          buffer_after_minutes_snapshot?: number
          buffer_before_minutes_snapshot?: number
          cancelled_at?: string | null
          consume_idempotency_key?: string | null
          consumed_at?: string | null
          consumed_booking_id?: string | null
          created_at?: string
          currency_snapshot?: string
          ends_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          occupied_during?: unknown
          patient_profile_id?: string
          service_duration_minutes_snapshot?: number
          service_id?: string
          service_price_cents_snapshot?: number
          service_title_snapshot?: string
          snapshot_captured_at?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_hold_status"]
          therapist_profile_id?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_holds_consumed_booking_id_fkey"
            columns: ["consumed_booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_consumed_booking_id_fkey"
            columns: ["consumed_booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "booking_holds_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "booking_holds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "booking_holds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "booking_holds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "booking_holds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "booking_holds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "booking_holds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "booking_holds_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "booking_holds_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_intake_responses: {
        Row: {
          booking_id: string
          created_at: string
          focus_area: string
          id: string
          patient_profile_id: string
          shared_note: string
          therapist_profile_id: string
          therapy_goal: string
          updated_at: string
          visibility: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          focus_area: string
          id?: string
          patient_profile_id: string
          shared_note: string
          therapist_profile_id: string
          therapy_goal: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          focus_area?: string
          id?: string
          patient_profile_id?: string
          shared_note?: string
          therapist_profile_id?: string
          therapy_goal?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_intake_responses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intake_responses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "booking_intake_responses_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intake_responses_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intake_responses_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intake_responses_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intake_responses_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intake_responses_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "booking_intake_responses_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "booking_intake_responses_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payment_receipts: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          provider: string
          receipt_url: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          provider?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          provider?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payment_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payment_receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
        ]
      }
      booking_reminder_jobs: {
        Row: {
          action_key: string
          attempts: number
          booking_id: string
          booking_version: number
          created_at: string
          id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          outbox_id: string | null
          recipient_user_id: string
          scheduled_for: string
          status: Database["public"]["Enums"]["booking_reminder_job_status"]
          updated_at: string
        }
        Insert: {
          action_key: string
          attempts?: number
          booking_id: string
          booking_version: number
          created_at?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          outbox_id?: string | null
          recipient_user_id: string
          scheduled_for: string
          status?: Database["public"]["Enums"]["booking_reminder_job_status"]
          updated_at?: string
        }
        Update: {
          action_key?: string
          attempts?: number
          booking_id?: string
          booking_version?: number
          created_at?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          outbox_id?: string | null
          recipient_user_id?: string
          scheduled_for?: string
          status?: Database["public"]["Enums"]["booking_reminder_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reminder_jobs_action_key_fkey"
            columns: ["action_key"]
            isOneToOne: false
            referencedRelation: "email_action_definitions"
            referencedColumns: ["action_key"]
          },
          {
            foreignKeyName: "booking_reminder_jobs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reminder_jobs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "booking_reminder_jobs_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "email_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reminder_jobs_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_reschedule_requests: {
        Row: {
          applied_at: string | null
          booking_id: string
          booking_version_at_request: number
          created_at: string
          expires_at: string
          id: string
          original_ends_at: string
          original_starts_at: string
          original_timezone: string
          proposed_ends_at: string
          proposed_starts_at: string
          proposed_timezone: string
          reason: string | null
          request_id: string | null
          requested_by_profile_id: string | null
          resolution_request_id: string | null
          resolved_at: string | null
          resolved_by_profile_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          booking_id: string
          booking_version_at_request: number
          created_at?: string
          expires_at: string
          id?: string
          original_ends_at: string
          original_starts_at: string
          original_timezone: string
          proposed_ends_at: string
          proposed_starts_at: string
          proposed_timezone: string
          reason?: string | null
          request_id?: string | null
          requested_by_profile_id?: string | null
          resolution_request_id?: string | null
          resolved_at?: string | null
          resolved_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          booking_id?: string
          booking_version_at_request?: number
          created_at?: string
          expires_at?: string
          id?: string
          original_ends_at?: string
          original_starts_at?: string
          original_timezone?: string
          proposed_ends_at?: string
          proposed_starts_at?: string
          proposed_timezone?: string
          reason?: string | null
          request_id?: string | null
          requested_by_profile_id?: string | null
          resolution_request_id?: string | null
          resolved_at?: string | null
          resolved_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reschedule_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reschedule_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "booking_reschedule_requests_requested_by_profile_id_fkey"
            columns: ["requested_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reschedule_requests_resolved_by_profile_id_fkey"
            columns: ["resolved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_session_summaries: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          patient_profile_id: string
          summary: string | null
          therapist_profile_id: string
          title: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          patient_profile_id: string
          summary?: string | null
          therapist_profile_id: string
          title?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          patient_profile_id?: string
          summary?: string | null
          therapist_profile_id?: string
          title?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_session_summaries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_session_summaries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "booking_session_summaries_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_session_summaries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_session_summaries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_session_summaries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_session_summaries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_session_summaries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "booking_session_summaries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "booking_session_summaries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          buffer_after_minutes_snapshot: number
          buffer_before_minutes_snapshot: number
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          currency_snapshot: string
          ends_at: string
          id: string
          last_transition_at: string | null
          legal_acceptance_recorded_at: string | null
          legal_cancellation_policy_version_id: string | null
          legal_privacy_version_id: string | null
          legal_terms_version_id: string | null
          meeting_provider: string | null
          meeting_url: string | null
          occupied_during: unknown
          patient_profile_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          service_duration_minutes_snapshot: number
          service_id: string
          service_price_cents_snapshot: number
          service_title_snapshot: string
          snapshot_captured_at: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          buffer_after_minutes_snapshot: number
          buffer_before_minutes_snapshot: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency_snapshot: string
          ends_at: string
          id?: string
          last_transition_at?: string | null
          legal_acceptance_recorded_at?: string | null
          legal_cancellation_policy_version_id?: string | null
          legal_privacy_version_id?: string | null
          legal_terms_version_id?: string | null
          meeting_provider?: string | null
          meeting_url?: string | null
          occupied_during: unknown
          patient_profile_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          service_duration_minutes_snapshot: number
          service_id: string
          service_price_cents_snapshot: number
          service_title_snapshot: string
          snapshot_captured_at: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          therapist_profile_id: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          buffer_after_minutes_snapshot?: number
          buffer_before_minutes_snapshot?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          currency_snapshot?: string
          ends_at?: string
          id?: string
          last_transition_at?: string | null
          legal_acceptance_recorded_at?: string | null
          legal_cancellation_policy_version_id?: string | null
          legal_privacy_version_id?: string | null
          legal_terms_version_id?: string | null
          meeting_provider?: string | null
          meeting_url?: string | null
          occupied_during?: unknown
          patient_profile_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          service_duration_minutes_snapshot?: number
          service_id?: string
          service_price_cents_snapshot?: number
          service_title_snapshot?: string
          snapshot_captured_at?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          therapist_profile_id?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_legal_cancellation_policy_version_id_fkey"
            columns: ["legal_cancellation_policy_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_legal_privacy_version_id_fkey"
            columns: ["legal_privacy_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_legal_terms_version_id_fkey"
            columns: ["legal_terms_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          patient_profile_id: string
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          patient_profile_id: string
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          patient_profile_id?: string
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "conversations_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "conversations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "conversations_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_action_definitions: {
        Row: {
          action_key: string
          active: boolean
          category: string
          created_at: string
          default_template_version: string
          description: string | null
          label: string
        }
        Insert: {
          action_key: string
          active?: boolean
          category: string
          created_at?: string
          default_template_version?: string
          description?: string | null
          label: string
        }
        Update: {
          action_key?: string
          active?: boolean
          category?: string
          created_at?: string
          default_template_version?: string
          description?: string | null
          label?: string
        }
        Relationships: []
      }
      email_action_settings: {
        Row: {
          action_key: string
          automatic_dispatch_enabled: boolean
          created_at: string
          enabled: boolean
          html_override: string | null
          preheader_override: string | null
          sender_profile_id: string | null
          subject_override: string | null
          text_override: string | null
          updated_at: string
        }
        Insert: {
          action_key: string
          automatic_dispatch_enabled?: boolean
          created_at?: string
          enabled?: boolean
          html_override?: string | null
          preheader_override?: string | null
          sender_profile_id?: string | null
          subject_override?: string | null
          text_override?: string | null
          updated_at?: string
        }
        Update: {
          action_key?: string
          automatic_dispatch_enabled?: boolean
          created_at?: string
          enabled?: boolean
          html_override?: string | null
          preheader_override?: string | null
          sender_profile_id?: string | null
          subject_override?: string | null
          text_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_action_settings_action_key_fkey"
            columns: ["action_key"]
            isOneToOne: true
            referencedRelation: "email_action_definitions"
            referencedColumns: ["action_key"]
          },
          {
            foreignKeyName: "email_action_settings_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "email_sender_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_logs: {
        Row: {
          action_key: string
          attempt_count: number
          correlation_id: string
          created_at: string
          error_message: string | null
          id: string
          provider_error_code: string | null
          provider_message_id: string | null
          recipient_email: string
          recipient_role: Database["public"]["Enums"]["user_role"] | null
          recipient_user_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          sender_profile_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_delivery_status"]
          subject: string | null
        }
        Insert: {
          action_key: string
          attempt_count?: number
          correlation_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider_error_code?: string | null
          provider_message_id?: string | null
          recipient_email: string
          recipient_role?: Database["public"]["Enums"]["user_role"] | null
          recipient_user_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sender_profile_id?: string | null
          sent_at?: string | null
          status: Database["public"]["Enums"]["email_delivery_status"]
          subject?: string | null
        }
        Update: {
          action_key?: string
          attempt_count?: number
          correlation_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          provider_error_code?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          recipient_role?: Database["public"]["Enums"]["user_role"] | null
          recipient_user_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sender_profile_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_logs_action_key_fkey"
            columns: ["action_key"]
            isOneToOne: false
            referencedRelation: "email_action_definitions"
            referencedColumns: ["action_key"]
          },
          {
            foreignKeyName: "email_delivery_logs_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_delivery_logs_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "email_sender_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          action_key: string
          attempts: number
          created_at: string
          domain_event_id: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          next_attempt_at: string | null
          payload: Json
          processed_at: string | null
          recipient_key: string
          recipient_user_id: string
          related_entity_id: string
          related_entity_type: string
          review_reason: string | null
          review_required: boolean
          sender_profile_id: string | null
          status: Database["public"]["Enums"]["email_outbox_status"]
          template_overrides: Json
          template_version: string
          updated_at: string
        }
        Insert: {
          action_key: string
          attempts?: number
          created_at?: string
          domain_event_id: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          next_attempt_at?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_key: string
          recipient_user_id: string
          related_entity_id: string
          related_entity_type: string
          review_reason?: string | null
          review_required?: boolean
          sender_profile_id?: string | null
          status?: Database["public"]["Enums"]["email_outbox_status"]
          template_overrides?: Json
          template_version?: string
          updated_at?: string
        }
        Update: {
          action_key?: string
          attempts?: number
          created_at?: string
          domain_event_id?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          next_attempt_at?: string | null
          payload?: Json
          processed_at?: string | null
          recipient_key?: string
          recipient_user_id?: string
          related_entity_id?: string
          related_entity_type?: string
          review_reason?: string | null
          review_required?: boolean
          sender_profile_id?: string | null
          status?: Database["public"]["Enums"]["email_outbox_status"]
          template_overrides?: Json
          template_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_action_key_fkey"
            columns: ["action_key"]
            isOneToOne: false
            referencedRelation: "email_action_definitions"
            referencedColumns: ["action_key"]
          },
          {
            foreignKeyName: "email_outbox_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "email_sender_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox_test_faults: {
        Row: {
          action_key: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          recipient_key: string
        }
        Insert: {
          action_key: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          recipient_key: string
        }
        Update: {
          action_key?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          recipient_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_test_faults_action_key_fkey"
            columns: ["action_key"]
            isOneToOne: false
            referencedRelation: "email_action_definitions"
            referencedColumns: ["action_key"]
          },
        ]
      }
      email_rate_limit_events: {
        Row: {
          action_key: string
          created_at: string
          id: string
          identifier_hash: string
          ip_hash: string | null
          outcome: string
        }
        Insert: {
          action_key: string
          created_at?: string
          id?: string
          identifier_hash: string
          ip_hash?: string | null
          outcome?: string
        }
        Update: {
          action_key?: string
          created_at?: string
          id?: string
          identifier_hash?: string
          ip_hash?: string | null
          outcome?: string
        }
        Relationships: []
      }
      email_sender_profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          is_default: boolean
          last_synced_at: string | null
          last_test_at: string | null
          last_test_message: string | null
          last_test_status:
            | Database["public"]["Enums"]["email_delivery_status"]
            | null
          mailbox_address: string
          mailbox_resource_id: string
          provider: Database["public"]["Enums"]["email_provider_key"]
          reply_to_email: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          id?: string
          is_default?: boolean
          last_synced_at?: string | null
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_status?:
            | Database["public"]["Enums"]["email_delivery_status"]
            | null
          mailbox_address: string
          mailbox_resource_id: string
          provider?: Database["public"]["Enums"]["email_provider_key"]
          reply_to_email?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          is_default?: boolean
          last_synced_at?: string | null
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_status?:
            | Database["public"]["Enums"]["email_delivery_status"]
            | null
          mailbox_address?: string
          mailbox_resource_id?: string
          provider?: Database["public"]["Enums"]["email_provider_key"]
          reply_to_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_verification_status_tokens: {
        Row: {
          confirmed_at: string | null
          created_at: string
          expires_at: string
          id: string
          recipient_role: Database["public"]["Enums"]["user_role"]
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          recipient_role: Database["public"]["Enums"]["user_role"]
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          recipient_role?: Database["public"]["Enums"]["user_role"]
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_verification_status_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_therapists: {
        Row: {
          created_at: string
          id: string
          patient_profile_id: string
          therapist_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_profile_id: string
          therapist_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_profile_id?: string
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_therapists_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "favorite_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "favorite_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger_entries: {
        Row: {
          amount_cents: number
          booking_id: string | null
          currency: string
          direction: Database["public"]["Enums"]["financial_ledger_direction"]
          entry_type: Database["public"]["Enums"]["financial_ledger_entry_type"]
          id: string
          metadata: Json
          occurred_at: string
          patient_profile_id: string | null
          payout_batch_id: string | null
          profile_id: string | null
          recorded_at: string
          session_payment_id: string | null
          source_external_id: string | null
          source_id: string | null
          source_table: string | null
          stripe_event_id: string | null
          stripe_transfer_id: string | null
          therapist_profile_id: string | null
        }
        Insert: {
          amount_cents: number
          booking_id?: string | null
          currency?: string
          direction: Database["public"]["Enums"]["financial_ledger_direction"]
          entry_type: Database["public"]["Enums"]["financial_ledger_entry_type"]
          id?: string
          metadata?: Json
          occurred_at?: string
          patient_profile_id?: string | null
          payout_batch_id?: string | null
          profile_id?: string | null
          recorded_at?: string
          session_payment_id?: string | null
          source_external_id?: string | null
          source_id?: string | null
          source_table?: string | null
          stripe_event_id?: string | null
          stripe_transfer_id?: string | null
          therapist_profile_id?: string | null
        }
        Update: {
          amount_cents?: number
          booking_id?: string | null
          currency?: string
          direction?: Database["public"]["Enums"]["financial_ledger_direction"]
          entry_type?: Database["public"]["Enums"]["financial_ledger_entry_type"]
          id?: string
          metadata?: Json
          occurred_at?: string
          patient_profile_id?: string | null
          payout_batch_id?: string | null
          profile_id?: string | null
          recorded_at?: string
          session_payment_id?: string | null
          source_external_id?: string | null
          source_id?: string | null
          source_table?: string | null
          stripe_event_id?: string | null
          stripe_transfer_id?: string | null
          therapist_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "financial_ledger_entries_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_session_payment_id_fkey"
            columns: ["session_payment_id"]
            isOneToOne: false
            referencedRelation: "session_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_stripe_transfer_id_fkey"
            columns: ["stripe_transfer_id"]
            isOneToOne: false
            referencedRelation: "stripe_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "financial_ledger_entries_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_policy_versions: {
        Row: {
          auto_confirmation_days: number
          cancellation_policy_key: string
          created_at: string
          currency: string
          downgrade_behavior: string
          effective_from: string
          effective_until: string | null
          free_cancellation_hours: number
          id: string
          is_active: boolean
          late_cancellation_retention_bps: number
          manual_review_response_days: number
          metadata: Json
          no_show_retention_bps: number
          patient_auto_confirmation_days: number
          payout_batch_rule: string
          platform_commission_bps: number
          proration_policy_key: string
          refund_policy_key: string
          refund_processing_business_days: number
          subscription_cancellation_behavior: string
          therapist_auto_confirmation_days: number
          timezone: string
          transfer_safety_period_days: number
          upgrade_proration_behavior: string
          version: string
          weekly_batch_time: string
          weekly_batch_weekday: number
        }
        Insert: {
          auto_confirmation_days?: number
          cancellation_policy_key?: string
          created_at?: string
          currency?: string
          downgrade_behavior?: string
          effective_from?: string
          effective_until?: string | null
          free_cancellation_hours?: number
          id?: string
          is_active?: boolean
          late_cancellation_retention_bps?: number
          manual_review_response_days?: number
          metadata?: Json
          no_show_retention_bps?: number
          patient_auto_confirmation_days?: number
          payout_batch_rule?: string
          platform_commission_bps?: number
          proration_policy_key?: string
          refund_policy_key?: string
          refund_processing_business_days?: number
          subscription_cancellation_behavior?: string
          therapist_auto_confirmation_days?: number
          timezone?: string
          transfer_safety_period_days?: number
          upgrade_proration_behavior?: string
          version: string
          weekly_batch_time?: string
          weekly_batch_weekday?: number
        }
        Update: {
          auto_confirmation_days?: number
          cancellation_policy_key?: string
          created_at?: string
          currency?: string
          downgrade_behavior?: string
          effective_from?: string
          effective_until?: string | null
          free_cancellation_hours?: number
          id?: string
          is_active?: boolean
          late_cancellation_retention_bps?: number
          manual_review_response_days?: number
          metadata?: Json
          no_show_retention_bps?: number
          patient_auto_confirmation_days?: number
          payout_batch_rule?: string
          platform_commission_bps?: number
          proration_policy_key?: string
          refund_policy_key?: string
          refund_processing_business_days?: number
          subscription_cancellation_behavior?: string
          therapist_auto_confirmation_days?: number
          timezone?: string
          transfer_safety_period_days?: number
          upgrade_proration_behavior?: string
          version?: string
          weekly_batch_time?: string
          weekly_batch_weekday?: number
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          actor_role: string
          booking_id: string | null
          content_hash: string
          context: string
          document_key: string
          document_version: string
          document_version_id: string
          evidence: Json
          id: string
          profile_id: string
          request_id: string
          revoked_at: string | null
          superseded_at: string | null
        }
        Insert: {
          accepted_at?: string
          actor_role: string
          booking_id?: string | null
          content_hash: string
          context: string
          document_key: string
          document_version: string
          document_version_id: string
          evidence?: Json
          id?: string
          profile_id: string
          request_id: string
          revoked_at?: string | null
          superseded_at?: string | null
        }
        Update: {
          accepted_at?: string
          actor_role?: string
          booking_id?: string | null
          content_hash?: string
          context?: string
          document_key?: string
          document_version?: string
          document_version_id?: string
          evidence?: Json
          id?: string
          profile_id?: string
          request_id?: string
          revoked_at?: string | null
          superseded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "legal_acceptances_document_version_id_fkey"
            columns: ["document_version_id"]
            isOneToOne: false
            referencedRelation: "legal_document_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audience: string[]
          canonical_path: string | null
          change_summary: string | null
          content_hash: string
          created_at: string
          document_key: string
          effective_at: string | null
          id: string
          language: string
          published_at: string | null
          requires_new_acceptance: boolean
          source_reference: string | null
          status: string
          superseded_at: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string[]
          canonical_path?: string | null
          change_summary?: string | null
          content_hash: string
          created_at?: string
          document_key: string
          effective_at?: string | null
          id?: string
          language?: string
          published_at?: string | null
          requires_new_acceptance?: boolean
          source_reference?: string | null
          status?: string
          superseded_at?: string | null
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string[]
          canonical_path?: string | null
          change_summary?: string | null
          content_hash?: string
          created_at?: string
          document_key?: string
          effective_at?: string | null
          id?: string
          language?: string
          published_at?: string | null
          requires_new_acceptance?: boolean
          source_reference?: string | null
          status?: string
          superseded_at?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      matching_interests: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          theme_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          theme_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          theme_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matching_interests_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "matching_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_interests_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "public_matching_config"
            referencedColumns: ["theme_id"]
          },
        ]
      }
      matching_themes: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      matching_therapy_settings: {
        Row: {
          created_at: string
          is_visible_in_matching: boolean
          therapy_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_visible_in_matching?: boolean
          therapy_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_visible_in_matching?: boolean
          therapy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_therapy_settings_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      matching_versions: {
        Row: {
          created_at: string
          id: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["matching_version_status"]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["matching_version_status"]
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["matching_version_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "matching_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matching_weights: {
        Row: {
          created_at: string
          id: string
          interest_id: string | null
          is_active: boolean
          reason: string | null
          theme_id: string | null
          therapy_id: string
          updated_at: string
          version_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          interest_id?: string | null
          is_active?: boolean
          reason?: string | null
          theme_id?: string | null
          therapy_id: string
          updated_at?: string
          version_id: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          interest_id?: string | null
          is_active?: boolean
          reason?: string | null
          theme_id?: string | null
          therapy_id?: string
          updated_at?: string
          version_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "matching_weights_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "matching_interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_weights_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "public_matching_config"
            referencedColumns: ["interest_id"]
          },
          {
            foreignKeyName: "matching_weights_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "matching_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_weights_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "public_matching_config"
            referencedColumns: ["theme_id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "matching_weights_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "matching_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matching_weights_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "public_matching_config"
            referencedColumns: ["version_id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string
          context: Database["public"]["Enums"]["message_context"]
          created_at: string
          cta_action: string | null
          id: string
          is_active: boolean
          key: string
          parameter_schema: Json
          requires_booking: boolean
          title: string
          updated_at: string
          usage_description: string
        }
        Insert: {
          body: string
          category?: string
          context: Database["public"]["Enums"]["message_context"]
          created_at?: string
          cta_action?: string | null
          id?: string
          is_active?: boolean
          key: string
          parameter_schema?: Json
          requires_booking?: boolean
          title: string
          updated_at?: string
          usage_description?: string
        }
        Update: {
          body?: string
          category?: string
          context?: Database["public"]["Enums"]["message_context"]
          created_at?: string
          cta_action?: string | null
          id?: string
          is_active?: boolean
          key?: string
          parameter_schema?: Json
          requires_booking?: boolean
          title?: string
          updated_at?: string
          usage_description?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          read_at: string | null
          sender_profile_id: string | null
          template_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          sender_profile_id?: string | null
          template_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          sender_profile_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_checkins: {
        Row: {
          checked_on: string
          created_at: string
          id: string
          mood: string
          patient_profile_id: string
          updated_at: string
        }
        Insert: {
          checked_on?: string
          created_at?: string
          id?: string
          mood: string
          patient_profile_id: string
          updated_at?: string
        }
        Update: {
          checked_on?: string
          created_at?: string
          id?: string
          mood?: string
          patient_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_checkins_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          event_key: string | null
          href: string | null
          id: string
          kind: string
          profile_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_key?: string | null
          href?: string | null
          id?: string
          kind: string
          profile_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event_key?: string | null
          href?: string | null
          id?: string
          kind?: string
          profile_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          display_name: string
          id: string
          marketing_consent: boolean
          metadata: Json
          phone: string | null
          phone_country_code: string | null
          sensitive_data_consent_at: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name: string
          id?: string
          marketing_consent?: boolean
          metadata?: Json
          phone?: string | null
          phone_country_code?: string | null
          sensitive_data_consent_at?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          id?: string
          marketing_consent?: boolean
          metadata?: Json
          phone?: string | null
          phone_country_code?: string | null
          sensitive_data_consent_at?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_review_mutation_requests: {
        Row: {
          action: string
          created_at: string
          id: string
          patient_profile_id: string
          payload_hash: string
          request_id: string
          review_id: string | null
          therapist_profile_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          patient_profile_id: string
          payload_hash: string
          request_id: string
          review_id?: string | null
          therapist_profile_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          patient_profile_id?: string
          payload_hash?: string
          request_id?: string
          review_id?: string | null
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_review_mutation_requests_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_home_testimonials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "patient_review_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          patient_profile_id: string
          platform_fee_cents: number
          provider: string
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          therapist_amount_cents: number
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          patient_profile_id: string
          platform_fee_cents?: number
          provider?: string
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          therapist_amount_cents?: number
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          patient_profile_id?: string
          platform_fee_cents?: number
          provider?: string
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          therapist_amount_cents?: number
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "payments_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batch_items: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          metadata: Json
          payout_batch_id: string
          payout_batch_therapist_id: string | null
          session_payment_id: string
          status: Database["public"]["Enums"]["payout_batch_item_status"]
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json
          payout_batch_id: string
          payout_batch_therapist_id?: string | null
          session_payment_id: string
          status?: Database["public"]["Enums"]["payout_batch_item_status"]
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          metadata?: Json
          payout_batch_id?: string
          payout_batch_therapist_id?: string | null
          session_payment_id?: string
          status?: Database["public"]["Enums"]["payout_batch_item_status"]
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_batch_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "payout_batch_items_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_payout_batch_therapist_id_fkey"
            columns: ["payout_batch_therapist_id"]
            isOneToOne: false
            referencedRelation: "payout_batch_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_session_payment_id_fkey"
            columns: ["session_payment_id"]
            isOneToOne: false
            referencedRelation: "session_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_items_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "payout_batch_items_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "payout_batch_items_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batch_therapists: {
        Row: {
          connect_account_id: string | null
          created_at: string
          id: string
          item_count: number
          metadata: Json
          payout_batch_id: string
          status: Database["public"]["Enums"]["payout_batch_item_status"]
          therapist_profile_id: string
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          connect_account_id?: string | null
          created_at?: string
          id?: string
          item_count?: number
          metadata?: Json
          payout_batch_id: string
          status?: Database["public"]["Enums"]["payout_batch_item_status"]
          therapist_profile_id: string
          total_amount_cents?: number
          updated_at?: string
        }
        Update: {
          connect_account_id?: string | null
          created_at?: string
          id?: string
          item_count?: number
          metadata?: Json
          payout_batch_id?: string
          status?: Database["public"]["Enums"]["payout_batch_item_status"]
          therapist_profile_id?: string
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_batch_therapists_connect_account_id_fkey"
            columns: ["connect_account_id"]
            isOneToOne: false
            referencedRelation: "therapist_connect_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_therapists_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "payout_batch_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "payout_batch_therapists_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batches: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          cutoff_at: string
          gross_amount_cents: number
          id: string
          item_count: number
          metadata: Json
          platform_gross_commission_cents: number
          processed_at: string | null
          reference_period_end: string
          reference_period_start: string
          status: Database["public"]["Enums"]["payout_batch_status"]
          therapist_amount_cents: number
          therapist_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          cutoff_at: string
          gross_amount_cents?: number
          id?: string
          item_count?: number
          metadata?: Json
          platform_gross_commission_cents?: number
          processed_at?: string | null
          reference_period_end: string
          reference_period_start: string
          status?: Database["public"]["Enums"]["payout_batch_status"]
          therapist_amount_cents?: number
          therapist_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          cutoff_at?: string
          gross_amount_cents?: number
          id?: string
          item_count?: number
          metadata?: Json
          platform_gross_commission_cents?: number
          processed_at?: string | null
          reference_period_end?: string
          reference_period_start?: string
          status?: Database["public"]["Enums"]["payout_batch_status"]
          therapist_amount_cents?: number
          therapist_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_operational_incidents: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          first_occurred_at: string
          id: string
          incident_key: string
          incident_type: string
          last_occurred_at: string
          metadata: Json
          occurrence_count: number
          payout_batch_id: string | null
          payout_batch_item_id: string | null
          payout_scheduler_run_id: string | null
          resolved_at: string | null
          severity: string
          status: Database["public"]["Enums"]["payout_operational_incident_status"]
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
          therapist_profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          first_occurred_at?: string
          id?: string
          incident_key: string
          incident_type: string
          last_occurred_at?: string
          metadata?: Json
          occurrence_count?: number
          payout_batch_id?: string | null
          payout_batch_item_id?: string | null
          payout_scheduler_run_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["payout_operational_incident_status"]
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          therapist_profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          first_occurred_at?: string
          id?: string
          incident_key?: string
          incident_type?: string
          last_occurred_at?: string
          metadata?: Json
          occurrence_count?: number
          payout_batch_id?: string | null
          payout_batch_item_id?: string | null
          payout_scheduler_run_id?: string | null
          resolved_at?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["payout_operational_incident_status"]
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          therapist_profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_operational_incidents_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_payout_batch_item_id_fkey"
            columns: ["payout_batch_item_id"]
            isOneToOne: false
            referencedRelation: "payout_batch_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_payout_scheduler_run_id_fkey"
            columns: ["payout_scheduler_run_id"]
            isOneToOne: false
            referencedRelation: "payout_scheduler_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_stripe_payout_id_fkey"
            columns: ["stripe_payout_id"]
            isOneToOne: false
            referencedRelation: "stripe_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_stripe_transfer_id_fkey"
            columns: ["stripe_transfer_id"]
            isOneToOne: false
            referencedRelation: "stripe_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "payout_operational_incidents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_scheduler_runs: {
        Row: {
          attempts: number
          business_date: string
          completed_at: string | null
          created_at: string
          cutoff_at: string
          id: string
          last_error_code: string | null
          last_error_message: string | null
          lease_expires_at: string | null
          payout_batch_id: string | null
          reference_period_end: string
          reference_period_start: string
          started_at: string
          status: Database["public"]["Enums"]["payout_scheduler_run_status"]
          updated_at: string
          window_alerted_at: string | null
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          business_date: string
          completed_at?: string | null
          created_at?: string
          cutoff_at: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          payout_batch_id?: string | null
          reference_period_end: string
          reference_period_start: string
          started_at?: string
          status?: Database["public"]["Enums"]["payout_scheduler_run_status"]
          updated_at?: string
          window_alerted_at?: string | null
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          business_date?: string
          completed_at?: string | null
          created_at?: string
          cutoff_at?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          payout_batch_id?: string | null
          reference_period_end?: string
          reference_period_start?: string
          started_at?: string
          status?: Database["public"]["Enums"]["payout_scheduler_run_status"]
          updated_at?: string
          window_alerted_at?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_scheduler_runs_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: true
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_checkout_intakes: {
        Row: {
          booking_id: string | null
          consent_accepted_at: string | null
          created_at: string
          expectation: string | null
          id: string
          initial_context: string | null
          objective: string
          patient_profile_id: string | null
          sensitive_data_acknowledged: boolean
          service_id: string | null
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          expectation?: string | null
          id?: string
          initial_context?: string | null
          objective: string
          patient_profile_id?: string | null
          sensitive_data_acknowledged?: boolean
          service_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          consent_accepted_at?: string | null
          created_at?: string
          expectation?: string | null
          id?: string
          initial_context?: string | null
          objective?: string
          patient_profile_id?: string | null
          sensitive_data_acknowledged?: boolean
          service_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_checkout_intakes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_checkout_intakes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "pre_checkout_intakes_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_checkout_intakes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "pre_checkout_intakes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "pre_checkout_intakes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "pre_checkout_intakes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "pre_checkout_intakes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "pre_checkout_intakes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "pre_checkout_intakes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          anonymized_at: string | null
          auth_deleted_at: string | null
          avatar_url: string | null
          created_at: string
          deletion_source: string | null
          display_name: string | null
          email: string | null
          email_confirmed_at: string | null
          id: string
          phone: string | null
          phone_country_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          auth_deleted_at?: string | null
          avatar_url?: string | null
          created_at?: string
          deletion_source?: string | null
          display_name?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id: string
          phone?: string | null
          phone_country_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          auth_deleted_at?: string | null
          avatar_url?: string | null
          created_at?: string
          deletion_source?: string | null
          display_name?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id?: string
          phone?: string | null
          phone_country_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      review_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          published_at: string | null
          review_id: string
          status: string
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          published_at?: string | null
          review_id: string
          status?: string
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          published_at?: string | null
          review_id?: string
          status?: string
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "public_home_testimonials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_reviews_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_reviews_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "review_replies_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "review_replies_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_revisions: {
        Row: {
          change_source: string
          changed_by_profile_id: string | null
          comment: string | null
          created_at: string
          id: string
          published_at: string | null
          rating: number
          review_id: string
          revision_number: number
          source_review_id: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          change_source: string
          changed_by_profile_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          rating: number
          review_id: string
          revision_number: number
          source_review_id?: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          change_source?: string
          changed_by_profile_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          rating?: number
          review_id?: string
          revision_number?: number
          source_review_id?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "review_revisions_changed_by_profile_id_fkey"
            columns: ["changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_revisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_home_testimonials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_revisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_revisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_revisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_revisions_source_review_id_fkey"
            columns: ["source_review_id"]
            isOneToOne: false
            referencedRelation: "public_home_testimonials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_revisions_source_review_id_fkey"
            columns: ["source_review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_revisions_source_review_id_fkey"
            columns: ["source_review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_revisions_source_review_id_fkey"
            columns: ["source_review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          moderation_reason: string | null
          patient_profile_id: string
          published_at: string | null
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          superseded_at: string | null
          superseded_by_review_id: string | null
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          moderation_reason?: string | null
          patient_profile_id: string
          published_at?: string | null
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          superseded_at?: string | null
          superseded_by_review_id?: string | null
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          moderation_reason?: string | null
          patient_profile_id?: string
          published_at?: string | null
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          superseded_at?: string | null
          superseded_by_review_id?: string | null
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "reviews_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_superseded_by_review_id_fkey"
            columns: ["superseded_by_review_id"]
            isOneToOne: false
            referencedRelation: "public_home_testimonials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_superseded_by_review_id_fkey"
            columns: ["superseded_by_review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_superseded_by_review_id_fkey"
            columns: ["superseded_by_review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_superseded_by_review_id_fkey"
            columns: ["superseded_by_review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "reviews_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "reviews_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_cancellation_decisions: {
        Row: {
          booking_id: string
          created_at: string
          decision: string
          id: string
          metadata: Json
          platform_retained_cents: number
          policy_version_id: string | null
          processed_at: string | null
          reason: string
          refund_amount_cents: number
          request_id: string
          requested_by_profile_id: string | null
          requested_by_role: string
          requires_manual_review: boolean
          retained_amount_cents: number
          review_due_at: string | null
          session_payment_id: string | null
          therapist_retained_cents: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          decision: string
          id?: string
          metadata?: Json
          platform_retained_cents?: number
          policy_version_id?: string | null
          processed_at?: string | null
          reason: string
          refund_amount_cents?: number
          request_id: string
          requested_by_profile_id?: string | null
          requested_by_role: string
          requires_manual_review?: boolean
          retained_amount_cents?: number
          review_due_at?: string | null
          session_payment_id?: string | null
          therapist_retained_cents?: number
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          decision?: string
          id?: string
          metadata?: Json
          platform_retained_cents?: number
          policy_version_id?: string | null
          processed_at?: string | null
          reason?: string
          refund_amount_cents?: number
          request_id?: string
          requested_by_profile_id?: string | null
          requested_by_role?: string
          requires_manual_review?: boolean
          retained_amount_cents?: number
          review_due_at?: string | null
          session_payment_id?: string | null
          therapist_retained_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_cancellation_decisions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cancellation_decisions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "session_cancellation_decisions_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "financial_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cancellation_decisions_requested_by_profile_id_fkey"
            columns: ["requested_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_cancellation_decisions_session_payment_id_fkey"
            columns: ["session_payment_id"]
            isOneToOne: false
            referencedRelation: "session_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      session_confirmation_incidents: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          opened_by_feedback_id: string | null
          reported_by_role: Database["public"]["Enums"]["user_role"] | null
          resolution_reason: string | null
          resolution_request_id: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          session_payment_id: string
          status: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          opened_by_feedback_id?: string | null
          reported_by_role?: Database["public"]["Enums"]["user_role"] | null
          resolution_reason?: string | null
          resolution_request_id?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          session_payment_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          opened_by_feedback_id?: string | null
          reported_by_role?: Database["public"]["Enums"]["user_role"] | null
          resolution_reason?: string | null
          resolution_request_id?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          session_payment_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_confirmation_incidents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_confirmation_incidents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "session_confirmation_incidents_opened_by_feedback_id_fkey"
            columns: ["opened_by_feedback_id"]
            isOneToOne: false
            referencedRelation: "session_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_confirmation_incidents_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_confirmation_incidents_session_payment_id_fkey"
            columns: ["session_payment_id"]
            isOneToOne: false
            referencedRelation: "session_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      session_confirmation_scheduler_runs: {
        Row: {
          attempts: number
          created_at: string
          error_code: string | null
          finalized_sessions: number
          finished_at: string | null
          id: string
          patient_confirmations: number
          scheduled_for: string
          started_at: string
          status: string
          therapist_confirmations: number
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_code?: string | null
          finalized_sessions?: number
          finished_at?: string | null
          id?: string
          patient_confirmations?: number
          scheduled_for: string
          started_at?: string
          status?: string
          therapist_confirmations?: number
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_code?: string | null
          finalized_sessions?: number
          finished_at?: string | null
          id?: string
          patient_confirmations?: number
          scheduled_for?: string
          started_at?: string
          status?: string
          therapist_confirmations?: number
          updated_at?: string
        }
        Relationships: []
      }
      session_disputes: {
        Row: {
          amount_cents: number
          closed_at: string | null
          created_at: string
          currency: string
          evidence_due_by: string | null
          id: string
          metadata: Json
          opened_at: string
          session_payment_id: string
          status: string
          stripe_charge_id: string | null
          stripe_dispute_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          closed_at?: string | null
          created_at?: string
          currency?: string
          evidence_due_by?: string | null
          id?: string
          metadata?: Json
          opened_at?: string
          session_payment_id: string
          status: string
          stripe_charge_id?: string | null
          stripe_dispute_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          closed_at?: string | null
          created_at?: string
          currency?: string
          evidence_due_by?: string | null
          id?: string
          metadata?: Json
          opened_at?: string
          session_payment_id?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_dispute_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_disputes_session_payment_id_fkey"
            columns: ["session_payment_id"]
            isOneToOne: false
            referencedRelation: "session_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      session_feedback: {
        Row: {
          author_profile_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          booking_id: string
          comment: string
          created_at: string
          id: string
          not_performed_reason: string | null
          outcome: string
          payload_hash: string
          rating: number | null
          request_id: string
          updated_at: string
        }
        Insert: {
          author_profile_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          booking_id: string
          comment?: string
          created_at?: string
          id?: string
          not_performed_reason?: string | null
          outcome: string
          payload_hash: string
          rating?: number | null
          request_id: string
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          author_role?: Database["public"]["Enums"]["user_role"]
          booking_id?: string
          comment?: string
          created_at?: string
          id?: string
          not_performed_reason?: string | null
          outcome?: string
          payload_hash?: string
          rating?: number | null
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_feedback_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_feedback_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
        ]
      }
      session_participant_confirmations: {
        Row: {
          booking_id: string
          confirmed_at: string
          confirmed_by_profile_id: string | null
          created_at: string
          due_at: string
          id: string
          outcome: string
          participant_role: Database["public"]["Enums"]["user_role"]
          payload_hash: string
          policy_version_id: string
          request_id: string
          source: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          confirmed_at?: string
          confirmed_by_profile_id?: string | null
          created_at?: string
          due_at: string
          id?: string
          outcome: string
          participant_role: Database["public"]["Enums"]["user_role"]
          payload_hash: string
          policy_version_id: string
          request_id: string
          source: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          confirmed_at?: string
          confirmed_by_profile_id?: string | null
          created_at?: string
          due_at?: string
          id?: string
          outcome?: string
          participant_role?: Database["public"]["Enums"]["user_role"]
          payload_hash?: string
          policy_version_id?: string
          request_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participant_confirmations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participant_confirmations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "session_participant_confirmations_confirmed_by_profile_id_fkey"
            columns: ["confirmed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participant_confirmations_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "financial_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_payment_attempts: {
        Row: {
          attempt_kind: string
          authorization_received_at: string | null
          booking_hold_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          request_metadata: Json
          reservation_expires_at: string | null
          response_metadata: Json
          session_payment_id: string
          slot_claimed_at: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          terminal_reason: string | null
          updated_at: string
        }
        Insert: {
          attempt_kind?: string
          authorization_received_at?: string | null
          booking_hold_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          request_metadata?: Json
          reservation_expires_at?: string | null
          response_metadata?: Json
          session_payment_id: string
          slot_claimed_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          terminal_reason?: string | null
          updated_at?: string
        }
        Update: {
          attempt_kind?: string
          authorization_received_at?: string | null
          booking_hold_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          request_metadata?: Json
          reservation_expires_at?: string | null
          response_metadata?: Json
          session_payment_id?: string
          slot_claimed_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          terminal_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_payment_attempts_booking_hold_id_fkey"
            columns: ["booking_hold_id"]
            isOneToOne: false
            referencedRelation: "booking_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payment_attempts_session_payment_id_fkey"
            columns: ["session_payment_id"]
            isOneToOne: false
            referencedRelation: "session_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      session_payments: {
        Row: {
          admin_blocked_at: string | null
          booking_id: string
          canceled_at: string | null
          created_at: string
          currency: string
          disputed_at: string | null
          eligible_at: string | null
          failed_at: string | null
          financial_status: Database["public"]["Enums"]["session_financial_status"]
          gross_amount_cents: number
          id: string
          internal_contested_at: string | null
          metadata: Json
          paid_at: string | null
          patient_profile_id: string
          platform_commission_bps: number
          platform_gross_commission_cents: number
          policy_version_id: string
          refund_pending: boolean
          service_confirmation_source:
            | Database["public"]["Enums"]["session_confirmation_source"]
            | null
          service_confirmed_at: string | null
          service_id: string
          service_status: Database["public"]["Enums"]["session_service_status"]
          stripe_balance_transaction_id: string | null
          stripe_charge_id: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_event_created_at: string | null
          stripe_event_id: string | null
          stripe_fee_amount_cents: number | null
          stripe_net_amount_cents: number | null
          stripe_payment_intent_id: string | null
          therapist_amount_cents: number
          therapist_profile_id: string
          transfer_blocked_reason: string | null
          transfer_status: Database["public"]["Enums"]["session_transfer_status"]
          updated_at: string
        }
        Insert: {
          admin_blocked_at?: string | null
          booking_id: string
          canceled_at?: string | null
          created_at?: string
          currency?: string
          disputed_at?: string | null
          eligible_at?: string | null
          failed_at?: string | null
          financial_status?: Database["public"]["Enums"]["session_financial_status"]
          gross_amount_cents: number
          id?: string
          internal_contested_at?: string | null
          metadata?: Json
          paid_at?: string | null
          patient_profile_id: string
          platform_commission_bps: number
          platform_gross_commission_cents: number
          policy_version_id: string
          refund_pending?: boolean
          service_confirmation_source?:
            | Database["public"]["Enums"]["session_confirmation_source"]
            | null
          service_confirmed_at?: string | null
          service_id: string
          service_status?: Database["public"]["Enums"]["session_service_status"]
          stripe_balance_transaction_id?: string | null
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_event_created_at?: string | null
          stripe_event_id?: string | null
          stripe_fee_amount_cents?: number | null
          stripe_net_amount_cents?: number | null
          stripe_payment_intent_id?: string | null
          therapist_amount_cents: number
          therapist_profile_id: string
          transfer_blocked_reason?: string | null
          transfer_status?: Database["public"]["Enums"]["session_transfer_status"]
          updated_at?: string
        }
        Update: {
          admin_blocked_at?: string | null
          booking_id?: string
          canceled_at?: string | null
          created_at?: string
          currency?: string
          disputed_at?: string | null
          eligible_at?: string | null
          failed_at?: string | null
          financial_status?: Database["public"]["Enums"]["session_financial_status"]
          gross_amount_cents?: number
          id?: string
          internal_contested_at?: string | null
          metadata?: Json
          paid_at?: string | null
          patient_profile_id?: string
          platform_commission_bps?: number
          platform_gross_commission_cents?: number
          policy_version_id?: string
          refund_pending?: boolean
          service_confirmation_source?:
            | Database["public"]["Enums"]["session_confirmation_source"]
            | null
          service_confirmed_at?: string | null
          service_id?: string
          service_status?: Database["public"]["Enums"]["session_service_status"]
          stripe_balance_transaction_id?: string | null
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_event_created_at?: string | null
          stripe_event_id?: string | null
          stripe_fee_amount_cents?: number | null
          stripe_net_amount_cents?: number | null
          stripe_payment_intent_id?: string | null
          therapist_amount_cents?: number
          therapist_profile_id?: string
          transfer_blocked_reason?: string | null
          transfer_status?: Database["public"]["Enums"]["session_transfer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "session_payments_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "financial_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "session_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "session_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "session_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "session_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "session_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "session_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_stripe_customer_id_fkey"
            columns: ["stripe_customer_id"]
            isOneToOne: false
            referencedRelation: "stripe_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "session_payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "session_payments_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_refunds: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          processed_at: string | null
          reason: string | null
          requested_by: string | null
          session_payment_id: string
          status: string
          stripe_refund_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          processed_at?: string | null
          reason?: string | null
          requested_by?: string | null
          session_payment_id: string
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          processed_at?: string | null
          reason?: string | null
          requested_by?: string | null
          session_payment_id?: string
          status?: string
          stripe_refund_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_refunds_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_refunds_session_payment_id_fkey"
            columns: ["session_payment_id"]
            isOneToOne: false
            referencedRelation: "session_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      session_service_confirmations: {
        Row: {
          booking_id: string
          confirmed_at: string
          confirmed_by_profile_id: string | null
          created_at: string
          id: string
          metadata: Json
          policy_version_id: string | null
          previous_service_status:
            | Database["public"]["Enums"]["session_service_status"]
            | null
          review_id: string | null
          session_payment_id: string | null
          source: Database["public"]["Enums"]["session_confirmation_source"]
        }
        Insert: {
          booking_id: string
          confirmed_at?: string
          confirmed_by_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          policy_version_id?: string | null
          previous_service_status?:
            | Database["public"]["Enums"]["session_service_status"]
            | null
          review_id?: string | null
          session_payment_id?: string | null
          source: Database["public"]["Enums"]["session_confirmation_source"]
        }
        Update: {
          booking_id?: string
          confirmed_at?: string
          confirmed_by_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          policy_version_id?: string | null
          previous_service_status?:
            | Database["public"]["Enums"]["session_service_status"]
            | null
          review_id?: string | null
          session_payment_id?: string | null
          source?: Database["public"]["Enums"]["session_confirmation_source"]
        }
        Relationships: [
          {
            foreignKeyName: "session_service_confirmations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_service_confirmations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "session_service_confirmations_confirmed_by_profile_id_fkey"
            columns: ["confirmed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_service_confirmations_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "financial_policy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_service_confirmations_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_home_testimonials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_service_confirmations_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_service_confirmations_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_service_confirmations_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_service_confirmations_session_payment_id_fkey"
            columns: ["session_payment_id"]
            isOneToOne: false
            referencedRelation: "session_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string
          email: string | null
          environment: string
          id: string
          livemode: boolean
          metadata: Json
          patient_profile_id: string | null
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          stripe_customer_id: string
          therapist_profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          environment?: string
          id?: string
          livemode?: boolean
          metadata?: Json
          patient_profile_id?: string | null
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          stripe_customer_id: string
          therapist_profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          environment?: string
          id?: string
          livemode?: boolean
          metadata?: Json
          patient_profile_id?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string
          therapist_profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_customers_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_customers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_customers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_customers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_customers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_customers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "stripe_customers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "stripe_customers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payout_transfer_allocations: {
        Row: {
          amount_cents: number
          connected_balance_transaction_id: string
          created_at: string
          currency: string
          id: string
          payout_batch_id: string
          payout_batch_therapist_id: string
          reconciled_at: string
          source_id: string
          stripe_payout_id: string
          stripe_transfer_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          connected_balance_transaction_id: string
          created_at?: string
          currency?: string
          id?: string
          payout_batch_id: string
          payout_batch_therapist_id: string
          reconciled_at?: string
          source_id: string
          stripe_payout_id: string
          stripe_transfer_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          connected_balance_transaction_id?: string
          created_at?: string
          currency?: string
          id?: string
          payout_batch_id?: string
          payout_batch_therapist_id?: string
          reconciled_at?: string
          source_id?: string
          stripe_payout_id?: string
          stripe_transfer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payout_transfer_allocatio_payout_batch_therapist_id_fkey"
            columns: ["payout_batch_therapist_id"]
            isOneToOne: false
            referencedRelation: "payout_batch_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payout_transfer_allocations_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payout_transfer_allocations_stripe_payout_id_fkey"
            columns: ["stripe_payout_id"]
            isOneToOne: false
            referencedRelation: "stripe_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payout_transfer_allocations_stripe_transfer_id_fkey"
            columns: ["stripe_transfer_id"]
            isOneToOne: true
            referencedRelation: "stripe_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payouts: {
        Row: {
          allocation_status: string
          amount_cents: number
          arrival_at: string | null
          attempt_count: number
          automatic: boolean
          connect_account_id: string
          created_at: string
          currency: string
          failed_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string | null
          included_transaction_net_cents: number | null
          lease_expires_at: string | null
          lease_owner: string | null
          next_retry_at: string | null
          paid_at: string | null
          payout_balance_transaction_id: string | null
          payout_batch_id: string | null
          payout_batch_therapist_id: string | null
          provider_reconciliation_status: string
          provider_status: string | null
          reconciled_at: string | null
          request_fingerprint: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["stripe_payout_status"]
          stripe_event_created_at: string | null
          stripe_event_id: string | null
          stripe_payout_id: string | null
          therapist_profile_id: string
          unmatched_transaction_count: number
          updated_at: string
        }
        Insert: {
          allocation_status?: string
          amount_cents: number
          arrival_at?: string | null
          attempt_count?: number
          automatic?: boolean
          connect_account_id: string
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string | null
          included_transaction_net_cents?: number | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          next_retry_at?: string | null
          paid_at?: string | null
          payout_balance_transaction_id?: string | null
          payout_batch_id?: string | null
          payout_batch_therapist_id?: string | null
          provider_reconciliation_status?: string
          provider_status?: string | null
          reconciled_at?: string | null
          request_fingerprint?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["stripe_payout_status"]
          stripe_event_created_at?: string | null
          stripe_event_id?: string | null
          stripe_payout_id?: string | null
          therapist_profile_id: string
          unmatched_transaction_count?: number
          updated_at?: string
        }
        Update: {
          allocation_status?: string
          amount_cents?: number
          arrival_at?: string | null
          attempt_count?: number
          automatic?: boolean
          connect_account_id?: string
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string | null
          included_transaction_net_cents?: number | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          next_retry_at?: string | null
          paid_at?: string | null
          payout_balance_transaction_id?: string | null
          payout_batch_id?: string | null
          payout_batch_therapist_id?: string | null
          provider_reconciliation_status?: string
          provider_status?: string | null
          reconciled_at?: string | null
          request_fingerprint?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["stripe_payout_status"]
          stripe_event_created_at?: string | null
          stripe_event_id?: string | null
          stripe_payout_id?: string | null
          therapist_profile_id?: string
          unmatched_transaction_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payouts_connect_account_id_fkey"
            columns: ["connect_account_id"]
            isOneToOne: false
            referencedRelation: "therapist_connect_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payouts_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payouts_payout_batch_therapist_id_fkey"
            columns: ["payout_batch_therapist_id"]
            isOneToOne: false
            referencedRelation: "payout_batch_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payouts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payouts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payouts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payouts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payouts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "stripe_payouts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "stripe_payouts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_transfer_reversals: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          reason: string | null
          status: string
          stripe_transfer_id: string
          stripe_transfer_reversal_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          reason?: string | null
          status?: string
          stripe_transfer_id: string
          stripe_transfer_reversal_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          reason?: string | null
          status?: string
          stripe_transfer_id?: string
          stripe_transfer_reversal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_transfer_reversals_stripe_transfer_id_fkey"
            columns: ["stripe_transfer_id"]
            isOneToOne: false
            referencedRelation: "stripe_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_transfers: {
        Row: {
          amount_cents: number
          attempt_count: number
          connect_account_id: string
          connected_balance_available_on: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          lease_expires_at: string | null
          lease_owner: string | null
          metadata: Json
          next_retry_at: string | null
          payout_batch_item_id: string
          request_fingerprint: string | null
          session_payment_id: string
          status: string
          stripe_connected_balance_transaction_id: string | null
          stripe_destination_payment_id: string | null
          stripe_source_charge_id: string | null
          stripe_transfer_id: string | null
          therapist_profile_id: string
          transferred_at: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          attempt_count?: number
          connect_account_id: string
          connected_balance_available_on?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          metadata?: Json
          next_retry_at?: string | null
          payout_batch_item_id: string
          request_fingerprint?: string | null
          session_payment_id: string
          status?: string
          stripe_connected_balance_transaction_id?: string | null
          stripe_destination_payment_id?: string | null
          stripe_source_charge_id?: string | null
          stripe_transfer_id?: string | null
          therapist_profile_id: string
          transferred_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          attempt_count?: number
          connect_account_id?: string
          connected_balance_available_on?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_owner?: string | null
          metadata?: Json
          next_retry_at?: string | null
          payout_batch_item_id?: string
          request_fingerprint?: string | null
          session_payment_id?: string
          status?: string
          stripe_connected_balance_transaction_id?: string | null
          stripe_destination_payment_id?: string | null
          stripe_source_charge_id?: string | null
          stripe_transfer_id?: string | null
          therapist_profile_id?: string
          transferred_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_transfers_connect_account_id_fkey"
            columns: ["connect_account_id"]
            isOneToOne: false
            referencedRelation: "therapist_connect_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_transfers_payout_batch_item_id_fkey"
            columns: ["payout_batch_item_id"]
            isOneToOne: true
            referencedRelation: "payout_batch_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_transfers_session_payment_id_fkey"
            columns: ["session_payment_id"]
            isOneToOne: false
            referencedRelation: "session_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_transfers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_transfers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_transfers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_transfers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_transfers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "stripe_transfers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "stripe_transfers_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          account_id: string | null
          api_version: string | null
          attempts: number
          error_code: string | null
          error_message: string | null
          event_type: string
          id: string
          livemode: boolean
          object_id: string | null
          payload_sanitized: Json | null
          payload_sha256: string | null
          processed_at: string | null
          processing_started_at: string | null
          processing_status: Database["public"]["Enums"]["stripe_webhook_processing_status"]
          received_at: string
          source: string
          stripe_event_created_at: string | null
          stripe_event_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          api_version?: string | null
          attempts?: number
          error_code?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          livemode?: boolean
          object_id?: string | null
          payload_sanitized?: Json | null
          payload_sha256?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          processing_status?: Database["public"]["Enums"]["stripe_webhook_processing_status"]
          received_at?: string
          source?: string
          stripe_event_created_at?: string | null
          stripe_event_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          api_version?: string | null
          attempts?: number
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          livemode?: boolean
          object_id?: string | null
          payload_sanitized?: Json | null
          payload_sha256?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          processing_status?: Database["public"]["Enums"]["stripe_webhook_processing_status"]
          received_at?: string
          source?: string
          stripe_event_created_at?: string | null
          stripe_event_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      structured_messages: {
        Row: {
          body: string
          booking_id: string | null
          context: Database["public"]["Enums"]["message_context"]
          created_at: string
          id: string
          metadata: Json
          patient_profile_id: string | null
          sender_profile_id: string | null
          template_id: string | null
          therapist_profile_id: string | null
        }
        Insert: {
          body: string
          booking_id?: string | null
          context: Database["public"]["Enums"]["message_context"]
          created_at?: string
          id?: string
          metadata?: Json
          patient_profile_id?: string | null
          sender_profile_id?: string | null
          template_id?: string | null
          therapist_profile_id?: string | null
        }
        Update: {
          body?: string
          booking_id?: string | null
          context?: Database["public"]["Enums"]["message_context"]
          created_at?: string
          id?: string
          metadata?: Json
          patient_profile_id?: string | null
          sender_profile_id?: string | null
          template_id?: string | null
          therapist_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "structured_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "structured_messages_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_messages_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_messages_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_messages_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_messages_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structured_messages_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "structured_messages_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "structured_messages_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_message_attachments: {
        Row: {
          created_at: string
          id: string
          message_id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_bucket: string
          storage_object_path: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          mime_type: string
          original_name: string
          size_bytes: number
          storage_bucket?: string
          storage_object_path: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          mime_type?: string
          original_name?: string
          size_bytes?: number
          storage_bucket?: string
          storage_object_path?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_message_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_profile_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          body: string
          created_at: string
          id: string
          request_id: string
          ticket_id: string
          visibility: string
        }
        Insert: {
          author_profile_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          body: string
          created_at?: string
          id?: string
          request_id: string
          ticket_id: string
          visibility?: string
        }
        Update: {
          author_profile_id?: string
          author_role?: Database["public"]["Enums"]["user_role"]
          body?: string
          created_at?: string
          id?: string
          request_id?: string
          ticket_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_admin_id: string | null
          booking_id: string | null
          category: string
          correlation_id: string | null
          created_at: string
          description: string | null
          diagnostic_context: Json
          id: string
          last_activity_at: string
          priority: string
          protocol: string
          request_id: string | null
          requester_profile_id: string | null
          resolution_summary: string | null
          resolved_at: string | null
          reviewed_at: string | null
          source: string
          status: string
          subject: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assigned_admin_id?: string | null
          booking_id?: string | null
          category: string
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          diagnostic_context?: Json
          id?: string
          last_activity_at?: string
          priority?: string
          protocol: string
          request_id?: string | null
          requester_profile_id?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          source?: string
          status?: string
          subject: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          assigned_admin_id?: string | null
          booking_id?: string | null
          category?: string
          correlation_id?: string | null
          created_at?: string
          description?: string | null
          diagnostic_context?: Json
          id?: string
          last_activity_at?: string
          priority?: string
          protocol?: string
          request_id?: string | null
          requester_profile_id?: string | null
          resolution_summary?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          source?: string
          status?: string
          subject?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "support_tickets_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapies: {
        Row: {
          archived_at: string | null
          calendar_color_key: string
          created_at: string
          created_by_profile_id: string | null
          deprecated_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available_for_services: boolean
          is_featured: boolean
          is_public_visible: boolean
          metadata: Json
          name: string
          popularity_score: number
          published_at: string | null
          replacement_therapy_id: string | null
          safety_note: string | null
          search_aliases: string[]
          short_description: string
          slug: string
          status: Database["public"]["Enums"]["therapy_status"]
          updated_at: string
          updated_by_profile_id: string | null
        }
        Insert: {
          archived_at?: string | null
          calendar_color_key?: string
          created_at?: string
          created_by_profile_id?: string | null
          deprecated_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available_for_services?: boolean
          is_featured?: boolean
          is_public_visible?: boolean
          metadata?: Json
          name: string
          popularity_score?: number
          published_at?: string | null
          replacement_therapy_id?: string | null
          safety_note?: string | null
          search_aliases?: string[]
          short_description: string
          slug: string
          status?: Database["public"]["Enums"]["therapy_status"]
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Update: {
          archived_at?: string | null
          calendar_color_key?: string
          created_at?: string
          created_by_profile_id?: string | null
          deprecated_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available_for_services?: boolean
          is_featured?: boolean
          is_public_visible?: boolean
          metadata?: Json
          name?: string
          popularity_score?: number
          published_at?: string | null
          replacement_therapy_id?: string | null
          safety_note?: string | null
          search_aliases?: string[]
          short_description?: string
          slug?: string
          status?: Database["public"]["Enums"]["therapy_status"]
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapies_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapies_replacement_therapy_id_fkey"
            columns: ["replacement_therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapies_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_availability_history_coverage: {
        Row: {
          created_at: string
          started_at: string
          therapist_profile_id: string
        }
        Insert: {
          created_at?: string
          started_at?: string
          therapist_profile_id: string
        }
        Update: {
          created_at?: string
          started_at?: string
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_availability_history_covera_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_availability_history_covera_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_availability_history_covera_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_availability_history_covera_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_availability_history_covera_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_availability_history_covera_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_availability_history_covera_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_connect_account_snapshots: {
        Row: {
          connect_account_id: string
          created_at: string
          id: string
          snapshot: Json
          stripe_event_id: string | null
        }
        Insert: {
          connect_account_id: string
          created_at?: string
          id?: string
          snapshot: Json
          stripe_event_id?: string | null
        }
        Update: {
          connect_account_id?: string
          created_at?: string
          id?: string
          snapshot?: Json
          stripe_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_connect_account_snapshots_connect_account_id_fkey"
            columns: ["connect_account_id"]
            isOneToOne: false
            referencedRelation: "therapist_connect_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_connect_accounts: {
        Row: {
          account_api_version: string
          account_generation: number
          balance_settings_synced_at: string | null
          charges_enabled: boolean
          closed_at: string | null
          closed_stripe_event_created_at: string | null
          closed_stripe_event_id: string | null
          created_at: string
          dashboard_type: string
          details_submitted: boolean
          disabled_reason: string | null
          fees_collector: string
          id: string
          is_current: boolean
          last_synced_at: string | null
          losses_collector: string
          metadata: Json
          onboarding_status: Database["public"]["Enums"]["connect_onboarding_status"]
          operational_status: string
          payout_schedule_interval: string | null
          payout_status: string
          payouts_enabled: boolean
          pending_requirements: Json
          stripe_account_id: string
          stripe_event_created_at: string | null
          stripe_event_id: string | null
          stripe_transfers_status: string
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          account_api_version?: string
          account_generation?: number
          balance_settings_synced_at?: string | null
          charges_enabled?: boolean
          closed_at?: string | null
          closed_stripe_event_created_at?: string | null
          closed_stripe_event_id?: string | null
          created_at?: string
          dashboard_type?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          fees_collector?: string
          id?: string
          is_current?: boolean
          last_synced_at?: string | null
          losses_collector?: string
          metadata?: Json
          onboarding_status?: Database["public"]["Enums"]["connect_onboarding_status"]
          operational_status?: string
          payout_schedule_interval?: string | null
          payout_status?: string
          payouts_enabled?: boolean
          pending_requirements?: Json
          stripe_account_id: string
          stripe_event_created_at?: string | null
          stripe_event_id?: string | null
          stripe_transfers_status?: string
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          account_api_version?: string
          account_generation?: number
          balance_settings_synced_at?: string | null
          charges_enabled?: boolean
          closed_at?: string | null
          closed_stripe_event_created_at?: string | null
          closed_stripe_event_id?: string | null
          created_at?: string
          dashboard_type?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          fees_collector?: string
          id?: string
          is_current?: boolean
          last_synced_at?: string | null
          losses_collector?: string
          metadata?: Json
          onboarding_status?: Database["public"]["Enums"]["connect_onboarding_status"]
          operational_status?: string
          payout_schedule_interval?: string | null
          payout_status?: string
          payouts_enabled?: boolean
          pending_requirements?: Json
          stripe_account_id?: string
          stripe_event_created_at?: string | null
          stripe_event_id?: string | null
          stripe_transfers_status?: string
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_metric_daily_aggregates: {
        Row: {
          booking_flow_starts: number
          created_at: string
          definition_version: number
          favorites_added: number
          fresh_through: string
          metric_date: string
          profile_views: number
          search_impressions: number
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          booking_flow_starts?: number
          created_at?: string
          definition_version?: number
          favorites_added?: number
          fresh_through: string
          metric_date: string
          profile_views?: number
          search_impressions?: number
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          booking_flow_starts?: number
          created_at?: string
          definition_version?: number
          favorites_added?: number
          fresh_through?: string
          metric_date?: string
          profile_views?: number
          search_impressions?: number
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_metric_daily_aggregates_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_daily_aggregates_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_daily_aggregates_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_daily_aggregates_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_daily_aggregates_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_metric_daily_aggregates_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_metric_daily_aggregates_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_metric_events: {
        Row: {
          created_at: string
          dedupe_key: string
          definition_version: number
          event_id: string
          event_source: string
          event_type: string
          id: string
          metric_date: string
          occurred_at: string
          result_position: number | null
          result_set_id: string | null
          service_id: string | null
          session_key_hash: string | null
          source_surface: string | null
          therapist_profile_id: string
          therapy_id: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          definition_version?: number
          event_id: string
          event_source: string
          event_type: string
          id?: string
          metric_date: string
          occurred_at?: string
          result_position?: number | null
          result_set_id?: string | null
          service_id?: string | null
          session_key_hash?: string | null
          source_surface?: string | null
          therapist_profile_id: string
          therapy_id?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          definition_version?: number
          event_id?: string
          event_source?: string
          event_type?: string
          id?: string
          metric_date?: string
          occurred_at?: string
          result_position?: number | null
          result_set_id?: string | null
          service_id?: string | null
          session_key_hash?: string | null
          source_surface?: string | null
          therapist_profile_id?: string
          therapy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_metric_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_metric_events_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapist_metrics_runtime_config: {
        Row: {
          public_telemetry_enabled: boolean
          singleton: boolean
          updated_at: string
        }
        Insert: {
          public_telemetry_enabled?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          public_telemetry_enabled?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      therapist_patient_relationships: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          patient_profile_id: string
          source_booking_id: string | null
          started_at: string
          status: string
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          patient_profile_id: string
          source_booking_id?: string | null
          started_at?: string
          status?: string
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          patient_profile_id?: string
          source_booking_id?: string | null
          started_at?: string
          status?: string
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_patient_relationships_patient_profile_id_fkey"
            columns: ["patient_profile_id"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_patient_relationships_source_booking_id_fkey"
            columns: ["source_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_patient_relationships_source_booking_id_fkey"
            columns: ["source_booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "therapist_patient_relationships_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_patient_relationships_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_patient_relationships_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_patient_relationships_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_patient_relationships_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_patient_relationships_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_patient_relationships_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_private_document_review_events: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          document_id: string
          id: string
          next_status: string
          previous_status: string
          reason: string | null
          therapist_profile_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          document_id: string
          id?: string
          next_status: string
          previous_status: string
          reason?: string | null
          therapist_profile_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          document_id?: string
          id?: string
          next_status?: string
          previous_status?: string
          reason?: string | null
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_private_document_review_eve_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_document_review_eve_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_document_review_eve_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_document_review_eve_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_document_review_eve_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_private_document_review_eve_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_private_document_review_eve_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_document_review_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_document_review_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_private_documents: {
        Row: {
          created_at: string
          document_kind: string
          file_name: string
          file_size_bytes: number
          id: string
          mime_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_bucket: string
          storage_object_path: string
          therapist_profile_id: string
          updated_at: string
          uploaded_by: string | null
          validation_state: string
        }
        Insert: {
          created_at?: string
          document_kind?: string
          file_name: string
          file_size_bytes: number
          id?: string
          mime_type: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_bucket?: string
          storage_object_path: string
          therapist_profile_id: string
          updated_at?: string
          uploaded_by?: string | null
          validation_state?: string
        }
        Update: {
          created_at?: string
          document_kind?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_bucket?: string
          storage_object_path?: string
          therapist_profile_id?: string
          updated_at?: string
          uploaded_by?: string | null
          validation_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_private_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_documents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_documents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_documents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_documents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_documents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_private_documents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_private_documents_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_private_identity: {
        Row: {
          city: string
          complement: string | null
          country: string
          created_at: string
          document_number: string
          document_type: string
          id: string
          neighborhood: string
          postal_code: string
          state: string
          street: string
          street_number: string
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          city: string
          complement?: string | null
          country?: string
          created_at?: string
          document_number: string
          document_type: string
          id?: string
          neighborhood: string
          postal_code: string
          state: string
          street: string
          street_number: string
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          city?: string
          complement?: string | null
          country?: string
          created_at?: string
          document_number?: string
          document_type?: string
          id?: string
          neighborhood?: string
          postal_code?: string
          state?: string
          street?: string
          street_number?: string
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_private_identity_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_identity_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_identity_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_identity_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_private_identity_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_private_identity_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_private_identity_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profile_content_versions: {
        Row: {
          base_profile_version: number | null
          bio_illustration_id: string | null
          created_at: string
          essence_body: string | null
          experience_years: number | null
          id: string
          invitation_body: string | null
          profile_payload: Json
          public_profile_theme: string
          published_at: string | null
          short_intro: string | null
          status: string
          therapist_profile_id: string
          updated_at: string
          video_provider: string | null
          video_thumbnail_url: string | null
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          base_profile_version?: number | null
          bio_illustration_id?: string | null
          created_at?: string
          essence_body?: string | null
          experience_years?: number | null
          id?: string
          invitation_body?: string | null
          profile_payload?: Json
          public_profile_theme?: string
          published_at?: string | null
          short_intro?: string | null
          status?: string
          therapist_profile_id: string
          updated_at?: string
          video_provider?: string | null
          video_thumbnail_url?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          base_profile_version?: number | null
          bio_illustration_id?: string | null
          created_at?: string
          essence_body?: string | null
          experience_years?: number | null
          id?: string
          invitation_body?: string | null
          profile_payload?: Json
          public_profile_theme?: string
          published_at?: string | null
          short_intro?: string | null
          status?: string
          therapist_profile_id?: string
          updated_at?: string
          video_provider?: string | null
          video_thumbnail_url?: string | null
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profile_daily_analytics: {
        Row: {
          contact_clicks: number
          created_at: string
          favorites_added: number
          metric_date: string
          profile_clicks: number
          profile_views: number
          search_impressions: number
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          contact_clicks?: number
          created_at?: string
          favorites_added?: number
          metric_date: string
          profile_clicks?: number
          profile_views?: number
          search_impressions?: number
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          contact_clicks?: number
          created_at?: string
          favorites_added?: number
          metric_date?: string
          profile_clicks?: number
          profile_views?: number
          search_impressions?: number
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profile_daily_analytics_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_daily_analytics_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_daily_analytics_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_daily_analytics_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_daily_analytics_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_daily_analytics_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_daily_analytics_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profile_events: {
        Row: {
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          next_public_status: string | null
          next_version: number | null
          previous_public_status: string | null
          previous_version: number | null
          reason: string | null
          request_id: string | null
          therapist_profile_id: string
        }
        Insert: {
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          next_public_status?: string | null
          next_version?: number | null
          previous_public_status?: string | null
          previous_version?: number | null
          reason?: string | null
          request_id?: string | null
          therapist_profile_id: string
        }
        Update: {
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          next_public_status?: string | null
          next_version?: number | null
          previous_public_status?: string | null
          previous_version?: number | null
          reason?: string | null
          request_id?: string | null
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profile_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profile_guide_items: {
        Row: {
          content_version_id: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          content_version_id: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          content_version_id?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profile_guide_items_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "therapist_profile_content_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profile_mutation_requests: {
        Row: {
          action: string
          created_at: string
          id: string
          payload_hash: string
          request_id: string
          response: Json
          therapist_profile_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload_hash: string
          request_id: string
          response: Json
          therapist_profile_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload_hash?: string
          request_id?: string
          response?: Json
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profile_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profile_reflections: {
        Row: {
          content_version_id: string
          created_at: string
          excerpt: string | null
          href: string | null
          id: string
          image_url: string | null
          is_public: boolean
          minutes_to_read: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content_version_id: string
          created_at?: string
          excerpt?: string | null
          href?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          minutes_to_read?: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content_version_id?: string
          created_at?: string
          excerpt?: string | null
          href?: string | null
          id?: string
          image_url?: string | null
          is_public?: boolean
          minutes_to_read?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profile_reflections_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "therapist_profile_content_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profile_slug_history: {
        Row: {
          created_at: string
          current_slug: string
          id: string
          old_slug: string
          therapist_profile_id: string
        }
        Insert: {
          created_at?: string
          current_slug: string
          id?: string
          old_slug: string
          therapist_profile_id: string
        }
        Update: {
          created_at?: string
          current_slug?: string
          id?: string
          old_slug?: string
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profile_slug_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_slug_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_slug_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_slug_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_slug_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_slug_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_slug_history_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profiles: {
        Row: {
          accepts_online_sessions: boolean
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          free_public_slug: string
          headline: string | null
          id: string
          is_accepting_bookings: boolean
          is_public: boolean
          languages: string[]
          last_published_at: string | null
          legal_name: string | null
          metadata: Json
          photo_url: string | null
          plan: Database["public"]["Enums"]["therapist_plan"]
          profile_version: number
          public_name: string
          public_profile_theme: string
          public_status: string
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["therapist_status"]
          unpublished_at: string | null
          updated_at: string
          user_id: string
          visibility_flags: Json
        }
        Insert: {
          accepts_online_sessions?: boolean
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          free_public_slug: string
          headline?: string | null
          id?: string
          is_accepting_bookings?: boolean
          is_public?: boolean
          languages?: string[]
          last_published_at?: string | null
          legal_name?: string | null
          metadata?: Json
          photo_url?: string | null
          plan?: Database["public"]["Enums"]["therapist_plan"]
          profile_version?: number
          public_name: string
          public_profile_theme?: string
          public_status?: string
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["therapist_status"]
          unpublished_at?: string | null
          updated_at?: string
          user_id: string
          visibility_flags?: Json
        }
        Update: {
          accepts_online_sessions?: boolean
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          free_public_slug?: string
          headline?: string | null
          id?: string
          is_accepting_bookings?: boolean
          is_public?: boolean
          languages?: string[]
          last_published_at?: string | null
          legal_name?: string | null
          metadata?: Json
          photo_url?: string | null
          plan?: Database["public"]["Enums"]["therapist_plan"]
          profile_version?: number
          public_name?: string
          public_profile_theme?: string
          public_status?: string
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["therapist_status"]
          unpublished_at?: string | null
          updated_at?: string
          user_id?: string
          visibility_flags?: Json
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_review_reply_mutation_requests: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload_hash: string
          reply_id: string | null
          request_id: string
          review_id: string | null
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload_hash: string
          reply_id?: string | null
          request_id: string
          review_id?: string | null
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload_hash?: string
          reply_id?: string | null
          request_id?: string
          review_id?: string | null
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_review_reply_mutation_reque_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_reque_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_reque_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_reque_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_reque_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_reque_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_reque_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_requests_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "review_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_home_testimonials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_reviews_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_review_reply_mutation_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_schedule_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          previous_version: number
          request_id: string
          resulting_version: number
          rule_count: number
          service_settings_count: number
          therapist_profile_id: string
          timezone: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          previous_version: number
          request_id: string
          resulting_version: number
          rule_count: number
          service_settings_count: number
          therapist_profile_id: string
          timezone: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          previous_version?: number
          request_id?: string
          resulting_version?: number
          rule_count?: number
          service_settings_count?: number
          therapist_profile_id?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_schedule_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_schedule_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_schedule_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_schedule_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_schedule_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_schedule_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_schedule_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_schedule_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_schedule_settings: {
        Row: {
          created_at: string
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          therapist_profile_id: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          therapist_profile_id?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "therapist_schedule_settings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_schedule_settings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_schedule_settings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_schedule_settings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_schedule_settings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_schedule_settings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_schedule_settings_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_service_booking_settings: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          created_at: string
          id: string
          interval_minutes: number
          max_days_ahead: number
          min_notice_minutes: number
          service_id: string
          updated_at: string
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          id?: string
          interval_minutes?: number
          max_days_ahead?: number
          min_notice_minutes?: number
          service_id: string
          updated_at?: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          created_at?: string
          id?: string
          interval_minutes?: number
          max_days_ahead?: number
          min_notice_minutes?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_service_booking_settings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_booking_settings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_booking_settings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_booking_settings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_booking_settings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_booking_settings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_booking_settings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_service_cancellation_policies: {
        Row: {
          created_at: string
          description: string | null
          free_until_hours: number
          id: string
          late_cancel_fee_percent: number
          no_show_fee_percent: number
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          free_until_hours?: number
          id?: string
          late_cancel_fee_percent?: number
          no_show_fee_percent?: number
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          free_until_hours?: number
          id?: string
          late_cancel_fee_percent?: number
          no_show_fee_percent?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_service_cancellation_policies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_cancellation_policies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_cancellation_policies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_cancellation_policies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_cancellation_policies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_cancellation_policies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_cancellation_policies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_service_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          next_status: Database["public"]["Enums"]["service_status"] | null
          previous_status: Database["public"]["Enums"]["service_status"] | null
          previous_version: number | null
          request_id: string | null
          resulting_version: number | null
          service_id: string | null
          therapist_profile_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          next_status?: Database["public"]["Enums"]["service_status"] | null
          previous_status?: Database["public"]["Enums"]["service_status"] | null
          previous_version?: number | null
          request_id?: string | null
          resulting_version?: number | null
          service_id?: string | null
          therapist_profile_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          next_status?: Database["public"]["Enums"]["service_status"] | null
          previous_status?: Database["public"]["Enums"]["service_status"] | null
          previous_version?: number | null
          request_id?: string | null
          resulting_version?: number | null
          service_id?: string | null
          therapist_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_service_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_service_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_service_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_service_matching_interests: {
        Row: {
          created_at: string
          interest_id: string
          therapist_service_id: string
        }
        Insert: {
          created_at?: string
          interest_id: string
          therapist_service_id: string
        }
        Update: {
          created_at?: string
          interest_id?: string
          therapist_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_service_matching_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "matching_interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_matching_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "public_matching_config"
            referencedColumns: ["interest_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_interests_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_interests_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_interests_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_interests_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_interests_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_interests_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_interests_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_service_matching_themes: {
        Row: {
          created_at: string
          theme_id: string
          therapist_service_id: string
        }
        Insert: {
          created_at?: string
          theme_id: string
          therapist_service_id: string
        }
        Update: {
          created_at?: string
          theme_id?: string
          therapist_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_service_matching_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "matching_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_matching_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "public_matching_config"
            referencedColumns: ["theme_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_themes_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_themes_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_themes_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_themes_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_themes_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_themes_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_matching_themes_therapist_service_id_fkey"
            columns: ["therapist_service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_service_mutation_requests: {
        Row: {
          created_at: string
          id: string
          operation: string
          payload_hash: string
          request_id: string
          response: Json
          service_id: string | null
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          operation: string
          payload_hash: string
          request_id: string
          response: Json
          service_id?: string | null
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          payload_hash?: string
          request_id?: string
          response?: Json
          service_id?: string | null
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_service_mutation_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_service_mutation_requests_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_services: {
        Row: {
          archived_at: string | null
          created_at: string
          currency: string
          delivery_format: string
          description: string | null
          duration_minutes: number
          id: string
          is_bookable: boolean
          online_only: boolean
          position: number
          price_cents: number
          status: Database["public"]["Enums"]["service_status"]
          therapist_profile_id: string
          therapy_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          delivery_format?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_bookable?: boolean
          online_only?: boolean
          position?: number
          price_cents: number
          status?: Database["public"]["Enums"]["service_status"]
          therapist_profile_id: string
          therapy_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          delivery_format?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_bookable?: boolean
          online_only?: boolean
          position?: number
          price_cents?: number
          status?: Database["public"]["Enums"]["service_status"]
          therapist_profile_id?: string
          therapy_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapist_subscription_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          next_plan: Database["public"]["Enums"]["therapist_plan"] | null
          next_status: string | null
          previous_plan: Database["public"]["Enums"]["therapist_plan"] | null
          previous_status: string | null
          stripe_event_id: string | null
          therapist_profile_id: string | null
          therapist_subscription_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          next_plan?: Database["public"]["Enums"]["therapist_plan"] | null
          next_status?: string | null
          previous_plan?: Database["public"]["Enums"]["therapist_plan"] | null
          previous_status?: string | null
          stripe_event_id?: string | null
          therapist_profile_id?: string | null
          therapist_subscription_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          next_plan?: Database["public"]["Enums"]["therapist_plan"] | null
          next_status?: string | null
          previous_plan?: Database["public"]["Enums"]["therapist_plan"] | null
          previous_status?: string | null
          stripe_event_id?: string | null
          therapist_profile_id?: string | null
          therapist_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_subscription_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscription_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscription_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscription_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscription_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_subscription_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_subscription_events_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscription_events_therapist_subscription_id_fkey"
            columns: ["therapist_subscription_id"]
            isOneToOne: false
            referencedRelation: "therapist_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_subscriptions: {
        Row: {
          billing_plan_id: string | null
          billing_plan_price_id: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          ended_at: string | null
          id: string
          metadata: Json
          plan_code: Database["public"]["Enums"]["therapist_plan"]
          status: Database["public"]["Enums"]["billing_subscription_status"]
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_event_created_at: string | null
          stripe_latest_invoice_id: string | null
          stripe_subscription_id: string | null
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          billing_plan_id?: string | null
          billing_plan_price_id?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          plan_code: Database["public"]["Enums"]["therapist_plan"]
          status: Database["public"]["Enums"]["billing_subscription_status"]
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_event_created_at?: string | null
          stripe_latest_invoice_id?: string | null
          stripe_subscription_id?: string | null
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          billing_plan_id?: string | null
          billing_plan_price_id?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          plan_code?: Database["public"]["Enums"]["therapist_plan"]
          status?: Database["public"]["Enums"]["billing_subscription_status"]
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_event_created_at?: string | null
          stripe_latest_invoice_id?: string | null
          stripe_subscription_id?: string | null
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_subscriptions_billing_plan_id_fkey"
            columns: ["billing_plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscriptions_billing_plan_price_id_fkey"
            columns: ["billing_plan_price_id"]
            isOneToOne: false
            referencedRelation: "billing_plan_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscriptions_stripe_customer_id_fkey"
            columns: ["stripe_customer_id"]
            isOneToOne: false
            referencedRelation: "stripe_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscriptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscriptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscriptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscriptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_subscriptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_subscriptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_subscriptions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_verifications: {
        Row: {
          changes_requested: string | null
          created_at: string
          documents_metadata: Json
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["therapist_status"]
          submitted_at: string
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          changes_requested?: string | null
          created_at?: string
          documents_metadata?: Json
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["therapist_status"]
          submitted_at?: string
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          changes_requested?: string | null
          created_at?: string
          documents_metadata?: Json
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["therapist_status"]
          submitted_at?: string
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_verifications_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_verifications_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_verifications_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_verifications_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_verifications_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_verifications_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_verifications_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapy_benefits: {
        Row: {
          created_at: string
          description: string | null
          icon_key: string
          id: string
          sort_order: number
          therapy_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_key: string
          id?: string
          sort_order?: number
          therapy_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_key?: string
          id?: string
          sort_order?: number
          therapy_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_benefits_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapy_catalog_events: {
        Row: {
          actor_profile_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"]
          correlation_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          metadata: Json
          next_state: Json | null
          previous_state: Json | null
          reason: string | null
          request_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"]
          correlation_id?: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json
          next_state?: Json | null
          previous_state?: Json | null
          reason?: string | null
          request_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"]
          correlation_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json
          next_state?: Json | null
          previous_state?: Json | null
          reason?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapy_catalog_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapy_catalog_request_materials: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number
          id: string
          mime_type: string
          storage_object_path: string
          therapy_catalog_request_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes: number
          id?: string
          mime_type: string
          storage_object_path: string
          therapy_catalog_request_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          storage_object_path?: string
          therapy_catalog_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_catalog_request_materia_therapy_catalog_request_id_fkey"
            columns: ["therapy_catalog_request_id"]
            isOneToOne: false
            referencedRelation: "therapy_catalog_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      therapy_catalog_requests: {
        Row: {
          client_request_id: string | null
          created_at: string
          decided_at: string | null
          decided_by_profile_id: string | null
          decision: string | null
          description: string | null
          id: string
          informed_name: string
          justification: string | null
          related_therapy_id: string | null
          requester_profile_id: string
          requester_therapist_profile_id: string | null
          resubmitted_at: string | null
          status: string
          submission: Json
          submission_version: number
          updated_at: string
        }
        Insert: {
          client_request_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by_profile_id?: string | null
          decision?: string | null
          description?: string | null
          id?: string
          informed_name: string
          justification?: string | null
          related_therapy_id?: string | null
          requester_profile_id: string
          requester_therapist_profile_id?: string | null
          resubmitted_at?: string | null
          status?: string
          submission?: Json
          submission_version?: number
          updated_at?: string
        }
        Update: {
          client_request_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by_profile_id?: string | null
          decision?: string | null
          description?: string | null
          id?: string
          informed_name?: string
          justification?: string | null
          related_therapy_id?: string | null
          requester_profile_id?: string
          requester_therapist_profile_id?: string | null
          resubmitted_at?: string | null
          status?: string
          submission?: Json
          submission_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_catalog_requests_decided_by_profile_id_fkey"
            columns: ["decided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_related_therapy_id_fkey"
            columns: ["related_therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_requester_therapist_profile_id_fkey"
            columns: ["requester_therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_requester_therapist_profile_id_fkey"
            columns: ["requester_therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_requester_therapist_profile_id_fkey"
            columns: ["requester_therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_requester_therapist_profile_id_fkey"
            columns: ["requester_therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_requester_therapist_profile_id_fkey"
            columns: ["requester_therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_requester_therapist_profile_id_fkey"
            columns: ["requester_therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapy_catalog_requests_requester_therapist_profile_id_fkey"
            columns: ["requester_therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapy_faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          sort_order: number
          therapy_id: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          sort_order?: number
          therapy_id: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          sort_order?: number
          therapy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_faqs_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapy_highlights: {
        Row: {
          created_at: string
          icon_key: string
          id: string
          sort_order: number
          therapy_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon_key: string
          id?: string
          sort_order?: number
          therapy_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon_key?: string
          id?: string
          sort_order?: number
          therapy_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_highlights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapy_matching_themes: {
        Row: {
          created_at: string
          sort_order: number
          theme_id: string
          therapy_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          sort_order?: number
          theme_id: string
          therapy_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          sort_order?: number
          theme_id?: string
          therapy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_matching_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "matching_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "public_matching_config"
            referencedColumns: ["theme_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapy_public_content: {
        Row: {
          approach_icon_key: string | null
          approach_label: string | null
          complementary_description: string | null
          created_at: string
          hero_focal_point: string
          hero_image_url: string | null
          introduction: string | null
          safety_note: string | null
          seo_description: string | null
          seo_title: string | null
          subtitle: string | null
          therapy_id: string
          updated_at: string
          visual_theme_key: Database["public"]["Enums"]["therapy_visual_theme_key"]
        }
        Insert: {
          approach_icon_key?: string | null
          approach_label?: string | null
          complementary_description?: string | null
          created_at?: string
          hero_focal_point?: string
          hero_image_url?: string | null
          introduction?: string | null
          safety_note?: string | null
          seo_description?: string | null
          seo_title?: string | null
          subtitle?: string | null
          therapy_id: string
          updated_at?: string
          visual_theme_key?: Database["public"]["Enums"]["therapy_visual_theme_key"]
        }
        Update: {
          approach_icon_key?: string | null
          approach_label?: string | null
          complementary_description?: string | null
          created_at?: string
          hero_focal_point?: string
          hero_image_url?: string | null
          introduction?: string | null
          safety_note?: string | null
          seo_description?: string | null
          seo_title?: string | null
          subtitle?: string | null
          therapy_id?: string
          updated_at?: string
          visual_theme_key?: Database["public"]["Enums"]["therapy_visual_theme_key"]
        }
        Relationships: [
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_public_content_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: true
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapy_slug_redirects: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          current_slug: string
          id: string
          old_slug: string
          therapy_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          current_slug: string
          id?: string
          old_slug: string
          therapy_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          current_slug?: string
          id?: string
          old_slug?: string
          therapy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_slug_redirects_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapy_theme_weights: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          reason: string | null
          source: Database["public"]["Enums"]["match_source"]
          subtheme_id: string | null
          theme_id: string | null
          therapy_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          reason?: string | null
          source?: Database["public"]["Enums"]["match_source"]
          subtheme_id?: string | null
          theme_id?: string | null
          therapy_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          reason?: string | null
          source?: Database["public"]["Enums"]["match_source"]
          subtheme_id?: string | null
          theme_id?: string | null
          therapy_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "therapy_theme_weights_subtheme_id_fkey"
            columns: ["subtheme_id"]
            isOneToOne: false
            referencedRelation: "therapy_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "therapy_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapy_themes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_theme_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_theme_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_theme_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapy_themes_parent_theme_id_fkey"
            columns: ["parent_theme_id"]
            isOneToOne: false
            referencedRelation: "therapy_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      video_session_control_jobs: {
        Row: {
          attempts: number
          booking_id: string
          completed_at: string | null
          created_at: string
          environment: string
          id: string
          idempotency_key: string
          last_error_code: string | null
          last_error_message: string | null
          locked_until_at: string | null
          max_attempts: number
          metadata: Json
          next_run_at: string
          operation: Database["public"]["Enums"]["video_session_control_operation"]
          status: Database["public"]["Enums"]["video_session_control_job_status"]
          updated_at: string
          video_session_id: string
        }
        Insert: {
          attempts?: number
          booking_id: string
          completed_at?: string | null
          created_at?: string
          environment: string
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_until_at?: string | null
          max_attempts?: number
          metadata?: Json
          next_run_at?: string
          operation: Database["public"]["Enums"]["video_session_control_operation"]
          status?: Database["public"]["Enums"]["video_session_control_job_status"]
          updated_at?: string
          video_session_id: string
        }
        Update: {
          attempts?: number
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          environment?: string
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_until_at?: string | null
          max_attempts?: number
          metadata?: Json
          next_run_at?: string
          operation?: Database["public"]["Enums"]["video_session_control_operation"]
          status?: Database["public"]["Enums"]["video_session_control_job_status"]
          updated_at?: string
          video_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_session_control_jobs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_session_control_jobs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "video_session_control_jobs_video_session_id_fkey"
            columns: ["video_session_id"]
            isOneToOne: false
            referencedRelation: "patient_video_session_summary_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_session_control_jobs_video_session_id_fkey"
            columns: ["video_session_id"]
            isOneToOne: false
            referencedRelation: "therapist_video_session_summary_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_session_control_jobs_video_session_id_fkey"
            columns: ["video_session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_session_participations: {
        Row: {
          booking_id: string
          created_at: string
          duration_seconds: number | null
          event_type: string
          id: string
          joined_at: string | null
          left_at: string | null
          metadata: Json
          participant_correlation_key: string
          participant_role: Database["public"]["Enums"]["video_session_participant_role"]
          provider_user_id: string | null
          provider_user_key: string | null
          updated_at: string
          video_session_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          duration_seconds?: number | null
          event_type: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          metadata?: Json
          participant_correlation_key: string
          participant_role?: Database["public"]["Enums"]["video_session_participant_role"]
          provider_user_id?: string | null
          provider_user_key?: string | null
          updated_at?: string
          video_session_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          duration_seconds?: number | null
          event_type?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          metadata?: Json
          participant_correlation_key?: string
          participant_role?: Database["public"]["Enums"]["video_session_participant_role"]
          provider_user_id?: string | null
          provider_user_key?: string | null
          updated_at?: string
          video_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_session_participations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_session_participations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
          {
            foreignKeyName: "video_session_participations_video_session_id_fkey"
            columns: ["video_session_id"]
            isOneToOne: false
            referencedRelation: "patient_video_session_summary_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_session_participations_video_session_id_fkey"
            columns: ["video_session_id"]
            isOneToOne: false
            referencedRelation: "therapist_video_session_summary_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_session_participations_video_session_id_fkey"
            columns: ["video_session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_sessions: {
        Row: {
          actual_ended_at: string | null
          actual_started_at: string | null
          booking_id: string
          created_at: string
          environment: string
          hard_ends_at: string | null
          id: string
          last_error_code: string | null
          last_error_message: string | null
          last_maintenance_at: string | null
          last_participant_left_at: string | null
          last_provider_event_at: string | null
          last_synced_at: string | null
          metadata: Json
          participant_count: number
          provider: string
          provider_session_id: string | null
          scheduled_ends_at: string
          scheduled_starts_at: string
          session_key: string | null
          session_name: string
          status: Database["public"]["Enums"]["video_session_status"]
          termination_confirmed_at: string | null
          termination_reason: string | null
          termination_requested_at: string | null
          therapist_first_joined_at: string | null
          therapist_last_joined_at: string | null
          therapist_last_left_at: string | null
          therapist_present: boolean
          therapist_token_issued_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          booking_id: string
          created_at?: string
          environment: string
          hard_ends_at?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_maintenance_at?: string | null
          last_participant_left_at?: string | null
          last_provider_event_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          participant_count?: number
          provider?: string
          provider_session_id?: string | null
          scheduled_ends_at: string
          scheduled_starts_at: string
          session_key?: string | null
          session_name: string
          status?: Database["public"]["Enums"]["video_session_status"]
          termination_confirmed_at?: string | null
          termination_reason?: string | null
          termination_requested_at?: string | null
          therapist_first_joined_at?: string | null
          therapist_last_joined_at?: string | null
          therapist_last_left_at?: string | null
          therapist_present?: boolean
          therapist_token_issued_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          booking_id?: string
          created_at?: string
          environment?: string
          hard_ends_at?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_maintenance_at?: string | null
          last_participant_left_at?: string | null
          last_provider_event_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          participant_count?: number
          provider?: string
          provider_session_id?: string | null
          scheduled_ends_at?: string
          scheduled_starts_at?: string
          session_key?: string | null
          session_name?: string
          status?: Database["public"]["Enums"]["video_session_status"]
          termination_confirmed_at?: string | null
          termination_reason?: string | null
          termination_requested_at?: string | null
          therapist_first_joined_at?: string | null
          therapist_last_joined_at?: string | null
          therapist_last_left_at?: string | null
          therapist_present?: boolean
          therapist_token_issued_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
        ]
      }
      zoom_video_access_issue_limits: {
        Row: {
          actor_role: string
          blocked_count: number
          booking_id: string
          environment: string
          id: string
          issued_count: number
          last_issued_at: string | null
          profile_id: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          actor_role: string
          blocked_count?: number
          booking_id: string
          environment: string
          id?: string
          issued_count?: number
          last_issued_at?: string | null
          profile_id: string
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          actor_role?: string
          blocked_count?: number
          booking_id?: string
          environment?: string
          id?: string
          issued_count?: number
          last_issued_at?: string | null
          profile_id?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_video_access_issue_limits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zoom_video_access_issue_limits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
        ]
      }
      zoom_video_webhook_events: {
        Row: {
          account_identifier: string | null
          attempts: number
          created_at: string
          error_code: string | null
          error_message: string | null
          event_key: string
          event_ts: string | null
          event_type: string
          id: string
          payload_sanitized: Json
          payload_sha256: string
          processed_at: string | null
          processing_started_at: string | null
          processing_status: Database["public"]["Enums"]["zoom_video_webhook_processing_status"]
          provider_session_id: string | null
          provider_user_id: string | null
          provider_user_key: string | null
          request_id: string | null
          session_name_hash: string | null
          updated_at: string
        }
        Insert: {
          account_identifier?: string | null
          attempts?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_key: string
          event_ts?: string | null
          event_type: string
          id?: string
          payload_sanitized?: Json
          payload_sha256: string
          processed_at?: string | null
          processing_started_at?: string | null
          processing_status?: Database["public"]["Enums"]["zoom_video_webhook_processing_status"]
          provider_session_id?: string | null
          provider_user_id?: string | null
          provider_user_key?: string | null
          request_id?: string | null
          session_name_hash?: string | null
          updated_at?: string
        }
        Update: {
          account_identifier?: string | null
          attempts?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_key?: string
          event_ts?: string | null
          event_type?: string
          id?: string
          payload_sanitized?: Json
          payload_sha256?: string
          processed_at?: string | null
          processing_started_at?: string | null
          processing_status?: Database["public"]["Enums"]["zoom_video_webhook_processing_status"]
          provider_session_id?: string | null
          provider_user_id?: string | null
          provider_user_key?: string | null
          request_id?: string | null
          session_name_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      patient_video_session_summary_v: {
        Row: {
          actual_ended_at: string | null
          actual_started_at: string | null
          booking_id: string | null
          environment: string | null
          hard_ends_at: string | null
          id: string | null
          last_synced_at: string | null
          provider: string | null
          scheduled_ends_at: string | null
          scheduled_starts_at: string | null
          status: Database["public"]["Enums"]["video_session_status"] | null
          therapist_first_joined_at: string | null
          therapist_present: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "video_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
        ]
      }
      public_home_testimonials: {
        Row: {
          author_name: string | null
          body: string | null
          context_label: string | null
          created_at: string | null
          id: string | null
          published_at: string | null
          rating: number | null
        }
        Insert: {
          author_name?: never
          body?: string | null
          context_label?: never
          created_at?: string | null
          id?: string | null
          published_at?: string | null
          rating?: number | null
        }
        Update: {
          author_name?: never
          body?: string | null
          context_label?: never
          created_at?: string | null
          id?: string | null
          published_at?: string | null
          rating?: number | null
        }
        Relationships: []
      }
      public_home_therapies: {
        Row: {
          href_slug: string | null
          id: string | null
          is_featured: boolean | null
          name: string | null
          short_description: string | null
          slug: string | null
          theme_name: string | null
          theme_slug: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_home_therapists: {
        Row: {
          accepts_online_sessions: boolean | null
          average_rating: number | null
          headline: string | null
          id: string | null
          photo_url: string | null
          public_name: string | null
          review_count: number | null
          service_price_from_cents: number | null
          service_title: string | null
          slug: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_home_therapists_internal: {
        Row: {
          accepts_online_sessions: boolean | null
          average_rating: number | null
          headline: string | null
          id: string | null
          photo_url: string | null
          public_name: string | null
          review_count: number | null
          service_price_from_cents: number | null
          service_title: string | null
          slug: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_matching_config: {
        Row: {
          interest_id: string | null
          interest_name: string | null
          interest_slug: string | null
          interest_sort_order: number | null
          theme_description: string | null
          theme_id: string | null
          theme_image_url: string | null
          theme_name: string | null
          theme_slug: string | null
          theme_sort_order: number | null
          version: number | null
          version_id: string | null
        }
        Relationships: []
      }
      public_matching_therapies_v: {
        Row: {
          description: string | null
          id: string | null
          image_url: string | null
          is_visible_in_matching: boolean | null
          name: string | null
          short_description: string | null
          slug: string | null
          status: Database["public"]["Enums"]["therapy_status"] | null
          therapist_count: number | null
        }
        Relationships: []
      }
      public_matching_therapist_counts: {
        Row: {
          therapist_count: number | null
          therapy_id: string | null
        }
        Relationships: []
      }
      public_matching_therapy_themes_v: {
        Row: {
          sort_order: number | null
          theme_id: string | null
          theme_name: string | null
          theme_slug: string | null
          therapy_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapy_matching_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "matching_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "public_matching_config"
            referencedColumns: ["theme_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_matching_themes_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      public_therapies_v: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          is_featured: boolean | null
          is_new: boolean | null
          is_popular: boolean | null
          name: string | null
          popularity_score: number | null
          published_at: string | null
          search_text: string | null
          short_description: string | null
          slug: string | null
          status: Database["public"]["Enums"]["therapy_status"] | null
          theme_names: string[] | null
          theme_slugs: string[] | null
          therapist_count: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_therapist_profile_content_v: {
        Row: {
          bio_illustration_id: string | null
          essence_body: string | null
          experience_years: number | null
          guide_items: Json | null
          invitation_body: string | null
          public_profile_theme: string | null
          reflections: Json | null
          short_intro: string | null
          slug: string | null
        }
        Relationships: []
      }
      public_therapist_profile_content_v_internal: {
        Row: {
          essence_body: string | null
          experience_years: number | null
          guide_items: Json | null
          invitation_body: string | null
          reflections: Json | null
          short_intro: string | null
          slug: string | null
          therapist_profile_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_profile_content_versions_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_therapist_profile_reviews_v: {
        Row: {
          author_label: string | null
          body: string | null
          created_label: string | null
          id: string | null
          patient_context: string | null
          published_at: string | null
          rating: number | null
          reply_body: string | null
          reply_published_at: string | null
          therapist_slug: string | null
        }
        Relationships: []
      }
      public_therapist_profile_reviews_v_internal: {
        Row: {
          author_label: string | null
          body: string | null
          created_label: string | null
          id: string | null
          patient_context: string | null
          published_at: string | null
          rating: number | null
          reply_body: string | null
          reply_published_at: string | null
          therapist_slug: string | null
        }
        Relationships: []
      }
      public_therapist_profile_services_v: {
        Row: {
          availability_exceptions: Json | null
          availability_rules: Json | null
          booking_conflicts: Json | null
          buffer_after_minutes: number | null
          buffer_before_minutes: number | null
          currency: string | null
          description: string | null
          duration_minutes: number | null
          interval_minutes: number | null
          max_days_ahead: number | null
          min_notice_minutes: number | null
          price_cents: number | null
          service_id: string | null
          service_title: string | null
          sort_order: number | null
          therapist_slug: string | null
          therapy_id: string | null
          therapy_name: string | null
          therapy_slug: string | null
        }
        Relationships: []
      }
      public_therapist_profile_services_v_internal: {
        Row: {
          availability_exceptions: Json | null
          availability_rules: Json | null
          booking_conflicts: Json | null
          buffer_after_minutes: number | null
          buffer_before_minutes: number | null
          currency: string | null
          description: string | null
          duration_minutes: number | null
          interval_minutes: number | null
          max_days_ahead: number | null
          min_notice_minutes: number | null
          price_cents: number | null
          service_id: string | null
          service_title: string | null
          sort_order: number | null
          therapist_slug: string | null
          therapy_id: string | null
          therapy_name: string | null
          therapy_slug: string | null
        }
        Relationships: []
      }
      public_therapist_profiles_v: {
        Row: {
          accepts_online_sessions: boolean | null
          average_rating: number | null
          badges: string[] | null
          bio: string | null
          city: string | null
          id: string | null
          is_accepting_bookings: boolean | null
          is_verified: boolean | null
          photo_url: string | null
          plan: Database["public"]["Enums"]["therapist_plan"] | null
          public_name: string | null
          published_headline: string | null
          review_count: number | null
          sessions_completed: number | null
          short_intro: string | null
          slug: string | null
          state: string | null
          tags: string[] | null
          updated_at: string | null
          video_provider: string | null
          video_thumbnail_url: string | null
          video_title: string | null
          video_url: string | null
        }
        Relationships: []
      }
      public_therapist_profiles_v_internal: {
        Row: {
          accepts_online_sessions: boolean | null
          average_rating: number | null
          badges: string[] | null
          bio: string | null
          city: string | null
          id: string | null
          is_accepting_bookings: boolean | null
          is_verified: boolean | null
          photo_url: string | null
          plan: Database["public"]["Enums"]["therapist_plan"] | null
          public_name: string | null
          published_headline: string | null
          review_count: number | null
          sessions_completed: number | null
          short_intro: string | null
          slug: string | null
          state: string | null
          tags: string[] | null
          updated_at: string | null
          video_provider: string | null
          video_thumbnail_url: string | null
          video_title: string | null
          video_url: string | null
        }
        Relationships: []
      }
      public_therapist_search: {
        Row: {
          average_rating: number | null
          city: string | null
          completed_session_count: number | null
          duration_minutes: number | null
          has_video: boolean | null
          highlight: string | null
          highlight_tone: string | null
          next_slot_at: string | null
          photo_url: string | null
          public_name: string | null
          review_count: number | null
          review_quote: string | null
          schedule_timezone: string | null
          search_text: string | null
          service_description: string | null
          service_id: string | null
          service_price_cents: number | null
          service_title: string | null
          slug: string | null
          state: string | null
          tags: string[] | null
          theme_names: string[] | null
          theme_slugs: string[] | null
          therapist_bio: string | null
          therapist_headline: string | null
          therapist_profile_id: string | null
          therapy_id: string | null
          therapy_name: string | null
          therapy_slug: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_therapist_search_internal: {
        Row: {
          average_rating: number | null
          city: string | null
          completed_session_count: number | null
          duration_minutes: number | null
          has_video: boolean | null
          highlight: string | null
          highlight_tone: string | null
          next_slot_at: string | null
          photo_url: string | null
          public_name: string | null
          review_count: number | null
          review_quote: string | null
          schedule_timezone: string | null
          search_text: string | null
          service_description: string | null
          service_id: string | null
          service_price_cents: number | null
          service_title: string | null
          slug: string | null
          state: string | null
          tags: string[] | null
          theme_names: string[] | null
          theme_slugs: string[] | null
          therapist_bio: string | null
          therapist_headline: string | null
          therapist_profile_id: string | null
          therapy_id: string | null
          therapy_name: string | null
          therapy_slug: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_therapist_slug_redirects_v: {
        Row: {
          current_slug: string | null
          old_slug: string | null
        }
        Relationships: []
      }
      public_therapist_slug_redirects_v_internal: {
        Row: {
          current_slug: string | null
          old_slug: string | null
        }
        Insert: {
          current_slug?: string | null
          old_slug?: string | null
        }
        Update: {
          current_slug?: string | null
          old_slug?: string | null
        }
        Relationships: []
      }
      public_therapy_details_v: {
        Row: {
          approach_icon_key: string | null
          approach_label: string | null
          benefits: Json | null
          complementary_description: string | null
          description: string | null
          hero_focal_point: string | null
          hero_image_url: string | null
          highlights: Json | null
          id: string | null
          image_url: string | null
          introduction: string | null
          name: string | null
          published_at: string | null
          safety_note: string | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          slug: string | null
          subtitle: string | null
          theme_names: string[] | null
          theme_slugs: string[] | null
          therapist_count: number | null
          updated_at: string | null
          visual_theme_key: string | null
        }
        Relationships: []
      }
      public_therapy_slug_redirects_v: {
        Row: {
          created_at: string | null
          current_slug: string | null
          old_slug: string | null
          therapy_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_slug?: string | null
          old_slug?: string | null
          therapy_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_slug?: string | null
          old_slug?: string | null
          therapy_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapy_slug_redirects_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapist_private_services_v1: {
        Row: {
          archived_at: string | null
          blocking_reason: string | null
          booking_count: number | null
          booking_count_delta_percent: number | null
          bookings_last_30_days: number | null
          created_at: string | null
          currency: string | null
          delivery_format: string | null
          description: string | null
          duration_minutes: number | null
          favorite_count: number | null
          is_available_for_services: boolean | null
          is_bookable: boolean | null
          is_reservable: boolean | null
          online_only: boolean | null
          position: number | null
          price_cents: number | null
          service_id: string | null
          status: Database["public"]["Enums"]["service_status"] | null
          therapist_profile_id: string | null
          therapy_id: string | null
          therapy_image_url: string | null
          therapy_is_public_visible: boolean | null
          therapy_name: string | null
          therapy_slug: string | null
          therapy_status: Database["public"]["Enums"]["therapy_status"] | null
          title: string | null
          updated_at: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_home_therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_matching_therapist_counts"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapy_id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "public_therapy_details_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey"
            columns: ["therapy_id"]
            isOneToOne: false
            referencedRelation: "therapist_service_allowed_catalog_v1"
            referencedColumns: ["therapy_id"]
          },
        ]
      }
      therapist_service_allowed_catalog_v1: {
        Row: {
          is_available_for_services: boolean | null
          is_public_visible: boolean | null
          is_visible_in_matching: boolean | null
          matching_themes: Json | null
          short_description: string | null
          therapy_id: string | null
          therapy_image_url: string | null
          therapy_name: string | null
          therapy_slug: string | null
          therapy_status: Database["public"]["Enums"]["therapy_status"] | null
          updated_at: string | null
        }
        Relationships: []
      }
      therapist_service_metrics_v1: {
        Row: {
          booking_count: number | null
          booking_count_delta_percent: number | null
          bookings_last_30_days: number | null
          favorite_count: number | null
          service_id: string | null
        }
        Relationships: []
      }
      therapist_session_read_model_v1: {
        Row: {
          _therapistProfileId: string | null
          _videoSessionReady: boolean | null
          attendanceSource: string | null
          attendanceStatus: string | null
          bookingId: string | null
          bookingStatus: Database["public"]["Enums"]["booking_status"] | null
          bookingVersion: number | null
          cancellationDecision: string | null
          cancellationRequiresReview: boolean | null
          currency: string | null
          durationMinutes: number | null
          endsAt: string | null
          financialStatus:
            | Database["public"]["Enums"]["session_financial_status"]
            | null
          fulfillmentStatus:
            | Database["public"]["Enums"]["session_service_status"]
            | null
          grossAmountCents: number | null
          modality: string | null
          patientAvatarUrl: string | null
          patientName: string | null
          patientProfileId: string | null
          priceCents: number | null
          proposedEndsAt: string | null
          proposedStartsAt: string | null
          proposedTimezone: string | null
          refundPending: boolean | null
          rescheduleStatus: string | null
          serviceId: string | null
          serviceTitle: string | null
          startsAt: string | null
          therapistAmountCents: number | null
          timezone: string | null
          transferStatus:
            | Database["public"]["Enums"]["session_transfer_status"]
            | null
          videoSessionProvider: string | null
          videoSessionStatus:
            | Database["public"]["Enums"]["video_session_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_patient_profile_id_fkey"
            columns: ["patientProfileId"]
            isOneToOne: false
            referencedRelation: "patient_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["serviceId"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["serviceId"]
            isOneToOne: false
            referencedRelation: "public_therapist_profile_services_v_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["serviceId"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["serviceId"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["serviceId"]
            isOneToOne: false
            referencedRelation: "therapist_private_services_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["serviceId"]
            isOneToOne: false
            referencedRelation: "therapist_service_metrics_v1"
            referencedColumns: ["service_id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["serviceId"]
            isOneToOne: false
            referencedRelation: "therapist_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["_therapistProfileId"]
            isOneToOne: false
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["_therapistProfileId"]
            isOneToOne: false
            referencedRelation: "public_home_therapists_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["_therapistProfileId"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["_therapistProfileId"]
            isOneToOne: false
            referencedRelation: "public_therapist_profiles_v_internal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["_therapistProfileId"]
            isOneToOne: false
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["_therapistProfileId"]
            isOneToOne: false
            referencedRelation: "public_therapist_search_internal"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey"
            columns: ["_therapistProfileId"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_video_session_summary_v: {
        Row: {
          actual_ended_at: string | null
          actual_started_at: string | null
          booking_id: string | null
          environment: string | null
          hard_ends_at: string | null
          id: string | null
          last_synced_at: string | null
          provider: string | null
          scheduled_ends_at: string | null
          scheduled_starts_at: string | null
          status: Database["public"]["Enums"]["video_session_status"] | null
          therapist_first_joined_at: string | null
          therapist_last_joined_at: string | null
          therapist_last_left_at: string | null
          therapist_present: boolean | null
          therapist_token_issued_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "therapist_session_read_model_v1"
            referencedColumns: ["bookingId"]
          },
        ]
      }
    }
    Functions: {
      admin_add_support_ticket_note_v1: {
        Args: { p_body: string; p_request_id: string; p_ticket_id: string }
        Returns: {
          author_profile_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          body: string
          created_at: string
          id: string
          request_id: string
          ticket_id: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "support_ticket_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_assert_responsible_therapy_text_v1: {
        Args: { p_value: string }
        Returns: undefined
      }
      admin_assert_therapy_content_lengths_v1: {
        Args: { p_payload: Json }
        Returns: undefined
      }
      admin_audit_json_object_v1: { Args: { p_value: Json }; Returns: Json }
      admin_decide_therapy_catalog_request_v1: {
        Args: {
          p_actor_user_id: string
          p_catalog_request_id: string
          p_decision: string
          p_related_therapy_id?: string
          p_request_id: string
          p_status: string
        }
        Returns: Json
      }
      admin_decide_therapy_catalog_request_v2: {
        Args: {
          p_actor_user_id: string
          p_catalog_request_id: string
          p_decision: string
          p_related_therapy_id?: string
          p_request_id: string
          p_status: string
        }
        Returns: Json
      }
      admin_execute_operation_command_v1: {
        Args: {
          p_action: string
          p_correlation_id?: string
          p_entity_id: string
          p_payload?: Json
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      admin_execute_operation_command_v1_internal: {
        Args: {
          p_action: string
          p_correlation_id?: string
          p_entity_id: string
          p_payload?: Json
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      admin_execute_operation_command_v2: {
        Args: {
          p_action: string
          p_correlation_id?: string
          p_entity_id: string
          p_payload?: Json
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      admin_execute_operation_command_v2_internal: {
        Args: {
          p_action: string
          p_correlation_id?: string
          p_entity_id: string
          p_payload?: Json
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      admin_execute_professional_lifecycle_command_v1: {
        Args: {
          p_action: string
          p_correlation_id?: string
          p_entity_id: string
          p_payload?: Json
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      admin_filter_jsonb_read_model_rows_v1: {
        Args: {
          p_page: number
          p_page_size: number
          p_rows: Json
          p_search: string
          p_sort: string
          p_status: string
        }
        Returns: Json
      }
      admin_get_actor_profile_v1: {
        Args: { p_actor_user_id: string }
        Returns: {
          anonymized_at: string | null
          auth_deleted_at: string | null
          avatar_url: string | null
          created_at: string
          deletion_source: string | null
          display_name: string | null
          email: string | null
          email_confirmed_at: string | null
          id: string
          phone: string | null
          phone_country_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_get_dashboard_v1: { Args: never; Returns: Json }
      admin_get_finance_detail_v1: {
        Args: { p_id: string; p_module: string }
        Returns: Json
      }
      admin_get_finance_module_v1: {
        Args: { p_limit?: number; p_module: string; p_offset?: number }
        Returns: Json
      }
      admin_get_finance_module_v2: {
        Args: { p_module: string; p_query?: Json }
        Returns: Json
      }
      admin_get_integration_health_v1: { Args: never; Returns: Json }
      admin_get_operation_detail_v1: {
        Args: { p_id: string; p_module: string }
        Returns: Json
      }
      admin_get_operation_detail_v1_internal: {
        Args: { p_id: string; p_module: string }
        Returns: Json
      }
      admin_get_operation_module_v1: {
        Args: { p_limit?: number; p_module: string; p_offset?: number }
        Returns: Json
      }
      admin_get_operation_module_v1_internal: {
        Args: { p_limit?: number; p_module: string; p_offset?: number }
        Returns: Json
      }
      admin_get_operation_module_v2: {
        Args: { p_module: string; p_query?: Json }
        Returns: Json
      }
      admin_get_session_feedback_v1: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      admin_get_session_feedback_v2: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      admin_get_support_inbox_v1: { Args: { p_query?: Json }; Returns: Json }
      admin_get_support_ticket_management_v1: {
        Args: { p_ticket_id: string }
        Returns: Json
      }
      admin_get_support_ticket_thread_v1: {
        Args: { p_ticket_id: string }
        Returns: {
          author_role: Database["public"]["Enums"]["user_role"]
          body: string
          created_at: string
          id: string
          visibility: string
        }[]
      }
      admin_get_support_ticket_thread_v2: {
        Args: { p_ticket_id: string }
        Returns: {
          attachments: Json
          author_role: Database["public"]["Enums"]["user_role"]
          body: string
          created_at: string
          id: string
          visibility: string
        }[]
      }
      admin_get_therapist_profile_review_v1: {
        Args: { p_therapist_profile_id: string }
        Returns: Json
      }
      admin_list_matching_v1: {
        Args: { p_actor_user_id: string }
        Returns: Json
      }
      admin_list_therapy_catalog_v1: {
        Args: { p_actor_user_id: string }
        Returns: Json
      }
      admin_manage_support_ticket_v1: {
        Args: {
          p_action: string
          p_priority?: string
          p_request_id: string
          p_ticket_id: string
        }
        Returns: Json
      }
      admin_permission_for_therapy_catalog_event_v1: {
        Args: { p_event_type: string }
        Returns: string
      }
      admin_replace_therapy_matching_themes_v1: {
        Args: {
          p_actor_user_id: string
          p_reason?: string
          p_request_id: string
          p_theme_ids: string[]
          p_therapy_id: string
        }
        Returns: Json
      }
      admin_reply_support_ticket_v1: {
        Args: { p_body: string; p_request_id: string; p_ticket_id: string }
        Returns: {
          author_profile_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          body: string
          created_at: string
          id: string
          request_id: string
          ticket_id: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "support_ticket_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reply_support_ticket_with_attachments_v1: {
        Args: {
          p_attachments?: Json
          p_body: string
          p_request_id: string
          p_ticket_id: string
        }
        Returns: {
          author_profile_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          body: string
          created_at: string
          id: string
          request_id: string
          ticket_id: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "support_ticket_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_resolve_session_confirmation_incident_v1: {
        Args: {
          p_booking_id: string
          p_decision: string
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      admin_support_ticket_message_exists_v1: {
        Args: { p_request_id: string; p_ticket_id: string }
        Returns: boolean
      }
      admin_therapy_impact_v1: {
        Args: { p_actor_user_id: string; p_therapy_id: string }
        Returns: Json
      }
      admin_transition_matching_entity_v1: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_entity_id: string
          p_entity_type: string
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      admin_transition_therapy_v1: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_payload?: Json
          p_reason?: string
          p_request_id: string
          p_therapy_id: string
        }
        Returns: Json
      }
      admin_upsert_matching_interest_v1: {
        Args: { p_actor_user_id: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      admin_upsert_matching_theme_v1: {
        Args: { p_actor_user_id: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      admin_upsert_therapy_draft_v1: {
        Args: { p_actor_user_id: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      admin_upsert_therapy_draft_with_matching_v1: {
        Args: { p_actor_user_id: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      admin_validate_therapy_publishable_v1: {
        Args: { p_therapy_id: string }
        Returns: undefined
      }
      apply_session_payment_state_v1: {
        Args: {
          p_financial_status: Database["public"]["Enums"]["session_financial_status"]
          p_session_payment_id: string
          p_stripe_charge_id?: string
          p_stripe_checkout_session_id?: string
          p_stripe_event_created_at: string
          p_stripe_event_id: string
          p_stripe_payment_intent_id?: string
        }
        Returns: Json
      }
      apply_stripe_payout_state_v1: {
        Args: {
          p_arrival_at?: string
          p_failure_code?: string
          p_failure_message?: string
          p_payout_batch_therapist_id?: string
          p_provider_status: string
          p_stripe_account_id: string
          p_stripe_event_created_at: string
          p_stripe_event_id: string
          p_stripe_payout_id: string
        }
        Returns: Json
      }
      apply_therapist_subscription_event_v1: {
        Args: {
          p_billing_plan_id?: string
          p_billing_plan_price_id?: string
          p_cancel_at_period_end?: boolean
          p_canceled_at?: string
          p_current_period_end?: string
          p_current_period_start?: string
          p_ended_at?: string
          p_metadata?: Json
          p_plan_code: Database["public"]["Enums"]["therapist_plan"]
          p_status: Database["public"]["Enums"]["billing_subscription_status"]
          p_stripe_checkout_session_id?: string
          p_stripe_customer_id?: string
          p_stripe_event_created_at: string
          p_stripe_event_id: string
          p_stripe_latest_invoice_id?: string
          p_stripe_subscription_id: string
          p_therapist_profile_id: string
        }
        Returns: Json
      }
      apply_zoom_video_session_event_v1:
        | {
            Args: {
              p_after_ends_minutes: number
              p_duration_seconds: number
              p_environment: string
              p_event_at: string
              p_event_type: string
              p_max_duration_minutes: number
              p_provider_session_id: string
              p_provider_user_id: string
              p_provider_user_key: string
              p_session_name: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_after_ends_minutes?: number
              p_duration_seconds?: number
              p_event_at: string
              p_event_type: string
              p_max_duration_minutes?: number
              p_provider_session_id: string
              p_provider_user_id?: string
              p_provider_user_key?: string
              p_session_name: string
            }
            Returns: undefined
          }
      apply_zoom_video_webhook_transition_v1: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_event_key: string
          p_status: Database["public"]["Enums"]["zoom_video_webhook_processing_status"]
        }
        Returns: undefined
      }
      arm_email_outbox_test_fault_v1: {
        Args: {
          p_action_key: string
          p_expires_at: string
          p_recipient_key: string
        }
        Returns: undefined
      }
      attach_support_ticket_requester_attachments_v1: {
        Args: {
          p_attachments?: Json
          p_request_id: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      authorize_therapist_zoom_manual_end_v1: {
        Args: {
          p_booking_id: string
          p_now?: string
          p_therapist_profile_id: string
        }
        Returns: Json
      }
      auto_confirm_sessions: { Args: { p_now?: string }; Returns: number }
      build_video_session_access_state_v1: {
        Args: {
          p_booking_status: Database["public"]["Enums"]["booking_status"]
          p_ends_at: string
          p_financial_status: Database["public"]["Enums"]["session_financial_status"]
          p_now?: string
          p_starts_at: string
          p_video_session_ready: boolean
          p_video_session_status: Database["public"]["Enums"]["video_session_status"]
        }
        Returns: Json
      }
      calculate_session_cancellation_policy: {
        Args: { p_booking_id: string; p_now?: string; p_reason?: string }
        Returns: {
          booking_id: string
          decision: string
          platform_retained_cents: number
          policy_version_id: string
          refund_amount_cents: number
          requires_manual_review: boolean
          retained_amount_cents: number
          review_due_at: string
          session_payment_id: string
          therapist_retained_cents: number
        }[]
      }
      calculate_session_payment_snapshot: {
        Args: {
          p_gross_amount_cents: number
          p_platform_commission_bps?: number
        }
        Returns: {
          gross_amount_cents: number
          platform_commission_bps: number
          platform_gross_commission_cents: number
          therapist_amount_cents: number
        }[]
      }
      cancel_booking_hold_v1: {
        Args: { p_hold_id: string; p_request_id: string }
        Returns: {
          buffer_after_minutes_snapshot: number
          buffer_before_minutes_snapshot: number
          cancelled_at: string | null
          consume_idempotency_key: string | null
          consumed_at: string | null
          consumed_booking_id: string | null
          created_at: string
          currency_snapshot: string
          ends_at: string
          expires_at: string
          id: string
          idempotency_key: string
          occupied_during: unknown
          patient_profile_id: string
          service_duration_minutes_snapshot: number
          service_id: string
          service_price_cents_snapshot: number
          service_title_snapshot: string
          snapshot_captured_at: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_hold_status"]
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "booking_holds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_booking_reminder_jobs_v1: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: number
      }
      cancel_reservation_checkout_attempt_v1: {
        Args: {
          p_booking_id: string
          p_reason: string
          p_stripe_checkout_session_id: string
        }
        Returns: Json
      }
      cancel_therapist_block_v1: {
        Args: {
          p_actor_user_id: string
          p_block_id: string
          p_expected_schedule_version: number
          p_request_id: string
          p_scope: string
        }
        Returns: Json
      }
      cancel_unstarted_initial_checkout_v1: {
        Args: { p_booking_id: string; p_hold_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_video_session_for_booking_v1: {
        Args: { p_booking_id: string; p_source?: string }
        Returns: string
      }
      check_therapist_public_slug_availability_v1: {
        Args: { p_actor_user_id: string; p_slug: string }
        Returns: Json
      }
      claim_auth_action_token: {
        Args: {
          p_claim_id: string
          p_claim_lease_seconds?: number
          p_purpose: Database["public"]["Enums"]["auth_action_purpose"]
          p_token_hash: string
        }
        Returns: {
          expires_at: string
          id: string
          recipient_email: string
          recipient_role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
      claim_email_outbox_v1: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: {
          action_key: string
          attempts: number
          created_at: string
          domain_event_id: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          next_attempt_at: string | null
          payload: Json
          processed_at: string | null
          recipient_key: string
          recipient_user_id: string
          related_entity_id: string
          related_entity_type: string
          review_reason: string | null
          review_required: boolean
          sender_profile_id: string | null
          status: Database["public"]["Enums"]["email_outbox_status"]
          template_overrides: Json
          template_version: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_payout_groups_v1: {
        Args: {
          p_environment?: string
          p_lease_minutes?: number
          p_limit?: number
          p_payout_batch_id: string
          p_worker_id: string
        }
        Returns: {
          amount_cents: number
          attempt_count: number
          connect_account_id: string
          idempotency_key: string
          payout_batch_therapist_id: string
          payout_id: string
          request_fingerprint: string
          stripe_account_id: string
          therapist_profile_id: string
        }[]
      }
      claim_payout_transfer_items_v1: {
        Args: {
          p_environment?: string
          p_lease_minutes?: number
          p_limit?: number
          p_payout_batch_id: string
          p_worker_id: string
        }
        Returns: {
          amount_cents: number
          attempt_count: number
          booking_id: string
          connect_account_id: string
          idempotency_key: string
          payout_batch_item_id: string
          request_fingerprint: string
          session_payment_id: string
          stripe_account_id: string
          stripe_charge_id: string
          therapist_profile_id: string
          transfer_id: string
        }[]
      }
      claim_session_cancellation_decision_v1: {
        Args: {
          p_booking_id: string
          p_decision: string
          p_metadata?: Json
          p_platform_retained_cents: number
          p_policy_version_id: string
          p_reason: string
          p_refund_amount_cents: number
          p_request_id: string
          p_requested_by_profile_id: string
          p_requested_by_role: string
          p_requires_manual_review: boolean
          p_retained_amount_cents: number
          p_review_due_at: string
          p_session_payment_id: string
          p_therapist_retained_cents: number
        }
        Returns: {
          booking_id: string
          created_new: boolean
          decision: string
          id: string
          platform_retained_cents: number
          policy_version_id: string
          reason: string
          refund_amount_cents: number
          request_id: string
          requested_by_profile_id: string
          requested_by_role: string
          requires_manual_review: boolean
          retained_amount_cents: number
          review_due_at: string
          session_payment_id: string
          therapist_retained_cents: number
        }[]
      }
      claim_session_payment_authorization_v1: {
        Args: {
          p_event_created_at: string
          p_request_id: string
          p_session_payment_id: string
          p_stripe_checkout_session_id: string
          p_stripe_payment_intent_id: string
        }
        Returns: Json
      }
      claim_weekly_payout_scheduler_run_v1: {
        Args: { p_lease_minutes?: number; p_now: string; p_worker_id: string }
        Returns: Json
      }
      complete_email_outbox_v1: {
        Args: {
          p_last_error?: string
          p_outbox_id: string
          p_outcome: Database["public"]["Enums"]["email_outbox_status"]
          p_review_reason?: string
          p_review_required?: boolean
          p_worker_id: string
        }
        Returns: {
          action_key: string
          attempts: number
          created_at: string
          domain_event_id: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          next_attempt_at: string | null
          payload: Json
          processed_at: string | null
          recipient_key: string
          recipient_user_id: string
          related_entity_id: string
          related_entity_type: string
          review_reason: string | null
          review_required: boolean
          sender_profile_id: string | null
          status: Database["public"]["Enums"]["email_outbox_status"]
          template_overrides: Json
          template_version: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "email_outbox"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_payout_transfer_v1: {
        Args: {
          p_stripe_transfer_id: string
          p_transfer_id: string
          p_transferred_at?: string
          p_worker_id: string
        }
        Returns: boolean
      }
      complete_payout_transfer_v2: {
        Args: {
          p_connected_balance_available_on?: string
          p_stripe_connected_balance_transaction_id?: string
          p_stripe_destination_payment_id: string
          p_stripe_transfer_id: string
          p_transfer_id: string
          p_transferred_at?: string
          p_worker_id: string
        }
        Returns: boolean
      }
      complete_stripe_payout_creation_v1: {
        Args: {
          p_arrival_at?: string
          p_payout_id: string
          p_provider_status: string
          p_source_type?: string
          p_stripe_payout_id: string
          p_worker_id: string
        }
        Returns: boolean
      }
      complete_video_session_control_job_v1: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_job_id: string
          p_retry_after_seconds?: number
          p_success: boolean
        }
        Returns: undefined
      }
      confirm_session_service: {
        Args: {
          p_booking_id: string
          p_confirmed_by_profile_id?: string
          p_metadata?: Json
          p_review_id?: string
          p_source: Database["public"]["Enums"]["session_confirmation_source"]
        }
        Returns: string
      }
      consume_auth_action_token: {
        Args: { p_claim_id: string; p_token_id: string }
        Returns: boolean
      }
      consume_booking_hold_v1: {
        Args: { p_hold_id: string; p_idempotency_key: string }
        Returns: {
          buffer_after_minutes_snapshot: number
          buffer_before_minutes_snapshot: number
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          currency_snapshot: string
          ends_at: string
          id: string
          last_transition_at: string | null
          legal_acceptance_recorded_at: string | null
          legal_cancellation_policy_version_id: string | null
          legal_privacy_version_id: string | null
          legal_terms_version_id: string | null
          meeting_provider: string | null
          meeting_url: string | null
          occupied_during: unknown
          patient_profile_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          service_duration_minutes_snapshot: number
          service_id: string
          service_price_cents_snapshot: number
          service_title_snapshot: string
          snapshot_captured_at: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_email_outbox_test_fault_v1: {
        Args: { p_action_key: string; p_recipient_key: string }
        Returns: boolean
      }
      create_support_ticket_v1: {
        Args: {
          p_booking_id?: string
          p_category: string
          p_description: string
          p_request_id: string
          p_source?: string
          p_subject: string
        }
        Returns: {
          assigned_admin_id: string | null
          booking_id: string | null
          category: string
          correlation_id: string | null
          created_at: string
          description: string | null
          diagnostic_context: Json
          id: string
          last_activity_at: string
          priority: string
          protocol: string
          request_id: string | null
          requester_profile_id: string | null
          resolution_summary: string | null
          resolved_at: string | null
          reviewed_at: string | null
          source: string
          status: string
          subject: string
          updated_at: string
          urgency: string
        }
        SetofOptions: {
          from: "*"
          to: "support_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_support_ticket_with_attachments_v1: {
        Args: {
          p_attachments?: Json
          p_booking_id?: string
          p_category: string
          p_description: string
          p_request_id: string
          p_source?: string
          p_subject: string
          p_ticket_id: string
        }
        Returns: {
          assigned_admin_id: string | null
          booking_id: string | null
          category: string
          correlation_id: string | null
          created_at: string
          description: string | null
          diagnostic_context: Json
          id: string
          last_activity_at: string
          priority: string
          protocol: string
          request_id: string | null
          requester_profile_id: string | null
          resolution_summary: string | null
          resolved_at: string | null
          reviewed_at: string | null
          source: string
          status: string
          subject: string
          updated_at: string
          urgency: string
        }
        SetofOptions: {
          from: "*"
          to: "support_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_therapist_block_v1: {
        Args: {
          p_actor_user_id: string
          p_all_day: boolean
          p_end_time: string
          p_reason: string
          p_reason_code: string
          p_recurrence_ends_on: string
          p_recurrence_frequency: string
          p_request_id: string
          p_service_id: string
          p_start_time: string
          p_starts_on: string
          p_timezone: string
        }
        Returns: Json
      }
      create_therapist_block_v2: {
        Args: {
          p_actor_user_id: string
          p_all_day: boolean
          p_end_time: string
          p_reason: string
          p_reason_code: string
          p_recurrence_ends_on: string
          p_recurrence_frequency: string
          p_request_id: string
          p_service_id: string
          p_start_time: string
          p_starts_on: string
          p_timezone: string
        }
        Returns: Json
      }
      create_therapist_service_v1: {
        Args: { p_actor_user_id: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      create_therapist_service_with_matching_v1: {
        Args: { p_actor_user_id: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      create_weekly_payout_batch: {
        Args: {
          p_created_by?: string
          p_cutoff_at?: string
          p_reference_period_end: string
          p_reference_period_start: string
        }
        Returns: string
      }
      create_zoom_video_session_key_v1: {
        Args: { p_booking_id: string; p_environment: string }
        Returns: string
      }
      create_zoom_video_session_name_v1: {
        Args: { p_booking_id: string; p_environment: string }
        Returns: string
      }
      dashboard_kpi_json: {
        Args: { current_value: number; previous_value: number }
        Returns: Json
      }
      defer_stripe_payout_v1: {
        Args: {
          p_disposition: string
          p_error_code: string
          p_error_message: string
          p_payout_id: string
          p_retry_after?: string
          p_worker_id: string
        }
        Returns: string
      }
      discard_therapist_profile_draft_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_request_id: string
        }
        Returns: Json
      }
      dismiss_therapist_aura_recommendation_v1: {
        Args: { p_recommendation_id: string; p_request_id: string }
        Returns: Json
      }
      dismiss_therapist_aura_signal_v1: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_recommendation_key: string
          p_request_id: string
          p_rule_key: string
          p_rule_version: number
        }
        Returns: Json
      }
      dismiss_therapist_aura_signal_v2: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_recommendation_key: string
          p_request_id: string
        }
        Returns: Json
      }
      dispatch_email_outbox_recovery_v1: { Args: never; Returns: undefined }
      enqueue_due_video_session_control_jobs_v1: {
        Args: {
          p_environment: string
          p_limit?: number
          p_therapist_absence_grace_seconds?: number
        }
        Returns: number
      }
      enqueue_transactional_email_v1: {
        Args: {
          p_action_key: string
          p_domain_event_id: string
          p_payload?: Json
          p_recipient_key: string
          p_recipient_user_id: string
          p_related_entity_id: string
          p_related_entity_type: string
        }
        Returns: string
      }
      enqueue_video_session_control_job_v1: {
        Args: {
          p_idempotency_key: string
          p_metadata?: Json
          p_next_run_at?: string
          p_operation: Database["public"]["Enums"]["video_session_control_operation"]
          p_video_session_id: string
        }
        Returns: string
      }
      ensure_no_duplicate_therapist_service_v1: {
        Args: {
          p_excluding_service_id?: string
          p_therapist_profile_id: string
          p_therapy_id: string
        }
        Returns: undefined
      }
      ensure_service_matching_rules_v1: {
        Args: { p_service_id: string }
        Returns: undefined
      }
      ensure_therapist_service_limit_v1: {
        Args: {
          p_excluding_service_id?: string
          p_plan: Database["public"]["Enums"]["therapist_plan"]
          p_therapist_profile_id: string
        }
        Returns: undefined
      }
      ensure_therapy_has_matching_theme_for_publish_v1: {
        Args: { p_therapy_id: string }
        Returns: undefined
      }
      ensure_video_session_for_paid_booking_v1: {
        Args: { p_booking_id: string; p_environment: string; p_source?: string }
        Returns: string
      }
      expire_booking_holds_v1: {
        Args: { p_now?: string; p_therapist_profile_id?: string }
        Returns: number
      }
      expire_booking_reschedule_requests_v1: {
        Args: { p_now?: string }
        Returns: number
      }
      expire_due_initial_checkout_attempts_v1: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          checkout_session_id: string
          session_payment_id: string
        }[]
      }
      expire_due_initial_checkout_orphans_v1: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          booking_id: string
        }[]
      }
      fail_payout_transfer_v1: {
        Args: {
          p_disposition: string
          p_error_code: string
          p_error_message: string
          p_transfer_id: string
          p_worker_id: string
        }
        Returns: string
      }
      finalize_bilateral_session_confirmation_v1: {
        Args: { p_booking_id: string; p_now?: string }
        Returns: string
      }
      finalize_payout_scheduler_run_v1: {
        Args: { p_scheduler_run_id: string }
        Returns: Json
      }
      generate_therapist_free_public_slug_v1: { Args: never; Returns: string }
      get_admin_payout_operations_v1: {
        Args: { p_limit?: number }
        Returns: Json
      }
      get_my_patient_schedule_blocking_intervals_v1: {
        Args: { p_range_end: string; p_range_start: string }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      get_patient_reservation_attempt_status_v1: {
        Args: { p_booking_id: string; p_stripe_checkout_session_id?: string }
        Returns: Json
      }
      get_patient_reservation_retry_context_v1: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      get_patient_schedule_blocking_bookings_v1: {
        Args: {
          p_exclude_booking_id: string
          p_patient_profile_id: string
          p_range_end: string
          p_range_start: string
        }
        Returns: {
          booking_id: string
          ends_at: string
          starts_at: string
        }[]
      }
      get_patient_session_feedback_queue_v1: { Args: never; Returns: Json }
      get_patient_therapist_review_v1: {
        Args: { p_therapist_profile_id: string }
        Returns: Json
      }
      get_private_therapist_advanced_financial_dashboard_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_private_therapist_agenda_revenue_potential_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_private_therapist_bank_payouts_v1: {
        Args: { p_limit?: number }
        Returns: Json
      }
      get_private_therapist_connect_account_v1: { Args: never; Returns: Json }
      get_private_therapist_financial_actor_v1: {
        Args: never
        Returns: {
          accepts_online_sessions: boolean
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          free_public_slug: string
          headline: string | null
          id: string
          is_accepting_bookings: boolean
          is_public: boolean
          languages: string[]
          last_published_at: string | null
          legal_name: string | null
          metadata: Json
          photo_url: string | null
          plan: Database["public"]["Enums"]["therapist_plan"]
          profile_version: number
          public_name: string
          public_profile_theme: string
          public_status: string
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["therapist_status"]
          unpublished_at: string | null
          updated_at: string
          user_id: string
          visibility_flags: Json
        }
        SetofOptions: {
          from: "*"
          to: "therapist_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_private_therapist_financial_benchmark_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_private_therapist_financial_forecast_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_private_therapist_financial_metrics_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_private_therapist_financial_opportunities_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_private_therapist_financial_overview_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_private_therapist_payouts_v1: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_period_end?: string
          p_period_start?: string
          p_status?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_private_therapist_profile_editor_v1: {
        Args: { p_actor_user_id: string }
        Returns: Json
      }
      get_private_therapist_receipts_v1: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_period_end?: string
          p_period_start?: string
          p_search?: string
          p_status?: string
          p_therapy_id?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_private_therapist_retention_analytics_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_public_therapist_next_slot_v1: {
        Args: { p_therapist_profile_id: string }
        Returns: string
      }
      get_public_therapy_theme_names_v1: {
        Args: { p_therapy_id: string }
        Returns: string[]
      }
      get_public_therapy_therapists_v1: {
        Args: {
          p_interest_ids?: string[]
          p_limit?: number
          p_theme_ids?: string[]
          p_therapy_slug: string
        }
        Returns: Json
      }
      get_service_available_day_slots_v1: {
        Args: { p_day: string; p_service_id: string }
        Returns: Json
      }
      get_service_available_days_v1: {
        Args: { p_month?: string; p_service_id: string }
        Returns: Json
      }
      get_service_available_slots_v1: {
        Args: {
          p_limit?: number
          p_range_end?: string
          p_range_start?: string
          p_service_id: string
        }
        Returns: Json
      }
      get_service_available_slots_v1_internal: {
        Args: {
          p_limit?: number
          p_range_end?: string
          p_range_start?: string
          p_service_id: string
        }
        Returns: Json
      }
      get_session_feedback_v1: { Args: { p_booking_id: string }; Returns: Json }
      get_session_feedback_v2: { Args: { p_booking_id: string }; Returns: Json }
      get_therapist_agenda_v1: {
        Args: { p_range_end?: string; p_range_start?: string }
        Returns: Json
      }
      get_therapist_aura_signals_v1: {
        Args: { p_period_days?: number }
        Returns: Json
      }
      get_therapist_aura_signals_v2: {
        Args: { p_period_days?: number }
        Returns: Json
      }
      get_therapist_blocks_v1: {
        Args: {
          p_cursor_id?: string
          p_cursor_starts_at?: string
          p_limit?: number
          p_range_end?: string
          p_range_start?: string
          p_reason_code?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_therapist_calendar_v1: {
        Args: { p_anchor_date?: string; p_view?: string }
        Returns: Json
      }
      get_therapist_dashboard_v1: { Args: never; Returns: Json }
      get_therapist_for_service_actor_v1: {
        Args: { p_actor_user_id: string }
        Returns: {
          accepts_online_sessions: boolean
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          free_public_slug: string
          headline: string | null
          id: string
          is_accepting_bookings: boolean
          is_public: boolean
          languages: string[]
          last_published_at: string | null
          legal_name: string | null
          metadata: Json
          photo_url: string | null
          plan: Database["public"]["Enums"]["therapist_plan"]
          profile_version: number
          public_name: string
          public_profile_theme: string
          public_status: string
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["therapist_status"]
          unpublished_at: string | null
          updated_at: string
          user_id: string
          visibility_flags: Json
        }
        SetofOptions: {
          from: "*"
          to: "therapist_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_therapist_interest_metrics_v1: {
        Args: { p_period_days?: number }
        Returns: Json
      }
      get_therapist_metrics_dashboard_v2: {
        Args: { p_period_days?: number }
        Returns: Json
      }
      get_therapist_metrics_foundation_v1: { Args: never; Returns: Json }
      get_therapist_metrics_overview_v1: {
        Args: { p_period_days?: number }
        Returns: Json
      }
      get_therapist_occupancy_metrics_v2: {
        Args: {
          p_period_days: number
          p_therapist_profile_id: string
          p_timezone: string
        }
        Returns: Json
      }
      get_therapist_private_identity_v1: { Args: never; Returns: Json }
      get_therapist_profile_actor_m1: {
        Args: { p_actor_user_id: string }
        Returns: {
          accepts_online_sessions: boolean
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          free_public_slug: string
          headline: string | null
          id: string
          is_accepting_bookings: boolean
          is_public: boolean
          languages: string[]
          last_published_at: string | null
          legal_name: string | null
          metadata: Json
          photo_url: string | null
          plan: Database["public"]["Enums"]["therapist_plan"]
          profile_version: number
          public_name: string
          public_profile_theme: string
          public_status: string
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["therapist_status"]
          unpublished_at: string | null
          updated_at: string
          user_id: string
          visibility_flags: Json
        }
        SetofOptions: {
          from: "*"
          to: "therapist_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_therapist_publication_eligibility_v1: {
        Args: { p_therapist_profile_id: string }
        Returns: Json
      }
      get_therapist_reviews_v1: { Args: never; Returns: Json }
      get_therapist_schedule_v1: { Args: never; Returns: Json }
      get_therapist_service_request_replay_v1: {
        Args: {
          p_operation: string
          p_payload_hash: string
          p_request_id: string
          p_therapist_profile_id: string
        }
        Returns: Json
      }
      get_therapist_session_detail_v1: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      get_therapist_session_evolution_comparison_v1: {
        Args: { p_period_days?: number }
        Returns: Json
      }
      get_therapist_session_metrics_v1: {
        Args: { p_period_days?: number }
        Returns: Json
      }
      get_therapist_sessions_v1: {
        Args: {
          p_booking_status?: Database["public"]["Enums"]["booking_status"]
          p_cursor_booking_id?: string
          p_cursor_starts_at?: string
          p_financial_status?: Database["public"]["Enums"]["session_financial_status"]
          p_limit?: number
          p_modality?: string
          p_patient_profile_id?: string
          p_period_end?: string
          p_period_start?: string
          p_service_id?: string
        }
        Returns: Json
      }
      get_therapist_shell_counters_v1: { Args: never; Returns: Json }
      increment_therapist_metric_daily_v1: {
        Args: {
          p_event_type: string
          p_fresh_through: string
          p_metric_date: string
          p_therapist_profile_id: string
        }
        Returns: undefined
      }
      is_booking_participant_profile_v1: {
        Args: { p_booking_id: string; p_profile_id: string }
        Returns: boolean
      }
      is_booking_status_transition_allowed_v1: {
        Args: {
          p_current: Database["public"]["Enums"]["booking_status"]
          p_next: Database["public"]["Enums"]["booking_status"]
        }
        Returns: boolean
      }
      is_current_admin: { Args: never; Returns: boolean }
      is_current_patient_profile: {
        Args: { candidate_id: string }
        Returns: boolean
      }
      is_current_therapist_profile: {
        Args: { candidate_id: string }
        Returns: boolean
      }
      is_public_service_booking_eligible_v1: {
        Args: { p_service_id: string }
        Returns: boolean
      }
      is_related_patient_to_current_therapist: {
        Args: { candidate_id: string }
        Returns: boolean
      }
      is_reserved_therapist_public_slug_v1: {
        Args: { p_slug: string }
        Returns: boolean
      }
      is_service_schedule_slot_v1: {
        Args: {
          p_ends_at: string
          p_reference_at?: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: boolean
      }
      is_therapist_publication_eligible_v1: {
        Args: { p_therapist_profile_id: string }
        Returns: boolean
      }
      is_therapist_video_session_eligible_v1: {
        Args: { p_therapist_profile_id: string }
        Returns: boolean
      }
      is_valid_timezone_v1: { Args: { p_timezone: string }; Returns: boolean }
      list_private_therapist_services_v1: {
        Args: { p_actor_user_id: string }
        Returns: Json
      }
      list_recoverable_session_captures_v1: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          session_payment_id: string
          slot_claimed_at: string
          stripe_payment_intent_id: string
        }[]
      }
      list_service_schedule_candidates_v1: {
        Args: {
          p_limit?: number
          p_range_end: string
          p_range_start: string
          p_reference_at?: string
          p_service_id: string
        }
        Returns: {
          ends_at: string
          occupied_during: unknown
          starts_at: string
          timezone: string
        }[]
      }
      list_therapist_service_catalog_v1: {
        Args: { p_actor_user_id: string }
        Returns: Json
      }
      mark_payout_window_incomplete_v1: {
        Args: { p_now: string; p_run_id: string }
        Returns: boolean
      }
      mark_structured_participant_messages_read_v1: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      mark_video_session_termination_confirmed_v1: {
        Args: { p_reason?: string; p_video_session_id: string }
        Returns: undefined
      }
      mark_video_session_termination_requested_v1: {
        Args: { p_reason: string; p_video_session_id: string }
        Returns: undefined
      }
      next_weekly_payout_cutoff_v1: {
        Args: { p_eligible_at: string; p_now?: string }
        Returns: string
      }
      normalize_private_therapist_finance_period_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_timezone?: string
        }
        Returns: {
          ends_at: string
          period_end: string
          period_start: string
          starts_at: string
          timezone: string
        }[]
      }
      normalize_therapist_public_slug_v1: {
        Args: { p_slug: string }
        Returns: string
      }
      patient_has_schedule_conflict_v1: {
        Args: {
          p_ends_at: string
          p_exclude_booking_id: string
          p_patient_profile_id: string
          p_starts_at: string
        }
        Returns: boolean
      }
      patient_review_payload_v1: {
        Args: { p_review: Database["public"]["Tables"]["reviews"]["Row"] }
        Returns: Json
      }
      preflight_session_payment_retry_v1: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      preview_structured_participant_message_v2: {
        Args: {
          p_booking_id?: string
          p_conversation_id: string
          p_parameters?: Json
          p_template_key: string
        }
        Returns: Json
      }
      private_therapist_agenda_capacity_v1: {
        Args: {
          p_range_end: string
          p_range_start: string
          p_therapist_profile_id: string
          p_timezone: string
        }
        Returns: {
          available_minutes: number
          committed_minutes: number
          exception_minutes: number
          scheduled_minutes: number
        }[]
      }
      private_therapist_finance_advanced_comparison_v1: {
        Args: { p_current: number; p_previous: number }
        Returns: Json
      }
      private_therapist_finance_advanced_dashboard_payload_v1: {
        Args: {
          p_period_end?: string
          p_period_start?: string
          p_plan: Database["public"]["Enums"]["therapist_plan"]
          p_therapist_profile_id: string
          p_timezone?: string
        }
        Returns: Json
      }
      private_therapist_finance_metric_comparison_v1: {
        Args: {
          p_current_has_data: boolean
          p_current_value: number
          p_previous_has_data: boolean
          p_previous_value: number
        }
        Returns: Json
      }
      private_therapist_finance_net_cents_v1: {
        Args: {
          p_payment: Database["public"]["Tables"]["session_payments"]["Row"]
        }
        Returns: number
      }
      private_therapist_finance_refunded_cents_v1: {
        Args: { p_session_payment_id: string }
        Returns: number
      }
      public_therapist_slug_redirect_rows_v1: {
        Args: never
        Returns: {
          current_slug: string
          old_slug: string
        }[]
      }
      publish_therapist_profile_draft_content_base_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_request_id: string
        }
        Returns: Json
      }
      publish_therapist_profile_draft_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_request_id: string
        }
        Returns: Json
      }
      purge_temporary_data_v1: { Args: { p_now?: string }; Returns: Json }
      queue_therapist_profile_review_v1: {
        Args: { p_therapist_profile_id: string }
        Returns: undefined
      }
      recheck_connect_blocked_payments_v1: {
        Args: { p_now?: string; p_therapist_profile_id: string }
        Returns: number
      }
      reconcile_automatic_stripe_payout_v1: {
        Args: {
          p_balance_transactions: Json
          p_observed_at?: string
          p_stripe_account_id: string
          p_stripe_payout_id: string
        }
        Returns: Json
      }
      reconcile_payout_transfer_v1: {
        Args: {
          p_observed_at?: string
          p_reversed?: boolean
          p_stripe_transfer_id: string
          p_transfer_id: string
        }
        Returns: string
      }
      reconcile_payout_transfer_v2: {
        Args: {
          p_connected_balance_available_on?: string
          p_observed_at?: string
          p_reversed?: boolean
          p_stripe_connected_balance_transaction_id?: string
          p_stripe_destination_payment_id: string
          p_stripe_transfer_id: string
          p_transfer_id: string
        }
        Returns: string
      }
      reconcile_session_payment_amount_v1: {
        Args: {
          p_charged_amount_cents: number
          p_discount_amount_cents?: number
          p_metadata?: Json
          p_original_amount_cents?: number
          p_session_payment_id: string
          p_stripe_checkout_session_id?: string
        }
        Returns: Json
      }
      record_admin_audit_event_v1: {
        Args: {
          p_action: string
          p_actor_role: string
          p_actor_user_id: string
          p_correlation_id: string
          p_entity_id: string
          p_entity_type: string
          p_next_state: Json
          p_permission: string
          p_previous_state: Json
          p_reason: string
          p_request_id: string
          p_source: string
        }
        Returns: string
      }
      record_automatic_stripe_payout_v1: {
        Args: {
          p_amount_cents: number
          p_arrival_at?: string
          p_currency: string
          p_failure_code?: string
          p_failure_message?: string
          p_payout_balance_transaction_id?: string
          p_provider_reconciliation_status: string
          p_provider_status: string
          p_source_type?: string
          p_stripe_account_id: string
          p_stripe_event_created_at: string
          p_stripe_event_id: string
          p_stripe_payout_id: string
        }
        Returns: Json
      }
      record_patient_zoom_waiting_room_arrival_v1: {
        Args: {
          p_booking_id: string
          p_now?: string
          p_patient_profile_id: string
        }
        Returns: Json
      }
      record_payout_operational_incident_v1: {
        Args: {
          p_error_code?: string
          p_error_message?: string
          p_incident_key: string
          p_incident_type: string
          p_metadata?: Json
          p_payout_batch_id?: string
          p_payout_batch_item_id?: string
          p_payout_scheduler_run_id?: string
          p_severity?: string
          p_stripe_payout_id?: string
          p_stripe_transfer_id?: string
          p_therapist_profile_id?: string
        }
        Returns: string
      }
      record_public_therapist_metric_events_v1: {
        Args: { p_events: Json; p_session_id: string }
        Returns: Json
      }
      record_session_participant_confirmation_v1: {
        Args: {
          p_actor_user_id: string
          p_booking_id: string
          p_confirmed_at?: string
          p_outcome: string
          p_request_id: string
          p_source?: string
        }
        Returns: Json
      }
      record_session_payment_stripe_reconciliation_v1: {
        Args: {
          p_payment_method_type?: string
          p_payment_origin?: string
          p_receipt_url?: string
          p_session_payment_id: string
          p_stripe_balance_transaction_id?: string
          p_stripe_charge_id?: string
          p_stripe_event_created_at: string
          p_stripe_event_id: string
          p_stripe_fee_amount_cents?: number
          p_stripe_net_amount_cents?: number
        }
        Returns: Json
      }
      refresh_automatic_payout_batch_states_v1: { Args: never; Returns: number }
      refresh_session_transfer_eligibility: {
        Args: { p_now?: string; p_session_payment_id: string }
        Returns: Database["public"]["Enums"]["session_transfer_status"]
      }
      register_legal_acceptance_v1: {
        Args: {
          p_actor_role: string
          p_booking_id?: string
          p_context: string
          p_document_key: string
          p_evidence?: Json
          p_profile_id: string
          p_request_id: string
        }
        Returns: {
          accepted_at: string
          actor_role: string
          booking_id: string | null
          content_hash: string
          context: string
          document_key: string
          document_version: string
          document_version_id: string
          evidence: Json
          id: string
          profile_id: string
          request_id: string
          revoked_at: string | null
          superseded_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "legal_acceptances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_auth_action_token_claim: {
        Args: { p_claim_id: string; p_token_id: string }
        Returns: boolean
      }
      release_expired_payout_leases_v1: {
        Args: { p_limit?: number }
        Returns: Json
      }
      reorder_therapist_services_v1: {
        Args: {
          p_actor_user_id: string
          p_request_id: string
          p_service_ids: string[]
        }
        Returns: Json
      }
      replace_therapist_service_matching_v1: {
        Args: {
          p_actor_user_id: string
          p_interest_ids: string[]
          p_request_id?: string
          p_service_id: string
          p_theme_ids: string[]
        }
        Returns: undefined
      }
      request_booking_reschedule_v1: {
        Args: {
          p_booking_id: string
          p_expected_booking_version?: number
          p_expires_in_seconds?: number
          p_proposed_ends_at: string
          p_proposed_starts_at: string
          p_proposed_timezone: string
          p_reason: string
          p_request_id: string
          p_requested_by_profile_id: string
        }
        Returns: {
          applied_at: string | null
          booking_id: string
          booking_version_at_request: number
          created_at: string
          expires_at: string
          id: string
          original_ends_at: string
          original_starts_at: string
          original_timezone: string
          proposed_ends_at: string
          proposed_starts_at: string
          proposed_timezone: string
          reason: string | null
          request_id: string | null
          requested_by_profile_id: string | null
          resolution_request_id: string | null
          resolved_at: string | null
          resolved_by_profile_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "booking_reschedule_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_booking_hold_v1: {
        Args: {
          p_ends_at: string
          p_idempotency_key: string
          p_patient_profile_id: string
          p_service_id: string
          p_starts_at: string
          p_timezone: string
          p_ttl_seconds?: number
        }
        Returns: {
          buffer_after_minutes_snapshot: number
          buffer_before_minutes_snapshot: number
          cancelled_at: string | null
          consume_idempotency_key: string | null
          consumed_at: string | null
          consumed_booking_id: string | null
          created_at: string
          currency_snapshot: string
          ends_at: string
          expires_at: string
          id: string
          idempotency_key: string
          occupied_during: unknown
          patient_profile_id: string
          service_duration_minutes_snapshot: number
          service_id: string
          service_price_cents_snapshot: number
          service_title_snapshot: string
          snapshot_captured_at: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_hold_status"]
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "booking_holds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_booking_hold_v1_internal: {
        Args: {
          p_ends_at: string
          p_idempotency_key: string
          p_patient_profile_id: string
          p_service_id: string
          p_starts_at: string
          p_timezone: string
          p_ttl_seconds?: number
        }
        Returns: {
          buffer_after_minutes_snapshot: number
          buffer_before_minutes_snapshot: number
          cancelled_at: string | null
          consume_idempotency_key: string | null
          consumed_at: string | null
          consumed_booking_id: string | null
          created_at: string
          currency_snapshot: string
          ends_at: string
          expires_at: string
          id: string
          idempotency_key: string
          occupied_during: unknown
          patient_profile_id: string
          service_duration_minutes_snapshot: number
          service_id: string
          service_price_cents_snapshot: number
          service_title_snapshot: string
          snapshot_captured_at: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_hold_status"]
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "booking_holds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_stripe_webhook_event_v1: {
        Args: {
          p_account_id: string
          p_api_version: string
          p_event_created_at: string
          p_event_type: string
          p_livemode: boolean
          p_object_id: string
          p_payload_sha256: string
          p_source: string
          p_stripe_event_id: string
        }
        Returns: {
          acquired: boolean
          processing_status: Database["public"]["Enums"]["stripe_webhook_processing_status"]
        }[]
      }
      reserve_video_session_control_jobs_v1: {
        Args: {
          p_environment: string
          p_limit?: number
          p_lock_seconds?: number
        }
        Returns: {
          attempts: number
          booking_id: string
          id: string
          max_attempts: number
          operation: Database["public"]["Enums"]["video_session_control_operation"]
          provider_session_id: string
          video_session_id: string
        }[]
      }
      reserve_zoom_video_access_issue_v1: {
        Args: {
          p_actor_role: string
          p_booking_id: string
          p_environment: string
          p_max_issued?: number
          p_profile_id: string
          p_window_seconds?: number
        }
        Returns: Json
      }
      reserve_zoom_video_webhook_event_v1: {
        Args: {
          p_account_identifier: string
          p_event_key: string
          p_event_ts: string
          p_event_type: string
          p_payload_sanitized?: Json
          p_payload_sha256: string
          p_provider_session_id: string
          p_provider_user_id: string
          p_provider_user_key: string
          p_request_id: string
          p_session_name_hash: string
        }
        Returns: {
          acquired: boolean
          processing_status: Database["public"]["Enums"]["zoom_video_webhook_processing_status"]
        }[]
      }
      resolve_booking_reschedule_v1: {
        Args: {
          p_expected_booking_version?: number
          p_request_id: string
          p_reschedule_request_id: string
          p_resolution: string
          p_resolved_by_profile_id: string
        }
        Returns: Json
      }
      resolve_current_therapist_for_reviews_v1: {
        Args: never
        Returns: {
          accepts_online_sessions: boolean
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          free_public_slug: string
          headline: string | null
          id: string
          is_accepting_bookings: boolean
          is_public: boolean
          languages: string[]
          last_published_at: string | null
          legal_name: string | null
          metadata: Json
          photo_url: string | null
          plan: Database["public"]["Enums"]["therapist_plan"]
          profile_version: number
          public_name: string
          public_profile_theme: string
          public_status: string
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["therapist_status"]
          unpublished_at: string | null
          updated_at: string
          user_id: string
          visibility_flags: Json
        }
        SetofOptions: {
          from: "*"
          to: "therapist_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_structured_participant_message_v2: {
        Args: {
          p_booking_id?: string
          p_conversation_id: string
          p_parameters?: Json
          p_template_key: string
        }
        Returns: Json
      }
      resolve_therapist_block_impact_v1: {
        Args: {
          p_actor_user_id: string
          p_impact_id: string
          p_request_id: string
          p_resolution: string
        }
        Returns: Json
      }
      resubmit_therapy_catalog_request_v2: {
        Args: {
          p_actor_user_id: string
          p_catalog_request_id: string
          p_payload: Json
          p_request_id: string
        }
        Returns: Json
      }
      retire_therapist_connect_account_v1: {
        Args: {
          p_closed_at?: string
          p_stripe_account_id: string
          p_stripe_event_created_at: string
          p_stripe_event_id: string
        }
        Returns: Json
      }
      run_booking_reminder_scheduler_v1: {
        Args: { p_limit?: number; p_now?: string }
        Returns: Json
      }
      save_patient_therapist_review_for_actor_v1: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_comment: string
          p_rating: number
          p_request_id: string
          p_therapist_profile_id: string
        }
        Returns: Json
      }
      save_therapist_private_identity_v1: {
        Args: {
          p_city: string
          p_complement: string
          p_country?: string
          p_document_number: string
          p_document_type: string
          p_neighborhood: string
          p_postal_code: string
          p_state: string
          p_street: string
          p_street_number: string
        }
        Returns: Json
      }
      save_therapist_profile_draft_content_base_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_payload: Json
          p_request_id: string
        }
        Returns: Json
      }
      save_therapist_profile_draft_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_payload: Json
          p_request_id: string
        }
        Returns: Json
      }
      save_therapist_profile_media_draft_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_kind: string
          p_media_url: string
          p_request_id: string
        }
        Returns: Json
      }
      save_therapist_schedule_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_request_id: string
          p_rules: Json
          p_service_settings: Json
          p_timezone: string
        }
        Returns: Json
      }
      schedule_booking_reminder_jobs_v1: {
        Args: { p_booking_id: string; p_now?: string }
        Returns: number
      }
      send_structured_participant_message_v1: {
        Args: { p_conversation_id: string; p_template_key: string }
        Returns: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          read_at: string | null
          sender_profile_id: string | null
          template_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_structured_participant_message_v2: {
        Args: {
          p_booking_id?: string
          p_conversation_id: string
          p_parameters?: Json
          p_template_key: string
        }
        Returns: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          read_at: string | null
          sender_profile_id: string | null
          template_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_support_ticket_requester_message_v1: {
        Args: { p_body: string; p_request_id: string; p_ticket_id: string }
        Returns: {
          author_profile_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          body: string
          created_at: string
          id: string
          request_id: string
          ticket_id: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "support_ticket_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_support_ticket_requester_message_with_attachments_v1: {
        Args: {
          p_attachments?: Json
          p_body: string
          p_request_id: string
          p_ticket_id: string
        }
        Returns: {
          author_profile_id: string
          author_role: Database["public"]["Enums"]["user_role"]
          body: string
          created_at: string
          id: string
          request_id: string
          ticket_id: string
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "support_ticket_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      service_row_to_private_json_v1: {
        Args: { p_service_id: string }
        Returns: Json
      }
      session_attendance_state_v1: {
        Args: { p_booking_id: string; p_now?: string }
        Returns: Json
      }
      session_confirmation_payload_v2: {
        Args: {
          p_confirmation: Database["public"]["Tables"]["session_participant_confirmations"]["Row"]
        }
        Returns: Json
      }
      session_feedback_confirmation_payload: {
        Args: {
          p_booking_id: string
          p_participant_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: Json
      }
      session_feedback_payload: {
        Args: {
          p_feedback: Database["public"]["Tables"]["session_feedback"]["Row"]
        }
        Returns: Json
      }
      store_therapist_service_request_v1: {
        Args: {
          p_operation: string
          p_payload_hash: string
          p_request_id: string
          p_response: Json
          p_service_id: string
          p_therapist_profile_id: string
        }
        Returns: Json
      }
      submit_session_feedback_for_actor_v1: {
        Args: {
          p_actor_user_id: string
          p_booking_id: string
          p_comment: string
          p_not_performed_reason: string
          p_outcome: string
          p_rating: number
          p_request_id: string
        }
        Returns: Json
      }
      submit_therapy_catalog_request_v1: {
        Args: { p_actor_user_id: string; p_payload: Json }
        Returns: Json
      }
      submit_therapy_catalog_request_v2: {
        Args: { p_actor_user_id: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      support_current_requester_role_v1: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      support_plain_text_v1: {
        Args: {
          p_field_name: string
          p_max_length: number
          p_min_length: number
          p_value: string
        }
        Returns: string
      }
      support_ticket_protocol_suffix_v1: {
        Args: { p_category: string }
        Returns: string
      }
      support_ticket_protocol_v1: {
        Args: { p_category: string }
        Returns: string
      }
      support_validate_ticket_attachments_v1: {
        Args: { p_attachments: Json; p_message_id: string; p_ticket_id: string }
        Returns: undefined
      }
      sync_booking_video_session_from_agenda_v1: {
        Args: {
          p_booking_id: string
          p_operation: string
          p_request_id: string
        }
        Returns: string
      }
      sync_booking_video_session_v1: {
        Args: {
          p_booking_id: string
          p_operation: string
          p_request_id?: string
        }
        Returns: string
      }
      synchronize_video_session_watchdog_v1: {
        Args: {
          p_environment: string
          p_max_duration_minutes: number
          p_provider_session_id: string
          p_session_name: string
        }
        Returns: undefined
      }
      therapist_metric_counter_v1: {
        Args: {
          p_copy_key_prefix: string
          p_current: number
          p_previous: number
          p_unit: string
        }
        Returns: Json
      }
      therapist_metric_rate_v1: {
        Args: {
          p_copy_key_prefix: string
          p_current_denominator: number
          p_current_numerator: number
          p_minimum_sample?: number
          p_previous_denominator: number
          p_previous_numerator: number
        }
        Returns: Json
      }
      therapist_metric_sampled_counter_by_sample_v1: {
        Args: {
          p_copy_key_prefix: string
          p_current: number
          p_minimum_sample?: number
          p_observed_sample: number
          p_previous: number
          p_unit: string
        }
        Returns: Json
      }
      therapist_metric_sampled_counter_v1: {
        Args: {
          p_copy_key_prefix: string
          p_current: number
          p_minimum_sample?: number
          p_previous: number
          p_unit: string
        }
        Returns: Json
      }
      therapist_profile_capabilities_json_m1: {
        Args: { p_plan: Database["public"]["Enums"]["therapist_plan"] }
        Returns: Json
      }
      therapist_profile_completeness_json_m1: {
        Args: { p_therapist_profile_id: string }
        Returns: Json
      }
      therapist_profile_content_json_m1: {
        Args: { p_content_version_id: string }
        Returns: Json
      }
      therapist_profile_derived_json_m1: {
        Args: { p_therapist_profile_id: string }
        Returns: Json
      }
      therapist_profile_published_fields_m1: {
        Args: {
          p_profile: Database["public"]["Tables"]["therapist_profiles"]["Row"]
        }
        Returns: Json
      }
      therapist_profile_replace_children_m1: {
        Args: {
          p_content_version_id: string
          p_guide_items: Json
          p_reflections: Json
        }
        Returns: undefined
      }
      therapist_profile_request_replay_m1: {
        Args: {
          p_action: string
          p_payload_hash: string
          p_request_id: string
          p_therapist_profile_id: string
        }
        Returns: Json
      }
      therapist_profile_store_request_m1: {
        Args: {
          p_action: string
          p_payload_hash: string
          p_request_id: string
          p_response: Json
          p_therapist_profile_id: string
        }
        Returns: Json
      }
      therapist_profile_validate_payload_m1: {
        Args: {
          p_payload: Json
          p_plan: Database["public"]["Enums"]["therapist_plan"]
        }
        Returns: Json
      }
      therapist_public_slug_status_v1: {
        Args: { p_slug: string; p_therapist_profile_id: string }
        Returns: Json
      }
      therapist_reviews_date_label_v1: {
        Args: { p_value: string }
        Returns: string
      }
      therapist_reviews_initials_v1: {
        Args: { p_name: string }
        Returns: string
      }
      therapist_service_limit_for_plan_v1: {
        Args: { p_plan: Database["public"]["Enums"]["therapist_plan"] }
        Returns: number
      }
      therapy_has_active_matching_theme_v1: {
        Args: { p_therapy_id: string }
        Returns: boolean
      }
      transition_booking_status_v1: {
        Args: {
          p_actor_profile_id: string
          p_booking_id: string
          p_expected_version?: number
          p_reason: string
          p_request_id: string
          p_source?: string
          p_target_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: {
          buffer_after_minutes_snapshot: number
          buffer_before_minutes_snapshot: number
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          currency_snapshot: string
          ends_at: string
          id: string
          last_transition_at: string | null
          legal_acceptance_recorded_at: string | null
          legal_cancellation_policy_version_id: string | null
          legal_privacy_version_id: string | null
          legal_terms_version_id: string | null
          meeting_provider: string | null
          meeting_url: string | null
          occupied_during: unknown
          patient_profile_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          service_duration_minutes_snapshot: number
          service_id: string
          service_price_cents_snapshot: number
          service_title_snapshot: string
          snapshot_captured_at: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          therapist_profile_id: string
          timezone: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_therapist_service_v1: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_expected_version: number
          p_request_id: string
          p_service_id: string
        }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      unpublish_therapist_profile_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_request_id: string
        }
        Returns: Json
      }
      update_therapist_public_slug_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_request_id: string
          p_slug: string
        }
        Returns: Json
      }
      update_therapist_service_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_payload: Json
          p_request_id: string
          p_service_id: string
        }
        Returns: Json
      }
      update_therapist_service_with_matching_v1: {
        Args: {
          p_actor_user_id: string
          p_expected_version: number
          p_payload: Json
          p_request_id: string
          p_service_id: string
        }
        Returns: Json
      }
      upsert_participant_conversation_for_booking_v1: {
        Args: { p_booking_id: string }
        Returns: string
      }
      upsert_therapist_review_reply_for_actor_v1: {
        Args: {
          p_actor_user_id: string
          p_body: string
          p_request_id: string
          p_review_id: string
        }
        Returns: Json
      }
      upsert_therapist_review_reply_v1: {
        Args: { p_body: string; p_request_id: string; p_review_id: string }
        Returns: Json
      }
      validate_platform_therapy_for_service_v1: {
        Args: { p_therapy_id: string }
        Returns: {
          archived_at: string | null
          calendar_color_key: string
          created_at: string
          created_by_profile_id: string | null
          deprecated_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available_for_services: boolean
          is_featured: boolean
          is_public_visible: boolean
          metadata: Json
          name: string
          popularity_score: number
          published_at: string | null
          replacement_therapy_id: string | null
          safety_note: string | null
          search_aliases: string[]
          short_description: string
          slug: string
          status: Database["public"]["Enums"]["therapy_status"]
          updated_at: string
          updated_by_profile_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "therapies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      auth_action_purpose: "email_verification" | "password_reset"
      billing_interval: "month" | "year"
      billing_subscription_status:
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused"
      booking_hold_status: "active" | "cancelled" | "consumed" | "expired"
      booking_reminder_job_status:
        | "scheduled"
        | "processing"
        | "enqueued"
        | "cancelled"
        | "missed"
        | "skipped"
        | "failed"
      booking_status:
        | "draft"
        | "pending_payment"
        | "confirmed"
        | "completed"
        | "cancelled_by_patient"
        | "cancelled_by_therapist"
        | "no_show_patient"
        | "no_show_therapist"
        | "refunded"
        | "cancelled_by_payment"
      connect_onboarding_status:
        | "not_started"
        | "account_created"
        | "onboarding_started"
        | "requirements_due"
        | "ready"
        | "restricted"
        | "disabled"
      email_delivery_status: "success" | "error" | "skipped"
      email_outbox_status:
        | "pending"
        | "processing"
        | "retry_pending"
        | "delivered"
        | "skipped"
        | "dead"
      email_provider_key: "hostinger_mail_api"
      financial_ledger_direction: "debit" | "credit"
      financial_ledger_entry_type:
        | "session_gross_payment"
        | "therapist_payable"
        | "platform_gross_commission"
        | "stripe_fee"
        | "refund"
        | "adjustment"
        | "transfer"
        | "transfer_reversal"
        | "dispute"
        | "loss"
        | "recovery"
        | "subscription_revenue"
      match_source: "journey" | "therapy_page" | "therapist_search"
      matching_version_status: "draft" | "published" | "archived"
      message_context:
        | "patient_to_therapist"
        | "patient_to_support"
        | "therapist_to_patient"
        | "system"
      payment_status:
        | "not_started"
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "cancelled"
      payout_batch_item_status:
        | "reserved"
        | "transfer_pending"
        | "transferred"
        | "failed"
        | "blocked"
        | "removed"
      payout_batch_status:
        | "draft"
        | "open"
        | "processing"
        | "partially_failed"
        | "completed"
        | "canceled"
      payout_operational_incident_status: "open" | "resolved"
      payout_scheduler_run_status:
        | "running"
        | "completed"
        | "completed_with_incidents"
        | "failed"
      review_status: "pending" | "published" | "hidden" | "reported" | "removed"
      service_status:
        | "draft"
        | "active"
        | "paused"
        | "archived"
        | "requires_review"
        | "rejected"
      session_confirmation_source:
        | "patient_review"
        | "therapist_manual"
        | "automatic"
        | "admin"
        | "bilateral"
      session_financial_status:
        | "pending"
        | "processing"
        | "paid"
        | "failed"
        | "canceled"
        | "partially_refunded"
        | "refunded"
        | "disputed"
      session_service_status:
        | "scheduled"
        | "occurred_pending_confirmation"
        | "confirmed_by_patient_review"
        | "confirmed_by_therapist"
        | "auto_confirmed"
        | "contested"
        | "canceled"
        | "not_performed"
        | "confirmed_bilateral"
      session_transfer_status:
        | "not_eligible"
        | "waiting_confirmation"
        | "waiting_safety_period"
        | "eligible"
        | "batched"
        | "transfer_pending"
        | "transferred"
        | "blocked"
        | "reversed"
        | "failed"
      stripe_payout_status:
        | "pending_balance"
        | "creating"
        | "pending"
        | "in_transit"
        | "paid"
        | "failed"
        | "canceled"
        | "reconciliation_required"
      stripe_webhook_processing_status:
        | "received"
        | "processing"
        | "processed"
        | "failed"
        | "ignored"
      therapist_plan: "free" | "premium" | "premium_plus"
      therapist_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "changes_requested"
        | "approved"
        | "rejected"
        | "suspended"
      therapy_status:
        | "draft"
        | "active"
        | "published"
        | "inactive"
        | "archived"
        | "in_review"
        | "deprecated"
      therapy_visual_theme_key: "energy" | "oracle" | "systemic"
      user_role: "patient" | "therapist" | "admin"
      video_session_control_job_status:
        | "queued"
        | "processing"
        | "retry"
        | "done"
        | "dead_letter"
      video_session_control_operation:
        | "end_patient_no_show"
        | "end_scheduled"
        | "end_hard_timeout"
        | "end_therapist_absent"
        | "reconcile_orphan"
        | "confirm_end"
      video_session_participant_role: "patient" | "therapist" | "unknown"
      video_session_status: "ready" | "active" | "ended" | "canceled" | "failed"
      zoom_video_webhook_processing_status:
        | "received"
        | "processing"
        | "processed"
        | "ignored"
        | "failed"
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
    Enums: {
      auth_action_purpose: ["email_verification", "password_reset"],
      billing_interval: ["month", "year"],
      billing_subscription_status: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
      booking_hold_status: ["active", "cancelled", "consumed", "expired"],
      booking_reminder_job_status: [
        "scheduled",
        "processing",
        "enqueued",
        "cancelled",
        "missed",
        "skipped",
        "failed",
      ],
      booking_status: [
        "draft",
        "pending_payment",
        "confirmed",
        "completed",
        "cancelled_by_patient",
        "cancelled_by_therapist",
        "no_show_patient",
        "no_show_therapist",
        "refunded",
        "cancelled_by_payment",
      ],
      connect_onboarding_status: [
        "not_started",
        "account_created",
        "onboarding_started",
        "requirements_due",
        "ready",
        "restricted",
        "disabled",
      ],
      email_delivery_status: ["success", "error", "skipped"],
      email_outbox_status: [
        "pending",
        "processing",
        "retry_pending",
        "delivered",
        "skipped",
        "dead",
      ],
      email_provider_key: ["hostinger_mail_api"],
      financial_ledger_direction: ["debit", "credit"],
      financial_ledger_entry_type: [
        "session_gross_payment",
        "therapist_payable",
        "platform_gross_commission",
        "stripe_fee",
        "refund",
        "adjustment",
        "transfer",
        "transfer_reversal",
        "dispute",
        "loss",
        "recovery",
        "subscription_revenue",
      ],
      match_source: ["journey", "therapy_page", "therapist_search"],
      matching_version_status: ["draft", "published", "archived"],
      message_context: [
        "patient_to_therapist",
        "patient_to_support",
        "therapist_to_patient",
        "system",
      ],
      payment_status: [
        "not_started",
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
        "cancelled",
      ],
      payout_batch_item_status: [
        "reserved",
        "transfer_pending",
        "transferred",
        "failed",
        "blocked",
        "removed",
      ],
      payout_batch_status: [
        "draft",
        "open",
        "processing",
        "partially_failed",
        "completed",
        "canceled",
      ],
      payout_operational_incident_status: ["open", "resolved"],
      payout_scheduler_run_status: [
        "running",
        "completed",
        "completed_with_incidents",
        "failed",
      ],
      review_status: ["pending", "published", "hidden", "reported", "removed"],
      service_status: [
        "draft",
        "active",
        "paused",
        "archived",
        "requires_review",
        "rejected",
      ],
      session_confirmation_source: [
        "patient_review",
        "therapist_manual",
        "automatic",
        "admin",
        "bilateral",
      ],
      session_financial_status: [
        "pending",
        "processing",
        "paid",
        "failed",
        "canceled",
        "partially_refunded",
        "refunded",
        "disputed",
      ],
      session_service_status: [
        "scheduled",
        "occurred_pending_confirmation",
        "confirmed_by_patient_review",
        "confirmed_by_therapist",
        "auto_confirmed",
        "contested",
        "canceled",
        "not_performed",
        "confirmed_bilateral",
      ],
      session_transfer_status: [
        "not_eligible",
        "waiting_confirmation",
        "waiting_safety_period",
        "eligible",
        "batched",
        "transfer_pending",
        "transferred",
        "blocked",
        "reversed",
        "failed",
      ],
      stripe_payout_status: [
        "pending_balance",
        "creating",
        "pending",
        "in_transit",
        "paid",
        "failed",
        "canceled",
        "reconciliation_required",
      ],
      stripe_webhook_processing_status: [
        "received",
        "processing",
        "processed",
        "failed",
        "ignored",
      ],
      therapist_plan: ["free", "premium", "premium_plus"],
      therapist_status: [
        "draft",
        "submitted",
        "in_review",
        "changes_requested",
        "approved",
        "rejected",
        "suspended",
      ],
      therapy_status: [
        "draft",
        "active",
        "published",
        "inactive",
        "archived",
        "in_review",
        "deprecated",
      ],
      therapy_visual_theme_key: ["energy", "oracle", "systemic"],
      user_role: ["patient", "therapist", "admin"],
      video_session_control_job_status: [
        "queued",
        "processing",
        "retry",
        "done",
        "dead_letter",
      ],
      video_session_control_operation: [
        "end_patient_no_show",
        "end_scheduled",
        "end_hard_timeout",
        "end_therapist_absent",
        "reconcile_orphan",
        "confirm_end",
      ],
      video_session_participant_role: ["patient", "therapist", "unknown"],
      video_session_status: ["ready", "active", "ended", "canceled", "failed"],
      zoom_video_webhook_processing_status: [
        "received",
        "processing",
        "processed",
        "ignored",
        "failed",
      ],
    },
  },
} as const
