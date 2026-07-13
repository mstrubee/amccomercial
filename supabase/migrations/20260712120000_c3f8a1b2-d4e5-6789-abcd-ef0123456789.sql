
-- DATA-001: per-row transactional RPC for CargaMasiva
--
-- Wraps the project + empresa-link writes for a single spreadsheet row inside
-- one PostgreSQL transaction.  If the empresa-link INSERT fails the project
-- INSERT is rolled back automatically — no orphaned proyecto rows possible.
--
-- The frontend still calls this row-by-row (preserving the pause/resume UX);
-- only the 2 separate Supabase calls become 1 atomic RPC call.

CREATE OR REPLACE FUNCTION public.process_carga_masiva_row(
  p_existing_proj_id  UUID,
  p_nombre            TEXT,
  p_fecha_ingreso     DATE,
  p_clasificacion_id  UUID,
  p_estado_obra       TEXT,
  p_fecha_estado_obra DATE,
  p_estado_amc        TEXT,
  p_direccion         TEXT,
  p_region            TEXT,
  p_comuna            TEXT,
  p_arq_nombre        TEXT,
  p_arq_contacto      TEXT,
  p_arq_mail          TEXT,
  p_arq_telefono      TEXT,
  p_const_nombre      TEXT,
  p_const_contacto    TEXT,
  p_const_mail        TEXT,
  p_const_telefono    TEXT,
  p_ito_nombre        TEXT,
  p_ito_contacto      TEXT,
  p_ito_mail          TEXT,
  p_ito_telefono      TEXT,
  p_duenos_nombre     TEXT,
  p_duenos_contacto   TEXT,
  p_duenos_mail       TEXT,
  p_duenos_telefono   TEXT,
  p_notas             TEXT,
  p_emp_links         JSONB   -- [{empresa_id: uuid, categoria_id: uuid|null}]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id  UUID;
  v_temp_id     UUID;
  v_created_ids UUID[]  := '{}';
  v_link        JSONB;
  v_empresa_id  UUID;
  v_cat_id      UUID;
  v_num_links   INTEGER;
  v_idx         INTEGER;
BEGIN
  -- Only admins may call this function (matches the isAdmin route guard in the UI).
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  v_num_links := COALESCE(jsonb_array_length(p_emp_links), 0);

  -- ── Branch 1: project already exists ────────────────────────────────────────
  IF p_existing_proj_id IS NOT NULL THEN

    -- Replicate the TypeScript "skip empty/null fields" update logic:
    --   text fields:  COALESCE(NULLIF(param, ''), existing_value)  — skip if ''
    --   uuid/date:    COALESCE(param, existing_value)              — skip if NULL
    --   always-set:   fecha_ingreso, estado_amc, adjudicado        — matches original
    UPDATE proyectos SET
      nombre            = COALESCE(NULLIF(p_nombre,            ''), nombre),
      fecha_ingreso     = p_fecha_ingreso,
      clasificacion_id  = COALESCE(p_clasificacion_id,  clasificacion_id),
      estado_obra       = COALESCE(NULLIF(p_estado_obra,       ''), estado_obra),
      fecha_estado_obra = COALESCE(p_fecha_estado_obra,  fecha_estado_obra),
      estado_amc        = p_estado_amc,
      direccion         = COALESCE(NULLIF(p_direccion,         ''), direccion),
      region            = COALESCE(NULLIF(p_region,            ''), region),
      comuna            = COALESCE(NULLIF(p_comuna,            ''), comuna),
      arq_nombre        = COALESCE(NULLIF(p_arq_nombre,        ''), arq_nombre),
      arq_contacto      = COALESCE(NULLIF(p_arq_contacto,      ''), arq_contacto),
      arq_mail          = COALESCE(NULLIF(p_arq_mail,          ''), arq_mail),
      arq_telefono      = COALESCE(NULLIF(p_arq_telefono,      ''), arq_telefono),
      const_nombre      = COALESCE(NULLIF(p_const_nombre,      ''), const_nombre),
      const_contacto    = COALESCE(NULLIF(p_const_contacto,    ''), const_contacto),
      const_mail        = COALESCE(NULLIF(p_const_mail,        ''), const_mail),
      const_telefono    = COALESCE(NULLIF(p_const_telefono,    ''), const_telefono),
      ito_nombre        = COALESCE(NULLIF(p_ito_nombre,        ''), ito_nombre),
      ito_contacto      = COALESCE(NULLIF(p_ito_contacto,      ''), ito_contacto),
      ito_mail          = COALESCE(NULLIF(p_ito_mail,          ''), ito_mail),
      ito_telefono      = COALESCE(NULLIF(p_ito_telefono,      ''), ito_telefono),
      duenos_nombre     = COALESCE(NULLIF(p_duenos_nombre,     ''), duenos_nombre),
      duenos_contacto   = COALESCE(NULLIF(p_duenos_contacto,   ''), duenos_contacto),
      duenos_mail       = COALESCE(NULLIF(p_duenos_mail,       ''), duenos_mail),
      duenos_telefono   = COALESCE(NULLIF(p_duenos_telefono,   ''), duenos_telefono),
      adjudicado        = false,
      notas             = COALESCE(NULLIF(p_notas,             ''), notas)
    WHERE id = p_existing_proj_id;

    v_project_id := p_existing_proj_id;

    -- UPSERT empresa links.
    -- ON CONFLICT relies on the UNIQUE(proyecto_id, empresa_id) constraint
    -- (defined in migration 20260206203503, name: proyecto_empresas_proyecto_id_empresa_id_key).
    -- Preserves monto_cotizacion, adjudicado, ganado_*, estado_amc set manually.
    FOR v_idx IN 0..(v_num_links - 1) LOOP
      v_link       := p_emp_links->v_idx;
      v_empresa_id := (v_link->>'empresa_id')::UUID;
      v_cat_id     := CASE WHEN (v_link->>'categoria_id') IS NULL
                           THEN NULL
                           ELSE (v_link->>'categoria_id')::UUID END;
      INSERT INTO proyecto_empresas (proyecto_id, empresa_id, categoria_id, subcategoria_id)
      VALUES (v_project_id, v_empresa_id, v_cat_id, NULL)
      ON CONFLICT (proyecto_id, empresa_id) DO UPDATE
        SET categoria_id    = EXCLUDED.categoria_id,
            subcategoria_id = NULL;
    END LOOP;

  -- ── Branch 2: new project, no empresa links ──────────────────────────────────
  ELSIF v_num_links = 0 THEN

    INSERT INTO proyectos (
      nombre, fecha_ingreso, clasificacion_id, estado_obra, fecha_estado_obra, estado_amc,
      direccion, region, comuna,
      arq_nombre,   arq_contacto,   arq_mail,   arq_telefono,
      const_nombre, const_contacto, const_mail, const_telefono,
      ito_nombre,   ito_contacto,   ito_mail,   ito_telefono,
      duenos_nombre, duenos_contacto, duenos_mail, duenos_telefono,
      adjudicado, notas
    ) VALUES (
      p_nombre, p_fecha_ingreso, p_clasificacion_id, p_estado_obra, p_fecha_estado_obra, p_estado_amc,
      p_direccion, p_region, p_comuna,
      p_arq_nombre,   p_arq_contacto,   p_arq_mail,   p_arq_telefono,
      p_const_nombre, p_const_contacto, p_const_mail, p_const_telefono,
      p_ito_nombre,   p_ito_contacto,   p_ito_mail,   p_ito_telefono,
      p_duenos_nombre, p_duenos_contacto, p_duenos_mail, p_duenos_telefono,
      false, p_notas
    )
    RETURNING id INTO v_project_id;

  -- ── Branch 3: N new projects, one per empresa link ───────────────────────────
  ELSE

    -- Insert one proyecto row per empresa; accumulate their IDs.
    FOR v_idx IN 0..(v_num_links - 1) LOOP
      INSERT INTO proyectos (
        nombre, fecha_ingreso, clasificacion_id, estado_obra, fecha_estado_obra, estado_amc,
        direccion, region, comuna,
        arq_nombre,   arq_contacto,   arq_mail,   arq_telefono,
        const_nombre, const_contacto, const_mail, const_telefono,
        ito_nombre,   ito_contacto,   ito_mail,   ito_telefono,
        duenos_nombre, duenos_contacto, duenos_mail, duenos_telefono,
        adjudicado, notas
      ) VALUES (
        p_nombre, p_fecha_ingreso, p_clasificacion_id, p_estado_obra, p_fecha_estado_obra, p_estado_amc,
        p_direccion, p_region, p_comuna,
        p_arq_nombre,   p_arq_contacto,   p_arq_mail,   p_arq_telefono,
        p_const_nombre, p_const_contacto, p_const_mail, p_const_telefono,
        p_ito_nombre,   p_ito_contacto,   p_ito_mail,   p_ito_telefono,
        p_duenos_nombre, p_duenos_contacto, p_duenos_mail, p_duenos_telefono,
        false, p_notas
      )
      RETURNING id INTO v_temp_id;
      v_created_ids := v_created_ids || v_temp_id;
    END LOOP;

    v_project_id := v_created_ids[1];

    -- Link each new proyecto to its empresa.
    -- If any INSERT here fails the entire function call is aborted and PostgreSQL
    -- rolls back all the proyecto INSERTs above — no orphaned rows, no compensatory
    -- DELETE needed in application code.
    FOR v_idx IN 1..v_num_links LOOP
      v_link       := p_emp_links->(v_idx - 1);
      v_empresa_id := (v_link->>'empresa_id')::UUID;
      v_cat_id     := CASE WHEN (v_link->>'categoria_id') IS NULL
                           THEN NULL
                           ELSE (v_link->>'categoria_id')::UUID END;
      INSERT INTO proyecto_empresas (
        proyecto_id, empresa_id, monto_cotizacion, adjudicado, categoria_id, subcategoria_id
      ) VALUES (
        v_created_ids[v_idx], v_empresa_id, 0, false, v_cat_id, NULL
      );
    END LOOP;

  END IF;

  RETURN v_project_id;
END;
$$;

-- Grant execute to authenticated users; the admin check is enforced inside the function.
GRANT EXECUTE ON FUNCTION public.process_carga_masiva_row TO authenticated;
