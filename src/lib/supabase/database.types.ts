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
      aura_recommendations: {
        Row: {
          body: string
          booking_id: string | null
          context: Json
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          patient_profile_id: string | null
          plan_required: Database["public"]["Enums"]["therapist_plan"]
          priority: number
          source_rule_key: string
          therapist_profile_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          booking_id?: string | null
          context?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          patient_profile_id?: string | null
          plan_required?: Database["public"]["Enums"]["therapist_plan"]
          priority?: number
          source_rule_key: string
          therapist_profile_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          booking_id?: string | null
          context?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          patient_profile_id?: string | null
          plan_required?: Database["public"]["Enums"]["therapist_plan"]
          priority?: number
          source_rule_key?: string
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
            referencedRelation: "public_therapist_profiles_v"
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
      availability_exceptions: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_available: boolean
          reason: string | null
          service_id: string | null
          starts_at: string
          therapist_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_available?: boolean
          reason?: string | null
          service_id?: string | null
          starts_at: string
          therapist_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_available?: boolean
          reason?: string | null
          service_id?: string | null
          starts_at?: string
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_profiles_v"
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
          service_id: string | null
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
          service_id?: string | null
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
          service_id?: string | null
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
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
            referencedRelation: "public_therapist_profiles_v"
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
          metadata: Json
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
          metadata?: Json
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
          metadata?: Json
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
          requested_by_profile_id: string
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
          requested_by_profile_id: string
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
          requested_by_profile_id?: string
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
          description: string | null
          label: string
        }
        Insert: {
          action_key: string
          active?: boolean
          category: string
          created_at?: string
          description?: string | null
          label: string
        }
        Update: {
          action_key?: string
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          label?: string
        }
        Relationships: []
      }
      email_action_settings: {
        Row: {
          action_key: string
          created_at: string
          enabled: boolean
          sender_profile_id: string | null
          updated_at: string
        }
        Insert: {
          action_key: string
          created_at?: string
          enabled?: boolean
          sender_profile_id?: string | null
          updated_at?: string
        }
        Update: {
          action_key?: string
          created_at?: string
          enabled?: boolean
          sender_profile_id?: string | null
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
          payout_batch_rule: string
          platform_commission_bps: number
          proration_policy_key: string
          refund_policy_key: string
          refund_processing_business_days: number
          subscription_cancellation_behavior: string
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
          payout_batch_rule?: string
          platform_commission_bps?: number
          proration_policy_key?: string
          refund_policy_key?: string
          refund_processing_business_days?: number
          subscription_cancellation_behavior?: string
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
          payout_batch_rule?: string
          platform_commission_bps?: number
          proration_policy_key?: string
          refund_policy_key?: string
          refund_processing_business_days?: number
          subscription_cancellation_behavior?: string
          timezone?: string
          transfer_safety_period_days?: number
          upgrade_proration_behavior?: string
          version?: string
          weekly_batch_time?: string
          weekly_batch_weekday?: number
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_search"
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
          context: Database["public"]["Enums"]["message_context"]
          created_at: string
          id: string
          is_active: boolean
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          context: Database["public"]["Enums"]["message_context"]
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          context?: Database["public"]["Enums"]["message_context"]
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_profile_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_profile_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_profile_id?: string
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_search"
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
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          email_confirmed_at: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id?: string
          phone?: string | null
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "therapist_profiles"
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
          therapist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
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
            referencedRelation: "public_therapist_profiles_v"
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
          requested_by_profile_id: string | null
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
          requested_by_profile_id?: string | null
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
          requested_by_profile_id?: string | null
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
      session_payment_attempts: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          request_metadata: Json
          response_metadata: Json
          session_payment_id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          request_metadata?: Json
          response_metadata?: Json
          session_payment_id: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          request_metadata?: Json
          response_metadata?: Json
          session_payment_id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
          connect_account_id: string
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          metadata: Json
          payout_batch_item_id: string
          session_payment_id: string
          status: string
          stripe_source_charge_id: string | null
          stripe_transfer_id: string | null
          therapist_profile_id: string
          transferred_at: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          connect_account_id: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          payout_batch_item_id: string
          session_payment_id: string
          status?: string
          stripe_source_charge_id?: string | null
          stripe_transfer_id?: string | null
          therapist_profile_id: string
          transferred_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          connect_account_id?: string
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          payout_batch_item_id?: string
          session_payment_id?: string
          status?: string
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          booking_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          priority: string
          requester_profile_id: string | null
          resolution_summary: string | null
          reviewed_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          requester_profile_id?: string | null
          resolution_summary?: string | null
          reviewed_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          requester_profile_id?: string | null
          resolution_summary?: string | null
          reviewed_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
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
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          is_public_visible: boolean
          metadata: Json
          name: string
          popularity_score: number
          published_at: string | null
          safety_note: string | null
          search_aliases: string[]
          short_description: string
          slug: string
          status: Database["public"]["Enums"]["therapy_status"]
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_public_visible?: boolean
          metadata?: Json
          name: string
          popularity_score?: number
          published_at?: string | null
          safety_note?: string | null
          search_aliases?: string[]
          short_description: string
          slug: string
          status?: Database["public"]["Enums"]["therapy_status"]
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_public_visible?: boolean
          metadata?: Json
          name?: string
          popularity_score?: number
          published_at?: string | null
          safety_note?: string | null
          search_aliases?: string[]
          short_description?: string
          slug?: string
          status?: Database["public"]["Enums"]["therapy_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapies_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "public_therapies_v"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "therapies_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "therapy_categories"
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
          charges_enabled: boolean
          created_at: string
          dashboard_type: string
          details_submitted: boolean
          disabled_reason: string | null
          fees_collector: string
          id: string
          last_synced_at: string | null
          losses_collector: string
          metadata: Json
          onboarding_status: Database["public"]["Enums"]["connect_onboarding_status"]
          operational_status: string
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
          charges_enabled?: boolean
          created_at?: string
          dashboard_type?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          fees_collector?: string
          id?: string
          last_synced_at?: string | null
          losses_collector?: string
          metadata?: Json
          onboarding_status?: Database["public"]["Enums"]["connect_onboarding_status"]
          operational_status?: string
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
          charges_enabled?: boolean
          created_at?: string
          dashboard_type?: string
          details_submitted?: boolean
          disabled_reason?: string | null
          fees_collector?: string
          id?: string
          last_synced_at?: string | null
          losses_collector?: string
          metadata?: Json
          onboarding_status?: Database["public"]["Enums"]["connect_onboarding_status"]
          operational_status?: string
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
            isOneToOne: true
            referencedRelation: "public_home_therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_profiles_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "public_therapist_search"
            referencedColumns: ["therapist_profile_id"]
          },
          {
            foreignKeyName: "therapist_connect_accounts_therapist_profile_id_fkey"
            columns: ["therapist_profile_id"]
            isOneToOne: true
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profile_content_versions: {
        Row: {
          created_at: string
          essence_body: string | null
          experience_years: number | null
          id: string
          invitation_body: string | null
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
          created_at?: string
          essence_body?: string | null
          experience_years?: number | null
          id?: string
          invitation_body?: string | null
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
          created_at?: string
          essence_body?: string | null
          experience_years?: number | null
          id?: string
          invitation_body?: string | null
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
          headline: string | null
          id: string
          is_accepting_bookings: boolean
          is_public: boolean
          languages: string[]
          legal_name: string | null
          metadata: Json
          photo_url: string | null
          plan: Database["public"]["Enums"]["therapist_plan"]
          public_name: string
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["therapist_status"]
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
          headline?: string | null
          id?: string
          is_accepting_bookings?: boolean
          is_public?: boolean
          languages?: string[]
          legal_name?: string | null
          metadata?: Json
          photo_url?: string | null
          plan?: Database["public"]["Enums"]["therapist_plan"]
          public_name: string
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["therapist_status"]
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
          headline?: string | null
          id?: string
          is_accepting_bookings?: boolean
          is_public?: boolean
          languages?: string[]
          legal_name?: string | null
          metadata?: Json
          photo_url?: string | null
          plan?: Database["public"]["Enums"]["therapist_plan"]
          public_name?: string
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["therapist_status"]
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
      therapist_schedule_events: {
        Row: {
          actor_user_id: string
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
          actor_user_id: string
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
          actor_user_id?: string
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_search"
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
      therapist_services: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          duration_minutes: number
          id: string
          online_only: boolean
          price_cents: number
          status: Database["public"]["Enums"]["service_status"]
          therapist_profile_id: string
          therapy_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes: number
          id?: string
          online_only?: boolean
          price_cents: number
          status?: Database["public"]["Enums"]["service_status"]
          therapist_profile_id: string
          therapy_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          online_only?: boolean
          price_cents?: number
          status?: Database["public"]["Enums"]["service_status"]
          therapist_profile_id?: string
          therapy_id?: string
          title?: string
          updated_at?: string
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_profiles_v"
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
            referencedRelation: "public_therapist_search"
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
        ]
      }
      therapy_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_search"
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
          id: string
          last_error_code: string | null
          last_error_message: string | null
          last_synced_at: string | null
          metadata: Json
          provider: string
          provider_session_id: string | null
          scheduled_ends_at: string
          scheduled_starts_at: string
          session_key: string | null
          session_name: string
          status: Database["public"]["Enums"]["video_session_status"]
          therapist_access_issued_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          booking_id: string
          created_at?: string
          environment: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider?: string
          provider_session_id?: string | null
          scheduled_ends_at: string
          scheduled_starts_at: string
          session_key?: string | null
          session_name: string
          status?: Database["public"]["Enums"]["video_session_status"]
          therapist_access_issued_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          booking_id?: string
          created_at?: string
          environment?: string
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider?: string
          provider_session_id?: string | null
          scheduled_ends_at?: string
          scheduled_starts_at?: string
          session_key?: string | null
          session_name?: string
          status?: Database["public"]["Enums"]["video_session_status"]
          therapist_access_issued_at?: string | null
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
          id: string | null
          last_synced_at: string | null
          provider: string | null
          scheduled_ends_at: string | null
          scheduled_starts_at: string | null
          status: Database["public"]["Enums"]["video_session_status"] | null
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
          category_name: string | null
          category_slug: string | null
          href_slug: string | null
          id: string | null
          is_featured: boolean | null
          name: string | null
          short_description: string | null
          slug: string | null
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
      public_therapies_v: {
        Row: {
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          category_sort_order: number | null
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
          therapist_count: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_therapist_profile_content_v: {
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
            referencedRelation: "public_therapist_profiles_v"
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
          category_name: string | null
          category_slug: string | null
          complementary_description: string | null
          description: string | null
          faqs: Json | null
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
          therapist_count: number | null
          updated_at: string | null
          visual_theme_key: string | null
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
            referencedRelation: "public_therapist_search"
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
            referencedRelation: "public_therapist_profiles_v"
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
          id: string | null
          last_synced_at: string | null
          provider: string | null
          scheduled_ends_at: string | null
          scheduled_starts_at: string | null
          status: Database["public"]["Enums"]["video_session_status"] | null
          therapist_access_issued_at: string | null
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
      apply_zoom_video_session_event_v1: {
        Args: {
          p_duration_seconds?: number
          p_event_at: string
          p_event_type: string
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
      cancel_video_session_for_booking_v1: {
        Args: { p_booking_id: string; p_source?: string }
        Returns: string
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
      get_therapist_agenda_v1: {
        Args: { p_range_end?: string; p_range_start?: string }
        Returns: Json
      }
      get_therapist_dashboard_v1: { Args: never; Returns: Json }
      get_therapist_schedule_v1: { Args: never; Returns: Json }
      get_therapist_session_detail_v1: {
        Args: { p_booking_id: string }
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
      is_current_patient_profile: {
        Args: { candidate_id: string }
        Returns: boolean
      }
      is_current_therapist_profile: {
        Args: { candidate_id: string }
        Returns: boolean
      }
      is_related_patient_to_current_therapist: {
        Args: { candidate_id: string }
        Returns: boolean
      }
      is_valid_timezone_v1: { Args: { p_timezone: string }; Returns: boolean }
      refresh_session_transfer_eligibility: {
        Args: { p_now?: string; p_session_payment_id: string }
        Returns: Database["public"]["Enums"]["session_transfer_status"]
      }
      release_auth_action_token_claim: {
        Args: { p_claim_id: string; p_token_id: string }
        Returns: boolean
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
          requested_by_profile_id: string
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
      unaccent: { Args: { "": string }; Returns: string }
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
      connect_onboarding_status:
        | "not_started"
        | "account_created"
        | "onboarding_started"
        | "requirements_due"
        | "ready"
        | "restricted"
        | "disabled"
      email_delivery_status: "success" | "error" | "skipped"
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
      review_status: "pending" | "published" | "hidden" | "reported" | "removed"
      service_status: "draft" | "active" | "paused" | "archived"
      session_confirmation_source:
        | "patient_review"
        | "therapist_manual"
        | "automatic"
        | "admin"
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
      therapy_status: "draft" | "active" | "published" | "inactive" | "archived"
      therapy_visual_theme_key: "energy" | "oracle" | "systemic"
      user_role: "patient" | "therapist" | "admin"
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
      review_status: ["pending", "published", "hidden", "reported", "removed"],
      service_status: ["draft", "active", "paused", "archived"],
      session_confirmation_source: [
        "patient_review",
        "therapist_manual",
        "automatic",
        "admin",
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
      therapy_status: ["draft", "active", "published", "inactive", "archived"],
      therapy_visual_theme_key: ["energy", "oracle", "systemic"],
      user_role: ["patient", "therapist", "admin"],
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

