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
          acao: string
          created_at: string
          detalhes_json: Json | null
          empresa_id: string | null
          entidade: string | null
          entidade_id: string | null
          id: string
          ip_origem: string | null
          loja_id: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes_json?: Json | null
          empresa_id?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip_origem?: string | null
          loja_id?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes_json?: Json | null
          empresa_id?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip_origem?: string | null
          loja_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          id: string
          nome_fantasia: string
          razao_social: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome_fantasia: string
          razao_social?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome_fantasia?: string
          razao_social?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      integration_configs: {
        Row: {
          bridge_token: string | null
          bridge_url: string | null
          created_at: string
          id: string
          loja_id: string
          maxapi_client_id: string | null
          maxapi_secret_key: string | null
          maxapi_token_cache: string | null
          maxapi_token_expires_at: string | null
          maxapi_url: string | null
          status_bridge: Database["public"]["Enums"]["integration_status"]
          status_maxapi: Database["public"]["Enums"]["integration_status"]
          ultimo_teste_bridge: string | null
          ultimo_teste_maxapi: string | null
          updated_at: string
        }
        Insert: {
          bridge_token?: string | null
          bridge_url?: string | null
          created_at?: string
          id?: string
          loja_id: string
          maxapi_client_id?: string | null
          maxapi_secret_key?: string | null
          maxapi_token_cache?: string | null
          maxapi_token_expires_at?: string | null
          maxapi_url?: string | null
          status_bridge?: Database["public"]["Enums"]["integration_status"]
          status_maxapi?: Database["public"]["Enums"]["integration_status"]
          ultimo_teste_bridge?: string | null
          ultimo_teste_maxapi?: string | null
          updated_at?: string
        }
        Update: {
          bridge_token?: string | null
          bridge_url?: string | null
          created_at?: string
          id?: string
          loja_id?: string
          maxapi_client_id?: string | null
          maxapi_secret_key?: string | null
          maxapi_token_cache?: string | null
          maxapi_token_expires_at?: string | null
          maxapi_url?: string | null
          status_bridge?: Database["public"]["Enums"]["integration_status"]
          status_maxapi?: Database["public"]["Enums"]["integration_status"]
          ultimo_teste_bridge?: string | null
          ultimo_teste_maxapi?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_configs_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          ativo: boolean
          created_at: string
          emp_id_maxdata: string
          empresa_id: string
          id: string
          nome: string
          terminal_maxdata: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          emp_id_maxdata: string
          empresa_id: string
          id?: string
          nome: string
          terminal_maxdata: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          emp_id_maxdata?: string
          empresa_id?: string
          id?: string
          nome?: string
          terminal_maxdata?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_empresas: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          role_na_empresa: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          role_na_empresa?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          role_na_empresa?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_global_admin: { Args: { _user_id: string }; Returns: boolean }
      user_can_access_loja: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_manage_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_manage_loja: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: boolean
      }
      user_role_on_empresa: {
        Args: { _empresa_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "operador" | "viewer"
      integration_status: "online" | "offline" | "erro" | "nao_configurado"
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
      app_role: ["owner", "admin", "operador", "viewer"],
      integration_status: ["online", "offline", "erro", "nao_configurado"],
    },
  },
} as const
