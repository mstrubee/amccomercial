import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCategorias } from "@/hooks/useCategorias";
import { useClasificaciones } from "@/hooks/useClasificaciones";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { REGIONES_CHILE } from "@/data/chile-geo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Brain, Bell, FileText, Users, Sparkles, Plus, Link, ChevronDown, ChevronRight, Paperclip, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const ESTADOS_OBRA = [
  "Anteproyecto", "Proyecto", "Licitación", "Constructora Adjudicada",
  "Obra Gruesa Inicial", "Obra Gruesa Intermedia", "Terminaciones", "Detenida", "Sin Información",
];

const TEMPLATE_COLUMNS = [
  "Nombre Proyecto", "Fecha Ingreso", "Clasificación", "Estado Obra", "Fecha Estado Obra",
  "Estado AMC",
  "Empresa 1", "Categoría Empresa 1", "Empresa 2", "Categoría Empresa 2",
  "Empresa 3", "Categoría Empresa 3", "Empresa 4", "Categoría Empresa 4",
  "Dirección", "Región", "Comuna",
  "Arq Nombre", "Arq Contacto", "Arq Email", "Arq Teléfono",
  "Const Nombre", "Const Contacto", "Const Email", "Const Teléfono",
  "ITO Nombre", "ITO Contacto", "ITO Email", "ITO Teléfono",
  "Dueños Nombre", "Dueños Contacto", "Dueños Email", "Dueños Teléfono",
  "Notas / Alertas",
];

/** Dropdown field definitions for AI matching */
const DROPDOWN_FIELDS: { column: string; getOptions: (ctx: DropdownCtx) => string[] }[] = [
  { column: "Clasificación", getOptions: (ctx) => ctx.clasificacionNames },
  { column: "Estado Obra", getOptions: () => ESTADOS_OBRA },
  { column: "Estado AMC", getOptions: (ctx) => ctx.estadosAMC },
  { column: "Región", getOptions: (ctx) => ctx.regionNames },
  ...([1, 2, 3, 4].flatMap((i) => [
    { column: `Empresa ${i}`, getOptions: (ctx: DropdownCtx) => ctx.empresaNames },
    { column: `Categoría Empresa ${i}`, getOptions: (ctx: DropdownCtx) => ctx.categoriaNames },
  ])),
];

interface DropdownCtx {
  clasificacionNames: string[];
  estadosAMC: string[];
  empresaNames: string[];
  categoriaNames: string[];
  regionNames: string[];
}

interface ParsedAlerta {
  fecha: string | null;
  texto: string;
  esFutura: boolean;
  crearAlerta: boolean;
  /** null = línea madre (proyecto), empresa_id string = empresa específica */
  empresaId: string | null;
  /** Index of parent alert within the same row's alertas array, or null */
  parentIndex: number | null;
}

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
  alertas: ParsedAlerta[];
  alertasParsing: boolean;
  alertasParsed: boolean;
  /** Fields that were AI-corrected */
  aiCorrected: string[];
  /** Fields that AI couldn't match - need manual correction */
  aiUnmatched: string[];
}

export default function CargaMasiva() {
  const { data: empresas } = useEmpresas();
  const { data: categorias } = useCategorias();
  const { data: clasificaciones } = useClasificaciones();
  const queryClient = useQueryClient();

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [parsingAlertas, setParsingAlertas] = useState(false);
  const [parsingContactos, setParsingContactos] = useState(false);
  const [matchingDropdowns, setMatchingDropdowns] = useState(false);
  const [dropdownsMatched, setDropdownsMatched] = useState(false);
  const [aiPhase, setAiPhase] = useState<"idle" | "dropdowns" | "alertas" | "contactos" | "done">("idle");
  const [openProjects, setOpenProjects] = useState<Record<number, boolean>>({});
  const aiRunTriggered = useRef(false);
  const [uploadingSample, setUploadingSample] = useState(false);

  // Load persisted sample files from DB
  const { data: sampleFiles, refetch: refetchSamples } = useQuery({
    queryKey: ["archivos-muestra"],
    queryFn: async () => {
      const { data, error } = await supabase.from("archivos_muestra" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown) as { id: string; nombre: string; path: string; url: string; created_at: string }[];
    },
  });

  const [estadosAMC] = useState<string[]>(["Vigente", "Descartado", "Todo Ofrecido", "Sin Respuesta"]);

  const empresaNames = useMemo(() => (empresas || []).map((e) => e.nombre), [empresas]);
  const categoriaNames = useMemo(() => (categorias || []).map((c) => c.nombre), [categorias]);
  const clasificacionNames = useMemo(() => (clasificaciones || []).map((c) => c.nombre), [clasificaciones]);
  const regionNames = useMemo(() => REGIONES_CHILE.map((r) => r.nombre), []);

  const dropdownCtx = useMemo<DropdownCtx>(() => ({
    clasificacionNames, estadosAMC, empresaNames, categoriaNames, regionNames,
  }), [clasificacionNames, estadosAMC, empresaNames, categoriaNames, regionNames]);

  const downloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const wsData = [TEMPLATE_COLUMNS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = TEMPLATE_COLUMNS.map((col) => ({ wch: Math.max(col.length + 4, 18) }));
    XLSX.utils.book_append_sheet(wb, ws, "Proyectos");

    const refData: string[][] = [];
    const maxLen = Math.max(clasificacionNames.length, ESTADOS_OBRA.length, estadosAMC.length, empresaNames.length, categoriaNames.length, regionNames.length);
    const refHeaders = ["Clasificaciones", "Estados Obra", "Estados AMC", "Empresas", "Categorías", "Regiones"];
    refData.push(refHeaders);
    for (let i = 0; i < maxLen; i++) {
      refData.push([
        clasificacionNames[i] || "", ESTADOS_OBRA[i] || "", estadosAMC[i] || "",
        empresaNames[i] || "", categoriaNames[i] || "", regionNames[i] || "",
      ]);
    }

    REGIONES_CHILE.forEach((r) => {
      const colIdx = refHeaders.length;
      if (refData[0]) refData[0].push(`Comunas ${r.nombre}`);
      r.comunas.forEach((c, i) => {
        if (!refData[i + 1]) refData[i + 1] = [];
        refData[i + 1][colIdx] = c;
      });
    });

    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef["!cols"] = refHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, wsRef, "Opciones (Referencia)");

    XLSX.writeFile(wb, "Plantilla_Carga_Masiva_Proyectos.xlsx");
    toast.success("Plantilla descargada");
  }, [clasificacionNames, estadosAMC, empresaNames, categoriaNames, regionNames]);

  /** Find region from comuna using chile-geo data */
  const findRegionByComuna = useCallback((comuna: string): string => {
    if (!comuna) return "";
    const comunaTrimmed = comuna.trim();
    for (const reg of REGIONES_CHILE) {
      if (reg.comunas.some((c) => c.toLowerCase() === comunaTrimmed.toLowerCase())) {
        return reg.nombre;
      }
    }
    return "";
  }, []);

  /** Initial validation - only checks required fields, NOT dropdown matches */
  const validateRowBasic = useCallback(
    (row: Record<string, string>, idx: number): ParsedRow => {
      const errors: string[] = [];
      const nombre = (row["Nombre Proyecto"] || "").trim();
      if (!nombre) errors.push("Nombre Proyecto requerido");

      // Auto-detect region from comuna
      let region = (row["Región"] || "").trim();
      const comuna = (row["Comuna"] || "").trim();
      if (!region && comuna) {
        region = findRegionByComuna(comuna);
        if (region) row["Región"] = region;
      }

      // Validate comuna belongs to region (if both provided and region is valid)
      if (region && regionNames.includes(region) && comuna) {
        const reg = REGIONES_CHILE.find((r) => r.nombre === region);
        if (reg && !reg.comunas.some((c) => c.toLowerCase() === comuna.toLowerCase()))
          errors.push(`Comuna "${comuna}" no pertenece a ${region}`);
      }

      return {
        rowIndex: idx + 2, data: row, errors, valid: errors.length === 0,
        alertas: [], alertasParsing: false, alertasParsed: false,
        aiCorrected: [], aiUnmatched: [],
      };
    },
    [regionNames, findRegionByComuna]
  );

  /** Full validation including dropdown checks - called after AI matching or inline edits */
  const revalidateRow = useCallback((row: ParsedRow): ParsedRow => {
    const errors: string[] = [];
    const d = row.data;
    const nombre = (d["Nombre Proyecto"] || "").trim();
    if (!nombre) errors.push("Nombre Proyecto requerido");

    const clasificacion = (d["Clasificación"] || "").trim();
    if (clasificacion && !clasificacionNames.includes(clasificacion))
      errors.push(`Clasificación "${clasificacion}" no reconocida`);

    const estadoObra = (d["Estado Obra"] || "").trim();
    if (estadoObra && !ESTADOS_OBRA.includes(estadoObra))
      errors.push(`Estado Obra "${estadoObra}" no reconocido`);

    const estadoAmc = (d["Estado AMC"] || "").trim();
    if (estadoAmc && !estadosAMC.includes(estadoAmc))
      errors.push(`Estado AMC "${estadoAmc}" no reconocido`);

    const region = (d["Región"] || "").trim();
    const comuna = (d["Comuna"] || "").trim();
    if (region && !regionNames.includes(region))
      errors.push(`Región "${region}" no reconocida`);
    if (region && regionNames.includes(region) && comuna) {
      const reg = REGIONES_CHILE.find((r) => r.nombre === region);
      if (reg && !reg.comunas.some((c) => c.toLowerCase() === comuna.toLowerCase()))
        errors.push(`Comuna "${comuna}" no pertenece a ${region}`);
    }

    for (let i = 1; i <= 4; i++) {
      const emp = (d[`Empresa ${i}`] || "").trim();
      if (emp && !empresaNames.includes(emp)) errors.push(`Empresa ${i} "${emp}" no reconocida`);
      const cat = (d[`Categoría Empresa ${i}`] || "").trim();
      if (cat && !categoriaNames.includes(cat)) errors.push(`Categoría Empresa ${i} "${cat}" no reconocida`);
    }

    return { ...row, errors, valid: errors.length === 0 };
  }, [clasificacionNames, estadosAMC, empresaNames, categoriaNames, regionNames]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploaded(false);
      setDropdownsMatched(false);
      setAiPhase("idle");
      aiRunTriggered.current = false;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
          if (rows.length === 0) { toast.error("El archivo no contiene datos"); return; }
          const parsed = rows.map((row, i) => validateRowBasic(row, i));
          setParsedRows(parsed);
          aiRunTriggered.current = false;
          toast.info(`${parsed.length} filas leídas. Iniciando procesamiento con IA...`);
        } catch { toast.error("Error al leer el archivo"); }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = "";
    },
    [validateRowBasic]
  );



  const matchDropdownsWithAI = useCallback(async () => {
    // Collect all items that need matching
    const items: { rowIndex: number; column: string; value: string; options: string[] }[] = [];

    for (const row of parsedRows) {
      for (const field of DROPDOWN_FIELDS) {
        const value = (row.data[field.column] || "").trim();
        if (!value) continue;
        const options = field.getOptions(dropdownCtx);
        // Check exact match (case insensitive)
        const exactMatch = options.find((o) => o.toLowerCase() === value.toLowerCase());
        if (exactMatch) {
          // Auto-correct case differences silently
          if (exactMatch !== value) {
            row.data[field.column] = exactMatch;
          }
        } else {
          items.push({ rowIndex: row.rowIndex, column: field.column, value, options });
        }
      }
    }

    setMatchingDropdowns(true);

    try {
      // --- Phase 1: Match existing dropdown values with AI ---
      const batchSize = 30;
      const allResults: { index: number; original: string; match: string | null; confidence: number }[] = [];

      if (items.length > 0) {
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize).map((item, idx) => ({
            index: idx + i,
            value: item.value,
            field: item.column,
            options: item.options,
          }));

          const { data, error } = await supabase.functions.invoke("match-dropdown-values", {
            body: { items: batch },
          });

          if (error) throw error;
          if (data.results) allResults.push(...data.results);
        }
      }

      // Apply dropdown match results first
      let updatedRows = [...parsedRows];
      for (const result of allResults) {
        const item = items[result.index];
        if (!item) continue;
        updatedRows = updatedRows.map((row) => {
          if (row.rowIndex !== item.rowIndex) return row;
          const newData = { ...row.data };
          const newAiCorrected = [...row.aiCorrected];
          const newAiUnmatched = [...row.aiUnmatched];
          if (result.match && result.confidence >= 90) {
            newData[item.column] = result.match;
            newAiCorrected.push(item.column);
          } else {
            newData[item.column] = "";
            newAiUnmatched.push(item.column);
          }
          return { ...row, data: newData, aiCorrected: newAiCorrected, aiUnmatched: newAiUnmatched };
        });
      }

      // --- Phase 2: Infer classification from project name when empty ---
      const clsOptions = dropdownCtx.clasificacionNames;
      if (clsOptions.length > 0) {
        const inferItems: { rowIndex: number; projectName: string }[] = [];
        for (const row of updatedRows) {
          const cls = (row.data["Clasificación"] || "").trim();
          const name = (row.data["Nombre Proyecto"] || "").trim();
          if (!cls && name) {
            inferItems.push({ rowIndex: row.rowIndex, projectName: name });
          }
        }

        if (inferItems.length > 0) {
          for (let i = 0; i < inferItems.length; i += batchSize) {
            const batch = inferItems.slice(i, i + batchSize).map((item, idx) => ({
              index: idx + i,
              value: item.projectName,
              field: "Clasificación (inferida del nombre)",
              options: clsOptions,
            }));

            const { data, error } = await supabase.functions.invoke("match-dropdown-values", {
              body: { items: batch },
            });

            if (error) throw error;
            if (data.results) {
              for (const result of data.results) {
                const item = inferItems[result.index];
                if (!item || !result.match || result.confidence < 70) continue;
                updatedRows = updatedRows.map((row) => {
                  if (row.rowIndex !== item.rowIndex) return row;
                  const newData = { ...row.data };
                  newData["Clasificación"] = result.match!;
                  return { ...row, data: newData, aiCorrected: [...row.aiCorrected, "Clasificación"] };
                });
              }
            }
          }
        }
      }

      // Revalidate all rows
      setParsedRows(updatedRows.map(revalidateRow));

      const matched = allResults.filter((r) => r.match && r.confidence >= 90).length;
      const unmatched = allResults.filter((r) => !r.match || r.confidence < 90).length;

      setDropdownsMatched(true);
      if (matched > 0 && unmatched > 0) {
        toast.info(`IA corrigió ${matched} valores. ${unmatched} requieren corrección manual.`);
      } else if (matched > 0) {
        toast.success(`IA corrigió ${matched} valores automáticamente.`);
      } else if (unmatched > 0) {
        toast.warning(`${unmatched} valores no pudieron ser identificados. Corrija manualmente.`);
      } else {
        toast.success("Todos los valores coinciden correctamente");
      }
    } catch (err: any) {
      toast.error("Error al clasificar con IA: " + err.message);
    } finally {
      setMatchingDropdowns(false);
    }
  }, [parsedRows, dropdownCtx, revalidateRow]);

  /** Update a single field in a row and revalidate */
  const updateRowField = useCallback((rowIndex: number, column: string, value: string) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.rowIndex !== rowIndex) return row;
        const newData = { ...row.data, [column]: value };
        const newUnmatched = row.aiUnmatched.filter((f) => f !== column);
        return revalidateRow({ ...row, data: newData, aiUnmatched: newUnmatched });
      })
    );
  }, [revalidateRow]);

  /** Get options for a dropdown field column */
  const getOptionsForColumn = useCallback((column: string): string[] => {
    const field = DROPDOWN_FIELDS.find((f) => f.column === column);
    return field ? field.getOptions(dropdownCtx) : [];
  }, [dropdownCtx]);

  /** Parse alertas text using AI for all rows that have content */
  const parseAlertasWithAI = useCallback(async () => {
    const rowsWithAlertas = parsedRows.filter(
      (r) => r.valid && (r.data["Notas / Alertas"] || "").trim() && !r.alertasParsed
    );
    if (rowsWithAlertas.length === 0) {
      toast.info("No hay textos de alertas para procesar");
      return;
    }

    setParsingAlertas(true);
    const cutoffDate = new Date("2026-01-01");

    for (const row of rowsWithAlertas) {
      setParsedRows((prev) =>
        prev.map((r) => r.rowIndex === row.rowIndex ? { ...r, alertasParsing: true } : r)
      );

      try {
        const { data, error } = await supabase.functions.invoke("parse-alertas", {
          body: { texto: row.data["Notas / Alertas"] },
        });

        if (error) throw error;

        // Get empresas linked to this row for auto-assignment
        const rowEmpNames: { id: string; nombre: string }[] = [];
        for (let i = 1; i <= 4; i++) {
          const empName = (row.data[`Empresa ${i}`] || "").trim();
          if (empName && empresas) {
            const emp = empresas.find((e) => e.nombre === empName);
            if (emp) rowEmpNames.push({ id: emp.id, nombre: emp.nombre });
          }
        }

        const alertas: ParsedAlerta[] = (data.alertas || []).map((a: any) => {
          const fecha = a.fecha || null;
          const esFutura = fecha ? new Date(fecha) >= cutoffDate : false;
          // Auto-assign empresa if the alert text mentions a known empresa name
          let empresaId: string | null = null;
          if (rowEmpNames.length > 0) {
            const textoLower = (a.texto || "").toLowerCase();
            const matched = rowEmpNames.find((e) => textoLower.includes(e.nombre.toLowerCase()));
            if (matched) empresaId = matched.id;
          }
          return { fecha, texto: a.texto, esFutura, crearAlerta: true, empresaId, parentIndex: null };
        });

        setParsedRows((prev) =>
          prev.map((r) =>
            r.rowIndex === row.rowIndex
              ? { ...r, alertas, alertasParsing: false, alertasParsed: true }
              : r
          )
        );
      } catch (err: any) {
        toast.error(`Error procesando fila ${row.rowIndex}: ${err.message}`);
        setParsedRows((prev) =>
          prev.map((r) => r.rowIndex === row.rowIndex ? { ...r, alertasParsing: false } : r)
        );
      }
    }

    setParsingAlertas(false);
    toast.success("Alertas procesadas con IA");
  }, [parsedRows, empresas]);

  /** Parse contacts with AI for rows that have multiple names in contact fields */
  const parseContactosWithAI = useCallback(async () => {
    const contactFields = ["Arq", "Const", "ITO", "Dueños"];
    const rowsWithMultipleContacts = parsedRows.filter((r) => {
      if (!r.valid) return false;
      return contactFields.some((prefix) => {
        const nombre = (r.data[`${prefix} Nombre`] || "").trim();
        return nombre && (nombre.includes(",") || nombre.includes("/") || nombre.includes(" y "));
      });
    });

    if (rowsWithMultipleContacts.length === 0) {
      toast.info("No hay contactos múltiples para procesar");
      return;
    }

    setParsingContactos(true);

    for (const row of rowsWithMultipleContacts) {
      try {
        const contactos = contactFields.map((prefix) => ({
          categoria: prefix === "Const" ? "Constructora" : prefix,
          nombre: (row.data[`${prefix} Nombre`] || "").trim(),
          contacto: (row.data[`${prefix} Contacto`] || "").trim(),
          email: (row.data[`${prefix} Email`] || "").trim(),
          telefono: (row.data[`${prefix} Teléfono`] || "").trim(),
        })).filter((c) => c.nombre);

        if (contactos.length === 0) continue;

        const { data, error } = await supabase.functions.invoke("parse-contactos", {
          body: { contactos },
        });

        if (error) throw error;

        const parsed = data.contactos || [];
        setParsedRows((prev) =>
          prev.map((r) => {
            if (r.rowIndex !== row.rowIndex) return r;
            const newData = { ...r.data };
            for (const c of parsed) {
              const prefix = c.categoria === "Constructora" ? "Const" : c.categoria;
              if (contactFields.includes(prefix) || prefix === "Const") {
                newData[`${prefix} Nombre`] = c.nombre || "";
                newData[`${prefix} Contacto`] = c.contacto || "";
                newData[`${prefix} Email`] = c.email || "";
                newData[`${prefix} Teléfono`] = c.telefono || "";
              }
            }
            return { ...r, data: newData };
          })
        );
      } catch (err: any) {
        toast.error(`Error procesando contactos fila ${row.rowIndex}: ${err.message}`);
      }
    }

    setParsingContactos(false);
    toast.success("Contactos procesados con IA");
  }, [parsedRows]);

  /** Auto-run AI pipeline when rows are loaded */
  const matchRef = useRef(matchDropdownsWithAI);
  const alertasRef = useRef(parseAlertasWithAI);
  const contactosRef = useRef(parseContactosWithAI);
  matchRef.current = matchDropdownsWithAI;
  alertasRef.current = parseAlertasWithAI;
  contactosRef.current = parseContactosWithAI;

  useEffect(() => {
    if (parsedRows.length > 0 && !aiRunTriggered.current && aiPhase === "idle") {
      aiRunTriggered.current = true;
      (async () => {
        try {
          setAiPhase("dropdowns");
          await matchRef.current();
          setAiPhase("alertas");
          await alertasRef.current();
          setAiPhase("contactos");
          await contactosRef.current();
          setAiPhase("done");
          setOpenProjects(() => {
            const opens: Record<number, boolean> = {};
            return opens;
          });
        } catch {
          setAiPhase("done");
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedRows.length, aiPhase]);


  const toggleAlertaCrear = useCallback((rowIndex: number, alertaIdx: number) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        const alertas = [...r.alertas];
        alertas[alertaIdx] = { ...alertas[alertaIdx], crearAlerta: !alertas[alertaIdx].crearAlerta };
        return { ...r, alertas };
      })
    );
  }, []);

  /** Change empresa assignment for a specific alerta */
  const setAlertaEmpresa = useCallback((rowIndex: number, alertaIdx: number, empresaId: string | null) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        const alertas = [...r.alertas];
        alertas[alertaIdx] = { ...alertas[alertaIdx], empresaId };
        return { ...r, alertas };
      })
    );
  }, []);

  /** Mark all past alertas as not to create (or toggle them) */
  const toggleAllPastAlertas = useCallback((rowIndex: number, crearAlerta: boolean) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        const alertas = r.alertas.map((a) => a.esFutura ? a : { ...a, crearAlerta });
        return { ...r, alertas };
      })
    );
  }, []);

  /** Change date for a specific alerta */
  const setAlertaFecha = useCallback((rowIndex: number, alertaIdx: number, fecha: string) => {
    const cutoff = new Date("2026-01-01");
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        const alertas = [...r.alertas];
        const esFutura = fecha ? new Date(fecha) >= cutoff : false;
        alertas[alertaIdx] = { ...alertas[alertaIdx], fecha: fecha || null, esFutura };
        return { ...r, alertas };
      })
    );
  }, []);

  /** Add a dependent (child) alerta after the given index */
  const addDependentAlerta = useCallback((rowIndex: number, parentIdx: number) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        const alertas = [...r.alertas];
        const parent = alertas[parentIdx];
        const newAlerta: ParsedAlerta = {
          fecha: null,
          texto: "",
          esFutura: false,
          crearAlerta: true,
          empresaId: parent.empresaId,
          parentIndex: parentIdx,
        };
        alertas.splice(parentIdx + 1, 0, newAlerta);
        // Adjust parentIndex references for items after insertion point
        for (let i = 0; i < alertas.length; i++) {
          if (alertas[i].parentIndex !== null && alertas[i].parentIndex! > parentIdx && i !== parentIdx + 1) {
            alertas[i] = { ...alertas[i], parentIndex: alertas[i].parentIndex! + 1 };
          }
        }
        return { ...r, alertas };
      })
    );
  }, []);

  /** Update text of a specific alerta */
  const setAlertaTexto = useCallback((rowIndex: number, alertaIdx: number, texto: string) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        const alertas = [...r.alertas];
        alertas[alertaIdx] = { ...alertas[alertaIdx], texto };
        return { ...r, alertas };
      })
    );
  }, []);

  const handleBulkInsert = useCallback(async () => {
    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) { toast.error("No hay filas válidas para cargar"); return; }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      for (const row of validRows) {
        const d = row.data;

        let clasificacion_id: string | null = null;
        const clsName = (d["Clasificación"] || "").trim();
        if (clsName && clasificaciones) {
          const found = clasificaciones.find((c) => c.nombre === clsName);
          if (found) clasificacion_id = found.id;
        }

        const empLinks: { empresa_id: string; categoria_id: string | null }[] = [];
        for (let i = 1; i <= 4; i++) {
          const empName = (d[`Empresa ${i}`] || "").trim();
          const catName = (d[`Categoría Empresa ${i}`] || "").trim();
          if (empName && empresas) {
            const emp = empresas.find((e) => e.nombre === empName);
            if (emp) {
              let cat_id: string | null = null;
              if (catName && categorias) {
                const cat = categorias.find((c) => c.nombre === catName);
                if (cat) cat_id = cat.id;
              }
              empLinks.push({ empresa_id: emp.id, categoria_id: cat_id });
            }
          }
        }

        const fechaIngreso = parseDateValue(d["Fecha Ingreso"]);
        const fechaEstado = parseDateValue(d["Fecha Estado Obra"]);

        // Only store undated notes that aren't being created as alertas
        const notasTexto = row.alertas
          .filter((a) => !a.crearAlerta && !a.fecha)
          .map((a) => a.texto)
          .join("\n");

        const projectPayload = {
          nombre: d["Nombre Proyecto"]?.trim() || "",
          fecha_ingreso: fechaIngreso || new Date().toISOString().split("T")[0],
          clasificacion_id,
          estado_obra: d["Estado Obra"]?.trim() || "",
          fecha_estado_obra: fechaEstado || null,
          estado_amc: d["Estado AMC"]?.trim() || "Vigente",
          direccion: d["Dirección"]?.trim() || "",
          region: d["Región"]?.trim() || "",
          comuna: d["Comuna"]?.trim() || "",
          arq_nombre: d["Arq Nombre"]?.trim() || "",
          arq_contacto: d["Arq Contacto"]?.trim() || "",
          arq_mail: d["Arq Email"]?.trim() || "",
          arq_telefono: d["Arq Teléfono"]?.trim() || "",
          const_nombre: d["Const Nombre"]?.trim() || "",
          const_contacto: d["Const Contacto"]?.trim() || "",
          const_mail: d["Const Email"]?.trim() || "",
          const_telefono: d["Const Teléfono"]?.trim() || "",
          ito_nombre: d["ITO Nombre"]?.trim() || "",
          ito_contacto: d["ITO Contacto"]?.trim() || "",
          ito_mail: d["ITO Email"]?.trim() || "",
          ito_telefono: d["ITO Teléfono"]?.trim() || "",
          duenos_nombre: d["Dueños Nombre"]?.trim() || "",
          duenos_contacto: d["Dueños Contacto"]?.trim() || "",
          duenos_mail: d["Dueños Email"]?.trim() || "",
          duenos_telefono: d["Dueños Teléfono"]?.trim() || "",
          adjudicado: false,
          notas: notasTexto,
        };

        let projectId: string;

        if (empLinks.length === 0) {
          const { data: created, error } = await supabase
            .from("proyectos")
            .insert(projectPayload as any)
            .select("id")
            .single();
          if (error) throw error;
          projectId = created.id;
        } else {
          const inserts = empLinks.map(() => ({ ...projectPayload }));
          const { data: created, error } = await supabase
            .from("proyectos")
            .insert(inserts as any[])
            .select();
          if (error) throw error;

          projectId = created![0].id;

          const links = created!.map((p: any, i: number) => ({
            proyecto_id: p.id,
            empresa_id: empLinks[i].empresa_id,
            monto_cotizacion: 0,
            adjudicado: false,
            categoria_id: empLinks[i].categoria_id,
            subcategoria_id: null,
          }));
          const { error: linkErr } = await supabase.from("proyecto_empresas").insert(links);
          if (linkErr) throw linkErr;
        }

        // Create alertas - handle parent-child dependencies
        const alertasToCreate = row.alertas
          .map((a, origIdx) => ({ ...a, origIdx }))
          .filter((a) => a.crearAlerta && a.fecha);

        if (alertasToCreate.length > 0) {
          // Map original index -> created DB id for parent references
          const origIdxToDbId: Record<number, string> = {};

          // Insert root alertas first (no parent), then children
          const roots = alertasToCreate.filter((a) => a.parentIndex === null);
          const children = alertasToCreate.filter((a) => a.parentIndex !== null);

          if (roots.length > 0) {
            const rootInserts = roots.map((a) => ({
              proyecto_id: projectId,
              empresa_id: a.empresaId || null,
              titulo: "Seguimiento",
              texto: a.texto,
              fecha_seguimiento: a.fecha!,
              usuario_responsable_id: user.id,
              created_by: user.id,
              completada: false,
            }));
            const { data: createdRoots, error: rootErr } = await supabase
              .from("alertas")
              .insert(rootInserts as any[])
              .select("id");
            if (rootErr) throw rootErr;
            roots.forEach((a, i) => {
              origIdxToDbId[a.origIdx] = createdRoots![i].id;
            });
          }

          // Insert children with parent_alerta_id
          if (children.length > 0) {
            const childInserts = children.map((a) => ({
              proyecto_id: projectId,
              empresa_id: a.empresaId || null,
              titulo: "Seguimiento",
              texto: a.texto,
              fecha_seguimiento: a.fecha!,
              usuario_responsable_id: user.id,
              created_by: user.id,
              completada: false,
              parent_alerta_id: a.parentIndex !== null ? origIdxToDbId[a.parentIndex] || null : null,
            }));
            const { error: childErr } = await supabase.from("alertas").insert(childInserts as any[]);
            if (childErr) throw childErr;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["proyectos"] });
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
      setUploaded(true);
      toast.success(`${validRows.length} proyectos cargados exitosamente`);
    } catch (err: any) {
      toast.error("Error al cargar: " + err.message);
    } finally {
      setUploading(false);
    }
  }, [parsedRows, empresas, categorias, clasificaciones, queryClient]);

  const validCount = parsedRows.filter((r) => r.valid).length;
  const errorCount = parsedRows.filter((r) => !r.valid).length;
  const hasAlertasText = parsedRows.some((r) => r.valid && (r.data["Notas / Alertas"] || "").trim());
  const allAlertasParsed = parsedRows.filter((r) => r.valid && (r.data["Notas / Alertas"] || "").trim()).every((r) => r.alertasParsed);
  const totalAlertasToCreate = parsedRows.reduce((acc, r) => acc + r.alertas.filter((a) => a.crearAlerta).length, 0);
  const hasMultipleContacts = parsedRows.some((r) => {
    if (!r.valid) return false;
    return ["Arq", "Const", "ITO", "Dueños"].some((prefix) => {
      const nombre = (r.data[`${prefix} Nombre`] || "").trim();
      return nombre && (nombre.includes(",") || nombre.includes("/") || nombre.includes(" y "));
    });
  });

  // Count AI corrections and unmatched
  const totalAiCorrected = parsedRows.reduce((acc, r) => acc + r.aiCorrected.length, 0);
  const totalAiUnmatched = parsedRows.reduce((acc, r) => acc + r.aiUnmatched.length, 0);

  // Check if there are any unmatched dropdown values needing AI
  const hasUnmatchedDropdowns = useMemo(() => {
    return parsedRows.some((row) => {
      return DROPDOWN_FIELDS.some((field) => {
        const value = (row.data[field.column] || "").trim();
        if (!value) return false;
        const options = field.getOptions(dropdownCtx);
        return !options.some((o) => o.toLowerCase() === value.toLowerCase());
      });
    });
  }, [parsedRows, dropdownCtx]);

  const handleSampleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSample(true);
    try {
      const ts = Date.now();
      const path = `${ts}_${file.name}`;
      const { error } = await supabase.storage.from("carga-masiva-muestras").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("carga-masiva-muestras").getPublicUrl(path);
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase.from("archivos_muestra" as any) as any).insert({ nombre: file.name, path, url: urlData.publicUrl, uploaded_by: user?.email || "" });
      refetchSamples();
      toast.success("Archivo de muestra subido correctamente");
    } catch (err: any) {
      toast.error("Error al subir archivo: " + (err.message || ""));
    } finally {
      setUploadingSample(false);
      e.target.value = "";
    }
  }, [refetchSamples]);

  const removeSampleFile = useCallback(async (fileRecord: { id: string; path: string }) => {
    await supabase.storage.from("carga-masiva-muestras").remove([fileRecord.path]);
    await (supabase.from("archivos_muestra" as any) as any).delete().eq("id", fileRecord.id);
    refetchSamples();
    toast.info("Archivo de muestra eliminado");
  }, [refetchSamples]);

  const aiProcessing = aiPhase !== "idle" && aiPhase !== "done";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Carga Masiva de Proyectos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Descarga la plantilla, complétala y súbela para crear múltiples proyectos.
        </p>
      </div>

      {/* Step 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" /> Paso 1: Descargar Plantilla
          </CardTitle>
          <CardDescription>
            La plantilla incluye una columna "Notas / Alertas" donde puedes pegar texto corrido con fechas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={downloadTemplate} variant="outline" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Descargar Plantilla Excel
          </Button>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-2">
              <Paperclip className="w-3 h-3 inline mr-1" />
              Opcionalmente, sube un archivo de muestra para tu registro personal (no es procesado por el sistema).
            </p>
            {sampleFiles && sampleFiles.length > 0 && (
              <div className="space-y-1 mb-2">
                {sampleFiles.map((sf) => (
                  <div key={sf.id} className="flex items-center gap-2 text-sm">
                    <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={sf.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 truncate max-w-[300px]">
                      {sf.nombre}
                    </a>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSampleFile(sf)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-input rounded-md cursor-pointer hover:bg-accent transition-colors text-xs text-muted-foreground">
              {uploadingSample ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
              {uploadingSample ? "Subiendo..." : "Adjuntar archivo de muestra"}
              <input type="file" className="hidden" onChange={handleSampleUpload} disabled={uploadingSample} />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Paso 2: Subir Archivo Completado
          </CardTitle>
          <CardDescription>Acepta archivos .xlsx o .csv</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-accent transition-colors text-sm">
            <Upload className="w-4 h-4" /> Seleccionar archivo
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </CardContent>
      </Card>

      {/* Step 3: Automatic AI processing */}
      {parsedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {aiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : aiPhase === "done" ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Sparkles className="w-4 h-4" />}
              Paso 3: Procesamiento con IA
            </CardTitle>
            <CardDescription>
              {aiPhase === "idle" && "Preparando procesamiento..."}
              {aiPhase === "dropdowns" && "Clasificando valores de campos desplegables..."}
              {aiPhase === "alertas" && "Procesando notas y alertas..."}
              {aiPhase === "contactos" && "Estructurando contactos..."}
              {aiPhase === "done" && (
                <span className="flex gap-3 flex-wrap">
                  <span className="text-green-600">Procesamiento completado</span>
                  {totalAiCorrected > 0 && <span className="text-amber-600">{totalAiCorrected} valores corregidos</span>}
                  {totalAiUnmatched > 0 && <span className="text-destructive">{totalAiUnmatched} pendientes de corrección</span>}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {aiProcessing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <div className={`w-2 h-2 rounded-full ${aiPhase === "dropdowns" ? "bg-primary animate-pulse" : "bg-green-500"}`} />
                    <div className={`w-2 h-2 rounded-full ${aiPhase === "alertas" ? "bg-primary animate-pulse" : aiPhase === "contactos" ? "bg-green-500" : "bg-muted"}`} />
                    <div className={`w-2 h-2 rounded-full ${aiPhase === "contactos" ? "bg-primary animate-pulse" : "bg-muted"}`} />
                  </div>
                  <span className="text-xs">
                    {aiPhase === "dropdowns" && "1/3 Clasificación"}
                    {aiPhase === "alertas" && "2/3 Alertas"}
                    {aiPhase === "contactos" && "3/3 Contactos"}
                  </span>
                </div>
              )}
              {aiPhase === "done" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParsedRows((prev) => prev.map((r) => ({
                      ...r,
                      alertasParsed: false,
                      alertas: [],
                      aiCorrected: [],
                      aiUnmatched: [],
                    })));
                    setDropdownsMatched(false);
                    setAiPhase("idle");
                    aiRunTriggered.current = false;
                  }}
                  className="gap-2"
                >
                  <Sparkles className="w-3 h-3" /> Reprocesar todo con IA
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Alertas review - collapsible per project */}
      {parsedRows.length > 0 && aiPhase === "done" && parsedRows.some((r) => r.alertasParsed && r.alertas.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" /> Paso 4: Confirmar Alertas por Proyecto
            </CardTitle>
            <CardDescription>
              Revisa y confirma las alertas procesadas para cada proyecto. {totalAlertasToCreate} alertas seleccionadas para crear.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {parsedRows.filter((r) => r.alertasParsed && r.alertas.length > 0).map((row) => {
              const pastCount = row.alertas.filter((a) => !a.esFutura).length;
              const pastCrearCount = row.alertas.filter((a) => !a.esFutura && a.crearAlerta).length;
              const rowEmpresas: { id: string; nombre: string }[] = [];
              for (let i = 1; i <= 4; i++) {
                const empName = (row.data[`Empresa ${i}`] || "").trim();
                if (empName && empresas) {
                  const emp = empresas.find((e) => e.nombre === empName);
                  if (emp) rowEmpresas.push({ id: emp.id, nombre: emp.nombre });
                }
              }
              const isOpen = openProjects[row.rowIndex] ?? false;
              const alertasCount = row.alertas.filter((a) => a.crearAlerta).length;

              return (
                <Collapsible
                  key={row.rowIndex}
                  open={isOpen}
                  onOpenChange={(open) => setOpenProjects((prev) => ({ ...prev, [row.rowIndex]: open }))}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                      {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      <div className="flex-1 text-left">
                        <span className="text-sm font-semibold">{row.data["Nombre Proyecto"]}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          — {row.alertas.length} entradas · {alertasCount} a crear · {row.alertas.filter((a) => a.esFutura).length} futuras · {pastCount} pasadas
                        </span>
                      </div>
                      {rowEmpresas.length > 0 && (
                        <div className="flex gap-1">
                          {rowEmpresas.map((e) => (
                            <Badge key={e.id} variant="outline" className="text-[10px]">{e.nombre}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-1 border-l-2 border-primary/20 pl-3 space-y-1">
                      {/* Batch actions for past alerts */}
                      {pastCount > 0 && (
                        <div className="flex gap-1 py-1">
                          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2"
                            onClick={() => toggleAllPastAlertas(row.rowIndex, true)} disabled={pastCrearCount === pastCount}>
                            Incluir todas las pasadas
                          </Button>
                          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2"
                            onClick={() => toggleAllPastAlertas(row.rowIndex, false)} disabled={pastCrearCount === 0}>
                            Excluir todas las pasadas
                          </Button>
                        </div>
                      )}
                      <div className="space-y-1 max-h-[400px] overflow-auto">
                        {row.alertas.map((alerta, aIdx) => (
                          <div
                            key={aIdx}
                            className={`flex items-start gap-2 p-2 rounded text-xs ${
                              alerta.parentIndex !== null ? "ml-6 border-l-2 border-primary/30" : ""
                            } ${
                              alerta.esFutura ? "bg-primary/5 border border-primary/20" : "bg-muted/50"
                            }`}
                          >
                            <Checkbox checked={alerta.crearAlerta} onCheckedChange={() => toggleAlertaCrear(row.rowIndex, aIdx)} className="mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {alerta.crearAlerta ? <Bell className="w-3 h-3 text-primary shrink-0" /> : <FileText className="w-3 h-3 text-muted-foreground shrink-0" />}
                                {alerta.parentIndex !== null && <Link className="w-3 h-3 text-primary/60 shrink-0" />}
                                <input type="date" value={alerta.fecha || ""} onChange={(e) => setAlertaFecha(row.rowIndex, aIdx, e.target.value)}
                                  onFocus={(e) => { if (!alerta.fecha || !alerta.esFutura) { const today = new Date().toISOString().slice(0, 10); e.target.value = alerta.fecha || today; if (!alerta.fecha) { e.target.defaultValue = today; } } }}
                                  min={new Date().toISOString().slice(0, 10)}
                                  className="h-5 text-[10px] font-mono bg-transparent border border-border rounded px-1 w-[110px] text-muted-foreground" />
                                {!alerta.fecha && <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-600">Nota sin fecha</Badge>}
                                {alerta.esFutura && <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary">2026</Badge>}
                                {!alerta.esFutura && alerta.fecha && <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground border-muted-foreground">vencida</Badge>}
                                {alerta.crearAlerta && rowEmpresas.length > 0 && (
                                  <Select value={alerta.empresaId || "__madre__"} onValueChange={(v) => setAlertaEmpresa(row.rowIndex, aIdx, v === "__madre__" ? null : v)}>
                                    <SelectTrigger className="h-5 text-[10px] w-[130px] border-border"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__madre__" className="text-[10px]">Línea madre</SelectItem>
                                      {rowEmpresas.map((emp) => <SelectItem key={emp.id} value={emp.id} className="text-[10px]">{emp.nombre}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                )}
                                {alerta.crearAlerta && alerta.fecha && (
                                  <button className="text-[9px] text-primary/70 hover:text-primary font-medium flex items-center gap-0.5"
                                    onClick={() => addDependentAlerta(row.rowIndex, aIdx)} title="Crear alerta dependiente">
                                    <Plus className="w-3 h-3" /> Dependiente
                                  </button>
                                )}
                              </div>
                              <input type="text" value={alerta.texto} onChange={(e) => setAlertaTexto(row.rowIndex, aIdx, e.target.value)}
                                placeholder={alerta.parentIndex !== null ? "Texto de la alerta dependiente..." : "Texto de la nota..."}
                                className="mt-0.5 w-full text-xs bg-transparent border border-border rounded px-1 py-0.5 text-foreground/80" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Step final: Preview & confirm */}
      {parsedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Paso 5: Revisión y Carga
            </CardTitle>
            <CardDescription className="flex gap-3 flex-wrap">
              <span className="text-green-600">{validCount} válidas</span>
              {errorCount > 0 && <span className="text-destructive">{errorCount} con errores</span>}
              {totalAlertasToCreate > 0 && (
                <span className="text-primary">{totalAlertasToCreate} alertas a crear</span>
              )}
              {totalAiCorrected > 0 && (
                <span className="text-amber-600">{totalAiCorrected} corregidos por IA</span>
              )}
              {totalAiUnmatched > 0 && (
                <span className="text-destructive">{totalAiUnmatched} pendientes de corrección</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Fila</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Nombre Proyecto</TableHead>
                    <TableHead>Clasificación</TableHead>
                    <TableHead>Estado Obra</TableHead>
                    <TableHead>Estado AMC</TableHead>
                    <TableHead>Región</TableHead>
                    <TableHead>Empresas</TableHead>
                    <TableHead>Alertas</TableHead>
                    <TableHead>Errores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow key={row.rowIndex} className={!row.valid ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{row.rowIndex}</TableCell>
                      <TableCell>
                        {row.valid ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">OK</Badge>
                        ) : (
                          <Badge variant="destructive">Error</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.data["Nombre Proyecto"]}</TableCell>

                      {/* Clasificación - editable if unmatched */}
                      <TableCell>
                        <InlineDropdown
                          value={row.data["Clasificación"] || ""}
                          options={clasificacionNames}
                          isUnmatched={row.aiUnmatched.includes("Clasificación")}
                          isCorrected={row.aiCorrected.includes("Clasificación")}
                          onChange={(v) => updateRowField(row.rowIndex, "Clasificación", v)}
                        />
                      </TableCell>

                      {/* Estado Obra - editable if unmatched */}
                      <TableCell>
                        <InlineDropdown
                          value={row.data["Estado Obra"] || ""}
                          options={ESTADOS_OBRA}
                          isUnmatched={row.aiUnmatched.includes("Estado Obra")}
                          isCorrected={row.aiCorrected.includes("Estado Obra")}
                          onChange={(v) => updateRowField(row.rowIndex, "Estado Obra", v)}
                        />
                      </TableCell>

                      {/* Estado AMC - editable if unmatched */}
                      <TableCell>
                        <InlineDropdown
                          value={row.data["Estado AMC"] || ""}
                          options={estadosAMC}
                          isUnmatched={row.aiUnmatched.includes("Estado AMC")}
                          isCorrected={row.aiCorrected.includes("Estado AMC")}
                          onChange={(v) => updateRowField(row.rowIndex, "Estado AMC", v)}
                        />
                      </TableCell>

                      {/* Región */}
                      <TableCell>
                        <InlineDropdown
                          value={row.data["Región"] || ""}
                          options={regionNames}
                          isUnmatched={row.aiUnmatched.includes("Región")}
                          isCorrected={row.aiCorrected.includes("Región")}
                          onChange={(v) => updateRowField(row.rowIndex, "Región", v)}
                        />
                      </TableCell>

                      <TableCell className="text-xs">
                        {[1, 2, 3, 4].map((i) => {
                          const emp = row.data[`Empresa ${i}`] || "";
                          const isUnmatched = row.aiUnmatched.includes(`Empresa ${i}`);
                          if (isUnmatched) {
                            return (
                              <div key={i} className="mb-1">
                                <InlineDropdown
                                  value={emp}
                                  options={empresaNames}
                                  isUnmatched
                                  isCorrected={false}
                                  onChange={(v) => updateRowField(row.rowIndex, `Empresa ${i}`, v)}
                                  placeholder={`Empresa ${i}`}
                                />
                              </div>
                            );
                          }
                          return emp ? <div key={i} className={row.aiCorrected.includes(`Empresa ${i}`) ? "text-amber-600" : ""}>{emp}</div> : null;
                        })}
                        {![1,2,3,4].some(i => row.data[`Empresa ${i}`]) && "—"}
                      </TableCell>

                      <TableCell className="text-xs">
                        {row.alertasParsing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : row.alertasParsed ? (
                          <span className="text-primary">
                            {row.alertas.filter((a) => a.crearAlerta).length} / {row.alertas.length}
                          </span>
                        ) : (row.data["Notas / Alertas"] || "").trim() ? (
                          <span className="text-muted-foreground">Pendiente</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[250px]">
                        {row.errors.length > 0 && (
                          <div className="flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{row.errors.join("; ")}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

              <div className="flex items-center gap-3">
              <Button onClick={handleBulkInsert} disabled={validCount === 0 || uploading || uploaded} className="gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {uploaded ? "Cargado" : uploading ? "Cargando..." : `Cargar ${validCount} Proyectos`}
              </Button>
              {!uploaded && !uploading && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setParsedRows([]);
                    setDropdownsMatched(false);
                    setUploaded(false);
                    toast.info("Carga masiva cancelada");
                  }}
                >
                  Cancelar
                </Button>
              )}
              {uploaded && <span className="text-sm text-green-600">✓ Proyectos cargados exitosamente</span>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Inline dropdown for correcting unmatched values */
function InlineDropdown({
  value,
  options,
  isUnmatched,
  isCorrected,
  onChange,
  placeholder,
}: {
  value: string;
  options: string[];
  isUnmatched: boolean;
  isCorrected: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  if (isUnmatched) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs border-destructive bg-destructive/5 w-[140px]">
          <SelectValue placeholder={placeholder || "Seleccionar..."} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (isCorrected) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs border-amber-500 bg-amber-50/50 w-[140px]" title="Corregido por IA - click para cambiar">
          <span className="flex items-center gap-1">✨ <SelectValue /></span>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return <span className="text-xs">{value || "—"}</span>;
}

/** Parse date from Excel serial or string */
function parseDateValue(val: string | number | undefined): string | null {
  if (!val) return null;
  if (typeof val === "number") {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
