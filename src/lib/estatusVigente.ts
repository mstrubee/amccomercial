/**
 * REGLA DE NEGOCIO (definida por el usuario, 2026-09-20)
 *
 * El estatus vigente de una empresa en un proyecto es la entrada MÁS RECIENTE de
 * `historial_estatus_empresa`, entendida como la de fecha (`fecha`) más reciente.
 * Si dos entradas tienen la misma fecha (o ninguna), gana la registrada más tarde.
 *
 * El estatus guardado en `proyecto_empresas` (categoria_id / subcategoria_id)
 * debe ser siempre igual a esa entrada, y todo cambio de estatus se registra en
 * el historial y queda como la entrada más reciente. El historial es un registro
 * de cómo fue avanzando el proyecto: NO es un selector de estatus.
 *
 * Cualquier pantalla que muestre, filtre o cuente estatus de empresa debe usar
 * estas funciones, para que la regla viva en un solo lugar.
 */

export interface HistorialOrdenable {
  categoria_id: string | null;
  subcategoria_id: string | null;
  /** Fecha del estatus (YYYY-MM-DD). Una entrada sin fecha se considera la más antigua. */
  fecha?: string | null;
  /** Momento de registro (ISO). Desempata entradas con la misma fecha. */
  created_at: string;
}

/**
 * Comparador para `Array.sort`: deja PRIMERO la entrada más reciente
 * (fecha más reciente; a igual fecha, la registrada más tarde).
 */
export function compararHistorialMasRecientePrimero(a: HistorialOrdenable, b: HistorialOrdenable): number {
  const fa = a.fecha || "";
  const fb = b.fecha || "";
  if (fa !== fb) return fa < fb ? 1 : -1;
  const ca = `${a.created_at}`;
  const cb = `${b.created_at}`;
  if (ca !== cb) return ca < cb ? 1 : -1;
  return 0;
}

/** Copia ordenada con la entrada más reciente primero. */
export function ordenarHistorial<T extends HistorialOrdenable>(rows: readonly T[]): T[] {
  return [...rows].sort(compararHistorialMasRecientePrimero);
}

/** La entrada más reciente (la que define el estatus vigente), o null si no hay historial. */
export function historialVigente<T extends HistorialOrdenable>(rows: readonly T[] | null | undefined): T | null {
  let best: T | null = null;
  for (const r of rows || []) {
    if (!best || compararHistorialMasRecientePrimero(r, best) < 0) best = r;
  }
  return best;
}

/** ¿Dos estatus (categoría + subcategoría) son el mismo? */
export function mismoEstatus(
  a: { categoria_id: string | null; subcategoria_id: string | null },
  b: { categoria_id: string | null; subcategoria_id: string | null },
): boolean {
  return (a.categoria_id || null) === (b.categoria_id || null) && (a.subcategoria_id || null) === (b.subcategoria_id || null);
}

/**
 * Fecha con la que se registra un cambio de estatus. Un cambio siempre debe quedar
 * como la entrada más reciente, así que nunca puede ser anterior a la fecha de la
 * última entrada: si lo fuera, se usa la fecha de la última entrada.
 */
export function fechaNoAnterior(
  fecha: string | null | undefined,
  hoy: string,
  ultimo: { fecha?: string | null } | null | undefined,
): string {
  const elegida = fecha || hoy;
  const previa = ultimo?.fecha || "";
  return previa && previa > elegida ? previa : elegida;
}
