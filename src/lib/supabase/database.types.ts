export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      aura_recommendations: {
        Row: {
          body: string;
          booking_id: string | null;
          context: Json;
          created_at: string;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          patient_profile_id: string | null;
          plan_required: Database["public"]["Enums"]["therapist_plan"];
          priority: number;
          source_rule_key: string;
          therapist_profile_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          booking_id?: string | null;
          context?: Json;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          patient_profile_id?: string | null;
          plan_required?: Database["public"]["Enums"]["therapist_plan"];
          priority?: number;
          source_rule_key: string;
          therapist_profile_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          booking_id?: string | null;
          context?: Json;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          patient_profile_id?: string | null;
          plan_required?: Database["public"]["Enums"]["therapist_plan"];
          priority?: number;
          source_rule_key?: string;
          therapist_profile_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aura_recommendations_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aura_recommendations_patient_profile_id_fkey";
            columns: ["patient_profile_id"];
            isOneToOne: false;
            referencedRelation: "patient_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aura_recommendations_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_exceptions: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          is_available: boolean;
          reason: string | null;
          service_id: string | null;
          starts_at: string;
          therapist_profile_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          is_available?: boolean;
          reason?: string | null;
          service_id?: string | null;
          starts_at: string;
          therapist_profile_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          is_available?: boolean;
          reason?: string | null;
          service_id?: string | null;
          starts_at?: string;
          therapist_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "therapist_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "availability_exceptions_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_rules: {
        Row: {
          created_at: string;
          day_of_week: number;
          end_time: string;
          id: string;
          is_active: boolean;
          service_id: string | null;
          start_time: string;
          therapist_profile_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: number;
          end_time: string;
          id?: string;
          is_active?: boolean;
          service_id?: string | null;
          start_time: string;
          therapist_profile_id: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          is_active?: boolean;
          service_id?: string | null;
          start_time?: string;
          therapist_profile_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_rules_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "therapist_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "availability_rules_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          ends_at: string;
          id: string;
          meeting_provider: string | null;
          meeting_url: string | null;
          patient_profile_id: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          service_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
          therapist_profile_id: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          ends_at: string;
          id?: string;
          meeting_provider?: string | null;
          meeting_url?: string | null;
          patient_profile_id: string;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          service_id: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["booking_status"];
          therapist_profile_id: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          ends_at?: string;
          id?: string;
          meeting_provider?: string | null;
          meeting_url?: string | null;
          patient_profile_id?: string;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          service_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          therapist_profile_id?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_patient_profile_id_fkey";
            columns: ["patient_profile_id"];
            isOneToOne: false;
            referencedRelation: "patient_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "therapist_services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      favorite_therapists: {
        Row: {
          created_at: string;
          id: string;
          patient_profile_id: string;
          therapist_profile_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          patient_profile_id: string;
          therapist_profile_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          patient_profile_id?: string;
          therapist_profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorite_therapists_patient_profile_id_fkey";
            columns: ["patient_profile_id"];
            isOneToOne: false;
            referencedRelation: "patient_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorite_therapists_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      message_templates: {
        Row: {
          body: string;
          context: Database["public"]["Enums"]["message_context"];
          created_at: string;
          id: string;
          is_active: boolean;
          key: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          context: Database["public"]["Enums"]["message_context"];
          created_at?: string;
          id?: string;
          is_active?: boolean;
          key: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          context?: Database["public"]["Enums"]["message_context"];
          created_at?: string;
          id?: string;
          is_active?: boolean;
          key?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patient_profiles: {
        Row: {
          avatar_url: string | null;
          birth_date: string | null;
          created_at: string;
          display_name: string;
          id: string;
          marketing_consent: boolean;
          metadata: Json;
          phone: string | null;
          sensitive_data_consent_at: string | null;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          marketing_consent?: boolean;
          metadata?: Json;
          phone?: string | null;
          sensitive_data_consent_at?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          marketing_consent?: boolean;
          metadata?: Json;
          phone?: string | null;
          sensitive_data_consent_at?: string | null;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_cents: number;
          booking_id: string;
          created_at: string;
          currency: string;
          id: string;
          paid_at: string | null;
          patient_profile_id: string;
          platform_fee_cents: number;
          provider: string;
          refunded_at: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          therapist_amount_cents: number;
          therapist_profile_id: string;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          booking_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          paid_at?: string | null;
          patient_profile_id: string;
          platform_fee_cents?: number;
          provider?: string;
          refunded_at?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          therapist_amount_cents?: number;
          therapist_profile_id: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          booking_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          paid_at?: string | null;
          patient_profile_id?: string;
          platform_fee_cents?: number;
          provider?: string;
          refunded_at?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          therapist_amount_cents?: number;
          therapist_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_patient_profile_id_fkey";
            columns: ["patient_profile_id"];
            isOneToOne: false;
            referencedRelation: "patient_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pre_checkout_intakes: {
        Row: {
          booking_id: string | null;
          consent_accepted_at: string | null;
          created_at: string;
          expectation: string | null;
          id: string;
          initial_context: string | null;
          objective: string;
          patient_profile_id: string | null;
          sensitive_data_acknowledged: boolean;
          service_id: string | null;
          updated_at: string;
        };
        Insert: {
          booking_id?: string | null;
          consent_accepted_at?: string | null;
          created_at?: string;
          expectation?: string | null;
          id?: string;
          initial_context?: string | null;
          objective: string;
          patient_profile_id?: string | null;
          sensitive_data_acknowledged?: boolean;
          service_id?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_id?: string | null;
          consent_accepted_at?: string | null;
          created_at?: string;
          expectation?: string | null;
          id?: string;
          initial_context?: string | null;
          objective?: string;
          patient_profile_id?: string | null;
          sensitive_data_acknowledged?: boolean;
          service_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pre_checkout_intakes_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pre_checkout_intakes_patient_profile_id_fkey";
            columns: ["patient_profile_id"];
            isOneToOne: false;
            referencedRelation: "patient_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pre_checkout_intakes_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "therapist_services";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          booking_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          moderation_reason: string | null;
          patient_profile_id: string;
          published_at: string | null;
          rating: number;
          status: Database["public"]["Enums"]["review_status"];
          therapist_profile_id: string;
          updated_at: string;
        };
        Insert: {
          booking_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          moderation_reason?: string | null;
          patient_profile_id: string;
          published_at?: string | null;
          rating: number;
          status?: Database["public"]["Enums"]["review_status"];
          therapist_profile_id: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          moderation_reason?: string | null;
          patient_profile_id?: string;
          published_at?: string | null;
          rating?: number;
          status?: Database["public"]["Enums"]["review_status"];
          therapist_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_patient_profile_id_fkey";
            columns: ["patient_profile_id"];
            isOneToOne: false;
            referencedRelation: "patient_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      structured_messages: {
        Row: {
          body: string;
          booking_id: string | null;
          context: Database["public"]["Enums"]["message_context"];
          created_at: string;
          id: string;
          metadata: Json;
          patient_profile_id: string | null;
          sender_profile_id: string | null;
          template_id: string | null;
          therapist_profile_id: string | null;
        };
        Insert: {
          body: string;
          booking_id?: string | null;
          context: Database["public"]["Enums"]["message_context"];
          created_at?: string;
          id?: string;
          metadata?: Json;
          patient_profile_id?: string | null;
          sender_profile_id?: string | null;
          template_id?: string | null;
          therapist_profile_id?: string | null;
        };
        Update: {
          body?: string;
          booking_id?: string | null;
          context?: Database["public"]["Enums"]["message_context"];
          created_at?: string;
          id?: string;
          metadata?: Json;
          patient_profile_id?: string | null;
          sender_profile_id?: string | null;
          template_id?: string | null;
          therapist_profile_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "structured_messages_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "structured_messages_patient_profile_id_fkey";
            columns: ["patient_profile_id"];
            isOneToOne: false;
            referencedRelation: "patient_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "structured_messages_sender_profile_id_fkey";
            columns: ["sender_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "structured_messages_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "message_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "structured_messages_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      support_tickets: {
        Row: {
          booking_id: string | null;
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          priority: string;
          requester_profile_id: string | null;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          booking_id?: string | null;
          category: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          priority?: string;
          requester_profile_id?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          priority?: string;
          requester_profile_id?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_tickets_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_requester_profile_id_fkey";
            columns: ["requester_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      therapies: {
        Row: {
          category_id: string;
          created_at: string;
          description: string | null;
          id: string;
          is_featured: boolean;
          metadata: Json;
          name: string;
          safety_note: string | null;
          short_description: string;
          slug: string;
          status: Database["public"]["Enums"]["therapy_status"];
          updated_at: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          metadata?: Json;
          name: string;
          safety_note?: string | null;
          short_description: string;
          slug: string;
          status?: Database["public"]["Enums"]["therapy_status"];
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_featured?: boolean;
          metadata?: Json;
          name?: string;
          safety_note?: string | null;
          short_description?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["therapy_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "therapies_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "therapy_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      therapist_profiles: {
        Row: {
          accepts_online_sessions: boolean;
          bio: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          headline: string | null;
          id: string;
          is_accepting_bookings: boolean;
          is_public: boolean;
          languages: string[];
          legal_name: string | null;
          metadata: Json;
          photo_url: string | null;
          plan: Database["public"]["Enums"]["therapist_plan"];
          public_name: string;
          slug: string;
          state: string | null;
          status: Database["public"]["Enums"]["therapist_status"];
          updated_at: string;
          user_id: string;
          visibility_flags: Json;
        };
        Insert: {
          accepts_online_sessions?: boolean;
          bio?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          headline?: string | null;
          id?: string;
          is_accepting_bookings?: boolean;
          is_public?: boolean;
          languages?: string[];
          legal_name?: string | null;
          metadata?: Json;
          photo_url?: string | null;
          plan?: Database["public"]["Enums"]["therapist_plan"];
          public_name: string;
          slug: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["therapist_status"];
          updated_at?: string;
          user_id: string;
          visibility_flags?: Json;
        };
        Update: {
          accepts_online_sessions?: boolean;
          bio?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          headline?: string | null;
          id?: string;
          is_accepting_bookings?: boolean;
          is_public?: boolean;
          languages?: string[];
          legal_name?: string | null;
          metadata?: Json;
          photo_url?: string | null;
          plan?: Database["public"]["Enums"]["therapist_plan"];
          public_name?: string;
          slug?: string;
          state?: string | null;
          status?: Database["public"]["Enums"]["therapist_status"];
          updated_at?: string;
          user_id?: string;
          visibility_flags?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "therapist_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      therapist_services: {
        Row: {
          created_at: string;
          currency: string;
          description: string | null;
          duration_minutes: number;
          id: string;
          online_only: boolean;
          price_cents: number;
          status: Database["public"]["Enums"]["service_status"];
          therapist_profile_id: string;
          therapy_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          description?: string | null;
          duration_minutes: number;
          id?: string;
          online_only?: boolean;
          price_cents: number;
          status?: Database["public"]["Enums"]["service_status"];
          therapist_profile_id: string;
          therapy_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          online_only?: boolean;
          price_cents?: number;
          status?: Database["public"]["Enums"]["service_status"];
          therapist_profile_id?: string;
          therapy_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "therapist_services_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "therapist_services_therapy_id_fkey";
            columns: ["therapy_id"];
            isOneToOne: false;
            referencedRelation: "therapies";
            referencedColumns: ["id"];
          },
        ];
      };
      therapist_verifications: {
        Row: {
          changes_requested: string | null;
          created_at: string;
          documents_metadata: Json;
          id: string;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["therapist_status"];
          submitted_at: string;
          therapist_profile_id: string;
          updated_at: string;
        };
        Insert: {
          changes_requested?: string | null;
          created_at?: string;
          documents_metadata?: Json;
          id?: string;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["therapist_status"];
          submitted_at?: string;
          therapist_profile_id: string;
          updated_at?: string;
        };
        Update: {
          changes_requested?: string | null;
          created_at?: string;
          documents_metadata?: Json;
          id?: string;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["therapist_status"];
          submitted_at?: string;
          therapist_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "therapist_verifications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "therapist_verifications_therapist_profile_id_fkey";
            columns: ["therapist_profile_id"];
            isOneToOne: false;
            referencedRelation: "therapist_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      therapy_categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      therapy_theme_weights: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          reason: string | null;
          source: Database["public"]["Enums"]["match_source"];
          subtheme_id: string | null;
          theme_id: string | null;
          therapy_id: string;
          updated_at: string;
          weight: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          reason?: string | null;
          source?: Database["public"]["Enums"]["match_source"];
          subtheme_id?: string | null;
          theme_id?: string | null;
          therapy_id: string;
          updated_at?: string;
          weight?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          reason?: string | null;
          source?: Database["public"]["Enums"]["match_source"];
          subtheme_id?: string | null;
          theme_id?: string | null;
          therapy_id?: string;
          updated_at?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "therapy_theme_weights_subtheme_id_fkey";
            columns: ["subtheme_id"];
            isOneToOne: false;
            referencedRelation: "therapy_themes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "therapy_theme_weights_theme_id_fkey";
            columns: ["theme_id"];
            isOneToOne: false;
            referencedRelation: "therapy_themes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "therapy_theme_weights_therapy_id_fkey";
            columns: ["therapy_id"];
            isOneToOne: false;
            referencedRelation: "therapies";
            referencedColumns: ["id"];
          },
        ];
      };
      therapy_themes: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          parent_theme_id: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          parent_theme_id?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          parent_theme_id?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "therapy_themes_parent_theme_id_fkey";
            columns: ["parent_theme_id"];
            isOneToOne: false;
            referencedRelation: "therapy_themes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
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
        | "refunded";
      match_source: "journey" | "therapy_page" | "therapist_search";
      message_context:
        | "patient_to_therapist"
        | "patient_to_support"
        | "therapist_to_patient"
        | "system";
      payment_status:
        | "not_started"
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "cancelled";
      review_status:
        | "pending"
        | "published"
        | "hidden"
        | "reported"
        | "removed";
      service_status: "draft" | "active" | "paused" | "archived";
      therapist_plan: "free" | "premium" | "premium_plus";
      therapist_status:
        | "draft"
        | "submitted"
        | "in_review"
        | "changes_requested"
        | "approved"
        | "rejected"
        | "suspended";
      therapy_status: "draft" | "active" | "inactive" | "archived";
      user_role: "patient" | "therapist" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
      therapy_status: ["draft", "active", "inactive", "archived"],
      user_role: ["patient", "therapist", "admin"],
    },
  },
} as const;
