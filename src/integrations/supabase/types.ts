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
      access_codes: {
        Row: {
          client_name: string
          code: string
          created_at: string
          created_by: string
          ends_on: string | null
          free_months: number
          free_plan: string | null
          id: string
          invite_email: string | null
          invite_sent_at: string | null
          invite_sent_by: string | null
          max_accounts: number
          note: string | null
          role: string
          switched_off_at: string | null
          switched_off_by: string | null
        }
        Insert: {
          client_name: string
          code: string
          created_at?: string
          created_by: string
          ends_on?: string | null
          free_months?: number
          free_plan?: string | null
          id?: string
          invite_email?: string | null
          invite_sent_at?: string | null
          invite_sent_by?: string | null
          max_accounts?: number
          note?: string | null
          role: string
          switched_off_at?: string | null
          switched_off_by?: string | null
        }
        Update: {
          client_name?: string
          code?: string
          created_at?: string
          created_by?: string
          ends_on?: string | null
          free_months?: number
          free_plan?: string | null
          id?: string
          invite_email?: string | null
          invite_sent_at?: string | null
          invite_sent_by?: string | null
          max_accounts?: number
          note?: string | null
          role?: string
          switched_off_at?: string | null
          switched_off_by?: string | null
        }
        Relationships: []
      }
      access_devices: {
        Row: {
          code_id: string
          first_seen_at: string
          id: string
          last_seen_at: string
          visits: number
        }
        Insert: {
          code_id: string
          first_seen_at?: string
          id: string
          last_seen_at?: string
          visits?: number
        }
        Update: {
          code_id?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "access_devices_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      access_failures: {
        Row: {
          hour_count: number
          hour_started_at: string
          in_a_row: number
          key: string
          paused_until: string | null
        }
        Insert: {
          hour_count?: number
          hour_started_at?: string
          in_a_row?: number
          key: string
          paused_until?: string | null
        }
        Update: {
          hour_count?: number
          hour_started_at?: string
          in_a_row?: number
          key?: string
          paused_until?: string | null
        }
        Relationships: []
      }
      admin_contact_notes: {
        Row: {
          author_user_id: string
          body: string
          contact_user_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_user_id: string
          body: string
          contact_user_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          contact_user_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_contact_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_contact_notes_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_conversations: {
        Row: {
          client_org_id: string
          client_side: string
          created_at: string
          firm_profile_id: string
          id: string
        }
        Insert: {
          client_org_id: string
          client_side: string
          created_at?: string
          firm_profile_id: string
          id?: string
        }
        Update: {
          client_org_id?: string
          client_side?: string
          created_at?: string
          firm_profile_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_conversations_firm_profile_id_fkey"
            columns: ["firm_profile_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_enquiries: {
        Row: {
          client_org_id: string
          client_side: string
          closed_at: string | null
          closed_reason: string | null
          conversation_id: string
          created_at: string
          declined_at: string | null
          declined_reason: string | null
          done_at: string | null
          engaged_at: string | null
          firm_profile_id: string
          id: string
          need_text: string
          read_at: string | null
          sent_by: string
          service_key: string
          status: string
          timing: string | null
        }
        Insert: {
          client_org_id: string
          client_side: string
          closed_at?: string | null
          closed_reason?: string | null
          conversation_id: string
          created_at?: string
          declined_at?: string | null
          declined_reason?: string | null
          done_at?: string | null
          engaged_at?: string | null
          firm_profile_id: string
          id?: string
          need_text: string
          read_at?: string | null
          sent_by: string
          service_key: string
          status?: string
          timing?: string | null
        }
        Update: {
          client_org_id?: string
          client_side?: string
          closed_at?: string | null
          closed_reason?: string | null
          conversation_id?: string
          created_at?: string
          declined_at?: string | null
          declined_reason?: string | null
          done_at?: string | null
          engaged_at?: string | null
          firm_profile_id?: string
          id?: string
          need_text?: string
          read_at?: string | null
          sent_by?: string
          service_key?: string
          status?: string
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_enquiries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "advisor_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_enquiries_firm_profile_id_fkey"
            columns: ["firm_profile_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_enquiry_events: {
        Row: {
          actor_user_id: string | null
          conversation_id: string
          created_at: string
          data: Json
          enquiry_id: string
          id: string
          kind: string
          ref_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          conversation_id: string
          created_at?: string
          data?: Json
          enquiry_id: string
          id?: string
          kind: string
          ref_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          conversation_id?: string
          created_at?: string
          data?: Json
          enquiry_id?: string
          id?: string
          kind?: string
          ref_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_enquiry_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "advisor_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_enquiry_events_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "advisor_enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_favourites: {
        Row: {
          created_at: string
          item_id: string
          item_kind: string
          user_id: string
          view: string
        }
        Insert: {
          created_at?: string
          item_id: string
          item_kind: string
          user_id: string
          view?: string
        }
        Update: {
          created_at?: string
          item_id?: string
          item_kind?: string
          user_id?: string
          view?: string
        }
        Relationships: []
      }
      advisor_firm_credentials: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          firm_id: string
          id: string
          name: string
          name_th: string | null
          note: string | null
          note_th: string | null
          sort_order: number
          status: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          firm_id: string
          id?: string
          name: string
          name_th?: string | null
          note?: string | null
          note_th?: string | null
          sort_order?: number
          status?: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          firm_id?: string
          id?: string
          name?: string
          name_th?: string | null
          note?: string | null
          note_th?: string | null
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_firm_credentials_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_firm_documents: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string
          doc_type: string | null
          file_path: string
          firm_id: string
          id: string
          name: string
          valid_until: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          doc_type?: string | null
          file_path: string
          firm_id: string
          id?: string
          name: string
          valid_until?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          doc_type?: string | null
          file_path?: string
          firm_id?: string
          id?: string
          name?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_firm_documents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_firm_fees: {
        Row: {
          amount_thb: number | null
          fee: string
          fee_type: string
          firm_id: string
          own_words: string | null
          own_words_th: string | null
          pct_max: number | null
          pct_min: number | null
          service: string
        }
        Insert: {
          amount_thb?: number | null
          fee: string
          fee_type?: string
          firm_id: string
          own_words?: string | null
          own_words_th?: string | null
          pct_max?: number | null
          pct_min?: number | null
          service: string
        }
        Update: {
          amount_thb?: number | null
          fee?: string
          fee_type?: string
          firm_id?: string
          own_words?: string | null
          own_words_th?: string | null
          pct_max?: number | null
          pct_min?: number | null
          service?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_firm_fees_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_firm_reviews: {
        Row: {
          client_detail: string | null
          client_role: string
          client_user_id: string | null
          comment: string | null
          created_at: string
          enquiry_id: string | null
          firm_id: string
          id: string
          service: string | null
          stars: number
        }
        Insert: {
          client_detail?: string | null
          client_role: string
          client_user_id?: string | null
          comment?: string | null
          created_at?: string
          enquiry_id?: string | null
          firm_id: string
          id?: string
          service?: string | null
          stars: number
        }
        Update: {
          client_detail?: string | null
          client_role?: string
          client_user_id?: string | null
          comment?: string | null
          created_at?: string
          enquiry_id?: string | null
          firm_id?: string
          id?: string
          service?: string | null
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "advisor_firm_reviews_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "advisor_enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_firm_reviews_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_firm_team: {
        Row: {
          email: string | null
          firm_id: string
          id: string
          name: string
          role: string | null
          role_th: string | null
          sort_order: number
        }
        Insert: {
          email?: string | null
          firm_id: string
          id?: string
          name: string
          role?: string | null
          role_th?: string | null
          sort_order?: number
        }
        Update: {
          email?: string | null
          firm_id?: string
          id?: string
          name?: string
          role?: string | null
          role_th?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "advisor_firm_team_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_firms: {
        Row: {
          addr_district: string | null
          addr_postal: string | null
          addr_province: string | null
          addr_street: string | null
          addr_subdistrict: string | null
          addr_unit: string | null
          advisor_verification: string
          assigned_admin_id: string | null
          city: string | null
          country: string | null
          created_at: string
          dbd_capital: number | null
          dbd_checked_at: string | null
          dbd_name: string | null
          dbd_registered_on: string | null
          dbd_status: string | null
          deal_max_usd_m: number | null
          deal_min_usd_m: number | null
          deal_size_band: string | null
          decline_note: string | null
          decline_reason: string | null
          declined_at: string | null
          declined_by: string | null
          description: string | null
          description_th: string | null
          email: string | null
          firm_type: string
          id: string
          languages: string[]
          legal_name: string | null
          live_since: string | null
          logo_path: string | null
          logo_source: string | null
          media: Json
          more_info_at: string | null
          more_info_by: string | null
          more_info_fields: string[]
          more_info_note: string | null
          name: string
          owner_relation: string | null
          owner_user_id: string | null
          phone: string | null
          prepared_at: string | null
          prepared_by: string | null
          published_headline: string | null
          published_listing_name: string | null
          ref_no: string
          registration_no: string | null
          review_checklist: string[]
          run_by: Database["public"]["Enums"]["profile_run_by"]
          sector_agnostic: boolean
          sector_picks: Json | null
          sectors: string[]
          services: string[]
          setup_answered: string[]
          setup_done_at: string | null
          setup_reached: string | null
          status: string
          suggested_headline: string | null
          suggested_listing_name: string | null
          team_size: number | null
          thai_name: string | null
          updated_at: string
          verification_reason: string | null
          verification_requested_at: string | null
          verified_at: string | null
          verified_by: string | null
          verified_snapshot: Json | null
          website: string | null
          wizard_state: Json
          year_founded: number | null
        }
        Insert: {
          addr_district?: string | null
          addr_postal?: string | null
          addr_province?: string | null
          addr_street?: string | null
          addr_subdistrict?: string | null
          addr_unit?: string | null
          advisor_verification?: string
          assigned_admin_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          dbd_capital?: number | null
          dbd_checked_at?: string | null
          dbd_name?: string | null
          dbd_registered_on?: string | null
          dbd_status?: string | null
          deal_max_usd_m?: number | null
          deal_min_usd_m?: number | null
          deal_size_band?: string | null
          decline_note?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          declined_by?: string | null
          description?: string | null
          description_th?: string | null
          email?: string | null
          firm_type?: string
          id?: string
          languages?: string[]
          legal_name?: string | null
          live_since?: string | null
          logo_path?: string | null
          logo_source?: string | null
          media?: Json
          more_info_at?: string | null
          more_info_by?: string | null
          more_info_fields?: string[]
          more_info_note?: string | null
          name?: string
          owner_relation?: string | null
          owner_user_id?: string | null
          phone?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          published_headline?: string | null
          published_listing_name?: string | null
          ref_no?: string
          registration_no?: string | null
          review_checklist?: string[]
          run_by?: Database["public"]["Enums"]["profile_run_by"]
          sector_agnostic?: boolean
          sector_picks?: Json | null
          sectors?: string[]
          services?: string[]
          setup_answered?: string[]
          setup_done_at?: string | null
          setup_reached?: string | null
          status?: string
          suggested_headline?: string | null
          suggested_listing_name?: string | null
          team_size?: number | null
          thai_name?: string | null
          updated_at?: string
          verification_reason?: string | null
          verification_requested_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_snapshot?: Json | null
          website?: string | null
          wizard_state?: Json
          year_founded?: number | null
        }
        Update: {
          addr_district?: string | null
          addr_postal?: string | null
          addr_province?: string | null
          addr_street?: string | null
          addr_subdistrict?: string | null
          addr_unit?: string | null
          advisor_verification?: string
          assigned_admin_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          dbd_capital?: number | null
          dbd_checked_at?: string | null
          dbd_name?: string | null
          dbd_registered_on?: string | null
          dbd_status?: string | null
          deal_max_usd_m?: number | null
          deal_min_usd_m?: number | null
          deal_size_band?: string | null
          decline_note?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          declined_by?: string | null
          description?: string | null
          description_th?: string | null
          email?: string | null
          firm_type?: string
          id?: string
          languages?: string[]
          legal_name?: string | null
          live_since?: string | null
          logo_path?: string | null
          logo_source?: string | null
          media?: Json
          more_info_at?: string | null
          more_info_by?: string | null
          more_info_fields?: string[]
          more_info_note?: string | null
          name?: string
          owner_relation?: string | null
          owner_user_id?: string | null
          phone?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          published_headline?: string | null
          published_listing_name?: string | null
          ref_no?: string
          registration_no?: string | null
          review_checklist?: string[]
          run_by?: Database["public"]["Enums"]["profile_run_by"]
          sector_agnostic?: boolean
          sector_picks?: Json | null
          sectors?: string[]
          services?: string[]
          setup_answered?: string[]
          setup_done_at?: string | null
          setup_reached?: string | null
          status?: string
          suggested_headline?: string | null
          suggested_listing_name?: string | null
          team_size?: number | null
          thai_name?: string | null
          updated_at?: string
          verification_reason?: string | null
          verification_requested_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          verified_snapshot?: Json | null
          website?: string | null
          wizard_state?: Json
          year_founded?: number | null
        }
        Relationships: []
      }
      advisor_invitations: {
        Row: {
          answered_at: string | null
          answered_by: string | null
          client_org_id: string | null
          deal_id: string
          firm_profile_id: string
          id: string
          invited_at: string
          invited_by: string
          side: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          answered_by?: string | null
          client_org_id?: string | null
          deal_id: string
          firm_profile_id: string
          id?: string
          invited_at?: string
          invited_by: string
          side: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          answered_by?: string | null
          client_org_id?: string | null
          deal_id?: string
          firm_profile_id?: string
          id?: string
          invited_at?: string
          invited_by?: string
          side?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_invitations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_invitations_firm_profile_id_fkey"
            columns: ["firm_profile_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_ndas: {
        Row: {
          buyer_org_id: string | null
          client_side: string
          consent_text: string
          deal_id: string
          expires_at: string
          firm_profile_id: string
          id: string
          nda_text: string
          pdf_path: string | null
          seller_org_id: string | null
          signed_at: string
          signed_by: string
          signer_name: string | null
          signer_title: string | null
        }
        Insert: {
          buyer_org_id?: string | null
          client_side: string
          consent_text: string
          deal_id: string
          expires_at: string
          firm_profile_id: string
          id?: string
          nda_text: string
          pdf_path?: string | null
          seller_org_id?: string | null
          signed_at?: string
          signed_by: string
          signer_name?: string | null
          signer_title?: string | null
        }
        Update: {
          buyer_org_id?: string | null
          client_side?: string
          consent_text?: string
          deal_id?: string
          expires_at?: string
          firm_profile_id?: string
          id?: string
          nda_text?: string
          pdf_path?: string | null
          seller_org_id?: string | null
          signed_at?: string
          signed_by?: string
          signer_name?: string | null
          signer_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_ndas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_ndas_firm_profile_id_fkey"
            columns: ["firm_profile_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_proposals: {
        Row: {
          amount_thb: number | null
          answered_at: string | null
          answered_by: string | null
          consent_text: string | null
          enquiry_id: string
          fee_text: string
          fee_type: string
          id: string
          letter_file: Json | null
          own_words: string | null
          pct_max: number | null
          pct_min: number | null
          scope: string
          sent_at: string
          sent_by: string
          service_key: string
          status: string
          timing: string | null
          valid_until: string
        }
        Insert: {
          amount_thb?: number | null
          answered_at?: string | null
          answered_by?: string | null
          consent_text?: string | null
          enquiry_id: string
          fee_text: string
          fee_type: string
          id?: string
          letter_file?: Json | null
          own_words?: string | null
          pct_max?: number | null
          pct_min?: number | null
          scope: string
          sent_at?: string
          sent_by: string
          service_key: string
          status?: string
          timing?: string | null
          valid_until: string
        }
        Update: {
          amount_thb?: number | null
          answered_at?: string | null
          answered_by?: string | null
          consent_text?: string | null
          enquiry_id?: string
          fee_text?: string
          fee_type?: string
          id?: string
          letter_file?: Json | null
          own_words?: string | null
          pct_max?: number | null
          pct_min?: number | null
          scope?: string
          sent_at?: string
          sent_by?: string
          service_key?: string
          status?: string
          timing?: string | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_proposals_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "advisor_enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      analyst_statement_edits: {
        Row: {
          created_at: string
          edited_amount: number | null
          edited_by: string | null
          fiscal_year: number
          id: string
          item_code: string
          note: string | null
          original_amount: number | null
          registration_number: string
          statement: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          edited_amount?: number | null
          edited_by?: string | null
          fiscal_year: number
          id?: string
          item_code: string
          note?: string | null
          original_amount?: number | null
          registration_number: string
          statement: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          edited_amount?: number | null
          edited_by?: string | null
          fiscal_year?: number
          id?: string
          item_code?: string
          note?: string | null
          original_amount?: number | null
          registration_number?: string
          statement?: string
          updated_at?: string
        }
        Relationships: []
      }
      approval_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          dbd_retrieved_at: string | null
          dbd_source: string | null
          fields: string[]
          id: string
          item_id: string
          item_type: string
          note: string | null
          reasons: string[]
          startup_id: string | null
          subject_user_id: string | null
          version: number | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          dbd_retrieved_at?: string | null
          dbd_source?: string | null
          fields?: string[]
          id?: string
          item_id: string
          item_type: string
          note?: string | null
          reasons?: string[]
          startup_id?: string | null
          subject_user_id?: string | null
          version?: number | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          dbd_retrieved_at?: string | null
          dbd_source?: string | null
          fields?: string[]
          id?: string
          item_id?: string
          item_type?: string
          note?: string | null
          reasons?: string[]
          startup_id?: string | null
          subject_user_id?: string | null
          version?: number | null
        }
        Relationships: []
      }
      approval_notices: {
        Row: {
          banner_step: string | null
          created_at: string
          decided_at: string | null
          item_id: string
          item_type: string
          popup_seen_at: string | null
          red_open: boolean
          updated_at: string
          user_id: string
          yellow_folded: boolean
        }
        Insert: {
          banner_step?: string | null
          created_at?: string
          decided_at?: string | null
          item_id: string
          item_type: string
          popup_seen_at?: string | null
          red_open?: boolean
          updated_at?: string
          user_id: string
          yellow_folded?: boolean
        }
        Update: {
          banner_step?: string | null
          created_at?: string
          decided_at?: string | null
          item_id?: string
          item_type?: string
          popup_seen_at?: string | null
          red_open?: boolean
          updated_at?: string
          user_id?: string
          yellow_folded?: boolean
        }
        Relationships: []
      }
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
      buy_order_applications: {
        Row: {
          applied_at: string
          business_id: string
          buy_order_id: string
          decided_at: string | null
          decided_by_user_id: string | null
          id: string
          nda_request_id: string | null
          note: string | null
          seller_user_id: string
          status: string
        }
        Insert: {
          applied_at?: string
          business_id: string
          buy_order_id: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          nda_request_id?: string | null
          note?: string | null
          seller_user_id: string
          status?: string
        }
        Update: {
          applied_at?: string
          business_id?: string
          buy_order_id?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          nda_request_id?: string | null
          note?: string | null
          seller_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_order_applications_buy_order_id_fkey"
            columns: ["buy_order_id"]
            isOneToOne: false
            referencedRelation: "buy_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_order_views: {
        Row: {
          buy_order_id: string
          first_viewed_at: string
          user_id: string
        }
        Insert: {
          buy_order_id: string
          first_viewed_at?: string
          user_id: string
        }
        Update: {
          buy_order_id?: string
          first_viewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_order_views_buy_order_id_fkey"
            columns: ["buy_order_id"]
            isOneToOne: false
            referencedRelation: "buy_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_orders: {
        Row: {
          admin_note: string | null
          cities: string
          closed_at: string | null
          closes_on: string | null
          cover_image_name: string | null
          cover_image_path: string | null
          cover_sector_image_id: string | null
          cover_uploaded_at: string | null
          cover_uploaded_by: string | null
          created_at: string
          deal_types: string[]
          description: string
          description_th: string | null
          extended_count: number
          factory_size: string
          id: string
          investor_profile_id: string
          kind: string
          location: string
          must_have: string[]
          must_have_th: string[]
          name_on_card: string
          name_on_card_th: string | null
          nice_to_have: string[]
          nice_to_have_th: string[]
          period_months: number
          posted_at: string | null
          posted_by_user_id: string | null
          price_range: string
          products: string | null
          products_th: string | null
          profit: string | null
          property_size: string
          ref: string
          sector: string
          sent_back_at: string | null
          sent_to_admin_at: string | null
          status: string
          target_revenue: string
          text_lang: string
          timing: string | null
          timing_th: string | null
          updated_at: string
          written_by_user_id: string
        }
        Insert: {
          admin_note?: string | null
          cities?: string
          closed_at?: string | null
          closes_on?: string | null
          cover_image_name?: string | null
          cover_image_path?: string | null
          cover_sector_image_id?: string | null
          cover_uploaded_at?: string | null
          cover_uploaded_by?: string | null
          created_at?: string
          deal_types?: string[]
          description: string
          description_th?: string | null
          extended_count?: number
          factory_size?: string
          id?: string
          investor_profile_id: string
          kind: string
          location: string
          must_have?: string[]
          must_have_th?: string[]
          name_on_card: string
          name_on_card_th?: string | null
          nice_to_have?: string[]
          nice_to_have_th?: string[]
          period_months?: number
          posted_at?: string | null
          posted_by_user_id?: string | null
          price_range: string
          products?: string | null
          products_th?: string | null
          profit?: string | null
          property_size?: string
          ref?: string
          sector: string
          sent_back_at?: string | null
          sent_to_admin_at?: string | null
          status?: string
          target_revenue: string
          text_lang?: string
          timing?: string | null
          timing_th?: string | null
          updated_at?: string
          written_by_user_id: string
        }
        Update: {
          admin_note?: string | null
          cities?: string
          closed_at?: string | null
          closes_on?: string | null
          cover_image_name?: string | null
          cover_image_path?: string | null
          cover_sector_image_id?: string | null
          cover_uploaded_at?: string | null
          cover_uploaded_by?: string | null
          created_at?: string
          deal_types?: string[]
          description?: string
          description_th?: string | null
          extended_count?: number
          factory_size?: string
          id?: string
          investor_profile_id?: string
          kind?: string
          location?: string
          must_have?: string[]
          must_have_th?: string[]
          name_on_card?: string
          name_on_card_th?: string | null
          nice_to_have?: string[]
          nice_to_have_th?: string[]
          period_months?: number
          posted_at?: string | null
          posted_by_user_id?: string | null
          price_range?: string
          products?: string | null
          products_th?: string | null
          profit?: string | null
          property_size?: string
          ref?: string
          sector?: string
          sent_back_at?: string | null
          sent_to_admin_at?: string | null
          status?: string
          target_revenue?: string
          text_lang?: string
          timing?: string | null
          timing_th?: string | null
          updated_at?: string
          written_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_orders_cover_sector_image_id_fkey"
            columns: ["cover_sector_image_id"]
            isOneToOne: false
            referencedRelation: "sector_images"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_profiles: {
        Row: {
          address: string | null
          approval_status: string
          aum_exact: string | null
          aum_value: number | null
          buyer_relation: string | null
          city: string | null
          code_name: string
          contact_number: string | null
          country: string | null
          created_at: string
          deal_types: string[]
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          decision_process: string | null
          decision_reasons: string[]
          description: string | null
          description_th: string | null
          geography: string | null
          headline: string | null
          investor_id: string | null
          legal_name: string | null
          live_since: string | null
          logo_url: string | null
          people: Json
          pof_path: string | null
          pof_verified_at: string | null
          portfolio: Json
          private_description: string | null
          profile_views_month: number
          published_headline: string | null
          published_listing_name: string | null
          ref_no: string
          revenue_band: string | null
          sectors: string[]
          show_name: boolean
          stages: string[]
          status: string
          submitted_at: string | null
          suggested_headline: string | null
          suggested_listing_name: string | null
          target_size: string | null
          ticket_exact: string | null
          ticket_max: number | null
          ticket_min: number | null
          track_record: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          approval_status?: string
          aum_exact?: string | null
          aum_value?: number | null
          buyer_relation?: string | null
          city?: string | null
          code_name: string
          contact_number?: string | null
          country?: string | null
          created_at?: string
          deal_types?: string[]
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          decision_process?: string | null
          decision_reasons?: string[]
          description?: string | null
          description_th?: string | null
          geography?: string | null
          headline?: string | null
          investor_id?: string | null
          legal_name?: string | null
          live_since?: string | null
          logo_url?: string | null
          people?: Json
          pof_path?: string | null
          pof_verified_at?: string | null
          portfolio?: Json
          private_description?: string | null
          profile_views_month?: number
          published_headline?: string | null
          published_listing_name?: string | null
          ref_no?: string
          revenue_band?: string | null
          sectors?: string[]
          show_name?: boolean
          stages?: string[]
          status?: string
          submitted_at?: string | null
          suggested_headline?: string | null
          suggested_listing_name?: string | null
          target_size?: string | null
          ticket_exact?: string | null
          ticket_max?: number | null
          ticket_min?: number | null
          track_record?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          approval_status?: string
          aum_exact?: string | null
          aum_value?: number | null
          buyer_relation?: string | null
          city?: string | null
          code_name?: string
          contact_number?: string | null
          country?: string | null
          created_at?: string
          deal_types?: string[]
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          decision_process?: string | null
          decision_reasons?: string[]
          description?: string | null
          description_th?: string | null
          geography?: string | null
          headline?: string | null
          investor_id?: string | null
          legal_name?: string | null
          live_since?: string | null
          logo_url?: string | null
          people?: Json
          pof_path?: string | null
          pof_verified_at?: string | null
          portfolio?: Json
          private_description?: string | null
          profile_views_month?: number
          published_headline?: string | null
          published_listing_name?: string | null
          ref_no?: string
          revenue_band?: string | null
          sectors?: string[]
          show_name?: boolean
          stages?: string[]
          status?: string
          submitted_at?: string | null
          suggested_headline?: string | null
          suggested_listing_name?: string | null
          target_size?: string | null
          ticket_exact?: string | null
          ticket_max?: number | null
          ticket_min?: number | null
          track_record?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_profiles_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_report_access: {
        Row: {
          buyer_id: string
          company_id: string
          id: string
          last_opened_at: string | null
          opened_at: string
          order_id: string | null
          pipeline_id: string
          report_key: string
          via: string
        }
        Insert: {
          buyer_id: string
          company_id: string
          id?: string
          last_opened_at?: string | null
          opened_at?: string
          order_id?: string | null
          pipeline_id: string
          report_key: string
          via: string
        }
        Update: {
          buyer_id?: string
          company_id?: string
          id?: string
          last_opened_at?: string | null
          opened_at?: string
          order_id?: string | null
          pipeline_id?: string
          report_key?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_report_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_report_access_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "report_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_report_access_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_verifications: {
        Row: {
          assignee_id: string | null
          buyer_type: string | null
          company_name: string
          decided_at: string | null
          decision_note: string | null
          documents: string[]
          email_domain_match: boolean | null
          id: string
          linkedin: string | null
          registration_no: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
          website: string | null
          work_email: string
        }
        Insert: {
          assignee_id?: string | null
          buyer_type?: string | null
          company_name: string
          decided_at?: string | null
          decision_note?: string | null
          documents?: string[]
          email_domain_match?: boolean | null
          id?: string
          linkedin?: string | null
          registration_no?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
          website?: string | null
          work_email: string
        }
        Update: {
          assignee_id?: string | null
          buyer_type?: string | null
          company_name?: string
          decided_at?: string | null
          decision_note?: string | null
          documents?: string[]
          email_domain_match?: boolean | null
          id?: string
          linkedin?: string | null
          registration_no?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
          website?: string | null
          work_email?: string
        }
        Relationships: []
      }
      cash_flow_items: {
        Row: {
          amount: number | null
          created_at: string
          display_order: number
          financial_statement_id: string
          fiscal_year: number
          id: string
          is_total: boolean
          item_code: string
          item_label: string
          percent_change: number | null
          section: string
          source_reference: string | null
          startup_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          display_order?: number
          financial_statement_id: string
          fiscal_year: number
          id?: string
          is_total?: boolean
          item_code: string
          item_label: string
          percent_change?: number | null
          section: string
          source_reference?: string | null
          startup_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          display_order?: number
          financial_statement_id?: string
          fiscal_year?: number
          id?: string
          is_total?: boolean
          item_code?: string
          item_label?: string
          percent_change?: number | null
          section?: string
          source_reference?: string | null
          startup_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_items_financial_statement_id_fkey"
            columns: ["financial_statement_id"]
            isOneToOne: false
            referencedRelation: "financial_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_flow_items_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      company_director_th: {
        Row: {
          company_info_id: string
          created_at: string
          director_name_th: string
          display_order: number
          id: string
          is_active: boolean
          startup_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_info_id: string
          created_at?: string
          director_name_th: string
          display_order?: number
          id?: string
          is_active?: boolean
          startup_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_info_id?: string
          created_at?: string
          director_name_th?: string
          display_order?: number
          id?: string
          is_active?: boolean
          startup_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_director_th_company_info_id_fkey"
            columns: ["company_info_id"]
            isOneToOne: false
            referencedRelation: "company_info_th"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_director_th_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      company_financial_submission_year_th: {
        Row: {
          company_info_id: string
          created_at: string
          financial_year_be: number
          financial_year_ce: number | null
          id: string
          is_latest: boolean
          startup_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_info_id: string
          created_at?: string
          financial_year_be: number
          financial_year_ce?: number | null
          id?: string
          is_latest?: boolean
          startup_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_info_id?: string
          created_at?: string
          financial_year_be?: number
          financial_year_ce?: number | null
          id?: string
          is_latest?: boolean
          startup_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_financial_submission_year_th_company_info_id_fkey"
            columns: ["company_info_id"]
            isOneToOne: false
            referencedRelation: "company_info_th"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_financial_submission_year_th_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      company_info_th: {
        Row: {
          authorized_signatory_th: string | null
          business_group_th: string | null
          business_size: string | null
          created_at: string
          head_office_address_th: string | null
          id: string
          legal_entity_status_th: string | null
          legal_entity_type_th: string | null
          legal_name_en: string | null
          legal_name_th: string | null
          manually_edited_at: string | null
          manually_edited_by: string | null
          previous_registration_number: string | null
          registered_capital_th_raw: string | null
          registered_capital_thb: number | null
          registration_date: string | null
          registration_date_th_raw: string | null
          registration_number: string | null
          retrieved_at: string | null
          source_name: string | null
          source_url: string | null
          startup_id: string
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          authorized_signatory_th?: string | null
          business_group_th?: string | null
          business_size?: string | null
          created_at?: string
          head_office_address_th?: string | null
          id?: string
          legal_entity_status_th?: string | null
          legal_entity_type_th?: string | null
          legal_name_en?: string | null
          legal_name_th?: string | null
          manually_edited_at?: string | null
          manually_edited_by?: string | null
          previous_registration_number?: string | null
          registered_capital_th_raw?: string | null
          registered_capital_thb?: number | null
          registration_date?: string | null
          registration_date_th_raw?: string | null
          registration_number?: string | null
          retrieved_at?: string | null
          source_name?: string | null
          source_url?: string | null
          startup_id: string
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          authorized_signatory_th?: string | null
          business_group_th?: string | null
          business_size?: string | null
          created_at?: string
          head_office_address_th?: string | null
          id?: string
          legal_entity_status_th?: string | null
          legal_entity_type_th?: string | null
          legal_name_en?: string | null
          legal_name_th?: string | null
          manually_edited_at?: string | null
          manually_edited_by?: string | null
          previous_registration_number?: string | null
          registered_capital_th_raw?: string | null
          registered_capital_thb?: number | null
          registration_date?: string | null
          registration_date_th_raw?: string | null
          registration_number?: string | null
          retrieved_at?: string | null
          source_name?: string | null
          source_url?: string | null
          startup_id?: string
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_info_th_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      company_latest_business_th: {
        Row: {
          business_code: string | null
          business_description_th: string | null
          business_objective_th: string | null
          company_info_id: string
          created_at: string
          financial_year_be: number | null
          id: string
          startup_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          business_code?: string | null
          business_description_th?: string | null
          business_objective_th?: string | null
          company_info_id: string
          created_at?: string
          financial_year_be?: number | null
          id?: string
          startup_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          business_code?: string | null
          business_description_th?: string | null
          business_objective_th?: string | null
          company_info_id?: string
          created_at?: string
          financial_year_be?: number | null
          id?: string
          startup_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_latest_business_th_company_info_id_fkey"
            columns: ["company_info_id"]
            isOneToOne: true
            referencedRelation: "company_info_th"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_latest_business_th_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      company_registered_business_th: {
        Row: {
          business_code: string | null
          business_description_th: string | null
          business_objective_th: string | null
          company_info_id: string
          created_at: string
          id: string
          startup_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          business_code?: string | null
          business_description_th?: string | null
          business_objective_th?: string | null
          company_info_id: string
          created_at?: string
          id?: string
          startup_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          business_code?: string | null
          business_description_th?: string | null
          business_objective_th?: string | null
          company_info_id?: string
          created_at?: string
          id?: string
          startup_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_registered_business_th_company_info_id_fkey"
            columns: ["company_info_id"]
            isOneToOne: true
            referencedRelation: "company_info_th"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_registered_business_th_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      company_report_records: {
        Row: {
          authorised_at: string | null
          authorised_by: string | null
          checked_on: string | null
          company_id: string
          content: Json | null
          created_at: string
          generated_at: string | null
          id: string
          ready_by: string | null
          report_key: string
          source_filed_on: string | null
          status: string
        }
        Insert: {
          authorised_at?: string | null
          authorised_by?: string | null
          checked_on?: string | null
          company_id: string
          content?: Json | null
          created_at?: string
          generated_at?: string | null
          id?: string
          ready_by?: string | null
          report_key: string
          source_filed_on?: string | null
          status?: string
        }
        Update: {
          authorised_at?: string | null
          authorised_by?: string | null
          checked_on?: string | null
          company_id?: string
          content?: Json | null
          created_at?: string
          generated_at?: string | null
          id?: string
          ready_by?: string | null
          report_key?: string
          source_filed_on?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_report_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      company_verification_checks: {
        Row: {
          id: string
          key: number
          recorded_at: string
          result: string
          source_label: string | null
          values: Json
          verification_id: string
        }
        Insert: {
          id?: string
          key: number
          recorded_at?: string
          result: string
          source_label?: string | null
          values?: Json
          verification_id: string
        }
        Update: {
          id?: string
          key?: number
          recorded_at?: string
          result?: string
          source_label?: string | null
          values?: Json
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_verification_checks_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "company_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      company_verifications: {
        Row: {
          affidavit_issued_on: string | null
          checked_at: string | null
          company_id: string
          created_at: string
          id: string
          included: boolean
          order_id: string | null
          ready_by: string | null
          record_details: Json
          requested_by: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          affidavit_issued_on?: string | null
          checked_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          included?: boolean
          order_id?: string | null
          ready_by?: string | null
          record_details?: Json
          requested_by?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          affidavit_issued_on?: string | null
          checked_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          included?: boolean
          order_id?: string | null
          ready_by?: string | null
          record_details?: Json
          requested_by?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_verifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_enquiries: {
        Row: {
          company: string | null
          consent_at: string
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          language: string
          message: string
          name: string
          phone: string | null
          reference: string
          role: string
          status: string
          topic: string
          user_id: string | null
        }
        Insert: {
          company?: string | null
          consent_at: string
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          language?: string
          message: string
          name: string
          phone?: string | null
          reference: string
          role: string
          status?: string
          topic: string
          user_id?: string | null
        }
        Update: {
          company?: string | null
          consent_at?: string
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          language?: string
          message?: string
          name?: string
          phone?: string | null
          reference?: string
          role?: string
          status?: string
          topic?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          hidden_profile_id: string
          id: string
          investor_id: string
          investor_user_id: string | null
          pipeline_id: string | null
          seller_user_id: string
          startup_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          hidden_profile_id: string
          id?: string
          investor_id: string
          investor_user_id?: string | null
          pipeline_id?: string | null
          seller_user_id: string
          startup_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          hidden_profile_id?: string
          id?: string
          investor_id?: string
          investor_user_id?: string | null
          pipeline_id?: string | null
          seller_user_id?: string
          startup_id?: string
          status?: string
        }
        Relationships: []
      }
      dbd_company_records: {
        Row: {
          created_at: string
          data: Json
          entered_by_name: string | null
          raw_payload: Json | null
          registration_number: string
          retrieved_at: string
          retrieved_by: string | null
          source: string
          source_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          entered_by_name?: string | null
          raw_payload?: Json | null
          registration_number: string
          retrieved_at?: string
          retrieved_by?: string | null
          source?: string
          source_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          entered_by_name?: string | null
          raw_payload?: Json | null
          registration_number?: string
          retrieved_at?: string
          retrieved_by?: string | null
          source?: string
          source_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dbd_fetch_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          error: string | null
          id: string
          new_retrieved_at: string | null
          note: string | null
          old_retrieved_at: string | null
          registration_number: string
          result: string
          source: string | null
          startup_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          new_retrieved_at?: string | null
          note?: string | null
          old_retrieved_at?: string | null
          registration_number: string
          result: string
          source?: string | null
          startup_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          new_retrieved_at?: string | null
          note?: string | null
          old_retrieved_at?: string | null
          registration_number?: string
          result?: string
          source?: string | null
          startup_id?: string | null
        }
        Relationships: []
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
      deal_advisors: {
        Row: {
          advisor_nda_id: string | null
          advisor_user_id: string
          deal_id: string
          firm_profile_id: string
          id: string
          invitation_id: string | null
          joined_at: string
          side: string
        }
        Insert: {
          advisor_nda_id?: string | null
          advisor_user_id: string
          deal_id: string
          firm_profile_id: string
          id?: string
          invitation_id?: string | null
          joined_at?: string
          side: string
        }
        Update: {
          advisor_nda_id?: string | null
          advisor_user_id?: string
          deal_id?: string
          firm_profile_id?: string
          id?: string
          invitation_id?: string | null
          joined_at?: string
          side?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_advisors_advisor_nda_id_fkey"
            columns: ["advisor_nda_id"]
            isOneToOne: false
            referencedRelation: "advisor_ndas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_advisors_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_advisors_firm_profile_id_fkey"
            columns: ["firm_profile_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_advisors_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "advisor_invitations"
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
      deal_pipeline_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          id: string
          note: string | null
          pipeline_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          id?: string
          note?: string | null
          pipeline_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          id?: string
          note?: string | null
          pipeline_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_pipeline_events_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_pipelines: {
        Row: {
          buyer_approval_seen_at: string | null
          buyer_message: string | null
          buyer_user_id: string
          contact_at: string | null
          created_at: string
          ended_at: string | null
          ended_at_step: number | null
          ended_by_side: string | null
          exclusivity_until: string | null
          hidden_profile_id: string
          id: string
          legal_at: string | null
          loi_accepted_at: string | null
          loi_accepted_by: string | null
          loi_amount: number | null
          loi_changes_requested_at: string | null
          loi_conditions: string | null
          loi_consent_text: string | null
          loi_exclusivity_days: number | null
          loi_request_days: number | null
          loi_request_note: string | null
          loi_request_price: number | null
          loi_request_respond_by: string | null
          loi_requested_at: string | null
          loi_requested_by: string | null
          loi_sent_at: string | null
          loi_stake_pct: number | null
          nda_approved_at: string | null
          nda_expires_at: string | null
          nda_requested_at: string
          payment_at: string | null
          report_allow_download: boolean
          report_requested_at: string | null
          report_shared_at: string | null
          report_viewed_at: string | null
          spa_at: string | null
          startup_id: string
          status: string
          updated_at: string
          wait_kind: string
          wait_task: string | null
        }
        Insert: {
          buyer_approval_seen_at?: string | null
          buyer_message?: string | null
          buyer_user_id: string
          contact_at?: string | null
          created_at?: string
          ended_at?: string | null
          ended_at_step?: number | null
          ended_by_side?: string | null
          exclusivity_until?: string | null
          hidden_profile_id: string
          id?: string
          legal_at?: string | null
          loi_accepted_at?: string | null
          loi_accepted_by?: string | null
          loi_amount?: number | null
          loi_changes_requested_at?: string | null
          loi_conditions?: string | null
          loi_consent_text?: string | null
          loi_exclusivity_days?: number | null
          loi_request_days?: number | null
          loi_request_note?: string | null
          loi_request_price?: number | null
          loi_request_respond_by?: string | null
          loi_requested_at?: string | null
          loi_requested_by?: string | null
          loi_sent_at?: string | null
          loi_stake_pct?: number | null
          nda_approved_at?: string | null
          nda_expires_at?: string | null
          nda_requested_at?: string
          payment_at?: string | null
          report_allow_download?: boolean
          report_requested_at?: string | null
          report_shared_at?: string | null
          report_viewed_at?: string | null
          spa_at?: string | null
          startup_id: string
          status?: string
          updated_at?: string
          wait_kind?: string
          wait_task?: string | null
        }
        Update: {
          buyer_approval_seen_at?: string | null
          buyer_message?: string | null
          buyer_user_id?: string
          contact_at?: string | null
          created_at?: string
          ended_at?: string | null
          ended_at_step?: number | null
          ended_by_side?: string | null
          exclusivity_until?: string | null
          hidden_profile_id?: string
          id?: string
          legal_at?: string | null
          loi_accepted_at?: string | null
          loi_accepted_by?: string | null
          loi_amount?: number | null
          loi_changes_requested_at?: string | null
          loi_conditions?: string | null
          loi_consent_text?: string | null
          loi_exclusivity_days?: number | null
          loi_request_days?: number | null
          loi_request_note?: string | null
          loi_request_price?: number | null
          loi_request_respond_by?: string | null
          loi_requested_at?: string | null
          loi_requested_by?: string | null
          loi_sent_at?: string | null
          loi_stake_pct?: number | null
          nda_approved_at?: string | null
          nda_expires_at?: string | null
          nda_requested_at?: string
          payment_at?: string | null
          report_allow_download?: boolean
          report_requested_at?: string | null
          report_shared_at?: string | null
          report_viewed_at?: string | null
          spa_at?: string | null
          startup_id?: string
          status?: string
          updated_at?: string
          wait_kind?: string
          wait_task?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_pipelines_hidden_profile_id_fkey"
            columns: ["hidden_profile_id"]
            isOneToOne: false
            referencedRelation: "hidden_profiles"
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
      deal_watchlist: {
        Row: {
          created_at: string
          deal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_watchlist_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_withdrawals: {
        Row: {
          comment: string | null
          deal_id: string
          feedback_sent: boolean
          id: string
          reason_code: string
          shared: boolean
          side: string
          step_at_withdrawal: number
          withdrawn_at: string
          withdrawn_by: string
        }
        Insert: {
          comment?: string | null
          deal_id: string
          feedback_sent?: boolean
          id?: string
          reason_code: string
          shared?: boolean
          side: string
          step_at_withdrawal: number
          withdrawn_at?: string
          withdrawn_by: string
        }
        Update: {
          comment?: string | null
          deal_id?: string
          feedback_sent?: boolean
          id?: string
          reason_code?: string
          shared?: boolean
          side?: string
          step_at_withdrawal?: number
          withdrawn_at?: string
          withdrawn_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_withdrawals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deal_pipelines"
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
      email_alert_log: {
        Row: {
          alert_key: string
          created_at: string
          email: string | null
          id: string
          reason: string | null
          ref_key: string | null
          role: string
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          alert_key: string
          created_at?: string
          email?: string | null
          id?: string
          reason?: string | null
          ref_key?: string | null
          role: string
          status: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          alert_key?: string
          created_at?: string
          email?: string | null
          id?: string
          reason?: string | null
          ref_key?: string | null
          role?: string
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_alert_rules: {
        Row: {
          daily_time: string
          id: number
          match_threshold: number
          message_mode: string
          quiet_enabled: boolean
          quiet_end: string
          quiet_start: string
          updated_at: string
          weekly_day: number
          weekly_time: string
        }
        Insert: {
          daily_time?: string
          id?: number
          match_threshold?: number
          message_mode?: string
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          updated_at?: string
          weekly_day?: number
          weekly_time?: string
        }
        Update: {
          daily_time?: string
          id?: number
          match_threshold?: number
          message_mode?: string
          quiet_enabled?: boolean
          quiet_end?: string
          quiet_start?: string
          updated_at?: string
          weekly_day?: number
          weekly_time?: string
        }
        Relationships: []
      }
      email_alert_settings: {
        Row: {
          alert_key: string
          enabled: boolean
          overrides: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_key: string
          enabled?: boolean
          overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_key?: string
          enabled?: boolean
          overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      financial_position_items: {
        Row: {
          amount: number | null
          created_at: string
          display_order: number
          financial_statement_id: string
          fiscal_year: number
          id: string
          is_total: boolean
          item_code: string
          item_label: string
          percent_change: number | null
          source_reference: string | null
          startup_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          display_order?: number
          financial_statement_id: string
          fiscal_year: number
          id?: string
          is_total?: boolean
          item_code: string
          item_label: string
          percent_change?: number | null
          source_reference?: string | null
          startup_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          display_order?: number
          financial_statement_id?: string
          fiscal_year?: number
          id?: string
          is_total?: boolean
          item_code?: string
          item_label?: string
          percent_change?: number | null
          source_reference?: string | null
          startup_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_position_items_financial_statement_id_fkey"
            columns: ["financial_statement_id"]
            isOneToOne: false
            referencedRelation: "financial_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_position_items_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ratios: {
        Row: {
          calculation_source: string | null
          created_at: string
          display_order: number
          financial_statement_id: string | null
          fiscal_year: number
          id: string
          ratio_category: string
          ratio_code: string
          ratio_label: string
          source_reference: string | null
          startup_id: string
          tenant_id: string
          unit: string
          updated_at: string
          value: number | null
        }
        Insert: {
          calculation_source?: string | null
          created_at?: string
          display_order?: number
          financial_statement_id?: string | null
          fiscal_year: number
          id?: string
          ratio_category: string
          ratio_code: string
          ratio_label: string
          source_reference?: string | null
          startup_id: string
          tenant_id: string
          unit?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          calculation_source?: string | null
          created_at?: string
          display_order?: number
          financial_statement_id?: string | null
          fiscal_year?: number
          id?: string
          ratio_category?: string
          ratio_code?: string
          ratio_label?: string
          source_reference?: string | null
          startup_id?: string
          tenant_id?: string
          unit?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_ratios_financial_statement_id_fkey"
            columns: ["financial_statement_id"]
            isOneToOne: false
            referencedRelation: "financial_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ratios_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_statements: {
        Row: {
          created_at: string
          currency: string
          fiscal_year: number
          id: string
          matched_registered_name: string | null
          matched_registered_number: string | null
          registration_number: string | null
          retrieved_at: string | null
          source_date: string | null
          source_name: string | null
          source_reference: string | null
          startup_id: string
          statement_basis: string | null
          tenant_id: string
          updated_at: string
          verified_status: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          fiscal_year: number
          id?: string
          matched_registered_name?: string | null
          matched_registered_number?: string | null
          registration_number?: string | null
          retrieved_at?: string | null
          source_date?: string | null
          source_name?: string | null
          source_reference?: string | null
          startup_id: string
          statement_basis?: string | null
          tenant_id: string
          updated_at?: string
          verified_status?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          fiscal_year?: number
          id?: string
          matched_registered_name?: string | null
          matched_registered_number?: string | null
          registration_number?: string | null
          retrieved_at?: string | null
          source_date?: string | null
          source_name?: string | null
          source_reference?: string | null
          startup_id?: string
          statement_basis?: string | null
          tenant_id?: string
          updated_at?: string
          verified_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_statements_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_profile_views: {
        Row: {
          day: string
          firm_profile_id: string
          user_id: string
        }
        Insert: {
          day?: string
          firm_profile_id: string
          user_id: string
        }
        Update: {
          day?: string
          firm_profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_profile_views_firm_profile_id_fkey"
            columns: ["firm_profile_id"]
            isOneToOne: false
            referencedRelation: "advisor_firms"
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
      help_thread_status: {
        Row: {
          done_at: string
          done_by: string
          thread_key: string
        }
        Insert: {
          done_at?: string
          done_by: string
          thread_key: string
        }
        Update: {
          done_at?: string
          done_by?: string
          thread_key?: string
        }
        Relationships: []
      }
      hidden_profiles: {
        Row: {
          approval_status: string
          asking_price: number | null
          asking_price_band: string | null
          asking_price_thb: number | null
          assignee_id: string | null
          code_name: string | null
          cover_art: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          customers_summary: string
          customers_summary_th: string | null
          deal_type: string | null
          decided_at: string | null
          decision_fields: string[]
          decision_note: string | null
          decision_reasons: string[]
          description: string
          description_th: string | null
          directory_category: string | null
          featured: boolean
          handover: string | null
          handover_months: number | null
          has_unpublished_changes: boolean
          headline: string
          headline_th: string | null
          highlights: string[]
          highlights_th: string[] | null
          id: string
          live: Json | null
          live_snapshot: Json | null
          market_tags: string[] | null
          nda_approver: string
          ndas_approved: number
          new_until: string | null
          notify_admin_edits: boolean
          open_to: string[]
          owner_stays: string | null
          pending_cover: string | null
          process: string | null
          product_tags: string[] | null
          public_image_id: string | null
          published_at: string | null
          published_by: string | null
          published_headline: string | null
          reason: string | null
          reason_th: string | null
          ref_no: string
          region: string | null
          review_checks: string[]
          stake_pct: number | null
          startup_id: string
          status: string
          structure: string | null
          submitted_at: string | null
          submitted_by: string | null
          suggested_headline: string | null
          suggested_listing_name: string | null
          tenant_id: string
          unpublished_at: string | null
          updated_at: string
          updated_by: string | null
          version: number
          views: number
        }
        Insert: {
          approval_status?: string
          asking_price?: number | null
          asking_price_band?: string | null
          asking_price_thb?: number | null
          assignee_id?: string | null
          code_name?: string | null
          cover_art?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          customers_summary?: string
          customers_summary_th?: string | null
          deal_type?: string | null
          decided_at?: string | null
          decision_fields?: string[]
          decision_note?: string | null
          decision_reasons?: string[]
          description?: string
          description_th?: string | null
          directory_category?: string | null
          featured?: boolean
          handover?: string | null
          handover_months?: number | null
          has_unpublished_changes?: boolean
          headline?: string
          headline_th?: string | null
          highlights?: string[]
          highlights_th?: string[] | null
          id?: string
          live?: Json | null
          live_snapshot?: Json | null
          market_tags?: string[] | null
          nda_approver?: string
          ndas_approved?: number
          new_until?: string | null
          notify_admin_edits?: boolean
          open_to?: string[]
          owner_stays?: string | null
          pending_cover?: string | null
          process?: string | null
          product_tags?: string[] | null
          public_image_id?: string | null
          published_at?: string | null
          published_by?: string | null
          published_headline?: string | null
          reason?: string | null
          reason_th?: string | null
          ref_no?: string
          region?: string | null
          review_checks?: string[]
          stake_pct?: number | null
          startup_id: string
          status?: string
          structure?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          suggested_headline?: string | null
          suggested_listing_name?: string | null
          tenant_id: string
          unpublished_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          views?: number
        }
        Update: {
          approval_status?: string
          asking_price?: number | null
          asking_price_band?: string | null
          asking_price_thb?: number | null
          assignee_id?: string | null
          code_name?: string | null
          cover_art?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          customers_summary?: string
          customers_summary_th?: string | null
          deal_type?: string | null
          decided_at?: string | null
          decision_fields?: string[]
          decision_note?: string | null
          decision_reasons?: string[]
          description?: string
          description_th?: string | null
          directory_category?: string | null
          featured?: boolean
          handover?: string | null
          handover_months?: number | null
          has_unpublished_changes?: boolean
          headline?: string
          headline_th?: string | null
          highlights?: string[]
          highlights_th?: string[] | null
          id?: string
          live?: Json | null
          live_snapshot?: Json | null
          market_tags?: string[] | null
          nda_approver?: string
          ndas_approved?: number
          new_until?: string | null
          notify_admin_edits?: boolean
          open_to?: string[]
          owner_stays?: string | null
          pending_cover?: string | null
          process?: string | null
          product_tags?: string[] | null
          public_image_id?: string | null
          published_at?: string | null
          published_by?: string | null
          published_headline?: string | null
          reason?: string | null
          reason_th?: string | null
          ref_no?: string
          region?: string | null
          review_checks?: string[]
          stake_pct?: number | null
          startup_id?: string
          status?: string
          structure?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          suggested_headline?: string | null
          suggested_listing_name?: string | null
          tenant_id?: string
          unpublished_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "hidden_profiles_public_image_id_fkey"
            columns: ["public_image_id"]
            isOneToOne: false
            referencedRelation: "sector_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_profiles_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      income_statement_items: {
        Row: {
          amount: number | null
          created_at: string
          display_order: number
          financial_statement_id: string
          fiscal_year: number
          id: string
          is_total: boolean
          item_code: string
          item_label: string
          percent_change: number | null
          source_reference: string | null
          startup_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          display_order?: number
          financial_statement_id: string
          fiscal_year: number
          id?: string
          is_total?: boolean
          item_code: string
          item_label: string
          percent_change?: number | null
          source_reference?: string | null
          startup_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          display_order?: number
          financial_statement_id?: string
          fiscal_year?: number
          id?: string
          is_total?: boolean
          item_code?: string
          item_label?: string
          percent_change?: number | null
          source_reference?: string | null
          startup_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_statement_items_financial_statement_id_fkey"
            columns: ["financial_statement_id"]
            isOneToOne: false
            referencedRelation: "financial_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_statement_items_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
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
      investor_images: {
        Row: {
          file_name: string
          height: number
          id: string
          size_bytes: number
          storage_path: string
          type_key: string
          uploaded_at: string
          uploaded_by: string | null
          width: number
        }
        Insert: {
          file_name: string
          height: number
          id?: string
          size_bytes: number
          storage_path: string
          type_key: string
          uploaded_at?: string
          uploaded_by?: string | null
          width: number
        }
        Update: {
          file_name?: string
          height?: number
          id?: string
          size_bytes?: number
          storage_path?: string
          type_key?: string
          uploaded_at?: string
          uploaded_by?: string | null
          width?: number
        }
        Relationships: []
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
      investor_profile_verifications: {
        Row: {
          assignee_id: string | null
          buyer_type: string | null
          company_name: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          decision_reasons: string[]
          documents: string[]
          email_domain_match: boolean | null
          id: string
          investor_id: string
          linkedin: string | null
          registration_no: string | null
          review_checks: string[]
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          website: string | null
          work_email: string | null
        }
        Insert: {
          assignee_id?: string | null
          buyer_type?: string | null
          company_name?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          decision_reasons?: string[]
          documents?: string[]
          email_domain_match?: boolean | null
          id?: string
          investor_id: string
          linkedin?: string | null
          registration_no?: string | null
          review_checks?: string[]
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          work_email?: string | null
        }
        Update: {
          assignee_id?: string | null
          buyer_type?: string | null
          company_name?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          decision_reasons?: string[]
          documents?: string[]
          email_domain_match?: boolean | null
          id?: string
          investor_id?: string
          linkedin?: string | null
          registration_no?: string | null
          review_checks?: string[]
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_profile_verifications_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investors"
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
          acts_for_types: string[]
          address_city_district: string | null
          address_line1: string | null
          address_line2: string | null
          address_province_state: string | null
          aum: string | null
          aum_band: string | null
          aum_exact_usd: number | null
          bio: string | null
          business_address: string | null
          company_size_band: string | null
          company_type: string | null
          company_type_source: string
          country: string | null
          created_at: string
          created_by: string | null
          deal_size_band: string | null
          email: string | null
          firm_name: string | null
          id: string
          imported_at: string | null
          investment_focus: string[] | null
          investor_name: string
          investor_type: string | null
          keywords: string[] | null
          keywords_th: string[] | null
          legal_name: string | null
          linkedin_url: string | null
          logo_url: string | null
          long_description: string | null
          long_description_th: string | null
          max_ticket_size: string | null
          media: Json
          min_ticket_size: string | null
          owner_relation: string | null
          postal_code: string | null
          preferred_industries: string[] | null
          preferred_stages: string[] | null
          prepared_at: string | null
          prepared_by: string | null
          registration_no: string | null
          revenue_max_m: number | null
          revenue_min_band: string | null
          revenue_min_m: number | null
          run_by: Database["public"]["Enums"]["profile_run_by"]
          sector_picks: Json | null
          setup_done_at: string | null
          setup_reached: string | null
          short_description: string | null
          short_description_th: string | null
          source_global_id: string | null
          status: string
          tenant_id: string
          ticket_band: string | null
          ticket_size: string | null
          updated_at: string
          updated_by: string | null
          visibility: string
          website_url: string | null
          wizard: Json
          year_founded: number | null
        }
        Insert: {
          acts_for_types?: string[]
          address_city_district?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_province_state?: string | null
          aum?: string | null
          aum_band?: string | null
          aum_exact_usd?: number | null
          bio?: string | null
          business_address?: string | null
          company_size_band?: string | null
          company_type?: string | null
          company_type_source?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deal_size_band?: string | null
          email?: string | null
          firm_name?: string | null
          id?: string
          imported_at?: string | null
          investment_focus?: string[] | null
          investor_name: string
          investor_type?: string | null
          keywords?: string[] | null
          keywords_th?: string[] | null
          legal_name?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          long_description?: string | null
          long_description_th?: string | null
          max_ticket_size?: string | null
          media?: Json
          min_ticket_size?: string | null
          owner_relation?: string | null
          postal_code?: string | null
          preferred_industries?: string[] | null
          preferred_stages?: string[] | null
          prepared_at?: string | null
          prepared_by?: string | null
          registration_no?: string | null
          revenue_max_m?: number | null
          revenue_min_band?: string | null
          revenue_min_m?: number | null
          run_by?: Database["public"]["Enums"]["profile_run_by"]
          sector_picks?: Json | null
          setup_done_at?: string | null
          setup_reached?: string | null
          short_description?: string | null
          short_description_th?: string | null
          source_global_id?: string | null
          status?: string
          tenant_id: string
          ticket_band?: string | null
          ticket_size?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
          website_url?: string | null
          wizard?: Json
          year_founded?: number | null
        }
        Update: {
          acts_for_types?: string[]
          address_city_district?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_province_state?: string | null
          aum?: string | null
          aum_band?: string | null
          aum_exact_usd?: number | null
          bio?: string | null
          business_address?: string | null
          company_size_band?: string | null
          company_type?: string | null
          company_type_source?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          deal_size_band?: string | null
          email?: string | null
          firm_name?: string | null
          id?: string
          imported_at?: string | null
          investment_focus?: string[] | null
          investor_name?: string
          investor_type?: string | null
          keywords?: string[] | null
          keywords_th?: string[] | null
          legal_name?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          long_description?: string | null
          long_description_th?: string | null
          max_ticket_size?: string | null
          media?: Json
          min_ticket_size?: string | null
          owner_relation?: string | null
          postal_code?: string | null
          preferred_industries?: string[] | null
          preferred_stages?: string[] | null
          prepared_at?: string | null
          prepared_by?: string | null
          registration_no?: string | null
          revenue_max_m?: number | null
          revenue_min_band?: string | null
          revenue_min_m?: number | null
          run_by?: Database["public"]["Enums"]["profile_run_by"]
          sector_picks?: Json | null
          setup_done_at?: string | null
          setup_reached?: string | null
          short_description?: string | null
          short_description_th?: string | null
          source_global_id?: string | null
          status?: string
          tenant_id?: string
          ticket_band?: string | null
          ticket_size?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
          website_url?: string | null
          wizard?: Json
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
      listed_companies: {
        Row: {
          as_at: string | null
          created_at: string
          debt_equity: number | null
          ebitda_margin_pct: number | null
          ev_ebitda: number | null
          exchange_group: string | null
          gross_margin_pct: number | null
          id: string
          market: Database["public"]["Enums"]["peer_market"]
          name: string
          net_margin_pct: number | null
          pbv: number | null
          pe: number | null
          revenue_growth_pct: number | null
          revenue_thb_m: number | null
          roe_pct: number | null
          sector: string | null
          statement_period: string | null
          tag: string | null
          ticker: string
          updated_at: string
        }
        Insert: {
          as_at?: string | null
          created_at?: string
          debt_equity?: number | null
          ebitda_margin_pct?: number | null
          ev_ebitda?: number | null
          exchange_group?: string | null
          gross_margin_pct?: number | null
          id?: string
          market: Database["public"]["Enums"]["peer_market"]
          name: string
          net_margin_pct?: number | null
          pbv?: number | null
          pe?: number | null
          revenue_growth_pct?: number | null
          revenue_thb_m?: number | null
          roe_pct?: number | null
          sector?: string | null
          statement_period?: string | null
          tag?: string | null
          ticker: string
          updated_at?: string
        }
        Update: {
          as_at?: string | null
          created_at?: string
          debt_equity?: number | null
          ebitda_margin_pct?: number | null
          ev_ebitda?: number | null
          exchange_group?: string | null
          gross_margin_pct?: number | null
          id?: string
          market?: Database["public"]["Enums"]["peer_market"]
          name?: string
          net_margin_pct?: number | null
          pbv?: number | null
          pe?: number | null
          revenue_growth_pct?: number | null
          revenue_thb_m?: number | null
          roe_pct?: number | null
          sector?: string | null
          statement_period?: string | null
          tag?: string | null
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      listing_admin_edits: {
        Row: {
          admin_id: string
          created_at: string
          field: string
          hidden_profile_id: string
          id: string
          new_value: Json | null
          old_value: Json | null
          undone_at: string | null
          version: number
        }
        Insert: {
          admin_id: string
          created_at?: string
          field: string
          hidden_profile_id: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          undone_at?: string | null
          version?: number
        }
        Update: {
          admin_id?: string
          created_at?: string
          field?: string
          hidden_profile_id?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          undone_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_admin_edits_hidden_profile_id_fkey"
            columns: ["hidden_profile_id"]
            isOneToOne: false
            referencedRelation: "hidden_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_image_library: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          path?: string
        }
        Relationships: []
      }
      listing_invitations: {
        Row: {
          buyer_choice: string
          buyer_user_id: string | null
          choice_at: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          first_declined_at: string | null
          from_contact_request: string | null
          hidden_profile_id: string
          id: string
          investor_id: string
          invite_count: number
          pipeline_id: string | null
          sent_at: string
          sent_by: string
          startup_id: string
          viewed_at: string | null
        }
        Insert: {
          buyer_choice?: string
          buyer_user_id?: string | null
          choice_at?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          first_declined_at?: string | null
          from_contact_request?: string | null
          hidden_profile_id: string
          id?: string
          investor_id: string
          invite_count?: number
          pipeline_id?: string | null
          sent_at?: string
          sent_by: string
          startup_id: string
          viewed_at?: string | null
        }
        Update: {
          buyer_choice?: string
          buyer_user_id?: string | null
          choice_at?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          first_declined_at?: string | null
          from_contact_request?: string | null
          hidden_profile_id?: string
          id?: string
          investor_id?: string
          invite_count?: number
          pipeline_id?: string | null
          sent_at?: string
          sent_by?: string
          startup_id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      listing_submissions: {
        Row: {
          hidden_profile_id: string
          id: string
          snapshot: Json
          startup_id: string
          submitted_at: string
          submitted_by: string
          tenant_id: string
          version: number
        }
        Insert: {
          hidden_profile_id: string
          id?: string
          snapshot: Json
          startup_id: string
          submitted_at?: string
          submitted_by: string
          tenant_id: string
          version: number
        }
        Update: {
          hidden_profile_id?: string
          id?: string
          snapshot?: Json
          startup_id?: string
          submitted_at?: string
          submitted_by?: string
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_submissions_hidden_profile_id_fkey"
            columns: ["hidden_profile_id"]
            isOneToOne: false
            referencedRelation: "hidden_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      managed_clients: {
        Row: {
          agreed_in_writing: boolean
          confirmed_by: string | null
          email: string | null
          ended_at: string | null
          first_name: string
          id: string
          kind: string
          last_name: string
          managed_by: string
          owner_relation: string | null
          phone: string | null
          profile_id: string
          since: string
        }
        Insert: {
          agreed_in_writing?: boolean
          confirmed_by?: string | null
          email?: string | null
          ended_at?: string | null
          first_name: string
          id?: string
          kind: string
          last_name: string
          managed_by?: string
          owner_relation?: string | null
          phone?: string | null
          profile_id: string
          since?: string
        }
        Update: {
          agreed_in_writing?: boolean
          confirmed_by?: string | null
          email?: string | null
          ended_at?: string | null
          first_name?: string
          id?: string
          kind?: string
          last_name?: string
          managed_by?: string
          owner_relation?: string | null
          phone?: string | null
          profile_id?: string
          since?: string
        }
        Relationships: []
      }
      marketplace_message_reads: {
        Row: {
          read_at: string
          thread_key: string
          user_id: string
        }
        Insert: {
          read_at?: string
          thread_key: string
          user_id: string
        }
        Update: {
          read_at?: string
          thread_key?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_messages: {
        Row: {
          body: string
          created_at: string
          files: Json
          id: string
          sender_id: string
          thread_key: string
        }
        Insert: {
          body?: string
          created_at?: string
          files?: Json
          id?: string
          sender_id: string
          thread_key: string
        }
        Update: {
          body?: string
          created_at?: string
          files?: Json
          id?: string
          sender_id?: string
          thread_key?: string
        }
        Relationships: []
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
          link_url: string | null
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
          link_url?: string | null
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
          link_url?: string | null
          message?: string | null
          notification_type?: string
          tenant_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      peer_set_members: {
        Row: {
          created_at: string
          id: string
          listed_company_id: string
          peer_set_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listed_company_id: string
          peer_set_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listed_company_id?: string
          peer_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_set_members_listed_company_id_fkey"
            columns: ["listed_company_id"]
            isOneToOne: false
            referencedRelation: "listed_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_set_members_peer_set_id_fkey"
            columns: ["peer_set_id"]
            isOneToOne: false
            referencedRelation: "peer_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_sets: {
        Row: {
          business_model: string | null
          created_at: string
          id: string
          industry_tag: string
          is_baseline: boolean
          last_refreshed_at: string | null
          owner_user_id: string | null
          sector: string | null
          updated_at: string
        }
        Insert: {
          business_model?: string | null
          created_at?: string
          id?: string
          industry_tag?: string
          is_baseline?: boolean
          last_refreshed_at?: string | null
          owner_user_id?: string | null
          sector?: string | null
          updated_at?: string
        }
        Update: {
          business_model?: string | null
          created_at?: string
          id?: string
          industry_tag?: string
          is_baseline?: boolean
          last_refreshed_at?: string | null
          owner_user_id?: string | null
          sector?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      peers: {
        Row: {
          company_name: string
          created_at: string
          ebitda_margin_pct: number | null
          ev_ebitda: number | null
          id: string
          market: Database["public"]["Enums"]["peer_market"]
          pbv: number | null
          pe: number | null
          peer_set_id: string
          revenue_thb_m: number | null
          ticker: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          ebitda_margin_pct?: number | null
          ev_ebitda?: number | null
          id?: string
          market: Database["public"]["Enums"]["peer_market"]
          pbv?: number | null
          pe?: number | null
          peer_set_id: string
          revenue_thb_m?: number | null
          ticker?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          ebitda_margin_pct?: number | null
          ev_ebitda?: number | null
          id?: string
          market?: Database["public"]["Enums"]["peer_market"]
          pbv?: number | null
          pe?: number | null
          peer_set_id?: string
          revenue_thb_m?: number | null
          ticker?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "peers_peer_set_id_fkey"
            columns: ["peer_set_id"]
            isOneToOne: false
            referencedRelation: "peer_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_changes: {
        Row: {
          created_at: string
          created_by: string
          effective_at: string
          id: string
          keep_price: string
          new_values: Json
          plan_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_at: string
          id?: string
          keep_price?: string
          new_values: Json
          plan_id: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_at?: string
          id?: string
          keep_price?: string
          new_values?: Json
          plan_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_changes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_history: {
        Row: {
          at: string
          by_user: string | null
          changes: Json
          id: string
          plan_id: string
          summary: string
        }
        Insert: {
          at?: string
          by_user?: string | null
          changes?: Json
          id?: string
          plan_id: string
          summary: string
        }
        Update: {
          at?: string
          by_user?: string | null
          changes?: Json
          id?: string
          plan_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_reports: {
        Row: {
          mode: string
          per_term: number | null
          plan_id: string
          report_key: string
        }
        Insert: {
          mode: string
          per_term?: number | null
          plan_id: string
          report_key: string
        }
        Update: {
          mode?: string
          per_term?: number | null
          plan_id?: string
          report_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_reports_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_usage: {
        Row: {
          created_at: string
          id: string
          kind: string
          ref: string | null
          term_start: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          ref?: string | null
          term_start: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          ref?: string | null
          term_start?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          badge_style: string
          card_style: string
          card_text: Json
          clients_mode: string | null
          clients_n: number | null
          completion_fee_pct: number | null
          has_data_room: boolean
          has_manager: boolean
          has_screening: boolean
          has_shortlists: boolean
          has_site_visit: boolean
          has_valuation_video: boolean
          id: string
          key: string
          mandates_mode: string | null
          mandates_n: number | null
          name: string
          price_thb: number | null
          price_type: string
          requests_mode: string
          requests_n: number | null
          role: string
          sort: number
          status: string
          term_months: number
          updated_at: string
          users_mode: string | null
          users_n: number | null
          value_cap_thb_m: number | null
          verification_business_days: number
          verification_mode: string | null
          verification_price_thb: number | null
          verification_recheck_business_days: number
          verification_vat_pct: number
        }
        Insert: {
          badge_style: string
          card_style?: string
          card_text?: Json
          clients_mode?: string | null
          clients_n?: number | null
          completion_fee_pct?: number | null
          has_data_room?: boolean
          has_manager?: boolean
          has_screening?: boolean
          has_shortlists?: boolean
          has_site_visit?: boolean
          has_valuation_video?: boolean
          id?: string
          key: string
          mandates_mode?: string | null
          mandates_n?: number | null
          name: string
          price_thb?: number | null
          price_type: string
          requests_mode?: string
          requests_n?: number | null
          role: string
          sort?: number
          status?: string
          term_months: number
          updated_at?: string
          users_mode?: string | null
          users_n?: number | null
          value_cap_thb_m?: number | null
          verification_business_days?: number
          verification_mode?: string | null
          verification_price_thb?: number | null
          verification_recheck_business_days?: number
          verification_vat_pct?: number
        }
        Update: {
          badge_style?: string
          card_style?: string
          card_text?: Json
          clients_mode?: string | null
          clients_n?: number | null
          completion_fee_pct?: number | null
          has_data_room?: boolean
          has_manager?: boolean
          has_screening?: boolean
          has_shortlists?: boolean
          has_site_visit?: boolean
          has_valuation_video?: boolean
          id?: string
          key?: string
          mandates_mode?: string | null
          mandates_n?: number | null
          name?: string
          price_thb?: number | null
          price_type?: string
          requests_mode?: string
          requests_n?: number | null
          role?: string
          sort?: number
          status?: string
          term_months?: number
          updated_at?: string
          users_mode?: string | null
          users_n?: number | null
          value_cap_thb_m?: number | null
          verification_business_days?: number
          verification_mode?: string | null
          verification_price_thb?: number | null
          verification_recheck_business_days?: number
          verification_vat_pct?: number
        }
        Relationships: []
      }
      private_notes: {
        Row: {
          direction: string
          edited_at: string | null
          generated: Json
          generated_at: string
          id: string
          listing_id: string | null
          my_notes: string | null
          overrides: Json
          owner_org_id: string
          pipeline_id: string
          subject_org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          direction: string
          edited_at?: string | null
          generated?: Json
          generated_at?: string
          id?: string
          listing_id?: string | null
          my_notes?: string | null
          overrides?: Json
          owner_org_id: string
          pipeline_id: string
          subject_org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          direction?: string
          edited_at?: string | null
          generated?: Json
          generated_at?: string
          id?: string
          listing_id?: string | null
          my_notes?: string | null
          overrides?: Json
          owner_org_id?: string
          pipeline_id?: string
          subject_org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_notes_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_field_changes: {
        Row: {
          changed_by: string | null
          created_at: string
          field: string
          id: string
          kind: string
          new_value: string | null
          old_value: string | null
          part: string
          profile_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          field: string
          id?: string
          kind: string
          new_value?: string | null
          old_value?: string | null
          part: string
          profile_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          field?: string
          id?: string
          kind?: string
          new_value?: string | null
          old_value?: string | null
          part?: string
          profile_id?: string
        }
        Relationships: []
      }
      profile_handover_events: {
        Row: {
          actor: string | null
          created_at: string
          detail: string | null
          event: string
          id: string
          kind: string
          profile_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          kind: string
          profile_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          kind?: string
          profile_id?: string
        }
        Relationships: []
      }
      profile_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_by: string | null
          email: string
          expires_at: string
          first_name: string
          id: string
          kind: string
          language: string
          last_name: string
          note: string | null
          opened_at: string | null
          owner_relation: string | null
          prepared_snapshot: Json | null
          profile_id: string
          sent_at: string
          sent_by: string
          submitted_at: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          created_by?: string | null
          email: string
          expires_at?: string
          first_name: string
          id?: string
          kind: string
          language?: string
          last_name: string
          note?: string | null
          opened_at?: string | null
          owner_relation?: string | null
          prepared_snapshot?: Json | null
          profile_id: string
          sent_at?: string
          sent_by?: string
          submitted_at?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          created_by?: string | null
          email?: string
          expires_at?: string
          first_name?: string
          id?: string
          kind?: string
          language?: string
          last_name?: string
          note?: string | null
          opened_at?: string | null
          owner_relation?: string | null
          prepared_snapshot?: Json | null
          profile_id?: string
          sent_at?: string
          sent_by?: string
          submitted_at?: string | null
          token?: string
        }
        Relationships: []
      }
      profile_part_checks: {
        Row: {
          changed: boolean
          checked_at: string
          checked_by: string | null
          kind: string
          part: string
          profile_id: string
        }
        Insert: {
          changed?: boolean
          checked_at?: string
          checked_by?: string | null
          kind: string
          part: string
          profile_id: string
        }
        Update: {
          changed?: boolean
          checked_at?: string
          checked_by?: string | null
          kind?: string
          part?: string
          profile_id?: string
        }
        Relationships: []
      }
      report_open_events: {
        Row: {
          buyer_id: string
          company_id: string
          id: string
          opened_at: string
          pipeline_id: string
          report_key: string
          via: string
        }
        Insert: {
          buyer_id: string
          company_id: string
          id?: string
          opened_at?: string
          pipeline_id: string
          report_key: string
          via: string
        }
        Update: {
          buyer_id?: string
          company_id?: string
          id?: string
          opened_at?: string
          pipeline_id?: string
          report_key?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_open_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_open_events_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      report_order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          id: string
          note: string | null
          order_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          id?: string
          note?: string | null
          order_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          id?: string
          note?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "report_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      report_orders: {
        Row: {
          amount: number
          analyst_id: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          delivered_by: string | null
          due_at: string | null
          generated_at: string | null
          id: string
          invoice_no: string | null
          kind: string
          method: string | null
          ordered_by: string | null
          paid_at: string
          payment_ref: string | null
          ref: string
          startup_id: string
          status: string
        }
        Insert: {
          amount?: number
          analyst_id?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivered_by?: string | null
          due_at?: string | null
          generated_at?: string | null
          id?: string
          invoice_no?: string | null
          kind: string
          method?: string | null
          ordered_by?: string | null
          paid_at?: string
          payment_ref?: string | null
          ref?: string
          startup_id: string
          status?: string
        }
        Update: {
          amount?: number
          analyst_id?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          delivered_by?: string | null
          due_at?: string | null
          generated_at?: string | null
          id?: string
          invoice_no?: string | null
          kind?: string
          method?: string | null
          ordered_by?: string | null
          paid_at?: string
          payment_ref?: string | null
          ref?: string
          startup_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_orders_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      report_share_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          event: string
          id: string
          share_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          share_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_share_events_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "report_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      report_share_requests: {
        Row: {
          buyer_id: string
          company_id: string
          id: string
          pipeline_id: string
          report_key: string
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          buyer_id: string
          company_id: string
          id?: string
          pipeline_id: string
          report_key: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          buyer_id?: string
          company_id?: string
          id?: string
          pipeline_id?: string
          report_key?: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_share_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_share_requests_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      report_shares: {
        Row: {
          allow_download: boolean
          business_id: string
          buyer_id: string
          financials: boolean
          id: string
          pipeline_id: string | null
          report_keys: string[]
          report_opened_at: Json
          revoked_at: string | null
          revoked_by: string | null
          shared_at: string
          shared_by: string | null
          updated_at: string
          updated_by: string | null
          valuation: boolean
        }
        Insert: {
          allow_download?: boolean
          business_id: string
          buyer_id: string
          financials?: boolean
          id?: string
          pipeline_id?: string | null
          report_keys?: string[]
          report_opened_at?: Json
          revoked_at?: string | null
          revoked_by?: string | null
          shared_at?: string
          shared_by?: string | null
          updated_at?: string
          updated_by?: string | null
          valuation?: boolean
        }
        Update: {
          allow_download?: boolean
          business_id?: string
          buyer_id?: string
          financials?: boolean
          id?: string
          pipeline_id?: string | null
          report_keys?: string[]
          report_opened_at?: Json
          revoked_at?: string | null
          revoked_by?: string | null
          shared_at?: string
          shared_by?: string | null
          updated_at?: string
          updated_by?: string | null
          valuation?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "report_shares_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_shares_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "deal_pipelines"
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
      saved_investors: {
        Row: {
          created_at: string
          investor_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          investor_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          investor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_investors_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string
          hidden_profile_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_profile_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_hidden_profile_id_fkey"
            columns: ["hidden_profile_id"]
            isOneToOne: false
            referencedRelation: "hidden_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      sector_images: {
        Row: {
          file_name: string
          height: number
          id: string
          sector_key: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          width: number
        }
        Insert: {
          file_name: string
          height: number
          id?: string
          sector_key: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          width: number
        }
        Update: {
          file_name?: string
          height?: number
          id?: string
          sector_key?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          width?: number
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
      seller_report_prefs: {
        Row: {
          last_company_id: string | null
          share_panel_hidden: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          last_company_id?: string | null
          share_panel_hidden?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          last_company_id?: string | null
          share_panel_hidden?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_report_prefs_last_company_id_fkey"
            columns: ["last_company_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      share_invitations: {
        Row: {
          buy_order_id: string | null
          email: string
          id: string
          joined_at: string | null
          joined_user_id: string | null
          sender_user_id: string
          sent_at: string
          token: string
        }
        Insert: {
          buy_order_id?: string | null
          email: string
          id?: string
          joined_at?: string | null
          joined_user_id?: string | null
          sender_user_id: string
          sent_at?: string
          token: string
        }
        Update: {
          buy_order_id?: string | null
          email?: string
          id?: string
          joined_at?: string | null
          joined_user_id?: string | null
          sender_user_id?: string
          sent_at?: string
          token?: string
        }
        Relationships: []
      }
      sign_in_days: {
        Row: {
          day: string
          first_at: string
          user_id: string
        }
        Insert: {
          day?: string
          first_at?: string
          user_id: string
        }
        Update: {
          day?: string
          first_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signup_answers: {
        Row: {
          buyer_relation: string | null
          company: Json | null
          created_at: string
          done_at: string | null
          first_answer: string
          first_name: string | null
          investor_types: string[]
          last_name: string | null
          news_opt_in: boolean
          profile_id: string | null
          provider: string | null
          role: string
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
          welcome_seen_at: string | null
        }
        Insert: {
          buyer_relation?: string | null
          company?: Json | null
          created_at?: string
          done_at?: string | null
          first_answer: string
          first_name?: string | null
          investor_types?: string[]
          last_name?: string | null
          news_opt_in?: boolean
          profile_id?: string | null
          provider?: string | null
          role: string
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
          welcome_seen_at?: string | null
        }
        Update: {
          buyer_relation?: string | null
          company?: Json | null
          created_at?: string
          done_at?: string | null
          first_answer?: string
          first_name?: string | null
          investor_types?: string[]
          last_name?: string | null
          news_opt_in?: boolean
          profile_id?: string | null
          provider?: string | null
          role?: string
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
          welcome_seen_at?: string | null
        }
        Relationships: []
      }
      soft_launch_settings: {
        Row: {
          changed_at: string
          changed_by: string | null
          gate_on: boolean
          id: boolean
          usual_free_plans: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          gate_on?: boolean
          id?: boolean
          usual_free_plans?: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          gate_on?: boolean
          id?: boolean
          usual_free_plans?: Json
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
          bio_story: Json | null
          bio_story_th: Json | null
          bio_th: string | null
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
          bio_story?: Json | null
          bio_story_th?: Json | null
          bio_th?: string | null
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
          bio_story?: Json | null
          bio_story_th?: Json | null
          bio_th?: string | null
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
          seller_relation: string | null
          startup_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          id?: string
          owning_agent_user_id: string
          seller_relation?: string | null
          startup_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          id?: string
          owning_agent_user_id?: string
          seller_relation?: string | null
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
      startup_peer_selections: {
        Row: {
          chosen_at: string
          chosen_by: string | null
          id: string
          listed_company_id: string
          startup_id: string
        }
        Insert: {
          chosen_at?: string
          chosen_by?: string | null
          id?: string
          listed_company_id: string
          startup_id: string
        }
        Update: {
          chosen_at?: string
          chosen_by?: string | null
          id?: string
          listed_company_id?: string
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_peer_selections_listed_company_id_fkey"
            columns: ["listed_company_id"]
            isOneToOne: false
            referencedRelation: "listed_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_peer_selections_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
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
          address_city_district: string | null
          address_line1: string | null
          address_line2: string | null
          address_province_state: string | null
          business_address: string | null
          business_model: string | null
          business_size: string | null
          city: string | null
          company_size: string | null
          company_type: string | null
          company_type_source: string
          contact_number: string | null
          created_at: string
          created_by: string | null
          email: string | null
          headquarters: string | null
          id: string
          imported_at: string | null
          industry: string[]
          investment_stage: string | null
          iso_standards: string[]
          last_year_revenue: string | null
          linkedin_url: string | null
          listing_autofill_at: string | null
          logo_url: string | null
          long_description: string | null
          long_description_th: string | null
          market_tags: string[]
          market_tags_th: string[] | null
          owner_relation: string | null
          peer_basis: string
          postal_code: string | null
          prepared_at: string | null
          prepared_by: string | null
          product_tags: string[]
          product_tags_th: string[] | null
          region: string | null
          registered_capital: string | null
          registered_date: string | null
          registered_name: string | null
          registered_number: string | null
          registered_status: string | null
          registered_type: string | null
          registration_verified_at: string | null
          regulatory_licenses: Json
          run_by: Database["public"]["Enums"]["profile_run_by"]
          sector: string | null
          sector_pick: Json | null
          setup_done_at: string | null
          setup_from_signup: string[]
          setup_reached: string | null
          short_description: string | null
          short_description_th: string | null
          source_global_id: string | null
          startup_name: string | null
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
          address_city_district?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_province_state?: string | null
          business_address?: string | null
          business_model?: string | null
          business_size?: string | null
          city?: string | null
          company_size?: string | null
          company_type?: string | null
          company_type_source?: string
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          headquarters?: string | null
          id?: string
          imported_at?: string | null
          industry?: string[]
          investment_stage?: string | null
          iso_standards?: string[]
          last_year_revenue?: string | null
          linkedin_url?: string | null
          listing_autofill_at?: string | null
          logo_url?: string | null
          long_description?: string | null
          long_description_th?: string | null
          market_tags?: string[]
          market_tags_th?: string[] | null
          owner_relation?: string | null
          peer_basis?: string
          postal_code?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          product_tags?: string[]
          product_tags_th?: string[] | null
          region?: string | null
          registered_capital?: string | null
          registered_date?: string | null
          registered_name?: string | null
          registered_number?: string | null
          registered_status?: string | null
          registered_type?: string | null
          registration_verified_at?: string | null
          regulatory_licenses?: Json
          run_by?: Database["public"]["Enums"]["profile_run_by"]
          sector?: string | null
          sector_pick?: Json | null
          setup_done_at?: string | null
          setup_from_signup?: string[]
          setup_reached?: string | null
          short_description?: string | null
          short_description_th?: string | null
          source_global_id?: string | null
          startup_name?: string | null
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
          address_city_district?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_province_state?: string | null
          business_address?: string | null
          business_model?: string | null
          business_size?: string | null
          city?: string | null
          company_size?: string | null
          company_type?: string | null
          company_type_source?: string
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          headquarters?: string | null
          id?: string
          imported_at?: string | null
          industry?: string[]
          investment_stage?: string | null
          iso_standards?: string[]
          last_year_revenue?: string | null
          linkedin_url?: string | null
          listing_autofill_at?: string | null
          logo_url?: string | null
          long_description?: string | null
          long_description_th?: string | null
          market_tags?: string[]
          market_tags_th?: string[] | null
          owner_relation?: string | null
          peer_basis?: string
          postal_code?: string | null
          prepared_at?: string | null
          prepared_by?: string | null
          product_tags?: string[]
          product_tags_th?: string[] | null
          region?: string | null
          registered_capital?: string | null
          registered_date?: string | null
          registered_name?: string | null
          registered_number?: string | null
          registered_status?: string | null
          registered_type?: string | null
          registration_verified_at?: string | null
          regulatory_licenses?: Json
          run_by?: Database["public"]["Enums"]["profile_run_by"]
          sector?: string | null
          sector_pick?: Json | null
          setup_done_at?: string | null
          setup_from_signup?: string[]
          setup_reached?: string | null
          short_description?: string | null
          short_description_th?: string | null
          source_global_id?: string | null
          startup_name?: string | null
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
      subscriptions: {
        Row: {
          access_code_id: string | null
          free_bar_hidden_on: string | null
          free_end_email_sent_at: string | null
          free_end_seen_at: string | null
          free_ended_on: string | null
          free_plan_name: string | null
          free_reminder_sent_at: string | null
          id: string
          manager_user_id: string | null
          nda_credits: number
          plan_id: string
          price_locked_thb: number | null
          price_paid_thb: number | null
          source: string | null
          status: string
          term_end: string | null
          term_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_code_id?: string | null
          free_bar_hidden_on?: string | null
          free_end_email_sent_at?: string | null
          free_end_seen_at?: string | null
          free_ended_on?: string | null
          free_plan_name?: string | null
          free_reminder_sent_at?: string | null
          id?: string
          manager_user_id?: string | null
          nda_credits?: number
          plan_id: string
          price_locked_thb?: number | null
          price_paid_thb?: number | null
          source?: string | null
          status?: string
          term_end?: string | null
          term_start?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_code_id?: string | null
          free_bar_hidden_on?: string | null
          free_end_email_sent_at?: string | null
          free_end_seen_at?: string | null
          free_ended_on?: string | null
          free_plan_name?: string | null
          free_reminder_sent_at?: string | null
          id?: string
          manager_user_id?: string | null
          nda_credits?: number
          plan_id?: string
          price_locked_thb?: number | null
          price_paid_thb?: number | null
          source?: string | null
          status?: string
          term_end?: string | null
          term_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
      user_contacts: {
        Row: {
          company: string | null
          contact_type: string
          created_at: string
          department: string | null
          email: string | null
          event: string | null
          full_name: string
          id: string
          last_contacted_at: string | null
          location: string | null
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          owner_user_id: string
          phone: string | null
          position: string | null
          source: string
          status: string
          tags: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          company?: string | null
          contact_type?: string
          created_at?: string
          department?: string | null
          email?: string | null
          event?: string | null
          full_name: string
          id?: string
          last_contacted_at?: string | null
          location?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_user_id?: string
          phone?: string | null
          position?: string | null
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          company?: string | null
          contact_type?: string
          created_at?: string
          department?: string | null
          email?: string | null
          event?: string | null
          full_name?: string
          id?: string
          last_contacted_at?: string | null
          location?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_user_id?: string
          phone?: string | null
          position?: string | null
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          bio: string | null
          buyer_type: string | null
          city: string | null
          country: string | null
          created_at: string
          experience: string | null
          functional_expertise: string | null
          industry_focus: string | null
          linkedin: string | null
          organisation: string | null
          phone: string | null
          title: string | null
          updated_at: string
          user_id: string
          website: string | null
          welcome_tour_seen_at: string | null
        }
        Insert: {
          bio?: string | null
          buyer_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          experience?: string | null
          functional_expertise?: string | null
          industry_focus?: string | null
          linkedin?: string | null
          organisation?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          welcome_tour_seen_at?: string | null
        }
        Update: {
          bio?: string | null
          buyer_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          experience?: string | null
          functional_expertise?: string | null
          industry_focus?: string | null
          linkedin?: string | null
          organisation?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          welcome_tour_seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      user_verifications: {
        Row: {
          user_id: string
          verified_at: string
          verified_by: string | null
        }
        Insert: {
          user_id: string
          verified_at?: string
          verified_by?: string | null
        }
        Update: {
          user_id?: string
          verified_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          access_code_id: string | null
          account_role: string | null
          advisor_view: boolean
          advisors_intro_seen_at: string | null
          ai_agent_id: string | null
          created_at: string
          created_by: string | null
          dismissed_hints: string[]
          email: string
          first_name: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          primary_role_id: string | null
          primary_tenant_id: string | null
          signup_done_at: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          updated_by: string | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          access_code_id?: string | null
          account_role?: string | null
          advisor_view?: boolean
          advisors_intro_seen_at?: string | null
          ai_agent_id?: string | null
          created_at?: string
          created_by?: string | null
          dismissed_hints?: string[]
          email: string
          first_name?: string | null
          id: string
          last_login_at?: string | null
          last_name?: string | null
          primary_role_id?: string | null
          primary_tenant_id?: string | null
          signup_done_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          updated_by?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          access_code_id?: string | null
          account_role?: string | null
          advisor_view?: boolean
          advisors_intro_seen_at?: string | null
          ai_agent_id?: string | null
          created_at?: string
          created_by?: string | null
          dismissed_hints?: string[]
          email?: string
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          primary_role_id?: string | null
          primary_tenant_id?: string | null
          signup_done_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          updated_by?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: [
          {
            foreignKeyName: "users_access_code_id_fkey"
            columns: ["access_code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_primary_role_id_fkey"
            columns: ["primary_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_adjustments: {
        Row: {
          amount: number
          costs_amount: number | null
          created_at: string
          created_by: string | null
          description: string
          discount_pct: number | null
          filing_line: string | null
          fiscal_year: number
          id: string
          recurs: string
          startup_id: string
          tenant_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          costs_amount?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          discount_pct?: number | null
          filing_line?: string | null
          fiscal_year: number
          id?: string
          recurs?: string
          startup_id: string
          tenant_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          costs_amount?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          discount_pct?: number | null
          filing_line?: string | null
          fiscal_year?: number
          id?: string
          recurs?: string
          startup_id?: string
          tenant_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuation_adjustments_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_settings: {
        Row: {
          benchmark_peer_company_id: string | null
          created_at: string
          fiscal_year: number
          id: string
          stake: string
          startup_id: string
          tax_rate: number
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          benchmark_peer_company_id?: string | null
          created_at?: string
          fiscal_year: number
          id?: string
          stake?: string
          startup_id: string
          tax_rate?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          benchmark_peer_company_id?: string | null
          created_at?: string
          fiscal_year?: number
          id?: string
          stake?: string
          startup_id?: string
          tax_rate?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_settings_benchmark_peer_company_id_fkey"
            columns: ["benchmark_peer_company_id"]
            isOneToOne: false
            referencedRelation: "listed_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_settings_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_access: {
        Row: {
          buyer_account_id: string
          company_id: string
          id: string
          open_until: string | null
          opened_at: string | null
          order_id: string | null
          requested_at: string | null
          via: string
        }
        Insert: {
          buyer_account_id: string
          company_id: string
          id?: string
          open_until?: string | null
          opened_at?: string | null
          order_id?: string | null
          requested_at?: string | null
          via: string
        }
        Update: {
          buyer_account_id?: string
          company_id?: string
          id?: string
          open_until?: string | null
          opened_at?: string | null
          order_id?: string | null
          requested_at?: string | null
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_access_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "verification_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_orders: {
        Row: {
          amount: number
          buyer_account_id: string | null
          company_id: string
          created_at: string
          id: string
          method: string
          ordered_by: string
          paid_at: string | null
          receipt_no: string | null
          ref: string
          refund_requested_at: string | null
          slip: string | null
          status: string
          tax_invoice_no: string | null
          total: number
          vat: number
        }
        Insert: {
          amount: number
          buyer_account_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          method: string
          ordered_by: string
          paid_at?: string | null
          receipt_no?: string | null
          ref?: string
          refund_requested_at?: string | null
          slip?: string | null
          status?: string
          tax_invoice_no?: string | null
          total: number
          vat: number
        }
        Update: {
          amount?: number
          buyer_account_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          method?: string
          ordered_by?: string
          paid_at?: string | null
          receipt_no?: string | null
          ref?: string
          refund_requested_at?: string | null
          slip?: string | null
          status?: string
          tax_invoice_no?: string | null
          total?: number
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "verification_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_usage: {
        Row: {
          buyer_account_id: string
          company_id: string
          consumed_at: string
          id: string
          returned_at: string | null
          term_start: string
        }
        Insert: {
          buyer_account_id: string
          company_id: string
          consumed_at?: string
          id?: string
          returned_at?: string | null
          term_start: string
        }
        Update: {
          buyer_account_id?: string
          company_id?: string
          consumed_at?: string
          id?: string
          returned_at?: string | null
          term_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_feedback: {
        Row: {
          created_at: string
          id: string
          improve_text: string | null
          more_text: string | null
          options: string[]
          user_id: string
          withdrawal_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          improve_text?: string | null
          more_text?: string | null
          options?: string[]
          user_id: string
          withdrawal_id: string
        }
        Update: {
          created_at?: string
          id?: string
          improve_text?: string | null
          more_text?: string | null
          options?: string[]
          user_id?: string
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_feedback_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: true
            referencedRelation: "deal_withdrawals"
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
          last_report_company_id: string | null
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
          last_report_company_id?: string | null
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
          last_report_company_id?: string | null
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
      account_role_of: { Args: { _uid: string }; Returns: string }
      active_tenant_id: { Args: { _user_id: string }; Returns: string }
      address_place: {
        Args: { _country: string; _district: string; _province: string }
        Returns: string
      }
      admin_create_ownerless_advisor_firm: {
        Args: { _name: string }
        Returns: string
      }
      advisor_child_move: {
        Args: { _fid: string; _field: string }
        Returns: undefined
      }
      apply_plan_edit: {
        Args: { _by: string; _keep?: string; _plan: string; _values: Json }
        Returns: undefined
      }
      apply_scheduled_plan_changes: { Args: never; Returns: number }
      asking_price_band: { Args: { _thb: number }; Returns: string }
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
      can_manage_advisor_firm: { Args: { _firm: string }; Returns: boolean }
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
      can_open_report: {
        Args: { _ref: string; _report_key: string; _uid: string }
        Returns: boolean
      }
      can_read_message_thread: {
        Args: { _key: string; _uid: string }
        Returns: boolean
      }
      claim_access_seat: {
        Args: { _code_id: string; _role: string; _uid: string }
        Returns: string
      }
      claim_share_invitation: {
        Args: {
          _email: string
          _invitation_id: string
          _role: string
          _uid: string
        }
        Returns: boolean
      }
      close_due_buy_orders: { Args: never; Returns: number }
      company_type_for_relation: { Args: { _rel: string }; Returns: string }
      current_term_start: { Args: { _uid: string }; Returns: string }
      dbd_apply_edit: {
        Args: {
          _actor: string
          _amount: number
          _code: string
          _note: string
          _reg: string
          _statement: string
          _year: number
        }
        Returns: undefined
      }
      dbd_link_startup: {
        Args: { _actor: string; _sid: string }
        Returns: Json
      }
      dbd_locked_startup: { Args: { _sid: string }; Returns: boolean }
      dbd_materialize: {
        Args: { _data: Json; _reg: string; _sid: string }
        Returns: undefined
      }
      dbd_norm_reg: { Args: { _s: string }; Returns: string }
      dbd_snapshot_startup: { Args: { _sid: string }; Returns: Json }
      dbd_store_delete: {
        Args: { _actor: string; _reg: string }
        Returns: Json
      }
      dbd_store_save: {
        Args: {
          _action: string
          _actor: string
          _actor_name: string
          _data: Json
          _raw: Json
          _reg: string
          _source: string
          _source_note: string
        }
        Returns: Json
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
      has_sector_answer: {
        Args: { _agnostic: boolean; _picks: Json }
        Returns: boolean
      }
      investor_is_verified: {
        Args: { _ids: string[] }
        Returns: {
          investor_id: string
          verified: boolean
        }[]
      }
      is_account_admin: { Args: { _uid: string }; Returns: boolean }
      is_control: { Args: { _user_id: string }; Returns: boolean }
      is_master_agent_of: {
        Args: { _tenant: string; _user_id: string }
        Returns: boolean
      }
      is_startup_member: {
        Args: { _startup_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_admin_of: {
        Args: { _tenant: string; _user_id: string }
        Returns: boolean
      }
      mark_welcome_tour_seen: { Args: never; Returns: string }
      next_inv_ref: { Args: never; Returns: string }
      normalize_url_key: { Args: { _url: string }; Returns: string }
      prune_sign_in_days: { Args: never; Returns: undefined }
      record_report_open: {
        Args: { _ref: string; _report_key: string; _uid: string }
        Returns: boolean
      }
      record_sign_in_day: { Args: never; Returns: boolean }
      reports_open_plan: {
        Args: {
          _buyer: string
          _pipeline: string
          _plan_key: string
          _report: string
        }
        Returns: Json
      }
      reports_pipeline_nda: {
        Args: { _buyer: string; _pipeline: string }
        Returns: boolean
      }
      role_is: { Args: { _role: string; _uid: string }; Returns: boolean }
      share_email_has_account: { Args: { _email: string }; Returns: boolean }
      user_in_tenant: {
        Args: { _tenant: string; _user_id: string }
        Returns: boolean
      }
      verification_business_due: {
        Args: { _days: number; _from: string }
        Returns: string
      }
      verification_can_read: {
        Args: { _company: string; _uid: string }
        Returns: boolean
      }
      verification_nda_valid: {
        Args: { _company: string; _uid: string }
        Returns: boolean
      }
      verification_open: {
        Args: { _company: string; _uid: string }
        Returns: Json
      }
      verification_open_pipeline: {
        Args: { _company: string; _pipeline: string; _uid: string }
        Returns: Json
      }
      verification_owner: {
        Args: { _company: string; _uid: string }
        Returns: boolean
      }
      verification_pipeline_valid: {
        Args: { _company: string; _pipeline: string; _uid: string }
        Returns: boolean
      }
      verification_start_included: {
        Args: { _company: string }
        Returns: undefined
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
      peer_market: "SET" | "mai"
      profile_run_by: "none" | "owner" | "pitchsnack"
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
      peer_market: ["SET", "mai"],
      profile_run_by: ["none", "owner", "pitchsnack"],
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
