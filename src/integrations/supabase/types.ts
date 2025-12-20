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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      atribuicao_cartelas: {
        Row: {
          atribuicao_id: string
          created_at: string
          data_atribuicao: string | null
          data_devolucao: string | null
          id: string
          numero_cartela: number
          status: string | null
          venda_id: string | null
        }
        Insert: {
          atribuicao_id: string
          created_at?: string
          data_atribuicao?: string | null
          data_devolucao?: string | null
          id?: string
          numero_cartela: number
          status?: string | null
          venda_id?: string | null
        }
        Update: {
          atribuicao_id?: string
          created_at?: string
          data_atribuicao?: string | null
          data_devolucao?: string | null
          id?: string
          numero_cartela?: number
          status?: string | null
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atribuicao_cartelas_atribuicao_id_fkey"
            columns: ["atribuicao_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      atribuicoes: {
        Row: {
          created_at: string
          id: string
          sorteio_id: string
          updated_at: string | null
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sorteio_id: string
          updated_at?: string | null
          vendedor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sorteio_id?: string
          updated_at?: string | null
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atribuicoes_sorteio_id_fkey"
            columns: ["sorteio_id"]
            isOneToOne: false
            referencedRelation: "sorteios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      cartelas: {
        Row: {
          created_at: string
          id: string
          numero: number
          sorteio_id: string
          status: string | null
          updated_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          numero: number
          sorteio_id: string
          status?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          numero?: number
          sorteio_id?: string
          status?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cartelas_sorteio_id_fkey"
            columns: ["sorteio_id"]
            isOneToOne: false
            referencedRelation: "sorteios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartelas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          created_at: string
          data_pagamento: string | null
          forma_pagamento: string | null
          id: string
          valor: number | null
          venda_id: string
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          valor?: number | null
          venda_id: string
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          valor?: number | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          titulo_sistema: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nome: string
          titulo_sistema?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          titulo_sistema?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sorteios: {
        Row: {
          created_at: string
          data_sorteio: string | null
          id: string
          nome: string
          premio: string | null
          premios: Json | null
          quantidade_cartelas: number | null
          status: string | null
          updated_at: string | null
          user_id: string
          valor_cartela: number | null
        }
        Insert: {
          created_at?: string
          data_sorteio?: string | null
          id?: string
          nome: string
          premio?: string | null
          premios?: Json | null
          quantidade_cartelas?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          valor_cartela?: number | null
        }
        Update: {
          created_at?: string
          data_sorteio?: string | null
          id?: string
          nome?: string
          premio?: string | null
          premios?: Json | null
          quantidade_cartelas?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          valor_cartela?: number | null
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      usuarios: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          role: string
          senha_hash: string
          titulo_sistema: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          role?: string
          senha_hash: string
          titulo_sistema?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          role?: string
          senha_hash?: string
          titulo_sistema?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vendas: {
        Row: {
          cliente_nome: string | null
          cliente_telefone: string | null
          created_at: string
          data_venda: string | null
          id: string
          numeros_cartelas: string | null
          sorteio_id: string
          status: string | null
          updated_at: string | null
          valor_pago: number | null
          valor_total: number | null
          vendedor_id: string | null
        }
        Insert: {
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          data_venda?: string | null
          id?: string
          numeros_cartelas?: string | null
          sorteio_id: string
          status?: string | null
          updated_at?: string | null
          valor_pago?: number | null
          valor_total?: number | null
          vendedor_id?: string | null
        }
        Update: {
          cliente_nome?: string | null
          cliente_telefone?: string | null
          created_at?: string
          data_venda?: string | null
          id?: string
          numeros_cartelas?: string | null
          sorteio_id?: string
          status?: string | null
          updated_at?: string | null
          valor_pago?: number | null
          valor_total?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_sorteio_id_fkey"
            columns: ["sorteio_id"]
            isOneToOne: false
            referencedRelation: "sorteios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          ativo: boolean | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          sorteio_id: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          sorteio_id: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          sorteio_id?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedores_sorteio_id_fkey"
            columns: ["sorteio_id"]
            isOneToOne: false
            referencedRelation: "sorteios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
