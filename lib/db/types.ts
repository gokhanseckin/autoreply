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
      clicks: {
        Row: {
          clicked_at: string
          id: string
          ip_hash: string
          link_code_id: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_hash: string
          link_code_id: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_hash?: string
          link_code_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicks_link_code_id_fkey"
            columns: ["link_code_id"]
            isOneToOne: false
            referencedRelation: "link_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_log: {
        Row: {
          consent_text_version: string
          consent_type: string
          contact_id: string | null
          dm_message_id: string | null
          granted_at: string
          id: string
        }
        Insert: {
          consent_text_version: string
          consent_type: string
          contact_id?: string | null
          dm_message_id?: string | null
          granted_at?: string
          id?: string
        }
        Update: {
          consent_text_version?: string
          consent_type?: string
          contact_id?: string | null
          dm_message_id?: string | null
          granted_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_log_dm_message_id_fkey"
            columns: ["dm_message_id"]
            isOneToOne: false
            referencedRelation: "messages_log"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          deleted_at: string | null
          first_seen_at: string
          id: string
          ig_account_id: string
          ig_user_id: string
          ig_username: string | null
          language: string | null
          last_seen_at: string
        }
        Insert: {
          deleted_at?: string | null
          first_seen_at?: string
          id?: string
          ig_account_id: string
          ig_user_id: string
          ig_username?: string | null
          language?: string | null
          last_seen_at?: string
        }
        Update: {
          deleted_at?: string | null
          first_seen_at?: string
          id?: string
          ig_account_id?: string
          ig_user_id?: string
          ig_username?: string | null
          language?: string | null
          last_seen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_state: {
        Row: {
          awaiting_input_type: string | null
          contact_id: string
          context: Json
          current_flow_id: string | null
          current_step_id: string | null
          expires_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          awaiting_input_type?: string | null
          contact_id: string
          context?: Json
          current_flow_id?: string | null
          current_step_id?: string | null
          expires_at?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          awaiting_input_type?: string | null
          contact_id?: string
          context?: Json
          current_flow_id?: string | null
          current_step_id?: string | null
          expires_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_state_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_state_current_flow_id_fkey"
            columns: ["current_flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          contact_id: string | null
          id: string
          processed_at: string | null
          requested_at: string
          requested_via: string
          status: string
        }
        Insert: {
          contact_id?: string | null
          id?: string
          processed_at?: string | null
          requested_at?: string
          requested_via: string
          status?: string
        }
        Update: {
          contact_id?: string | null
          id?: string
          processed_at?: string | null
          requested_at?: string
          requested_via?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_subscribers: {
        Row: {
          consent_at: string
          consent_text_version: string
          contact_id: string | null
          created_at: string
          email: string
          id: string
          ig_account_id: string
          provider_id: string | null
          source_flow_id: string | null
          status: string
        }
        Insert: {
          consent_at: string
          consent_text_version: string
          contact_id?: string | null
          created_at?: string
          email: string
          id?: string
          ig_account_id: string
          provider_id?: string | null
          source_flow_id?: string | null
          status: string
        }
        Update: {
          consent_at?: string
          consent_text_version?: string
          contact_id?: string | null
          created_at?: string
          email?: string
          id?: string
          ig_account_id?: string
          provider_id?: string | null
          source_flow_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_subscribers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_subscribers_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_subscribers_source_flow_id_fkey"
            columns: ["source_flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          archived: boolean
          created_at: string
          email_capture_enabled: boolean
          email_provider: string
          id: string
          ig_account_id: string
          language: string
          name: string
          post_id: string | null
          steps: Json
          trigger_keywords: string[]
          trigger_type: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          email_capture_enabled?: boolean
          email_provider?: string
          id?: string
          ig_account_id: string
          language?: string
          name: string
          post_id?: string | null
          steps?: Json
          trigger_keywords?: string[]
          trigger_type: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          email_capture_enabled?: boolean
          email_provider?: string
          id?: string
          ig_account_id?: string
          language?: string
          name?: string
          post_id?: string | null
          steps?: Json
          trigger_keywords?: string[]
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flows_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flows_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_accounts: {
        Row: {
          created_at: string
          default_language: string
          email_provider_config: Json
          fb_page_id: string
          id: string
          ig_business_account_id: string
          name: string
          page_access_token_enc: string
        }
        Insert: {
          created_at?: string
          default_language?: string
          email_provider_config?: Json
          fb_page_id: string
          id?: string
          ig_business_account_id: string
          name: string
          page_access_token_enc: string
        }
        Update: {
          created_at?: string
          default_language?: string
          email_provider_config?: Json
          fb_page_id?: string
          id?: string
          ig_business_account_id?: string
          name?: string
          page_access_token_enc?: string
        }
        Relationships: []
      }
      link_codes: {
        Row: {
          code: string
          contact_id: string
          created_at: string
          first_clicked_at: string | null
          id: string
          link_id: string
        }
        Insert: {
          code: string
          contact_id: string
          created_at?: string
          first_clicked_at?: string | null
          id?: string
          link_id: string
        }
        Update: {
          code?: string
          contact_id?: string
          created_at?: string
          first_clicked_at?: string | null
          id?: string
          link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_codes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_codes_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      links: {
        Row: {
          created_at: string
          destination_url: string
          flow_id: string
          id: string
          label: string
          step_id: string
        }
        Insert: {
          created_at?: string
          destination_url: string
          flow_id: string
          id?: string
          label: string
          step_id: string
        }
        Update: {
          created_at?: string
          destination_url?: string
          flow_id?: string
          id?: string
          label?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_log: {
        Row: {
          contact_id: string | null
          direction: string
          error: Json | null
          id: string
          ig_account_id: string
          message_type: string
          meta_message_id: string | null
          payload: Json
          sent_at: string
        }
        Insert: {
          contact_id?: string | null
          direction: string
          error?: Json | null
          id?: string
          ig_account_id: string
          message_type: string
          meta_message_id?: string | null
          payload: Json
          sent_at?: string
        }
        Update: {
          contact_id?: string | null
          direction?: string
          error?: Json | null
          id?: string
          ig_account_id?: string
          message_type?: string
          meta_message_id?: string | null
          payload?: Json
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_log_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption_excerpt: string | null
          created_at: string
          id: string
          ig_account_id: string
          ig_media_id: string
          monitored: boolean
          permalink: string | null
          posted_at: string | null
        }
        Insert: {
          caption_excerpt?: string | null
          created_at?: string
          id?: string
          ig_account_id: string
          ig_media_id: string
          monitored?: boolean
          permalink?: string | null
          posted_at?: string | null
        }
        Update: {
          caption_excerpt?: string | null
          created_at?: string
          id?: string
          ig_account_id?: string
          ig_media_id?: string
          monitored?: boolean
          permalink?: string | null
          posted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
