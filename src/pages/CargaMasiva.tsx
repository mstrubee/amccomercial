import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCategorias } from "@/hooks/useCategorias";
import { useClasificaciones } from "@/hooks/useClasificaciones";
import { useQueryClient } from "@tanstack/react-query";
import { REGIONES_CHILE } from "@/data/chile-geo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Brain, Bell, FileText, Users } from "lucide-react";

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

interface ParsedAlerta {
  fecha: string | null;
  texto: string;
  esFutura: boolean;
  crearAlerta: boolean;
}

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
  alertas: ParsedAlerta[];
  alertasParsing: boolean;
  alertasParsed: boolean;
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

  const [estadosAMC] = useState<string[]>(["Vigente", "Descartado", "Todo Ofrecido", "Sin Respuesta"]);

  const empresaNames = useMemo(() => (empresas || []).map((e) => e.nombre), [empresas]);
  const categoriaNames = useMemo(() => (categorias || []).map((c) => c.nombre), [categorias]);
  const clasificacionNames = useMemo(() => (clasificaciones || []).map((c) => c.nombre), [clasificaciones]);
  const regionNames = useMemo(() => REGIONES_CHILE.map((r) => r.nombre), []);

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

  const validateRow = useCallback(
    (row: Record<string, string>, idx: number): ParsedRow => {
      const errors: string[] = [];
      const nombre = (row["Nombre Proyecto"] || "").trim();
      if (!nombre) errors.push("Nombre Proyecto requerido");

      const clasificacion = (row["Clasificación"] || "").trim();
      if (clasificacion && !clasificacionNames.includes(clasificacion))
        errors.push(`Clasificación "${clasificacion}" no reconocida`);

      const estadoObra = (row["Estado Obra"] || "").trim();
      if (estadoObra && !ESTADOS_OBRA.includes(estadoObra))
        errors.push(`Estado Obra "${estadoObra}" no reconocido`);

      const estadoAmc = (row["Estado AMC"] || "").trim();
      if (estadoAmc && !estadosAMC.includes(estadoAmc))
        errors.push(`Estado AMC "${estadoAmc}" no reconocido`);

      let region = (row["Región"] || "").trim();
      const comuna = (row["Comuna"] || "").trim();

      // Auto-detect region from comuna if region is empty
      if (!region && comuna) {
        region = findRegionByComuna(comuna);
        if (region) {
          row["Región"] = region;
        }
      }

      if (region && !regionNames.includes(region))
        errors.push(`Región "${region}" no reconocida`);

      if (region && comuna) {
        const reg = REGIONES_CHILE.find((r) => r.nombre === region);
        if (reg && !reg.comunas.some((c) => c.toLowerCase() === comuna.toLowerCase()))
          errors.push(`Comuna "${comuna}" no pertenece a ${region}`);
      }

      for (let i = 1; i <= 4; i++) {
        const emp = (row[`Empresa ${i}`] || "").trim();
        if (emp && !empresaNames.includes(emp)) errors.push(`Empresa ${i} "${emp}" no reconocida`);
        const cat = (row[`Categoría Empresa ${i}`] || "").trim();
        if (cat && !categoriaNames.includes(cat)) errors.push(`Categoría Empresa ${i} "${cat}" no reconocida`);
      }

      return {
        rowIndex: idx + 2, data: row, errors, valid: errors.length === 0,
        alertas: [], alertasParsing: false, alertasParsed: false,
      };
    },
    [clasificacionNames, estadosAMC, empresaNames, categoriaNames, regionNames, findRegionByComuna]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploaded(false);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
          if (rows.length === 0) { toast.error("El archivo no contiene datos"); return; }
          const parsed = rows.map((row, i) => validateRow(row, i));
          setParsedRows(parsed);
          toast.info(`${parsed.length} filas leídas, ${parsed.filter((r) => r.valid).length} válidas`);
        } catch { toast.error("Error al leer el archivo"); }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = "";
    },
    [validateRow]
  );

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

        const alertas: ParsedAlerta[] = (data.alertas || []).map((a: any) => {
          const fecha = a.fecha || null;
          const esFutura = fecha ? new Date(fecha) >= cutoffDate : false;
          return { fecha, texto: a.texto, esFutura, crearAlerta: esFutura };
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
  }, [parsedRows]);

  /** Parse contacts with AI for rows that have multiple names in contact fields */
  const parseContactosWithAI = useCallback(async () => {
    const contactFields = ["Arq", "Const", "ITO", "Dueños"];
    const rowsWithMultipleContacts = parsedRows.filter((r) => {
      if (!r.valid) return false;
      return contactFields.some((prefix) => {
        const nombre = (r.data[`${prefix} Nombre`] || "").trim();
        // Has multiple entries if contains separators
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

        // Build notas from non-alert entries
        const notasTexto = row.alertas
          .filter((a) => !a.crearAlerta)
          .map((a) => `${a.fecha || "s/f"}: ${a.texto}`)
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

        // Create alertas for selected entries
        const alertasToCreate = row.alertas.filter((a) => a.crearAlerta && a.fecha);
        if (alertasToCreate.length > 0) {
          const alertInserts = alertasToCreate.map((a) => ({
            proyecto_id: projectId,
            titulo: "Seguimiento",
            texto: a.texto,
            fecha_seguimiento: a.fecha!,
            usuario_responsable_id: user.id,
            created_by: user.id,
          }));
          const { error: alertErr } = await supabase.from("alertas").insert(alertInserts as any[]);
          if (alertErr) throw alertErr;
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

  let stepNum = 3;

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
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Descargar Plantilla Excel
          </Button>
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

      {/* Step 3+: AI parsing alertas */}
      {parsedRows.length > 0 && hasAlertasText && (() => {
        const currentStep = stepNum++;
        return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4" /> Paso {currentStep}: Procesar Notas con IA
            </CardTitle>
            <CardDescription>
              La IA separará el texto corrido en entradas individuales por fecha. Ene/Feb → 2026 (alertas), resto → 2025 (notas).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={parseAlertasWithAI} disabled={parsingAlertas || allAlertasParsed} className="gap-2">
              {parsingAlertas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {allAlertasParsed ? "Procesado" : parsingAlertas ? "Procesando..." : "Procesar con IA"}
            </Button>

            {/* Show parsed alertas per row */}
            {parsedRows.filter((r) => r.alertasParsed && r.alertas.length > 0).map((row) => (
              <div key={row.rowIndex} className="border rounded-md p-3 space-y-2">
                <h4 className="text-sm font-medium">
                  Fila {row.rowIndex}: {row.data["Nombre Proyecto"]}
                  <span className="ml-2 text-muted-foreground text-xs">
                    ({row.alertas.length} entradas, {row.alertas.filter((a) => a.esFutura).length} futuras)
                  </span>
                </h4>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {row.alertas.map((alerta, aIdx) => (
                    <div
                      key={aIdx}
                      className={`flex items-start gap-2 p-2 rounded text-xs ${
                        alerta.esFutura ? "bg-primary/5 border border-primary/20" : "bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={alerta.crearAlerta}
                        onCheckedChange={() => toggleAlertaCrear(row.rowIndex, aIdx)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {alerta.crearAlerta ? (
                            <Bell className="w-3 h-3 text-primary shrink-0" />
                          ) : (
                            <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-mono text-muted-foreground">
                            {alerta.fecha || "s/f"}
                          </span>
                          {alerta.esFutura && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary">
                              2026
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-foreground/80 break-words">{alerta.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        );
      })()}

      {/* Step: AI parsing contactos */}
      {parsedRows.length > 0 && hasMultipleContacts && (() => {
        const currentStep = stepNum++;
        return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Paso {currentStep}: Estructurar Contactos con IA
            </CardTitle>
            <CardDescription>
              Se detectaron contactos con múltiples nombres. La IA asociará cada nombre con su email y teléfono correspondiente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={parseContactosWithAI} disabled={parsingContactos} className="gap-2">
              {parsingContactos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {parsingContactos ? "Procesando..." : "Estructurar Contactos"}
            </Button>
          </CardContent>
        </Card>
        );
      })()}

      {/* Step final: Preview & confirm */}
      {parsedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Paso {stepNum}: Revisión y Carga
            </CardTitle>
            <CardDescription className="flex gap-3">
              <span className="text-green-600">{validCount} válidas</span>
              {errorCount > 0 && <span className="text-destructive">{errorCount} con errores</span>}
              {totalAlertasToCreate > 0 && (
                <span className="text-primary">{totalAlertasToCreate} alertas a crear</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Fila</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Nombre Proyecto</TableHead>
                    <TableHead>Clasificación</TableHead>
                    <TableHead>Estado Obra</TableHead>
                    <TableHead>Estado AMC</TableHead>
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
                      <TableCell>{row.data["Clasificación"]}</TableCell>
                      <TableCell>{row.data["Estado Obra"]}</TableCell>
                      <TableCell>{row.data["Estado AMC"]}</TableCell>
                      <TableCell className="text-xs">
                        {[1, 2, 3, 4].map((i) => row.data[`Empresa ${i}`]).filter(Boolean).join(", ") || "—"}
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
              {uploaded && <span className="text-sm text-green-600">✓ Proyectos cargados exitosamente</span>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
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
