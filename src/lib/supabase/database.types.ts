export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          ends_at: string
          id: string
          meeting_provider: string | null
          meeting_url: string | null
          patient_profile_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          service_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          therapist_profile_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          meeting_provider?: string | null
          meeting_url?: string | null
          patient_profile_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          service_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          therapist_profile_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          meeting_provider?: string | null
          meeting_url?: string | null
          patient_profile_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          service_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          therapist_profile_id?: string
          timezone?: string
          updated_at?: string
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
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
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
    }
    Functions: {
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
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
      review_status: "pending" | "published" | "hidden" | "reported" | "removed"
      service_status: "draft" | "active" | "paused" | "archived"
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
      review_status: ["pending", "published", "hidden", "reported", "removed"],
      service_status: ["draft", "active", "paused", "archived"],
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
    },
  },
} as const

