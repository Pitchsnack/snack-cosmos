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
      deal_activity: {
        Row: {
          activity_details: Json
          activity_type: string
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          activity_details?: Json
          activity_type: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          activity_details?: Json
          activity_type?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activity_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activity_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_ai_ownership: {
        Row: {
          assigned_at: string
          created_at: string
          deal_id: string
          id: string
          owning_ai_agent_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          deal_id: string
          id?: string
          owning_ai_agent_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          deal_id?: string
          id?: string
          owning_ai_agent_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_ai_ownership_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ai_ownership_owning_ai_agent_id_fkey"
            columns: ["owning_ai_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ai_ownership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_documents: {
        Row: {
          created_at: string
          created_by: string | null
          deal_id: string
          document_type: string | null
          file_name: string
          file_url: string
          id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_id: string
          document_type?: string | null
          file_name: string
          file_url: string
          id?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_id?: string
          document_type?: string | null
          file_name?: string
          file_url?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_introductions: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          introduced_by_user_id: string | null
          introduced_to_user_id: string | null
          investor_id: string | null
          startup_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          introduced_by_user_id?: string | null
          introduced_to_user_id?: string | null
          investor_id?: string | null
          startup_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          introduced_by_user_id?: string | null
          introduced_to_user_id?: string | null
          investor_id?: string | null
          startup_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      deal_ownership: {
        Row: {
          assigned_at: string
          created_at: string
          deal_id: string
          id: string
          owning_agent_user_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          deal_id: string
          id?: string
          owning_agent_user_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          deal_id?: string
          id?: string
          owning_agent_user_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_ownership_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ownership_owning_agent_user_id_fkey"
            columns: ["owning_agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_ownership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_share_activity: {
        Row: {
          activity_details: Json
          activity_type: string
          created_at: string
          created_by: string | null
          deal_share_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          activity_details?: Json
          activity_type: string
          created_at?: string
          created_by?: string | null
          deal_share_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          activity_details?: Json
          activity_type?: string
          created_at?: string
          created_by?: string | null
          deal_share_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_share_activity_deal_share_id_fkey"
            columns: ["deal_share_id"]
            isOneToOne: false
            referencedRelation: "deal_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_share_targets: {
        Row: {
          created_at: string
          deal_share_id: string
          id: string
          status: string
          target_tenant_id: string
          target_user_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_share_id: string
          id?: string
          status?: string
          target_tenant_id: string
          target_user_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_share_id?: string
          id?: string
          status?: string
          target_tenant_id?: string
          target_user_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_share_targets_deal_share_id_fkey"
            columns: ["deal_share_id"]
            isOneToOne: false
            referencedRelation: "deal_shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_share_targets_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_shares: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          share_reason: string | null
          shared_by_role: string | null
          shared_by_user_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          share_reason?: string | null
          shared_by_role?: string | null
          shared_by_user_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          share_reason?: string | null
          shared_by_role?: string | null
          shared_by_user_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_shares_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_shares_shared_by_user_id_fkey"
            columns: ["shared_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_shares_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_tags: {
        Row: {
          deal_id: string
          id: string
          tag_name: string
          tenant_id: string
        }
        Insert: {
          deal_id: string
          id?: string
          tag_name: string
          tenant_id: string
        }
        Update: {
          deal_id?: string
          id?: string
          tag_name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tags_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          created_at: string
          created_by: string | null
          deal_name: string
          expected_close_date: string | null
          id: string
          imported_at: string | null
          investment_amount: number | null
          investor_id: string
          notes: string | null
          probability: number | null
          source_global_id: string | null
          stage: string
          startup_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_name: string
          expected_close_date?: string | null
          id?: string
          imported_at?: string | null
          investment_amount?: number | null
          investor_id: string
          notes?: string | null
          probability?: number | null
          source_global_id?: string | null
          stage?: string
          startup_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_name?: string
          expected_close_date?: string | null
          id?: string
          imported_at?: string | null
          investment_amount?: number | null
          investor_id?: string
          notes?: string | null
          probability?: number | null
          source_global_id?: string | null
          stage?: string
          startup_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      default_intake_settings: {
        Row: {
          created_at: string
          default_investor_intake_agent_id: string
          default_investor_intake_ai_agent_id: string
          default_startup_intake_agent_id: string
          default_startup_intake_ai_agent_id: string
          id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          default_investor_intake_agent_id: string
          default_investor_intake_ai_agent_id: string
          default_startup_intake_agent_id: string
          default_startup_intake_ai_agent_id: string
          id?: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          default_investor_intake_agent_id?: string
          default_investor_intake_ai_agent_id?: string
          default_startup_intake_agent_id?: string
          default_startup_intake_ai_agent_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "default_intake_settings_default_investor_intake_agent_id_fkey"
            columns: ["default_investor_intake_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_intake_settings_default_investor_intake_ai_agent_i_fkey"
            columns: ["default_investor_intake_ai_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_intake_settings_default_startup_intake_agent_id_fkey"
            columns: ["default_startup_intake_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_intake_settings_default_startup_intake_ai_agent_id_fkey"
            columns: ["default_startup_intake_ai_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_intake_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "default_intake_settings_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      global_startup_imports: {
        Row: {
          global_id: string
          id: string
          imported_at: string
          imported_by: string
          tenant_id: string
          tenant_startup_id: string
        }
        Insert: {
          global_id: string
          id?: string
          imported_at?: string
          imported_by: string
          tenant_id: string
          tenant_startup_id: string
        }
        Update: {
          global_id?: string
          id?: string
          imported_at?: string
          imported_by?: string
          tenant_id?: string
          tenant_startup_id?: string
        }
        Relationships: []
      }
      global_startups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          sector: string | null
          stage: string | null
          status: string
          tags: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          sector?: string | null
          stage?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          sector?: string | null
          stage?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      investor_activity: {
        Row: {
          activity_details: Json
          activity_type: string
          created_at: string
          created_by: string | null
          id: string
          investor_id: string
          tenant_id: string
        }
        Insert: {
          activity_details?: Json
          activity_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          investor_id: string
          tenant_id: string
        }
        Update: {
          activity_details?: Json
          activity_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          investor_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_ai_ownership: {
        Row: {
          assigned_at: string
          created_at: string
          id: string
          investor_id: string
          owning_ai_agent_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          id?: string
          investor_id: string
          owning_ai_agent_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          id?: string
          investor_id?: string
          owning_ai_agent_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_ai_ownership_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_ai_ownership_owning_ai_agent_id_fkey"
            columns: ["owning_ai_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_ai_ownership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_investors: {
        Row: {
          created_at: string
          id: string
          investor_id: string
          portfolio_investor_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          investor_id: string
          portfolio_investor_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          investor_id?: string
          portfolio_investor_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_investors_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investors_portfolio_investor_id_fkey"
            columns: ["portfolio_investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_ownership: {
        Row: {
          assigned_at: string
          created_at: string
          id: string
          investor_id: string
          owning_agent_user_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          id?: string
          investor_id: string
          owning_agent_user_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          id?: string
          investor_id?: string
          owning_agent_user_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_ownership_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_ownership_owning_agent_user_id_fkey"
            columns: ["owning_agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_ownership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_tags: {
        Row: {
          id: string
          investor_id: string
          tag_name: string
          tenant_id: string
        }
        Insert: {
          id?: string
          investor_id: string
          tag_name: string
          tenant_id: string
        }
        Update: {
          id?: string
          investor_id?: string
          tag_name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_tags_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_tags_tenant_id_fkey"
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
      investor_users: {
        Row: {
          created_at: string
          id: string
          investor_id: string
          role: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investor_id: string
          role?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investor_id?: string
          role?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_users_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          aum: string | null
          bio: string | null
          business_address: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          firm_name: string | null
          id: string
          imported_at: string | null
          investment_focus: string[] | null
          investor_name: string
          investor_type: string | null
          keywords: string[] | null
          legal_name: string | null
          linkedin_url: string | null
          logo_url: string | null
          long_description: string | null
          max_ticket_size: string | null
          media: Json
          min_ticket_size: string | null
          preferred_industries: string[] | null
          preferred_stages: string[] | null
          short_description: string | null
          source_global_id: string | null
          status: string
          tenant_id: string
          ticket_size: string | null
          updated_at: string
          updated_by: string | null
          visibility: string
          website_url: string | null
          year_founded: number | null
        }
        Insert: {
          aum?: string | null
          bio?: string | null
          business_address?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          firm_name?: string | null
          id?: string
          imported_at?: string | null
          investment_focus?: string[] | null
          investor_name: string
          investor_type?: string | null
          keywords?: string[] | null
          legal_name?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          long_description?: string | null
          max_ticket_size?: string | null
          media?: Json
          min_ticket_size?: string | null
          preferred_industries?: string[] | null
          preferred_stages?: string[] | null
          short_description?: string | null
          source_global_id?: string | null
          status?: string
          tenant_id: string
          ticket_size?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
          website_url?: string | null
          year_founded?: number | null
        }
        Update: {
          aum?: string | null
          bio?: string | null
          business_address?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          firm_name?: string | null
          id?: string
          imported_at?: string | null
          investment_focus?: string[] | null
          investor_name?: string
          investor_type?: string | null
          keywords?: string[] | null
          legal_name?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          long_description?: string | null
          max_ticket_size?: string | null
          media?: Json
          min_ticket_size?: string | null
          preferred_industries?: string[] | null
          preferred_stages?: string[] | null
          short_description?: string | null
          source_global_id?: string | null
          status?: string
          tenant_id?: string
          ticket_size?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
          website_url?: string | null
          year_founded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          system_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          notification_type: string
          tenant_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type: string
          tenant_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type?: string
          tenant_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
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
      saved_searches: {
        Row: {
          created_at: string
          id: string
          search_name: string
          search_query: Json
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          search_name: string
          search_query?: Json
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          search_name?: string
          search_query?: Json
          tenant_id?: string | null
          user_id?: string
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
      startup_activity: {
        Row: {
          activity_details: Json
          activity_type: string
          created_at: string
          created_by: string | null
          id: string
          startup_id: string
          tenant_id: string
        }
        Insert: {
          activity_details?: Json
          activity_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          startup_id: string
          tenant_id: string
        }
        Update: {
          activity_details?: Json
          activity_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          startup_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_activity_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_activity_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_ai_ownership: {
        Row: {
          assigned_at: string
          created_at: string
          id: string
          owning_ai_agent_id: string
          startup_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          id?: string
          owning_ai_agent_id: string
          startup_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          id?: string
          owning_ai_agent_id?: string
          startup_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_ai_ownership_owning_ai_agent_id_fkey"
            columns: ["owning_ai_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_ai_ownership_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_ai_ownership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_founders: {
        Row: {
          bio: string | null
          created_at: string
          display_order: number
          full_name: string
          id: string
          linkedin_url: string | null
          photo_url: string | null
          position: string | null
          startup_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          display_order?: number
          full_name: string
          id?: string
          linkedin_url?: string | null
          photo_url?: string | null
          position?: string | null
          startup_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          display_order?: number
          full_name?: string
          id?: string
          linkedin_url?: string | null
          photo_url?: string | null
          position?: string | null
          startup_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_founders_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_founders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_investors: {
        Row: {
          created_at: string
          id: string
          investor_id: string
          startup_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          investor_id: string
          startup_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          investor_id?: string
          startup_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_investors_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_investors_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_investors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_media: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          slot: number
          startup_id: string
          storage_path: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          slot: number
          startup_id: string
          storage_path?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          slot?: number
          startup_id?: string
          storage_path?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_media_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_media_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_ownership: {
        Row: {
          assigned_at: string
          created_at: string
          id: string
          owning_agent_user_id: string
          startup_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          id?: string
          owning_agent_user_id: string
          startup_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          id?: string
          owning_agent_user_id?: string
          startup_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_ownership_owning_agent_user_id_fkey"
            columns: ["owning_agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_ownership_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_ownership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_tags: {
        Row: {
          id: string
          startup_id: string
          tag_name: string
          tenant_id: string
        }
        Insert: {
          id?: string
          startup_id: string
          tag_name: string
          tenant_id: string
        }
        Update: {
          id?: string
          startup_id?: string
          tag_name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_tags_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      startup_users: {
        Row: {
          created_at: string
          id: string
          role: string | null
          startup_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          startup_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          startup_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_users_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      startups: {
        Row: {
          city: string | null
          company_size: string | null
          company_type: string | null
          created_at: string
          created_by: string | null
          email: string | null
          headquarters: string | null
          id: string
          imported_at: string | null
          industry: string[]
          investment_stage: string | null
          last_year_revenue: string | null
          linkedin_url: string | null
          logo_url: string | null
          long_description: string | null
          market_tags: string[]
          product_tags: string[]
          region: string | null
          registered_name: string | null
          short_description: string | null
          source_global_id: string | null
          startup_name: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          url_key: string | null
          visibility: string
          website_url: string | null
          year_founded: number | null
        }
        Insert: {
          city?: string | null
          company_size?: string | null
          company_type?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          headquarters?: string | null
          id?: string
          imported_at?: string | null
          industry?: string[]
          investment_stage?: string | null
          last_year_revenue?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          long_description?: string | null
          market_tags?: string[]
          product_tags?: string[]
          region?: string | null
          registered_name?: string | null
          short_description?: string | null
          source_global_id?: string | null
          startup_name: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          url_key?: string | null
          visibility?: string
          website_url?: string | null
          year_founded?: number | null
        }
        Update: {
          city?: string | null
          company_size?: string | null
          company_type?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          headquarters?: string | null
          id?: string
          imported_at?: string | null
          industry?: string[]
          investment_stage?: string | null
          last_year_revenue?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          long_description?: string | null
          market_tags?: string[]
          product_tags?: string[]
          region?: string | null
          registered_name?: string | null
          short_description?: string | null
          source_global_id?: string | null
          startup_name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          url_key?: string | null
          visibility?: string
          website_url?: string | null
          year_founded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "startups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      workspace_preferences: {
        Row: {
          created_at: string
          default_landing_page: string
          id: string
          items_per_page: number
          sidebar_collapsed: boolean
          tenant_id: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_landing_page?: string
          id?: string
          items_per_page?: number
          sidebar_collapsed?: boolean
          tenant_id?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_landing_page?: string
          id?: string
          items_per_page?: number
          sidebar_collapsed?: boolean
          tenant_id?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_tenant_id: { Args: { _user_id: string }; Returns: string }
      can_access_deal: {
        Args: { _deal_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_investor: {
        Args: { _investor_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_shared_deal: {
        Args: { _deal_share_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_startup: {
        Args: { _startup_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_deal: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_investor: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_shared_deal: {
        Args: { _deal_share_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_startup: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      fn_import_global_startup: {
        Args: {
          _global_id: string
          _imported_by: string
          _owning_agent: string
          _owning_ai_agent: string
          _tenant_id: string
        }
        Returns: string
      }
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
      normalize_url_key: { Args: { _url: string }; Returns: string }
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
