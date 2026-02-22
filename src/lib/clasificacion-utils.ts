import { ClasificacionAlerta } from "@/hooks/useClasificacionesAlerta";
import { CategoriaWithSubs } from "@/hooks/useCategorias";

/**
 * Given a current clasificacion/subclasificacion, returns the next step in the sequence.
 * The clasificaciones array must be sorted by `orden` (already done by the hook).
 */
export function getNextClasificacion(
  clasificacionId: string | null | undefined,
  subclasificacionId: string | null | undefined,
  clasificaciones: ClasificacionAlerta[]
): { clasificacionId: string; subclasificacionId: string } {
  const empty = { clasificacionId: "", subclasificacionId: "" };
  if (!clasificacionId || clasificaciones.length === 0) return empty;

  const currentIdx = clasificaciones.findIndex((c) => c.id === clasificacionId);
  if (currentIdx === -1) return empty;

  const current = clasificaciones[currentIdx];

  if (subclasificacionId) {
    // Find current sub index
    const subIdx = current.subclasificaciones.findIndex((s) => s.id === subclasificacionId);
    if (subIdx !== -1 && subIdx < current.subclasificaciones.length - 1) {
      // Next sub in same clasificacion
      return {
        clasificacionId: current.id,
        subclasificacionId: current.subclasificaciones[subIdx + 1].id,
      };
    }
    // Last sub (or not found) → move to next clasificacion
    return getFirstOfNextClasificacion(currentIdx, clasificaciones);
  }

  // Has clasificacion but no sub → move to next clasificacion
  return getFirstOfNextClasificacion(currentIdx, clasificaciones);
}

function getFirstOfNextClasificacion(
  currentIdx: number,
  clasificaciones: ClasificacionAlerta[]
): { clasificacionId: string; subclasificacionId: string } {
  const empty = { clasificacionId: "", subclasificacionId: "" };
  if (currentIdx >= clasificaciones.length - 1) return empty; // no more

  const next = clasificaciones[currentIdx + 1];
  return {
    clasificacionId: next.id,
    subclasificacionId: next.subclasificaciones.length > 0 ? next.subclasificaciones[0].id : "",
  };
}

/**
 * Given a current categoria/subcategoria comercial, returns the next step in the sequence.
 * The categorias array must be sorted by `orden` (already done by the hook).
 */
export function getNextCategoriaComercial(
  categoriaId: string | null | undefined,
  subcategoriaId: string | null | undefined,
  categorias: CategoriaWithSubs[]
): { categoriaId: string; subcategoriaId: string } {
  const empty = { categoriaId: "", subcategoriaId: "" };
  if (!categoriaId || categorias.length === 0) return empty;

  const currentIdx = categorias.findIndex((c) => c.id === categoriaId);
  if (currentIdx === -1) return empty;

  const current = categorias[currentIdx];
  const subs = current.subcategorias_proyecto || [];

  if (subcategoriaId) {
    const subIdx = subs.findIndex((s) => s.id === subcategoriaId);
    if (subIdx !== -1 && subIdx < subs.length - 1) {
      return {
        categoriaId: current.id,
        subcategoriaId: subs[subIdx + 1].id,
      };
    }
    // Last sub or not found → move to next categoria
    return getFirstOfNextCategoria(currentIdx, categorias);
  }

  // Has categoria but no sub → move to next categoria
  return getFirstOfNextCategoria(currentIdx, categorias);
}

function getFirstOfNextCategoria(
  currentIdx: number,
  categorias: CategoriaWithSubs[]
): { categoriaId: string; subcategoriaId: string } {
  const empty = { categoriaId: "", subcategoriaId: "" };
  if (currentIdx >= categorias.length - 1) return empty;

  const next = categorias[currentIdx + 1];
  const subs = next.subcategorias_proyecto || [];
  return {
    categoriaId: next.id,
    subcategoriaId: subs.length > 0 ? subs[0].id : "",
  };
}
