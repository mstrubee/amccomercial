

# Fix: "Failed to send a request to the Edge Function" en Carga Masiva

## Problema

Cuando hay muchas filas con alertas, las llamadas secuenciales a la edge function `parse-alertas` fallan porque:
1. Cada llamada al gateway de IA puede tardar 5-15 segundos
2. Muchas llamadas consecutivas causan timeouts del lado del cliente
3. No hay reintentos ante fallos transitorios
4. Las funciones se reinician (boot/shutdown) sin procesar el request

## Solucion

### 1. Agregar retry con backoff exponencial en el cliente (`src/pages/CargaMasiva.tsx`)

Crear una funcion helper `invokeWithRetry` que reintente hasta 3 veces con delays crecientes (1s, 2s, 4s) ante errores de tipo "Failed to send" o timeout.

### 2. Agregar delay entre filas

Insertar un pequeno delay (500ms) entre cada llamada secuencial para evitar saturar las edge functions con requests simultaneos.

### 3. Aplicar el mismo patron a `parse-contactos`

La funcion `parseContactosWithAI` tiene el mismo problema potencial, aplicar retry tambien.

### 4. Mejorar mensajes de error

En vez de solo mostrar el error y continuar, mostrar cuantas filas fallaron al final y ofrecer un boton para reintentar solo las filas fallidas.

## Cambios tecnicos

### `src/pages/CargaMasiva.tsx`

- Nueva funcion helper `invokeWithRetry(functionName, body, maxRetries = 3)` que envuelve `supabase.functions.invoke` con logica de retry
- Agregar `await delay(500)` entre iteraciones del loop en `parseAlertasWithAI`
- Agregar `await delay(500)` entre iteraciones del loop en `parseContactosWithAI`
- Agregar boton "Reintentar fallidas" que filtra las filas que tienen alertas sin parsear y vuelve a correr el pipeline solo para esas

### Detalle del retry

```text
Intento 1 -> falla -> esperar 1s
Intento 2 -> falla -> esperar 2s  
Intento 3 -> falla -> marcar como error, continuar con siguiente fila
```

No se requieren cambios en las edge functions ni en la base de datos.

