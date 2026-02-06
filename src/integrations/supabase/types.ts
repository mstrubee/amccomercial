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
      condiciones_comerciales: {
        Row: {
          created_at: string
          descripcion: string | null
          empresa_id: string
          esquema_comision: number
          fecha_vigencia: string
          fee_fijo_mensual: number
          id: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          empresa_id: string
          esquema_comision?: number
          fecha_vigencia?: string
          fee_fijo_mensual?: number
          id?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          empresa_id?: string
          esquema_comision?: number
          fecha_vigencia?: string
          fee_fijo_mensual?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "condiciones_comerciales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          created_at: string
          estado: string
          fecha_inicio_relacion: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_inicio_relacion?: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_inicio_relacion?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      proyecto_empresas: {
        Row: {
          adjudicado: boolean
          empresa_id: string
          id: string
          monto_cotizacion: number | null
          proyecto_id: string
        }
        Insert: {
          adjudicado?: boolean
          empresa_id: string
          id?: string
          monto_cotizacion?: number | null
          proyecto_id: string
        }
        Update: {
          adjudicado?: boolean
          empresa_id?: string
          id?: string
          monto_cotizacion?: number | null
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_empresas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          adjudicado: boolean
          arq_contacto: string | null
          arq_mail: string | null
          arq_nombre: string | null
          arq_telefono: string | null
          comuna: string
          const_contacto: string | null
          const_mail: string | null
          const_nombre: string | null
          const_telefono: string | null
          created_at: string
          direccion: string
          duenos_contacto: string | null
          duenos_mail: string | null
          duenos_nombre: string | null
          duenos_telefono: string | null
          estado_amc: string
          estado_obra: string
          fecha_estado_obra: string | null
          id: string
          ito_contacto: string | null
          ito_mail: string | null
          ito_nombre: string | null
          ito_telefono: string | null
          monto_estimado: number | null
          nombre: string
          numero: number
          updated_at: string
        }
        Insert: {
          adjudicado?: boolean
          arq_contacto?: string | null
          arq_mail?: string | null
          arq_nombre?: string | null
          arq_telefono?: string | null
          comuna?: string
          const_contacto?: string | null
          const_mail?: string | null
          const_nombre?: string | null
          const_telefono?: string | null
          created_at?: string
          direccion?: string
          duenos_contacto?: string | null
          duenos_mail?: string | null
          duenos_nombre?: string | null
          duenos_telefono?: string | null
          estado_amc?: string
          estado_obra?: string
          fecha_estado_obra?: string | null
          id?: string
          ito_contacto?: string | null
          ito_mail?: string | null
          ito_nombre?: string | null
          ito_telefono?: string | null
          monto_estimado?: number | null
          nombre: string
          numero?: number
          updated_at?: string
        }
        Update: {
          adjudicado?: boolean
          arq_contacto?: string | null
          arq_mail?: string | null
          arq_nombre?: string | null
          arq_telefono?: string | null
          comuna?: string
          const_contacto?: string | null
          const_mail?: string | null
          const_nombre?: string | null
          const_telefono?: string | null
          created_at?: string
          direccion?: string
          duenos_contacto?: string | null
          duenos_mail?: string | null
          duenos_nombre?: string | null
          duenos_telefono?: string | null
          estado_amc?: string
          estado_obra?: string
          fecha_estado_obra?: string | null
          id?: string
          ito_contacto?: string | null
          ito_mail?: string | null
          ito_nombre?: string | null
          ito_telefono?: string | null
          monto_estimado?: number | null
          nombre?: string
          numero?: number
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
