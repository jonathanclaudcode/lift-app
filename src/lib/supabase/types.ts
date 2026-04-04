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
      bookings: {
        Row: {
          bokadirekt_id: string | null
          clinic_id: string
          created_at: string | null
          customer_id: string | null
          ends_at: string | null
          id: string
          location: string | null
          price: number | null
          provider_name: string | null
          raw_email_data: Json | null
          source: string | null
          starts_at: string
          status: string | null
          treatment: string
          updated_at: string | null
        }
        Insert: {
          bokadirekt_id?: string | null
          clinic_id: string
          created_at?: string | null
          customer_id?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          price?: number | null
          provider_name?: string | null
          raw_email_data?: Json | null
          source?: string | null
          starts_at: string
          status?: string | null
          treatment: string
          updated_at?: string | null
        }
        Update: {
          bokadirekt_id?: string | null
          clinic_id?: string
          created_at?: string | null
          customer_id?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          price?: number | null
          provider_name?: string | null
          raw_email_data?: Json | null
          source?: string | null
          starts_at?: string
          status?: string | null
          treatment?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string
          created_at: string | null
          display_name: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          slug: string
          style_profile: Json | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          slug: string
          style_profile?: Json | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          slug?: string
          style_profile?: Json | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          channel: string
          clinic_id: string
          created_at: string | null
          customer_id: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          clinic_id: string
          created_at?: string | null
          customer_id: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          clinic_id?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          allergies: string[] | null
          avg_rebooking_days: number | null
          birthday: string | null
          clinic_id: string
          created_at: string | null
          email: string | null
          id: string
          last_visit_at: string | null
          name: string
          notes: string | null
          phone: string | null
          pipeline_stage: string | null
          preferences: Json | null
          profile_summary: string | null
          response_rate: number | null
          skin_type: string | null
          treatment_count: number | null
          updated_at: string | null
        }
        Insert: {
          allergies?: string[] | null
          avg_rebooking_days?: number | null
          birthday?: string | null
          clinic_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          last_visit_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          preferences?: Json | null
          profile_summary?: string | null
          response_rate?: number | null
          skin_type?: string | null
          treatment_count?: number | null
          updated_at?: string | null
        }
        Update: {
          allergies?: string[] | null
          avg_rebooking_days?: number | null
          birthday?: string | null
          clinic_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          last_visit_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string | null
          preferences?: Json | null
          profile_summary?: string | null
          response_rate?: number | null
          skin_type?: string | null
          treatment_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_confidence: number | null
          ai_suggestions: Json | null
          author: string
          channel: string
          clinic_id: string
          content: string
          conversation_id: string
          created_at: string | null
          direction: string
          edit_distance: number | null
          external_message_id: string | null
          final_text: string | null
          id: string
          metadata: Json | null
          status: string | null
          suggested_text: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_suggestions?: Json | null
          author: string
          channel: string
          clinic_id: string
          content: string
          conversation_id: string
          created_at?: string | null
          direction: string
          edit_distance?: number | null
          external_message_id?: string | null
          final_text?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          suggested_text?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_suggestions?: Json | null
          author?: string
          channel?: string
          clinic_id?: string
          content?: string
          conversation_id?: string
          created_at?: string | null
          direction?: string
          edit_distance?: number | null
          external_message_id?: string | null
          final_text?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          suggested_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_events: {
        Row: {
          chosen_index: number | null
          clinic_id: string
          completion_tokens: number | null
          conversation_id: string | null
          created_at: string | null
          customer_id: string | null
          edit_distance: number | null
          edit_ratio: number | null
          final_text: string | null
          id: string
          message_id: string | null
          model: string | null
          prompt_tokens: number | null
          response_time_ms: number | null
          suggested_text: string | null
          suggestions: Json
        }
        Insert: {
          chosen_index?: number | null
          clinic_id: string
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          edit_distance?: number | null
          edit_ratio?: number | null
          final_text?: string | null
          id?: string
          message_id?: string | null
          model?: string | null
          prompt_tokens?: number | null
          response_time_ms?: number | null
          suggested_text?: string | null
          suggestions: Json
        }
        Update: {
          chosen_index?: number | null
          clinic_id?: string
          completion_tokens?: number | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          edit_distance?: number | null
          edit_ratio?: number | null
          final_text?: string | null
          id?: string
          message_id?: string | null
          model?: string | null
          prompt_tokens?: number | null
          response_time_ms?: number | null
          suggested_text?: string | null
          suggestions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_windows: {
        Row: {
          clinic_id: string
          customer_phone: string
          last_customer_message_at: string
          window_expires_at: string
        }
        Insert: {
          clinic_id: string
          customer_phone: string
          last_customer_message_at: string
          window_expires_at: string
        }
        Update: {
          clinic_id?: string
          customer_phone?: string
          last_customer_message_at?: string
          window_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_windows_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_clinic_id: { Args: never; Returns: string }
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
