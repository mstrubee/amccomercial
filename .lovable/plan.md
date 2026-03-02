
Objetivo: salir del bucle de “no funciona” con una corrección verificable y evitar que vuelvas a perder créditos en pruebas ciegas.

1) Diagnóstico confirmado (causa más probable)
- La app sí genera correctamente la URL OAuth desde backend.
- En tus capturas, los “redirect URI” configurados en Google aparecen con diferencias de texto respecto al URI real (hay caracteres cambiados y rutas truncadas).
- URI real que está enviando la app:
  `https://bprwbhvhuetjnmsjqfcm.supabase.co/functions/v1/google-calendar-auth`
- Si en Google Cloud hay aunque sea 1 carácter distinto, Google devuelve 403/blocked antes de volver a la app.

2) Desbloqueo inmediato (sin código, para validar ahora)
- Dejar solo este Redirect URI exacto en el OAuth Client:
  `https://bprwbhvhuetjnmsjqfcm.supabase.co/functions/v1/google-calendar-auth`
- Eliminar entradas parecidas/duplicadas con typo.
- Esperar 5–10 min por propagación y probar nuevamente.

3) Implementación propuesta para que no vuelva a pasar
- Agregar diagnóstico OAuth visible en /calendario (UI):
  - Mostrar “Redirect URI exacto en uso” con botón “Copiar”.
  - Mostrar “Client ID en uso” (enmascarado parcial).
  - Mostrar último error OAuth legible (ej. redirect_uri_mismatch, access_denied, app_not_configured).
- Mejorar callback en `google-calendar-auth`:
  - Si falla intercambio de código por token, redirigir a `/calendario?oauth_error=...` con mensaje claro.
  - Registrar logs estructurados (sin exponer secretos) para saber exactamente en qué paso falla.
- Mejorar robustez de autenticación de funciones:
  - Migrar validación a `getClaims()` (alineado con signing keys) en lugar de `getUser(token)` para evitar falsos 401 por validación.
- Mejorar redirect post-callback:
  - Evitar URL hardcodeada fija; usar variable de entorno de app base URL (publicada) y fallback seguro.
  - Soportar preview/publicado sin romper flujo.

4) Archivos a tocar
- `supabase/functions/google-calendar-auth/index.ts`
- `supabase/functions/google-calendar-api/index.ts` (solo ajuste de validación JWT)
- `src/hooks/useGoogleCalendar.ts`
- `src/pages/Calendario.tsx`
- (Opcional) componente nuevo de diagnóstico en `src/components/calendario/`

5) Riesgos y controles
- Riesgo: seguir probando con URI mal escrito en Google.
  - Control: exponer en UI el URI exacto y copiar/pegar literal.
- Riesgo: errores silenciosos de OAuth.
  - Control: retorno de `oauth_error` + toast específico + logs backend.

6) Validación final (end-to-end)
- Flujo completo: `/calendario` → “Conectar Google Calendar” → autorizar Google → volver a `/calendario?connected=true`.
- Confirmar en UI estado conectado.
- Crear, editar y eliminar 1 evento real.
- Recargar página y verificar persistencia de conexión y listado.

Señal de éxito esperada:
- Sin 403 en Google.
- Callback llega al backend.
- Token guardado para el usuario.
- Estado “connected: true” y eventos visibles.
