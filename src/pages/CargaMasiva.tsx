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
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

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
];

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

export default function CargaMasiva() {
  const { data: empresas } = useEmpresas();
  const { data: categorias } = useCategorias();
  const { data: clasificaciones } = useClasificaciones();
  const queryClient = useQueryClient();

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  // Fetch estado AMC options
  const [estadosAMC, setEstadosAMC] = useState<string[]>(["Vigente", "Descartado", "Todo Ofrecido", "Sin Respuesta"]);

  const empresaNames = useMemo(() => (empresas || []).map((e) => e.nombre), [empresas]);
  const categoriaNames = useMemo(() => (categorias || []).map((c) => c.nombre), [categorias]);
  const clasificacionNames = useMemo(() => (clasificaciones || []).map((c) => c.nombre), [clasificaciones]);
  const regionNames = useMemo(() => REGIONES_CHILE.map((r) => r.nombre), []);

  const downloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Main sheet with headers and one example row
    const wsData = [TEMPLATE_COLUMNS];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = TEMPLATE_COLUMNS.map((col) => ({ wch: Math.max(col.length + 4, 18) }));

    XLSX.utils.book_append_sheet(wb, ws, "Proyectos");

    // Reference sheet with dropdown options
    const refData: string[][] = [];
    const maxLen = Math.max(clasificacionNames.length, ESTADOS_OBRA.length, estadosAMC.length, empresaNames.length, categoriaNames.length, regionNames.length);
    const refHeaders = ["Clasificaciones", "Estados Obra", "Estados AMC", "Empresas", "Categorías", "Regiones"];
    refData.push(refHeaders);
    for (let i = 0; i < maxLen; i++) {
      refData.push([
        clasificacionNames[i] || "",
        ESTADOS_OBRA[i] || "",
        estadosAMC[i] || "",
        empresaNames[i] || "",
        categoriaNames[i] || "",
        regionNames[i] || "",
      ]);
    }

    // Add comunas per region
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

  const validateRow = useCallback(
    (row: Record<string, string>, idx: number): ParsedRow => {
      const errors: string[] = [];
      const nombre = (row["Nombre Proyecto"] || "").trim();
      if (!nombre) errors.push("Nombre Proyecto requerido");

      const clasificacion = (row["Clasificación"] || "").trim();
      if (clasificacion && !clasificacionNames.includes(clasificacion)) {
        errors.push(`Clasificación "${clasificacion}" no reconocida`);
      }

      const estadoObra = (row["Estado Obra"] || "").trim();
      if (estadoObra && !ESTADOS_OBRA.includes(estadoObra)) {
        errors.push(`Estado Obra "${estadoObra}" no reconocido`);
      }

      const estadoAmc = (row["Estado AMC"] || "").trim();
      if (estadoAmc && !estadosAMC.includes(estadoAmc)) {
        errors.push(`Estado AMC "${estadoAmc}" no reconocido`);
      }

      const region = (row["Región"] || "").trim();
      if (region && !regionNames.includes(region)) {
        errors.push(`Región "${region}" no reconocida`);
      }

      const comuna = (row["Comuna"] || "").trim();
      if (region && comuna) {
        const reg = REGIONES_CHILE.find((r) => r.nombre === region);
        if (reg && !reg.comunas.includes(comuna)) {
          errors.push(`Comuna "${comuna}" no pertenece a ${region}`);
        }
      }

      // Validate empresas
      for (let i = 1; i <= 4; i++) {
        const emp = (row[`Empresa ${i}`] || "").trim();
        if (emp && !empresaNames.includes(emp)) {
          errors.push(`Empresa ${i} "${emp}" no reconocida`);
        }
        const cat = (row[`Categoría Empresa ${i}`] || "").trim();
        if (cat && !categoriaNames.includes(cat)) {
          errors.push(`Categoría Empresa ${i} "${cat}" no reconocida`);
        }
      }

      return { rowIndex: idx + 2, data: row, errors, valid: errors.length === 0 };
    },
    [clasificacionNames, estadosAMC, empresaNames, categoriaNames, regionNames]
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

          if (rows.length === 0) {
            toast.error("El archivo no contiene datos");
            return;
          }

          const parsed = rows.map((row, i) => validateRow(row, i));
          setParsedRows(parsed);
          toast.info(`${parsed.length} filas leídas, ${parsed.filter((r) => r.valid).length} válidas`);
        } catch {
          toast.error("Error al leer el archivo");
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = "";
    },
    [validateRow]
  );

  const handleBulkInsert = useCallback(async () => {
    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para cargar");
      return;
    }

    setUploading(true);
    try {
      for (const row of validRows) {
        const d = row.data;

        // Resolve clasificacion_id
        let clasificacion_id: string | null = null;
        const clsName = (d["Clasificación"] || "").trim();
        if (clsName && clasificaciones) {
          const found = clasificaciones.find((c) => c.nombre === clsName);
          if (found) clasificacion_id = found.id;
        }

        // Collect empresa links
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

        // Parse dates
        const fechaIngreso = parseDateValue(d["Fecha Ingreso"]);
        const fechaEstado = parseDateValue(d["Fecha Estado Obra"]);

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
        };

        if (empLinks.length === 0) {
          const { error } = await supabase.from("proyectos").insert(projectPayload as any);
          if (error) throw error;
        } else {
          // Create one project row per empresa link (matches existing pattern)
          const inserts = empLinks.map(() => ({ ...projectPayload }));
          const { data: created, error } = await supabase
            .from("proyectos")
            .insert(inserts as any[])
            .select();
          if (error) throw error;

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
      }

      queryClient.invalidateQueries({ queryKey: ["proyectos"] });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Carga Masiva de Proyectos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Descarga la plantilla, complétala y súbela para crear múltiples proyectos.
        </p>
      </div>

      {/* Step 1: Download template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" /> Paso 1: Descargar Plantilla
          </CardTitle>
          <CardDescription>
            La plantilla incluye una hoja de referencia con las opciones válidas para cada campo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Descargar Plantilla Excel
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Upload file */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Paso 2: Subir Archivo Completado
          </CardTitle>
          <CardDescription>
            Acepta archivos .xlsx o .csv
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-accent transition-colors text-sm">
            <Upload className="w-4 h-4" />
            Seleccionar archivo
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </CardContent>
      </Card>

      {/* Step 3: Preview & confirm */}
      {parsedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Paso 3: Revisión y Carga
            </CardTitle>
            <CardDescription className="flex gap-3">
              <span className="text-green-600">{validCount} válidas</span>
              {errorCount > 0 && <span className="text-destructive">{errorCount} con errores</span>}
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
                        {[1, 2, 3, 4]
                          .map((i) => row.data[`Empresa ${i}`])
                          .filter(Boolean)
                          .join(", ") || "—"}
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
    // Excel date serial
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  const s = String(val).trim();
  // Try yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
