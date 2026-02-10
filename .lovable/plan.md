
## Corregir error de largo maximo en alertas

El error "value too long for type character varying(100)" ocurre porque las columnas `titulo` y `texto` de la tabla `alertas` tienen un limite de 100 caracteres. Al cargar datos masivamente, los textos generados por IA o ingresados manualmente pueden superar ese limite facilmente.

### Solucion

Ejecutar una migracion para cambiar ambas columnas de `character varying(100)` a `text` (sin limite de largo):

```sql
ALTER TABLE public.alertas ALTER COLUMN titulo TYPE text;
ALTER TABLE public.alertas ALTER COLUMN texto TYPE text;
```

Esto no afecta datos existentes ni requiere cambios en el codigo frontend, ya que los tipos de TypeScript generados ya usan `string` para ambos campos.
