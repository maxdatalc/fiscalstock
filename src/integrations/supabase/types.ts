export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      // ------------------------------------------------------------------
      // lojas — tabela existente do dashboard, usada por FiscalStock
      // Bridge config: sql_bridge_url + sql_bridge_token (já existem)
      // terminal_maxdata adicionado via migração (ADD COLUMN)
      // ------------------------------------------------------------------
      lojas: {
        Row: {
          id: string
          tenant_id: string
          name: string
          emp_id: number
          erp_base_url: string | null
          terminal_encrypted: string | null
          terminal_maxdata: string | null
          is_active: boolean
          sql_bridge_url: string | null
          sql_bridge_token: string | null
          sql_enabled: boolean | null
          sync_services_enabled: boolean | null
          sync_paused: boolean | null
          sync_paused_at: string | null
          sync_paused_by: string | null
          sync_pause_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          emp_id: number
          erp_base_url?: string | null
          terminal_encrypted?: string | null
          terminal_maxdata?: string | null
          is_active?: boolean
          sql_bridge_url?: string | null
          sql_bridge_token?: string | null
          sql_enabled?: boolean | null
          sync_services_enabled?: boolean | null
          sync_paused?: boolean | null
          sync_paused_at?: string | null
          sync_paused_by?: string | null
          sync_pause_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          emp_id?: number
          erp_base_url?: string | null
          terminal_encrypted?: string | null
          terminal_maxdata?: string | null
          is_active?: boolean
          sql_bridge_url?: string | null
          sql_bridge_token?: string | null
          sql_enabled?: boolean | null
          sync_services_enabled?: boolean | null
          sync_paused?: boolean | null
          sync_paused_at?: string | null
          sync_paused_by?: string | null
          sync_pause_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      // ------------------------------------------------------------------
      // tenants — usado como "empresas" no FiscalStock
      // ------------------------------------------------------------------
      tenants: {
        Row: {
          id: string
          name: string
          slug: string | null
          plan: string | null
          is_active: boolean
          dominio_customizado: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          plan?: string | null
          is_active?: boolean
          dominio_customizado?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string | null
          plan?: string | null
          is_active?: boolean
          dominio_customizado?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // ------------------------------------------------------------------
      // tenant_users — usado como "user_empresas" no FiscalStock
      // ------------------------------------------------------------------
      tenant_users: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      }
      // ------------------------------------------------------------------
      // integration_configs — MaxAPI config + token cache (criada por FiscalStock)
      // NÃO contém bridge_url/token (esses ficam em lojas.sql_bridge_*)
      // ------------------------------------------------------------------
      integration_configs: {
        Row: {
          id: string
          loja_id: string
          maxapi_url: string | null
          maxapi_client_id: string | null
          maxapi_secret_key: string | null
          maxapi_token_cache: string | null
          maxapi_token_expires_at: string | null
          status_maxapi: string
          status_bridge: string
          ultimo_teste_bridge: string | null
          ultimo_teste_maxapi: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loja_id: string
          maxapi_url?: string | null
          maxapi_client_id?: string | null
          maxapi_secret_key?: string | null
          maxapi_token_cache?: string | null
          maxapi_token_expires_at?: string | null
          status_maxapi?: string
          status_bridge?: string
          ultimo_teste_bridge?: string | null
          ultimo_teste_maxapi?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loja_id?: string
          maxapi_url?: string | null
          maxapi_client_id?: string | null
          maxapi_secret_key?: string | null
          maxapi_token_cache?: string | null
          maxapi_token_expires_at?: string | null
          status_maxapi?: string
          status_bridge?: string
          ultimo_teste_bridge?: string | null
          ultimo_teste_maxapi?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_configs_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          }
        ]
      }
      // ------------------------------------------------------------------
      // fs_profiles — perfis FiscalStock (criada por FiscalStock)
      // ------------------------------------------------------------------
      fs_profiles: {
        Row: {
          id: string
          user_id: string
          email: string
          nome: string
          role: string
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email?: string
          nome?: string
          role?: string
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          nome?: string
          role?: string
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // ------------------------------------------------------------------
      // fs_audit_logs — auditoria FiscalStock (criada por FiscalStock)
      // ------------------------------------------------------------------
      fs_audit_logs: {
        Row: {
          id: string
          user_id: string | null
          tenant_id: string | null
          loja_id: string | null
          acao: string
          entidade: string | null
          entidade_id: string | null
          detalhes_json: Json | null
          ip_origem: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          tenant_id?: string | null
          loja_id?: string | null
          acao: string
          entidade?: string | null
          entidade_id?: string | null
          detalhes_json?: Json | null
          ip_origem?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          tenant_id?: string | null
          loja_id?: string | null
          acao?: string
          entidade?: string | null
          entidade_id?: string | null
          detalhes_json?: Json | null
          ip_origem?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fs_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fs_audit_logs_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fs_user_can_access_loja: {
        Args: { _user_id: string; _loja_id: string }
        Returns: boolean
      }
      fs_user_can_manage_loja: {
        Args: { _user_id: string; _loja_id: string }
        Returns: boolean
      }
      fs_is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
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