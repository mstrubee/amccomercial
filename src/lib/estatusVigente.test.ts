import { describe, it, expect } from "vitest";
import {
  compararHistorialMasRecientePrimero,
  fechaNoAnterior,
  historialVigente,
  mismoEstatus,
  ordenarHistorial,
} from "./estatusVigente";

const h = (id: string, fecha: string | null, created_at: string, sub: string | null = null) => ({
  id,
  categoria_id: "cat",
  subcategoria_id: sub,
  fecha,
  created_at,
});

describe("historialVigente", () => {
  it("devuelve null si no hay historial", () => {
    expect(historialVigente([])).toBeNull();
    expect(historialVigente(null)).toBeNull();
    expect(historialVigente(undefined)).toBeNull();
  });

  it("gana la entrada de fecha más reciente, aunque se haya registrado antes", () => {
    const rows = [
      h("a", "2026-06-10", "2026-06-10T10:00:00Z"),
      h("b", "2026-07-01", "2026-07-01T09:00:00Z"),
      h("c", "2026-06-20", "2026-09-01T09:00:00Z"), // registrada después, pero de fecha anterior
    ];
    expect(historialVigente(rows)?.id).toBe("b");
  });

  it("a igual fecha gana la registrada más tarde", () => {
    const rows = [
      h("a", "2026-07-01", "2026-07-01T09:00:00Z"),
      h("b", "2026-07-01", "2026-07-01T15:00:00Z"),
    ];
    expect(historialVigente(rows)?.id).toBe("b");
  });

  it("una entrada sin fecha es la más antigua", () => {
    const rows = [
      h("sin", null, "2026-09-20T10:00:00Z"),
      h("con", "2026-03-01", "2026-03-01T10:00:00Z"),
    ];
    expect(historialVigente(rows)?.id).toBe("con");
  });

  it("si la única entrada no tiene fecha, esa es la vigente", () => {
    expect(historialVigente([h("sin", null, "2026-09-20T10:00:00Z")])?.id).toBe("sin");
  });

  it("no depende del orden de entrada", () => {
    const rows = [
      h("a", "2026-05-01", "2026-05-01T10:00:00Z"),
      h("b", "2026-08-01", "2026-08-01T10:00:00Z"),
      h("c", "2026-06-01", "2026-06-01T10:00:00Z"),
    ];
    expect(historialVigente([...rows].reverse())?.id).toBe("b");
    expect(historialVigente(rows)?.id).toBe("b");
  });
});

describe("ordenarHistorial", () => {
  it("deja la más reciente primero y no modifica el arreglo original", () => {
    const rows = [
      h("a", "2026-05-01", "2026-05-01T10:00:00Z"),
      h("b", "2026-08-01", "2026-08-01T10:00:00Z"),
      h("c", null, "2026-09-01T10:00:00Z"),
    ];
    const orden = ordenarHistorial(rows).map((r) => r.id);
    expect(orden).toEqual(["b", "a", "c"]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("el comparador es consistente (antisimétrico)", () => {
    const a = h("a", "2026-05-01", "2026-05-01T10:00:00Z");
    const b = h("b", "2026-08-01", "2026-08-01T10:00:00Z");
    expect(compararHistorialMasRecientePrimero(a, b)).toBeGreaterThan(0);
    expect(compararHistorialMasRecientePrimero(b, a)).toBeLessThan(0);
    expect(compararHistorialMasRecientePrimero(a, a)).toBe(0);
  });
});

describe("mismoEstatus", () => {
  it("compara categoría y subcategoría, tratando null y undefined igual", () => {
    expect(mismoEstatus({ categoria_id: "c", subcategoria_id: null }, { categoria_id: "c", subcategoria_id: null })).toBe(true);
    expect(mismoEstatus({ categoria_id: "c", subcategoria_id: "s" }, { categoria_id: "c", subcategoria_id: null })).toBe(false);
    expect(mismoEstatus({ categoria_id: "c", subcategoria_id: "s" }, { categoria_id: "c", subcategoria_id: "s2" })).toBe(false);
  });
});

describe("fechaNoAnterior", () => {
  const hoy = "2026-09-20";

  it("usa hoy si no se elige fecha", () => {
    expect(fechaNoAnterior(null, hoy, null)).toBe(hoy);
    expect(fechaNoAnterior("", hoy, undefined)).toBe(hoy);
  });

  it("respeta la fecha elegida si no es anterior a la última entrada", () => {
    expect(fechaNoAnterior("2026-09-25", hoy, { fecha: "2026-09-01" })).toBe("2026-09-25");
    expect(fechaNoAnterior("2026-09-01", hoy, { fecha: "2026-09-01" })).toBe("2026-09-01");
  });

  it("un cambio nunca queda anterior a la última entrada: se ajusta a su fecha", () => {
    expect(fechaNoAnterior("2026-03-01", hoy, { fecha: "2026-07-14" })).toBe("2026-07-14");
  });

  it("si la última entrada no tiene fecha, no restringe", () => {
    expect(fechaNoAnterior("2026-03-01", hoy, { fecha: null })).toBe("2026-03-01");
  });

  it("un cambio siempre resulta ser la entrada vigente tras registrarse", () => {
    const previas = [h("a", "2026-07-14", "2026-07-14T10:00:00Z", "ganado")];
    const ultimo = historialVigente(previas);
    // El usuario intenta registrar un cambio con fecha retroactiva.
    const fecha = fechaNoAnterior("2026-03-01", hoy, ultimo);
    const nueva = h("nueva", fecha, "2026-09-20T10:00:00Z", "otro");
    expect(historialVigente([...previas, nueva])?.id).toBe("nueva");
  });
});
