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
      channel_tokens: {
        Row: {
          channel_id: string
          created_at: string
          extra_config: Json | null
          id: string
          token_type: string
          token_value: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          extra_config?: Json | null
          id?: string
          token_type?: string
          token_value: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          extra_config?: Json | null
          id?: string
          token_type?: string
          token_value?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_tokens_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          engagement_rate: number | null
          followers: number | null
          id: string
          is_connected: boolean | null
          last_post_at: string | null
          name: string
          platform: string
          posts_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          is_connected?: boolean | null
          last_post_at?: string | null
          name: string
          platform: string
          posts_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          is_connected?: boolean | null
          last_post_at?: string | null
          name?: string
          platform?: string
          posts_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      contents: {
        Row: {
          audio_url: string | null
          body: string | null
          channel: string | null
          content_type: string
          created_at: string
          ethics_valid: boolean | null
          id: string
          media_url: string | null
          published_at: string | null
          scientific_valid: boolean | null
          score: number | null
          status: string
          thumbnail_url: string | null
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          body?: string | null
          channel?: string | null
          content_type?: string
          created_at?: string
          ethics_valid?: boolean | null
          id?: string
          media_url?: string | null
          published_at?: string | null
          scientific_valid?: boolean | null
          score?: number | null
          status?: string
          thumbnail_url?: string | null
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          body?: string | null
          channel?: string | null
          content_type?: string
          created_at?: string
          ethics_valid?: boolean | null
          id?: string
          media_url?: string | null
          published_at?: string | null
          scientific_valid?: boolean | null
          score?: number | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      whatsapp_content: {
        Row: {
          body: string | null
          content_type: string
          created_at: string
          engagement_score: number | null
          group_id: string | null
          id: string
          published_at: string | null
          scheduled_at: string | null
          source_content_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          content_type?: string
          created_at?: string
          engagement_score?: number | null
          group_id?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          source_content_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          content_type?: string
          created_at?: string
          engagement_score?: number | null
          group_id?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          source_content_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_content_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          created_at: string
          description: string | null
          group_type: string
          id: string
          invite_link: string | null
          is_active: boolean | null
          members_count: number | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_type?: string
          id?: string
          invite_link?: string | null
          is_active?: boolean | null
          members_count?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_type?: string
          id?: string
          invite_link?: string | null
          is_active?: boolean | null
          members_count?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
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
  public: {
    Enums: {},
  },
} as const
