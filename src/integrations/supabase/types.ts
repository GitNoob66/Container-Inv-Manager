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
      activity_logs: {
        Row: {
          action: string
          centre_id: string | null
          centre_name: string | null
          created_at: string
          details: string | null
          id: string
        }
        Insert: {
          action: string
          centre_id?: string | null
          centre_name?: string | null
          created_at?: string
          details?: string | null
          id?: string
        }
        Update: {
          action?: string
          centre_id?: string | null
          centre_name?: string | null
          created_at?: string
          details?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      centres: {
        Row: {
          code: string | null
          created_at: string
          id: string
          location: string | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      containers: {
        Row: {
          account: string | null
          cargo: string | null
          category: string | null
          centre_id: string
          condition: string | null
          container_no: string
          created_at: string
          ctr_type: string | null
          destination: string | null
          dispatched: boolean
          dry_subtype: string | null
          id: string
          in_date: string | null
          in_time: string | null
          mode: string | null
          out_date: string | null
          out_mode: string | null
          out_rail_ownership: string | null
          out_rake_name: string | null
          out_time: string | null
          ownership: string | null
          rail_ownership: string | null
          rake_name: string | null
          remarks: string | null
          size: string | null
          status: string | null
          updated_at: string
          weight: number | null
          yard_position: string | null
        }
        Insert: {
          account?: string | null
          cargo?: string | null
          category?: string | null
          centre_id: string
          condition?: string | null
          container_no: string
          created_at?: string
          ctr_type?: string | null
          destination?: string | null
          dispatched?: boolean
          dry_subtype?: string | null
          id?: string
          in_date?: string | null
          in_time?: string | null
          mode?: string | null
          out_date?: string | null
          out_mode?: string | null
          out_rail_ownership?: string | null
          out_rake_name?: string | null
          out_time?: string | null
          ownership?: string | null
          rail_ownership?: string | null
          rake_name?: string | null
          remarks?: string | null
          size?: string | null
          status?: string | null
          updated_at?: string
          weight?: number | null
          yard_position?: string | null
        }
        Update: {
          account?: string | null
          cargo?: string | null
          category?: string | null
          centre_id?: string
          condition?: string | null
          container_no?: string
          created_at?: string
          ctr_type?: string | null
          destination?: string | null
          dispatched?: boolean
          dry_subtype?: string | null
          id?: string
          in_date?: string | null
          in_time?: string | null
          mode?: string | null
          out_date?: string | null
          out_mode?: string | null
          out_rail_ownership?: string | null
          out_rake_name?: string | null
          out_time?: string | null
          ownership?: string | null
          rail_ownership?: string | null
          rake_name?: string | null
          remarks?: string | null
          size?: string | null
          status?: string | null
          updated_at?: string
          weight?: number | null
          yard_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "containers_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      rakes: {
        Row: {
          bpc_due_date: string | null
          created_at: string
          current_user_type: string
          id: string
          ownership: string
          rake_basing: string | null
          rake_id: string | null
          rake_name: string
          wagons: number | null
        }
        Insert: {
          bpc_due_date?: string | null
          created_at?: string
          current_user_type?: string
          id?: string
          ownership?: string
          rake_basing?: string | null
          rake_id?: string | null
          rake_name: string
          wagons?: number | null
        }
        Update: {
          bpc_due_date?: string | null
          created_at?: string
          current_user_type?: string
          id?: string
          ownership?: string
          rake_basing?: string | null
          rake_id?: string | null
          rake_name?: string
          wagons?: number | null
        }
        Relationships: []
      }
      size_options: {
        Row: {
          created_at: string
          id: string
          label: string
          teu: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          teu?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          teu?: number
        }
        Relationships: []
      }
      type_options: {
        Row: {
          created_at: string
          id: string
          label: string
          subtypes: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          subtypes?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          subtypes?: string[]
        }
        Relationships: []
      }
      yard_positions: {
        Row: {
          centre_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          centre_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          centre_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "yard_positions_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
