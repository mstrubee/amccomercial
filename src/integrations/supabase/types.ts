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
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      alertas: {
        Row: {
          clasificacion_alerta_id: string | null
          completada: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          deleted: boolean
          deleted_at: string | null
          deleted_by: string | null
          empresa_id: string | null
          fecha_seguimiento: string
          id: string
          parent_alerta_id: string | null
          proyecto_id: string
          subclasificacion_alerta_id: string | null
          texto: string
          titulo: string
          updated_at: string
          updated_by: string | null
          usuario_responsable_id: string
        }
        Insert: {
          clasificacion_alerta_id?: string | null
          completada?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          empresa_id?: string | null
          fecha_seguimiento: string
          id?: string
          parent_alerta_id?: string | null
          proyecto_id: string
          subclasificacion_alerta_id?: string | null
          texto: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          usuario_responsable_id: string
        }
        Update: {
          clasificacion_alerta_id?: string | null
          completada?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          empresa_id?: string | null
          fecha_seguimiento?: string
          id?: string
          parent_alerta_id?: string | null
          proyecto_id?: string
          subclasificacion_alerta_id?: string | null
          texto?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          usuario_responsable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_clasificacion_alerta_id_fkey"
            columns: ["clasificacion_alerta_id"]
            isOneToOne: false
            referencedRelation: "clasificaciones_alerta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_parent_alerta_id_fkey"
            columns: ["parent_alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_subclasificacion_alerta_id_fkey"
            columns: ["subclasificacion_alerta_id"]
            isOneToOne: false
            referencedRelation: "subclasificaciones_alerta"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      archivos_muestra: {
        Row: {
          created_at: string
          id: string
          nombre: string
          path: string
          uploaded_by: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          path: string
          uploaded_by: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          path?: string
          uploaded_by?: string
          url?: string
        }
        Relationships: []
      }
      captadores: {
        Row: {
          categoria_id: string
          contacto: string
          created_at: string
          email: string
          id: string
          nombre: string
          telefono: string
          updated_at: string
        }
        Insert: {
          categoria_id: string
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          nombre: string
          telefono?: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          telefono?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captadores_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_cliente: {
        Row: {
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      categorias_proyecto: {
        Row: {
          boton_bg_color: string | null
          boton_label: string | null
          boton_text_color: string | null
          color: string
          created_at: string
          es_adjudicado: boolean
          id: string
          nombre: string
          orden: number
          permite_fecha: boolean
        }
        Insert: {
          boton_bg_color?: string | null
          boton_label?: string | null
          boton_text_color?: string | null
          color?: string
          created_at?: string
          es_adjudicado?: boolean
          id?: string
          nombre: string
          orden?: number
          permite_fecha?: boolean
        }
        Update: {
          boton_bg_color?: string | null
          boton_label?: string | null
          boton_text_color?: string | null
          color?: string
          created_at?: string
          es_adjudicado?: boolean
          id?: string
          nombre?: string
          orden?: number
          permite_fecha?: boolean
        }
        Relationships: []
      }
      clasificaciones_alerta: {
        Row: {
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      clasificaciones_proyecto: {
        Row: {
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      clientes: {
        Row: {
          categoria_id: string
          contacto: string
          created_at: string
          email: string
          id: string
          nombre: string
          telefono: string
          updated_at: string
        }
        Insert: {
          categoria_id: string
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          nombre: string
          telefono?: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          telefono?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
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
      contactos_captador: {
        Row: {
          captador_id: string
          contacto: string
          created_at: string
          email: string
          id: string
          orden: number
          telefono: string
        }
        Insert: {
          captador_id: string
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          orden?: number
          telefono?: string
        }
        Update: {
          captador_id?: string
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          orden?: number
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "contactos_captador_captador_id_fkey"
            columns: ["captador_id"]
            isOneToOne: false
            referencedRelation: "captadores"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos_cliente: {
        Row: {
          cliente_id: string
          contacto: string
          created_at: string
          email: string
          id: string
          orden: number
          telefono: string
        }
        Insert: {
          cliente_id: string
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          orden?: number
          telefono?: string
        }
        Update: {
          cliente_id?: string
          contacto?: string
          created_at?: string
          email?: string
          id?: string
          orden?: number
          telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "contactos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proyecto_captadores: {
        Row: {
          captador_id: string
          created_at: string
          id: string
          proyecto_id: string
        }
        Insert: {
          captador_id: string
          created_at?: string
          id?: string
          proyecto_id: string
        }
        Update: {
          captador_id?: string
          created_at?: string
          id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_captadores_captador_id_fkey"
            columns: ["captador_id"]
            isOneToOne: false
            referencedRelation: "captadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_captadores_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_clientes: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          proyecto_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          proyecto_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_clientes_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_empresas: {
        Row: {
          adjudicado: boolean
          categoria_id: string | null
          empresa_id: string
          fecha_categoria: string | null
          ganado_fecha: string | null
          ganado_op: string | null
          ganado_presupuesto: number | null
          id: string
          monto_cotizacion: number | null
          proyecto_id: string
          subcategoria_id: string | null
        }
        Insert: {
          adjudicado?: boolean
          categoria_id?: string | null
          empresa_id: string
          fecha_categoria?: string | null
          ganado_fecha?: string | null
          ganado_op?: string | null
          ganado_presupuesto?: number | null
          id?: string
          monto_cotizacion?: number | null
          proyecto_id: string
          subcategoria_id?: string | null
        }
        Update: {
          adjudicado?: boolean
          categoria_id?: string | null
          empresa_id?: string
          fecha_categoria?: string | null
          ganado_fecha?: string | null
          ganado_op?: string | null
          ganado_presupuesto?: number | null
          id?: string
          monto_cotizacion?: number | null
          proyecto_id?: string
          subcategoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_empresas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_proyecto"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "proyecto_empresas_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_proyecto"
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
          clasificacion_id: string | null
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
          fecha_ingreso: string
          id: string
          ito_contacto: string | null
          ito_mail: string | null
          ito_nombre: string | null
          ito_telefono: string | null
          monto_estimado: number | null
          nombre: string
          nota_grupo: string
          notas: string
          numero: number
          region: string
          updated_at: string
        }
        Insert: {
          adjudicado?: boolean
          arq_contacto?: string | null
          arq_mail?: string | null
          arq_nombre?: string | null
          arq_telefono?: string | null
          clasificacion_id?: string | null
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
          fecha_ingreso?: string
          id?: string
          ito_contacto?: string | null
          ito_mail?: string | null
          ito_nombre?: string | null
          ito_telefono?: string | null
          monto_estimado?: number | null
          nombre: string
          nota_grupo?: string
          notas?: string
          numero?: number
          region?: string
          updated_at?: string
        }
        Update: {
          adjudicado?: boolean
          arq_contacto?: string | null
          arq_mail?: string | null
          arq_nombre?: string | null
          arq_telefono?: string | null
          clasificacion_id?: string | null
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
          fecha_ingreso?: string
          id?: string
          ito_contacto?: string | null
          ito_mail?: string | null
          ito_nombre?: string | null
          ito_telefono?: string | null
          monto_estimado?: number | null
          nombre?: string
          nota_grupo?: string
          notas?: string
          numero?: number
          region?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_clasificacion_id_fkey"
            columns: ["clasificacion_id"]
            isOneToOne: false
            referencedRelation: "clasificaciones_proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategorias_proyecto: {
        Row: {
          boton_bg_color: string | null
          boton_label: string | null
          boton_text_color: string | null
          categoria_id: string
          color: string
          created_at: string
          es_adjudicado: boolean
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          boton_bg_color?: string | null
          boton_label?: string | null
          boton_text_color?: string | null
          categoria_id: string
          color?: string
          created_at?: string
          es_adjudicado?: boolean
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          boton_bg_color?: string | null
          boton_label?: string | null
          boton_text_color?: string | null
          categoria_id?: string
          color?: string
          created_at?: string
          es_adjudicado?: boolean
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_proyecto_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      subclasificaciones_alerta: {
        Row: {
          clasificacion_id: string
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          clasificacion_id: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          clasificacion_id?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "subclasificaciones_alerta_clasificacion_id_fkey"
            columns: ["clasificacion_id"]
            isOneToOne: false
            referencedRelation: "clasificaciones_alerta"
            referencedColumns: ["id"]
          },
        ]
      }
      titulos_alerta: {
        Row: {
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          dashboard_widgets: string[] | null
          empresas_visibles: string[] | null
          id: string
          puede_editar: boolean
          secciones_visibles: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dashboard_widgets?: string[] | null
          empresas_visibles?: string[] | null
          id?: string
          puede_editar?: boolean
          secciones_visibles?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dashboard_widgets?: string[] | null
          empresas_visibles?: string[] | null
          id?: string
          puede_editar?: boolean
          secciones_visibles?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "usuario_tipo_1" | "usuario_tipo_2"
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
      app_role: ["admin", "usuario_tipo_1", "usuario_tipo_2"],
    },
  },
} as const
