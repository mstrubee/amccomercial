

## Plan: Poblar proyecto_clientes con los contactos actuales de cada proyecto

### Situacion actual

- La tabla `proyecto_clientes` tiene **0 registros**
- Los proyectos tienen contactos en campos de texto: `arq_nombre`, `const_nombre`, `ito_nombre`, `duenos_nombre`
- La tabla `clientes` ya tiene registros que coinciden con la mayoria de esos nombres
- Hay un pequeno grupo de nombres que no coinciden exactamente (variantes como "ANF" vs "ANF arquitectos", "EMU arq" vs "EMU arquitectos", etc.)

### Que se hara

Una migracion SQL que:

1. **Crea 7 clientes faltantes** para nombres sin coincidencia exacta:
   - Archiplan, Interplan, JT Schmidt (categoria Arquitectura)
   - AICE, Varios, CF (categoria Constructora)
   - Soledad Hansen (categoria Duenos)

2. **Inserta relaciones en `proyecto_clientes`** cruzando los 4 campos de contacto de cada proyecto contra la tabla de clientes:
   - Coincidencias exactas (case-insensitive, con trim)
   - Coincidencias fuzzy para variantes conocidas:
     - "ANF" / "anf" -> ANF arquitectos
     - "EMU" / "EMU arq" -> EMU arquitectos
     - "Estudio Base / Estudio Base" -> Estudio Base
     - "LKDM / LKDM / LKDM" -> LKDM
     - "Raimundo Anguita" -> Raimungo Anguita
     - "ROSENDE y ASOCIADOS..." -> ROSENDE & ASOCIADOS...

3. Usa `ON CONFLICT DO NOTHING` para evitar duplicados

### Resultado esperado

- ~656 relaciones insertadas (309 arq + 235 const + 36 ito + 76 duenos, menos duplicados donde un mismo cliente aparece en multiples roles del mismo proyecto)
- La columna "Contactos" en la tabla de proyectos mostrara los clientes correctamente vinculados
- El detalle de cada cliente mostrara los proyectos vinculados

### Sin cambios de codigo

Solo se requiere una migracion de datos SQL; no hay cambios en componentes ni hooks.

