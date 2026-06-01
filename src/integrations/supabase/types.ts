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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_by: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_by?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_user_assignments: {
        Row: {
          created_at: string
          id: string
          investor_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investor_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investor_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_user_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      master_agent_tenants: {
        Row: {
          created_at: string
          id: string
          master_agent_user_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          master_agent_user_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          master_agent_user_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_agent_tenants_master_agent_user_id_fkey"
            columns: ["master_agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          role_code: Database["public"]["Enums"]["app_role"]
          role_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          role_code: Database["public"]["Enums"]["app_role"]
          role_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          role_code?: Database["public"]["Enums"]["app_role"]
          role_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          details: Json
          event_type: Database["public"]["Enums"]["security_event_type"]
          id: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          event_type: Database["public"]["Enums"]["security_event_type"]
          id?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          event_type?: Database["public"]["Enums"]["security_event_type"]
          id?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      startup_user_assignments: {
        Row: {
          created_at: string
          id: string
          role: string | null
          startup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          startup_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          startup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_user_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_features: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          feature_code: string
          id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          feature_code: string
          id?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          feature_code?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_features_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          branding_logo_url: string | null
          branding_primary_color: string | null
          configuration_json: Json
          created_at: string
          created_by: string | null
          id: string
          tenant_id: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          configuration_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branding_logo_url?: string | null
          branding_primary_color?: string | null
          configuration_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscription: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          max_investors: number
          max_startups: number
          max_users: number
          subscription_plan: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          max_investors?: number
          max_startups?: number
          max_users?: number
          subscription_plan?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          max_investors?: number
          max_startups?: number
          max_users?: number
          subscription_plan?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscription_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          status: string
          tenant_code: string
          tenant_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          tenant_code: string
          tenant_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          tenant_code?: string
          tenant_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role_id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_id: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          id: string
          ip_address: string | null
          login_time: string
          logout_time: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_time?: string
          logout_time?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_time?: string
          logout_time?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tenants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          tenant_id: string
          user_id: string
          workspace_type: Database["public"]["Enums"]["workspace_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          tenant_id: string
          user_id: string
          workspace_type?: Database["public"]["Enums"]["workspace_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          tenant_id?: string
          user_id?: string
          workspace_type?: Database["public"]["Enums"]["workspace_type"]
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          ai_agent_id: string | null
          created_at: string
          created_by: string | null
          email: string
          first_name: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          primary_role_id: string | null
          primary_tenant_id: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          updated_by: string | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          ai_agent_id?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          first_name?: string | null
          id: string
          last_login_at?: string | null
          last_name?: string | null
          primary_role_id?: string | null
          primary_tenant_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          updated_by?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          ai_agent_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          primary_role_id?: string | null
          primary_tenant_id?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          updated_by?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: [
          {
            foreignKeyName: "users_primary_role_id_fkey"
            columns: ["primary_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_context: {
        Row: {
          active_role_id: string | null
          active_tenant_id: string | null
          active_workspace_type:
            | Database["public"]["Enums"]["workspace_type"]
            | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_role_id?: string | null
          active_tenant_id?: string | null
          active_workspace_type?:
            | Database["public"]["Enums"]["workspace_type"]
            | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_role_id?: string | null
          active_tenant_id?: string | null
          active_workspace_type?:
            | Database["public"]["Enums"]["workspace_type"]
            | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_context_active_role_id_fkey"
            columns: ["active_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_control: { Args: { _user_id: string }; Returns: boolean }
      is_master_agent_of: {
        Args: { _tenant: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_admin_of: {
        Args: { _tenant: string; _user_id: string }
        Returns: boolean
      }
      user_in_tenant: {
        Args: { _tenant: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "CONTROL"
        | "CONTROL_RESEARCH_AI"
        | "CONTROL_STARTUP_DISCOVERY_AI"
        | "CONTROL_INVESTOR_DISCOVERY_AI"
        | "MASTER_AGENT"
        | "MASTER_AGENT_AI"
        | "TENANT_ADMIN"
        | "TENANT_AGENT"
        | "TENANT_STARTUP_AI"
        | "TENANT_INVESTOR_AI"
        | "TENANT_DEAL_AI"
        | "STARTUP_USER"
        | "INVESTOR_USER"
      security_event_type:
        | "LOGIN"
        | "LOGOUT"
        | "FAILED_LOGIN"
        | "PASSWORD_RESET"
        | "ROLE_CHANGE"
        | "WORKSPACE_SWITCH"
        | "USER_INVITED"
        | "INVITE_ACCEPTED"
        | "INVITE_EXPIRED"
        | "ACCOUNT_LOCKED"
        | "ACCOUNT_SUSPENDED"
      user_status:
        | "Pending"
        | "Active"
        | "Suspended"
        | "Locked"
        | "Archived"
        | "Deleted"
      user_type: "Human" | "AI" | "System"
      workspace_type:
        | "CONTROL"
        | "MASTER_AGENT"
        | "TENANT"
        | "STARTUP"
        | "INVESTOR"
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
      app_role: [
        "CONTROL",
        "CONTROL_RESEARCH_AI",
        "CONTROL_STARTUP_DISCOVERY_AI",
        "CONTROL_INVESTOR_DISCOVERY_AI",
        "MASTER_AGENT",
        "MASTER_AGENT_AI",
        "TENANT_ADMIN",
        "TENANT_AGENT",
        "TENANT_STARTUP_AI",
        "TENANT_INVESTOR_AI",
        "TENANT_DEAL_AI",
        "STARTUP_USER",
        "INVESTOR_USER",
      ],
      security_event_type: [
        "LOGIN",
        "LOGOUT",
        "FAILED_LOGIN",
        "PASSWORD_RESET",
        "ROLE_CHANGE",
        "WORKSPACE_SWITCH",
        "USER_INVITED",
        "INVITE_ACCEPTED",
        "INVITE_EXPIRED",
        "ACCOUNT_LOCKED",
        "ACCOUNT_SUSPENDED",
      ],
      user_status: [
        "Pending",
        "Active",
        "Suspended",
        "Locked",
        "Archived",
        "Deleted",
      ],
      user_type: ["Human", "AI", "System"],
      workspace_type: [
        "CONTROL",
        "MASTER_AGENT",
        "TENANT",
        "STARTUP",
        "INVESTOR",
      ],
    },
  },
} as const
