export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      ig_accounts: {
        Row: {
          id: string;
          ig_business_account_id: string;
          fb_page_id: string;
          page_access_token_enc: string;
          name: string;
          default_language: string;
          email_provider_config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          ig_business_account_id: string;
          fb_page_id: string;
          page_access_token_enc: string;
          name: string;
          default_language?: string;
          email_provider_config?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          ig_business_account_id?: string;
          fb_page_id?: string;
          page_access_token_enc?: string;
          name?: string;
          default_language?: string;
          email_provider_config?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          ig_account_id: string;
          ig_media_id: string;
          caption_excerpt: string | null;
          permalink: string | null;
          monitored: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          ig_account_id: string;
          ig_media_id: string;
          caption_excerpt?: string | null;
          permalink?: string | null;
          monitored?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          ig_account_id?: string;
          ig_media_id?: string;
          caption_excerpt?: string | null;
          permalink?: string | null;
          monitored?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      flows: {
        Row: {
          id: string;
          ig_account_id: string;
          name: string;
          language: string;
          trigger_type: string;
          trigger_keywords: string[];
          post_id: string | null;
          steps: Json;
          email_capture_enabled: boolean;
          email_provider: string;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ig_account_id: string;
          name: string;
          language?: string;
          trigger_type: string;
          trigger_keywords?: string[];
          post_id?: string | null;
          steps?: Json;
          email_capture_enabled?: boolean;
          email_provider?: string;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ig_account_id?: string;
          name?: string;
          language?: string;
          trigger_type?: string;
          trigger_keywords?: string[];
          post_id?: string | null;
          steps?: Json;
          email_capture_enabled?: boolean;
          email_provider?: string;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          ig_account_id: string;
          ig_user_id: string;
          ig_username: string | null;
          language: string | null;
          first_seen_at: string;
          last_seen_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          ig_account_id: string;
          ig_user_id: string;
          ig_username?: string | null;
          language?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          ig_account_id?: string;
          ig_user_id?: string;
          ig_username?: string | null;
          language?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      conversation_state: {
        Row: {
          id: string;
          contact_id: string;
          current_flow_id: string | null;
          current_step_id: string | null;
          awaiting_input_type: string | null;
          context: Json;
          expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          current_flow_id?: string | null;
          current_step_id?: string | null;
          awaiting_input_type?: string | null;
          context?: Json;
          expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          current_flow_id?: string | null;
          current_step_id?: string | null;
          awaiting_input_type?: string | null;
          context?: Json;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages_log: {
        Row: {
          id: string;
          ig_account_id: string;
          contact_id: string | null;
          direction: string;
          message_type: string;
          payload: Json;
          meta_message_id: string | null;
          error: Json | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          ig_account_id: string;
          contact_id?: string | null;
          direction: string;
          message_type: string;
          payload: Json;
          meta_message_id?: string | null;
          error?: Json | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          ig_account_id?: string;
          contact_id?: string | null;
          direction?: string;
          message_type?: string;
          payload?: Json;
          meta_message_id?: string | null;
          error?: Json | null;
          sent_at?: string;
        };
        Relationships: [];
      };
      links: {
        Row: {
          id: string;
          flow_id: string;
          step_id: string;
          label: string;
          destination_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          flow_id: string;
          step_id: string;
          label: string;
          destination_url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          flow_id?: string;
          step_id?: string;
          label?: string;
          destination_url?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      link_codes: {
        Row: {
          id: string;
          link_id: string;
          contact_id: string;
          code: string;
          first_clicked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          link_id: string;
          contact_id: string;
          code: string;
          first_clicked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          link_id?: string;
          contact_id?: string;
          code?: string;
          first_clicked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      clicks: {
        Row: {
          id: string;
          link_code_id: string;
          ip_hash: string;
          user_agent: string | null;
          clicked_at: string;
        };
        Insert: {
          id?: string;
          link_code_id: string;
          ip_hash: string;
          user_agent?: string | null;
          clicked_at?: string;
        };
        Update: {
          id?: string;
          link_code_id?: string;
          ip_hash?: string;
          user_agent?: string | null;
          clicked_at?: string;
        };
        Relationships: [];
      };
      email_subscribers: {
        Row: {
          id: string;
          ig_account_id: string;
          contact_id: string | null;
          email: string;
          consent_at: string;
          consent_text_version: string;
          source_flow_id: string | null;
          provider_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ig_account_id: string;
          contact_id?: string | null;
          email: string;
          consent_at: string;
          consent_text_version: string;
          source_flow_id?: string | null;
          provider_id?: string | null;
          status: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ig_account_id?: string;
          contact_id?: string | null;
          email?: string;
          consent_at?: string;
          consent_text_version?: string;
          source_flow_id?: string | null;
          provider_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      consent_log: {
        Row: {
          id: string;
          contact_id: string | null;
          consent_type: string;
          consent_text_version: string;
          granted_at: string;
          dm_message_id: string | null;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          consent_type: string;
          consent_text_version: string;
          granted_at?: string;
          dm_message_id?: string | null;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          consent_type?: string;
          consent_text_version?: string;
          granted_at?: string;
          dm_message_id?: string | null;
        };
        Relationships: [];
      };
      deletion_requests: {
        Row: {
          id: string;
          contact_id: string | null;
          requested_via: string;
          requested_at: string;
          processed_at: string | null;
          status: string;
        };
        Insert: {
          id?: string;
          contact_id?: string | null;
          requested_via: string;
          requested_at?: string;
          processed_at?: string | null;
          status?: string;
        };
        Update: {
          id?: string;
          contact_id?: string | null;
          requested_via?: string;
          requested_at?: string;
          processed_at?: string | null;
          status?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
