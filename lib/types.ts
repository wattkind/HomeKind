// Hand-written Supabase Database type, derived directly from
// supabase/migrations/20260801000000_initial_schema.sql. Keep in sync with
// the migration — columns here must match the SQL exactly.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string;
        };
      };
      household_members: {
        Row: {
          household_id: string;
          user_id: string;
          role: "owner" | "member";
          warranty_threshold_days: 30 | 60 | 90;
          created_at: string;
        };
        Insert: {
          household_id: string;
          user_id: string;
          role: "owner" | "member";
          warranty_threshold_days?: 30 | 60 | 90;
          created_at?: string;
        };
        Update: {
          household_id?: string;
          user_id?: string;
          role?: "owner" | "member";
          warranty_threshold_days?: 30 | 60 | 90;
          created_at?: string;
        };
      };
      invites: {
        Row: {
          id: string;
          household_id: string;
          token_hash: string;
          created_by: string | null;
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          token_hash: string;
          created_by?: string | null;
          expires_at: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          token_hash?: string;
          created_by?: string | null;
          expires_at?: string;
          accepted_by?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          created_at?: string;
        };
      };
      devices: {
        Row: {
          id: string;
          household_id: string;
          room_id: string | null;
          name: string;
          brand: string | null;
          model_number: string | null;
          purchase_date: string | null;
          purchase_price: number | null;
          warranty_end: string | null;
          deleted_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          room_id?: string | null;
          name: string;
          brand?: string | null;
          model_number?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          warranty_end?: string | null;
          deleted_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          room_id?: string | null;
          name?: string;
          brand?: string | null;
          model_number?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          warranty_end?: string | null;
          deleted_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          device_id: string;
          household_id: string;
          type: "manual" | "receipt" | "other";
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number | null;
          page_count: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          household_id: string;
          type: "manual" | "receipt" | "other";
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes?: number | null;
          page_count?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          household_id?: string;
          type?: "manual" | "receipt" | "other";
          storage_path?: string;
          file_name?: string;
          mime_type?: string;
          size_bytes?: number | null;
          page_count?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          household_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
      };
      warranty_notifications: {
        Row: {
          id: string;
          device_id: string;
          household_id: string;
          user_id: string;
          channel: "push" | "banner";
          warranty_end: string;
          notified_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          household_id: string;
          user_id: string;
          channel: "push" | "banner";
          warranty_end: string;
          notified_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          household_id?: string;
          user_id?: string;
          channel?: "push" | "banner";
          warranty_end?: string;
          notified_at?: string;
        };
      };
      ai_usage: {
        Row: {
          id: number;
          household_id: string;
          user_id: string | null;
          purpose: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          ts: string;
        };
        Insert: {
          id?: number;
          household_id: string;
          user_id?: string | null;
          purpose: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          ts?: string;
        };
        Update: {
          id?: number;
          household_id?: string;
          user_id?: string | null;
          purpose?: string;
          model?: string;
          input_tokens?: number;
          output_tokens?: number;
          ts?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_household_with_defaults: {
        Args: { p_name: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row types for consumers that just want a plain shape.
export type Household = Database["public"]["Tables"]["households"]["Row"];
export type HouseholdMember = Database["public"]["Tables"]["household_members"]["Row"];
export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type Device = Database["public"]["Tables"]["devices"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type PushSubscriptionRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];
export type WarrantyNotification = Database["public"]["Tables"]["warranty_notifications"]["Row"];
