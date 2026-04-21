import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import type { HitosTemplate, HitosRow, HitosColumn } from "@/hooks/useHitosTemplate";

const META_COLS = ["__row_id", "__parent_id", "__orden", "__numbering"] as const;

type FlatExportRow = {
  row: HitosRow;
  numbering: string;
};

function buildFlatRows(rows: HitosRow[]): FlatExportRow[] {
  const childrenMap = new Map<string | null, HitosRow[]>();
  rows.forEach((r) => {
    const key = r.parent_id ?? null;
    const arr = childrenMap.get(key) || [];
    arr.push(r);
    childrenMap.set(key, arr);
  });
  childrenMap.forEach((arr) => arr.sort((a, b) => a.orden - b.orden));
  const out: FlatExportRow[] = [];
  const walk = (parentId: string | null, prefix: string) => {
    const list = childrenMap.get(parentId) || [];
    list.forEach((r, i) => {
      const numbering = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      out.push({ row: r, numbering });
      walk(r.id, numbering);
    });
  };
  walk(null, "");
  return out;
}

function cellToString(tipo: string, raw: string): string | boolean {
  if (!raw) return tipo === "checkbox" ? false : "";
  if (tipo === "checkbox") {
    try {
      const p = JSON.parse(raw);
      return !!p.checked;
    } catch {
      return false;
    }
  }
  return raw;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Convierte texto a minúsculas y capitaliza la primera letra de cada oración.
// Preserva URLs/emails y secuencias en MAYÚSCULAS de 2+ letras (acrónimos como "AMC").
function toSentenceCase(input: string): string {
  const raw = input.replace(/\s+/g, " ").trim();
  if (!raw) return "";
  // Tokenizar palabras para preservar acrónimos
  const words = raw.split(" ").map((w) => {
    if (/^[A-ZÁÉÍÓÚÑ]{2,}$/.test(w)) return w; // acrónimo
    if (/^https?:\/\//i.test(w) || /@/.test(w)) return w;
    return w.toLowerCase();
  });
  let text = words.join(" ");
  // Capitalizar inicio y después de . ! ?
  text = text.replace(/(^|[.!?]\s+)([\p{L}])/gu, (_, p, c) => p + c.toUpperCase());
  return text;
}

function parseImportedCell(column: HitosColumn, value: any, currentRaw: string): string {
  const tipo = column.tipo;
  if (value === null || value === undefined || value === "") {
    return tipo === "checkbox" ? "" : "";
  }
  if (tipo === "checkbox") {
    const s = String(value).trim().toUpperCase();
    const checked = s === "TRUE" || s === "VERDADERO" || s === "1" || s === "SI" || s === "SÍ" || s === "X" || s === "✓";
    if (!checked) return "";
    // preserve existing fecha if present
    let fecha: string | undefined;
    try {
      const p = JSON.parse(currentRaw || "{}");
      if (p.fecha) fecha = p.fecha;
    } catch {}
    return JSON.stringify(fecha ? { checked: true, fecha } : { checked: true });
  }
  if (tipo === "fecha") {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // try dd-mm-yyyy or dd/mm/yyyy
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return s;
  }
  if (tipo === "select") {
    const target = normalize(String(value));
    if (!target) return "";
    const match = column.options.find((o) => normalize(o.valor) === target);
    return match ? match.valor : "";
  }
  return toSentenceCase(String(value));
}

export function exportTemplateToExcel(template: HitosTemplate, fileName = "hitos-plantilla.xlsx") {
  const cols = [...template.columns].sort((a, b) => a.orden - b.orden);
  const flat = buildFlatRows(template.rows);
  const defaultsMap = new Map<string, string>();
  template.defaults.forEach((d) => defaultsMap.set(`${d.row_id}|${d.column_id}`, d.valor));

  const aoa: any[][] = [];
  // header — para selects incluimos las opciones como hint visible
  aoa.push([
    "#",
    ...cols.map((c) => {
      if (c.tipo === "select" && c.options.length) {
        const opts = c.options.map((o) => o.valor).join(" | ");
        return `${c.nombre} [select: ${opts}]`;
      }
      return `${c.nombre} [${c.tipo}]`;
    }),
    ...META_COLS,
  ]);
  flat.forEach(({ row, numbering }) => {
    const line: any[] = [numbering];
    cols.forEach((c) => {
      const raw = defaultsMap.get(`${row.id}|${c.id}`) || "";
      line.push(cellToString(c.tipo, raw));
    });
    line.push(row.id, row.parent_id || "", row.orden, numbering);
    aoa.push(line);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // column widths — meta columns ocultas para no distraer al usuario
  ws["!cols"] = [
    { wch: 8 },
    ...cols.map((c) => ({ wch: c.tipo === "select" ? 32 : 24 })),
    { hidden: true, wch: 0 },
    { hidden: true, wch: 0 },
    { hidden: true, wch: 0 },
    { hidden: true, wch: 0 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla");

  // hoja oculta con referencia de columnas (para trazabilidad)
  const colsSheet = XLSX.utils.aoa_to_sheet([
    ["column_id", "nombre", "tipo", "orden"],
    ...cols.map((c) => [c.id, c.nombre, c.tipo, c.orden]),
  ]);
  XLSX.utils.book_append_sheet(wb, colsSheet, "_columnas");
  // marcar la hoja _columnas como oculta
  wb.Workbook = {
    Sheets: [
      { name: "Plantilla", Hidden: 0 },
      { name: "_columnas", Hidden: 1 },
    ],
  } as any;

  XLSX.writeFile(wb, fileName);
}

export type ImportSummary = {
  added: number;
  updated: number;
  deleted: number;
  defaultsUpserted: number;
  errors: string[];
};

export async function importTemplateFromExcel(
  file: File,
  template: HitosTemplate,
): Promise<ImportSummary> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const wsName = wb.SheetNames.find((n) => n === "Plantilla") || wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!aoa.length) throw new Error("Hoja vacía");
  const header = aoa[0].map((h) => String(h || "").trim());
  const cols = [...template.columns].sort((a, b) => a.orden - b.orden);

  // Map header positions
  const colIndexByColumnId = new Map<string, number>();
  cols.forEach((c) => {
    const expected = `${c.nombre} [${c.tipo}]`;
    let idx = header.indexOf(expected);
    if (idx < 0) idx = header.findIndex((h) => h.toLowerCase().startsWith(c.nombre.toLowerCase() + " ["));
    if (idx >= 0) colIndexByColumnId.set(c.id, idx);
  });
  const idIdx = header.indexOf("__row_id");
  const parentIdx = header.indexOf("__parent_id");
  const numIdx = header.indexOf("#");
  if (idIdx < 0) throw new Error("Falta columna oculta __row_id en el archivo");

  const defaultsMap = new Map<string, string>();
  template.defaults.forEach((d) => defaultsMap.set(`${d.row_id}|${d.column_id}`, d.valor));
  const existingRowIds = new Set(template.rows.map((r) => r.id));
  const seenRowIds = new Set<string>();

  const summary: ImportSummary = { added: 0, updated: 0, deleted: 0, defaultsUpserted: 0, errors: [] };

  // Pass 1: build pending rows. La jerarquía se determina por la columna # (ej. 1, 1.1, 1.1.2)
  // si está presente; si no, se usa __parent_id como respaldo.
  type Pending = {
    lineIndex: number;
    rowId: string | null;
    parentRef: string;
    numbering: string; // ej "1.2.3"
    isNew: boolean;
  };
  const pendings: Pending[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const line = aoa[i];
    if (!line || line.every((c) => c === "" || c === null || c === undefined)) continue;
    const rowIdRaw = String(line[idIdx] || "").trim();
    const parentRaw = parentIdx >= 0 ? String(line[parentIdx] || "").trim() : "";
    const numRaw = numIdx >= 0 ? String(line[numIdx] ?? "").trim() : "";
    const isExisting = !!rowIdRaw && existingRowIds.has(rowIdRaw);
    if (isExisting) seenRowIds.add(rowIdRaw);
    pendings.push({
      lineIndex: i,
      rowId: isExisting ? rowIdRaw : null,
      parentRef: parentRaw,
      numbering: numRaw,
      isNew: !isExisting,
    });
  }

  // Si hay numeración disponible, derivar parent por prefijo (ej "1.2.3" -> padre "1.2").
  // Construimos un mapa numbering -> Pending para resolución.
  const hasNumbering = pendings.some((p) => /^\d+(\.\d+)*$/.test(p.numbering));
  const byNumbering = new Map<string, Pending>();
  if (hasNumbering) {
    pendings.forEach((p) => {
      if (/^\d+(\.\d+)*$/.test(p.numbering)) byNumbering.set(p.numbering, p);
    });
  }

  // Sort: por numbering jerárquico cuando exista, así los padres se procesan antes que los hijos.
  const cmpNumbering = (a: string, b: string) => {
    const aa = a.split(".").map((n) => parseInt(n, 10) || 0);
    const bb = b.split(".").map((n) => parseInt(n, 10) || 0);
    const len = Math.max(aa.length, bb.length);
    for (let i = 0; i < len; i++) {
      const da = aa[i] ?? 0;
      const db = bb[i] ?? 0;
      if (da !== db) return da - db;
    }
    return 0;
  };
  if (hasNumbering) {
    pendings.sort((a, b) => {
      const an = /^\d+(\.\d+)*$/.test(a.numbering);
      const bn = /^\d+(\.\d+)*$/.test(b.numbering);
      if (an && bn) return cmpNumbering(a.numbering, b.numbering);
      if (an) return -1;
      if (bn) return 1;
      return a.lineIndex - b.lineIndex;
    });
  }

  const orderCounters = new Map<string, number>();
  const rootKey = "__ROOT__";

  for (const p of pendings) {
    let parentId: string | null = null;

    if (hasNumbering && /^\d+(\.\d+)*$/.test(p.numbering) && p.numbering.includes(".")) {
      const parts = p.numbering.split(".");
      parts.pop();
      const parentNum = parts.join(".");
      const parentPending = byNumbering.get(parentNum);
      if (parentPending && parentPending.rowId) parentId = parentPending.rowId;
    } else if (p.parentRef) {
      if (existingRowIds.has(p.parentRef)) parentId = p.parentRef;
    }

    const key = parentId || rootKey;
    const orden = orderCounters.get(key) ?? 0;
    orderCounters.set(key, orden + 1);

    if (p.isNew) {
      const { data, error } = await supabase
        .from("hitos_template_rows")
        .insert({ orden, parent_id: parentId } as any)
        .select()
        .single();
      if (error) {
        summary.errors.push(`Fila ${p.lineIndex + 1}: ${error.message}`);
        continue;
      }
      p.rowId = (data as any).id;
      summary.added += 1;
    } else {
      // update existing row's parent/orden if different
      const existing = template.rows.find((r) => r.id === p.rowId);
      if (existing && (existing.parent_id !== parentId || existing.orden !== orden)) {
        const { error } = await supabase
          .from("hitos_template_rows")
          .update({ parent_id: parentId, orden })
          .eq("id", p.rowId!);
        if (error) summary.errors.push(`Fila ${p.lineIndex + 1}: ${error.message}`);
        else summary.updated += 1;
      }
    }
  }

  // Pass 2: upsert defaults for each row
  for (const p of pendings) {
    if (!p.rowId) continue;
    const line = aoa[p.lineIndex];
    for (const c of cols) {
      const idx = colIndexByColumnId.get(c.id);
      if (idx === undefined) continue;
      const current = defaultsMap.get(`${p.rowId}|${c.id}`) || "";
      const newVal = parseImportedCell(c, line[idx], current);
      if (newVal === current) continue;
      const { data: existing } = await supabase
        .from("hitos_template_row_defaults" as any)
        .select("id")
        .eq("row_id", p.rowId)
        .eq("column_id", c.id)
        .maybeSingle();
      if (existing) {
        if (newVal === "") {
          await supabase.from("hitos_template_row_defaults" as any).delete().eq("id", (existing as any).id);
        } else {
          await supabase
            .from("hitos_template_row_defaults" as any)
            .update({ valor: newVal, updated_at: new Date().toISOString() })
            .eq("id", (existing as any).id);
        }
      } else if (newVal !== "") {
        await supabase.from("hitos_template_row_defaults" as any).insert({
          row_id: p.rowId,
          column_id: c.id,
          valor: newVal,
        });
      }
      summary.defaultsUpserted += 1;
    }
  }

  // Pass 3: delete rows that existed but were not in the file
  const toDelete = [...existingRowIds].filter((id) => !seenRowIds.has(id));
  for (const id of toDelete) {
    const { error } = await supabase.from("hitos_template_rows").delete().eq("id", id);
    if (error) summary.errors.push(`Eliminar ${id}: ${error.message}`);
    else summary.deleted += 1;
  }

  return summary;
}