## Plan

1. **Corregir el flujo de Guardar en línea madre**
   - Haré que el formulario espere todo el guardado antes de cerrar o disparar procesos secundarios.
   - Bloquearé el botón mientras se guarda para evitar dobles submits durante los 10–15 segundos.

2. **Evitar los toasts múltiples reales**
   - El problema no parece venir solo de `executeParentSubmit`: el formulario también dispara sincronización de clientes e historial fuera del `await`, y esos hooks pueden invalidar/confirmar por separado.
   - Cambiaré esas acciones para que no generen confirmaciones múltiples durante el guardado de línea madre, o para que queden integradas/silenciosas en el flujo principal.

3. **Asegurar que `Estado Obra` se guarde y se refleje**
   - Revisaré el payload exacto que se envía desde `ProyectoFormDialog` a `executeParentSubmit`.
   - Mantendré la actualización de `estado_obra` y `fecha_estado_obra` aplicada a todas las sublíneas del grupo.
   - Después de escribir en la base, invalidaré `proyectos` una sola vez y recién ahí cerraré el diálogo.

4. **Mejorar el estado visual de carga**
   - Usaré un estado local de guardado para el diálogo de línea madre, porque actualmente `isLoading={updateProyecto.isPending}` no se activa cuando se usan escrituras directas.
   - El botón debe mostrar `Guardando...` y quedar deshabilitado hasta terminar.

## Archivos a modificar

- `src/pages/Proyectos.tsx`
- `src/components/proyectos/ProyectoFormDialog.tsx` si hace falta ajustar el submit async/silencioso
- Posiblemente `src/hooks/useSyncClienteProyecto.ts` si hay que permitir sincronización silenciosa sin toast

## Resultado esperado

Al editar una línea madre, cambiar **Estado Obra** y presionar **Guardar**:
- el botón muestra carga inmediatamente,
- no hay múltiples confirmaciones,
- aparece un solo toast final,
- el diálogo se cierra solo al terminar,
- el estado queda guardado y persiste al recargar.