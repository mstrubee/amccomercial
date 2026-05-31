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
      admin_notas: {
        Row: {
          contenido: string | null
          created_at: string | null
          deleted_at: string | null
          elemento_info: Json | null
          elemento_ruta: string | null
          elemento_selector: string | null
          estado: string
          id: string
          imagenes: string[] | null
          prioridad: string
          titulo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contenido?: string | null
          created_at?: string | null
          deleted_at?: string | null
          elemento_info?: Json | null
          elemento_ruta?: string | null
          elemento_selector?: string | null
          estado?: string
          id?: string
          imagenes?: string[] | null
          prioridad?: string
          titulo?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contenido?: string | null
          created_at?: string | null
          deleted_at?: string | null
          elemento_info?: Json | null
          elemento_ruta?: string | null
          elemento_selector?: string | null
          estado?: string
          id?: string
          imagenes?: string[] | null
          prioridad?: string
          titulo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      alerta_clasificaciones: {
        Row: {
          alerta_id: string
          clasificacion_id: string
          created_at: string
          id: string
          subclasificacion_id: string | null
        }
        Insert: {
          alerta_id: string
          clasificacion_id: string
          created_at?: string
          id?: string
          subclasificacion_id?: string | null
        }
        Update: {
          alerta_id?: string
          clasificacion_id?: string
          created_at?: string
          id?: string
          subclasificacion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerta_clasificaciones_alerta_id_fkey"
            columns: ["alerta_id"]
            isOneToOne: false
            referencedRelation: "alertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerta_clasificaciones_clasificacion_id_fkey"
            columns: ["clasificacion_id"]
            isOneToOne: false
            referencedRelation: "clasificaciones_alerta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerta_clasificaciones_subclasificacion_id_fkey"
            columns: ["subclasificacion_id"]
            isOneToOne: false
            referencedRelation: "subclasificaciones_alerta"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas: {
        Row: {
          categoria_proyecto_id: string | null
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
          subcategoria_proyecto_id: string | null
          subclasificacion_alerta_id: string | null
          texto: string
          titulo: string
          updated_at: string
          updated_by: string | null
          usuario_responsable_id: string
        }
        Insert: {
          categoria_proyecto_id?: string | null
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
          subcategoria_proyecto_id?: string | null
          subclasificacion_alerta_id?: string | null
          texto: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          usuario_responsable_id: string
        }
        Update: {
          categoria_proyecto_id?: string | null
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
          subcategoria_proyecto_id?: string | null
          subclasificacion_alerta_id?: string | null
          texto?: string
          titulo?: string
          updated_at?: string
          updated_by?: string | null
          usuario_responsable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_categoria_proyecto_id_fkey"
            columns: ["categoria_proyecto_id"]
            isOneToOne: false
            referencedRelation: "categorias_proyecto"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "alertas_subcategoria_proyecto_id_fkey"
            columns: ["subcategoria_proyecto_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_proyecto"
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
      chat_preferences: {
        Row: {
          created_at: string
          custom_sound_url: string | null
          id: string
          sound_option: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_sound_url?: string | null
          id?: string
          sound_option?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_sound_url?: string | null
          id?: string
          sound_option?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_preferences_user_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      delegaciones_alerta: {
        Row: {
          created_at: string
          delegado_id: string
          delegante_id: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          otorgado_por: string
          revocada: boolean
          revocada_at: string | null
        }
        Insert: {
          created_at?: string
          delegado_id: string
          delegante_id: string
          fecha_fin: string
          fecha_inicio?: string
          id?: string
          otorgado_por: string
          revocada?: boolean
          revocada_at?: string | null
        }
        Update: {
          created_at?: string
          delegado_id?: string
          delegante_id?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          otorgado_por?: string
          revocada?: boolean
          revocada_at?: string | null
        }
        Relationships: []
      }
      drive_files: {
        Row: {
          created_at: string
          created_by: string
          drive_file_id: string
          drive_folder_id: string | null
          file_name: string
          file_size: number
          id: string
          mime_type: string
          project_folder_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          drive_file_id: string
          drive_folder_id?: string | null
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string
          project_folder_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          drive_file_id?: string
          drive_folder_id?: string | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          project_folder_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_files_project_folder_id_fkey"
            columns: ["project_folder_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          empresa_id: string
          id: string
          is_completed: boolean
          parent_id: string | null
          proyecto_id: string | null
          text: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          is_completed?: boolean
          parent_id?: string | null
          proyecto_id?: string | null
          text: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          is_completed?: boolean
          parent_id?: string | null
          proyecto_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_checklist_items_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_checklist_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "empresa_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_checklist_items_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
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
          notas_atencion_especial: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string
          fecha_inicio_relacion?: string
          id?: string
          nombre: string
          notas_atencion_especial?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          fecha_inicio_relacion?: string
          id?: string
          nombre?: string
          notas_atencion_especial?: string
          updated_at?: string
        }
        Relationships: []
      }
      estados_amc: {
        Row: {
          color: string
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      estados_proyecto: {
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
      folder_templates: {
        Row: {
          created_at: string
          id: string
          is_repo_comun: boolean
          name: string
          orden: number
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_repo_comun?: boolean
          name: string
          orden?: number
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_repo_comun?: boolean
          name?: string
          orden?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folder_templates_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folder_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_estatus_empresa: {
        Row: {
          categoria_id: string | null
          created_at: string
          created_by: string
          fecha: string
          id: string
          monto_uf: number
          proyecto_empresa_id: string
          subcategoria_id: string | null
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          created_by: string
          fecha?: string
          id?: string
          monto_uf?: number
          proyecto_empresa_id: string
          subcategoria_id?: string | null
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          created_by?: string
          fecha?: string
          id?: string
          monto_uf?: number
          proyecto_empresa_id?: string
          subcategoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_estatus_empresa_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_proyecto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_estatus_empresa_proyecto_empresa_id_fkey"
            columns: ["proyecto_empresa_id"]
            isOneToOne: false
            referencedRelation: "proyecto_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_estatus_empresa_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias_proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      hitos_proyecto_empresa_extra_rows: {
        Row: {
          created_at: string
          created_by: string
          id: string
          orden: number
          proyecto_empresa_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          orden?: number
          proyecto_empresa_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          orden?: number
          proyecto_empresa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hitos_proyecto_empresa_extra_rows_proyecto_empresa_id_fkey"
            columns: ["proyecto_empresa_id"]
            isOneToOne: false
            referencedRelation: "proyecto_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      hitos_proyecto_empresa_values: {
        Row: {
          column_id: string
          created_by: string
          extra_row_id: string | null
          id: string
          proyecto_empresa_id: string
          row_id: string | null
          updated_at: string
          valor: string
        }
        Insert: {
          column_id: string
          created_by: string
          extra_row_id?: string | null
          id?: string
          proyecto_empresa_id: string
          row_id?: string | null
          updated_at?: string
          valor?: string
        }
        Update: {
          column_id?: string
          created_by?: string
          extra_row_id?: string | null
          id?: string
          proyecto_empresa_id?: string
          row_id?: string | null
          updated_at?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "hitos_proyecto_empresa_values_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "hitos_template_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hitos_proyecto_empresa_values_extra_row_id_fkey"
            columns: ["extra_row_id"]
            isOneToOne: false
            referencedRelation: "hitos_proyecto_empresa_extra_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hitos_proyecto_empresa_values_proyecto_empresa_id_fkey"
            columns: ["proyecto_empresa_id"]
            isOneToOne: false
            referencedRelation: "proyecto_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hitos_proyecto_empresa_values_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "hitos_template_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      hitos_template_column_options: {
        Row: {
          column_id: string
          created_at: string
          id: string
          orden: number
          valor: string
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          orden?: number
          valor: string
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          orden?: number
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "hitos_template_column_options_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "hitos_template_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      hitos_template_columns: {
        Row: {
          checkbox_action: string
          checkbox_color: string
          created_at: string
          editable_en_proyecto: boolean
          id: string
          nombre: string
          orden: number
          tipo: string
        }
        Insert: {
          checkbox_action?: string
          checkbox_color?: string
          created_at?: string
          editable_en_proyecto?: boolean
          id?: string
          nombre: string
          orden?: number
          tipo?: string
        }
        Update: {
          checkbox_action?: string
          checkbox_color?: string
          created_at?: string
          editable_en_proyecto?: boolean
          id?: string
          nombre?: string
          orden?: number
          tipo?: string
        }
        Relationships: []
      }
      hitos_template_row_defaults: {
        Row: {
          column_id: string
          id: string
          row_id: string
          updated_at: string
          valor: string
        }
        Insert: {
          column_id: string
          id?: string
          row_id: string
          updated_at?: string
          valor?: string
        }
        Update: {
          column_id?: string
          id?: string
          row_id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "hitos_template_row_defaults_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "hitos_template_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hitos_template_row_defaults_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "hitos_template_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      hitos_template_rows: {
        Row: {
          color: string | null
          created_at: string
          id: string
          orden: number
          parent_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          orden?: number
          parent_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          orden?: number
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hitos_template_rows_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "hitos_template_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_sync: {
        Row: {
          created_at: string
          created_by: string
          drive_file_id: string | null
          drive_folder_id: string | null
          error_message: string | null
          file_name: string
          file_size: number
          id: string
          mime_type: string
          project_folder_id: string
          retry_count: number
          status: string
          storage_path: string
          synced_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          drive_file_id?: string | null
          drive_folder_id?: string | null
          error_message?: string | null
          file_name: string
          file_size?: number
          id?: string
          mime_type?: string
          project_folder_id: string
          retry_count?: number
          status?: string
          storage_path: string
          synced_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          drive_file_id?: string | null
          drive_folder_id?: string | null
          error_message?: string | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          project_folder_id?: string
          retry_count?: number
          status?: string
          storage_path?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_sync_project_folder_id_fkey"
            columns: ["project_folder_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_status: string | null
          created_at: string
          current_section: string | null
          display_name: string
          email: string
          id: string
          last_seen_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_status?: string | null
          created_at?: string
          current_section?: string | null
          display_name?: string
          email: string
          id?: string
          last_seen_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_status?: string | null
          created_at?: string
          current_section?: string | null
          display_name?: string
          email?: string
          id?: string
          last_seen_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_folders: {
        Row: {
          created_at: string
          drive_folder_id: string | null
          id: string
          is_repo_comun: boolean
          name: string
          orden: number
          parent_id: string | null
          project_id: string
          template_id: string | null
        }
        Insert: {
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          is_repo_comun?: boolean
          name: string
          orden?: number
          parent_id?: string | null
          project_id: string
          template_id?: string | null
        }
        Update: {
          created_at?: string
          drive_folder_id?: string | null
          id?: string
          is_repo_comun?: boolean
          name?: string
          orden?: number
          parent_id?: string | null
          project_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_folders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "folder_templates"
            referencedColumns: ["id"]
          },
        ]
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
          estado_amc: string
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
          estado_amc?: string
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
          estado_amc?: string
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
      user_activity_thresholds: {
        Row: {
          created_at: string
          id: string
          idle_minutes: number
          offline_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idle_minutes?: number
          offline_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idle_minutes?: number
          offline_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_google_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          refresh_token: string
          scopes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token: string
          scopes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token?: string
          scopes?: string | null
          updated_at?: string
          user_id?: string
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
      ventas_proyecto_empresa: {
        Row: {
          created_at: string
          descripcion: string
          id: string
          monto_uf: number
          op: string
          proyecto_empresa_id: string
        }
        Insert: {
          created_at?: string
          descripcion?: string
          id?: string
          monto_uf?: number
          op?: string
          proyecto_empresa_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          id?: string
          monto_uf?: number
          op?: string
          proyecto_empresa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_proyecto_empresa_proyecto_empresa_id_fkey"
            columns: ["proyecto_empresa_id"]
            isOneToOne: false
            referencedRelation: "proyecto_empresas"
            referencedColumns: ["id"]
          },
        ]
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
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
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
