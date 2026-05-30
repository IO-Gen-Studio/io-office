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
      activity_log: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          module: Database["public"]["Enums"]["app_module"]
          summary: string
          verb: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          module: Database["public"]["Enums"]["app_module"]
          summary: string
          verb: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          module?: Database["public"]["Enums"]["app_module"]
          summary?: string
          verb?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_contacts: {
        Row: {
          campaign_id: string
          created_at: string
          custom: Json
          email: string | null
          first_name: string
          id: string
          industry: string | null
          job_title: string | null
          last_name: string
          lead_status: string
          notes: string | null
          organisation: string | null
          outreach: Json
          updated_at: string
          website: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          custom?: Json
          email?: string | null
          first_name?: string
          id?: string
          industry?: string | null
          job_title?: string | null
          last_name?: string
          lead_status?: string
          notes?: string | null
          organisation?: string | null
          outreach?: Json
          updated_at?: string
          website?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          custom?: Json
          email?: string | null
          first_name?: string
          id?: string
          industry?: string | null
          job_title?: string | null
          last_name?: string
          lead_status?: string
          notes?: string | null
          organisation?: string | null
          outreach?: Json
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_templates: {
        Row: {
          campaign_id: string
          template_id: string
        }
        Insert: {
          campaign_id: string
          template_id: string
        }
        Update: {
          campaign_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          stages: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          stages?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          stages?: Json
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          created_by: string | null
          custom: Json
          email: string | null
          first_name: string
          id: string
          is_lead: boolean
          job_title: string | null
          last_name: string
          notes: string | null
          organisation_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom?: Json
          email?: string | null
          first_name?: string
          id?: string
          is_lead?: boolean
          job_title?: string | null
          last_name?: string
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom?: Json
          email?: string | null
          first_name?: string
          id?: string
          is_lead?: boolean
          job_title?: string | null
          last_name?: string
          notes?: string | null
          organisation_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_defs: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          module: Database["public"]["Enums"]["app_module"]
          options: Json
          position: number
          type: Database["public"]["Enums"]["custom_field_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          module: Database["public"]["Enums"]["app_module"]
          options?: Json
          position?: number
          type: Database["public"]["Enums"]["custom_field_type"]
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          module?: Database["public"]["Enums"]["app_module"]
          options?: Json
          position?: number
          type?: Database["public"]["Enums"]["custom_field_type"]
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          approved: boolean
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string
          email: string
          expiry_ts: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email: string
          expiry_ts: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email?: string
          expiry_ts?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_status_options: {
        Row: {
          id: string
          is_default: boolean
          key: string
          label: string
          position: number
        }
        Insert: {
          id?: string
          is_default?: boolean
          key: string
          label: string
          position?: number
        }
        Update: {
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          position?: number
        }
        Relationships: []
      }
      milestone_templates: {
        Row: {
          id: string
          label: string
          position: number
        }
        Insert: {
          id?: string
          label: string
          position?: number
        }
        Update: {
          id?: string
          label?: string
          position?: number
        }
        Relationships: []
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_custom: boolean
          label: string
          position: number
          project_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_custom?: boolean
          label: string
          position?: number
          project_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_custom?: boolean
          label?: string
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      module_access: {
        Row: {
          can_edit: boolean
          can_view: boolean
          id: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organisations: {
        Row: {
          created_at: string
          created_by: string | null
          custom: Json
          id: string
          industry: string | null
          name: string
          notes: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      outreach_status_options: {
        Row: {
          id: string
          key: string
          label: string
          position: number
        }
        Insert: {
          id?: string
          key: string
          label: string
          position?: number
        }
        Update: {
          id?: string
          key?: string
          label?: string
          position?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string | null
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          job_title?: string | null
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          business_cost: number
          client_contact_id: string | null
          client_org_id: string | null
          created_at: string
          created_by: string | null
          custom: Json
          description: string | null
          end_date: string | null
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          supplier_cost: number
          team_lead_id: string | null
          title: string
          total_cost: number
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
        }
        Insert: {
          business_cost?: number
          client_contact_id?: string | null
          client_org_id?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supplier_cost?: number
          team_lead_id?: string | null
          title: string
          total_cost?: number
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Update: {
          business_cost?: number
          client_contact_id?: string | null
          client_org_id?: string | null
          created_at?: string
          created_by?: string | null
          custom?: Json
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          supplier_cost?: number
          team_lead_id?: string | null
          title?: string
          total_cost?: number
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_plans: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          copy: string
          created_at: string
          created_by: string | null
          id: string
          media_path: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          post_status: Database["public"]["Enums"]["post_status"]
          scheduled_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          copy?: string
          created_at?: string
          created_by?: string | null
          id?: string
          media_path?: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          post_status?: Database["public"]["Enums"]["post_status"]
          scheduled_at?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          copy?: string
          created_at?: string
          created_by?: string | null
          id?: string
          media_path?: string | null
          platform?: Database["public"]["Enums"]["social_platform"]
          post_status?: Database["public"]["Enums"]["post_status"]
          scheduled_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          client_contact_id: string | null
          client_org_id: string | null
          cost: number
          created_at: string
          created_by: string | null
          custom: Json
          id: string
          plan_name: string
          renewal_date: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          client_contact_id?: string | null
          client_org_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          plan_name: string
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          client_contact_id?: string | null
          client_org_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          custom?: Json
          id?: string
          plan_name?: string
          renewal_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_module: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          _entity_id: string
          _entity_type: string
          _metadata?: Json
          _module: Database["public"]["Enums"]["app_module"]
          _summary: string
          _verb: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_module:
        | "dashboard"
        | "crm"
        | "outreach"
        | "social"
        | "projects"
        | "subscriptions"
        | "calendar"
        | "settings"
      app_role: "admin" | "member"
      approval_status: "approved" | "not_approved"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "dropdown"
        | "checklist"
        | "long_text"
      post_status: "posted" | "not_posted" | "cancelled"
      priority_level: "low" | "medium" | "high"
      project_status: "in_progress" | "on_hold" | "cancelled" | "completed"
      project_type: "project" | "work"
      social_platform:
        | "linkedin"
        | "instagram"
        | "x"
        | "threads"
        | "facebook"
        | "tiktok"
        | "youtube"
      subscription_status: "active" | "paused" | "cancelled" | "past_due"
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
      app_module: [
        "dashboard",
        "crm",
        "outreach",
        "social",
        "projects",
        "subscriptions",
        "calendar",
        "settings",
      ],
      app_role: ["admin", "member"],
      approval_status: ["approved", "not_approved"],
      custom_field_type: [
        "text",
        "number",
        "date",
        "dropdown",
        "checklist",
        "long_text",
      ],
      post_status: ["posted", "not_posted", "cancelled"],
      priority_level: ["low", "medium", "high"],
      project_status: ["in_progress", "on_hold", "cancelled", "completed"],
      project_type: ["project", "work"],
      social_platform: [
        "linkedin",
        "instagram",
        "x",
        "threads",
        "facebook",
        "tiktok",
        "youtube",
      ],
      subscription_status: ["active", "paused", "cancelled", "past_due"],
    },
  },
} as const
