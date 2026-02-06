export interface Empresa {
  id: string;
  nombre: string;
  estado: "Activa" | "Inactiva";
  fechaInicioRelacion: string;
  condicionesComerciales: CondicionComercial[];
}

export interface CondicionComercial {
  id: string;
  empresaId: string;
  feeFijoMensual: number;
  esquemaComision: number; // percentage
  fechaVigencia: string;
  descripcion?: string;
}

export interface Proyecto {
  id: string;
  numero: number;
  nombre: string;
  direccion: string;
  comuna: string;
  estadoObra: string;
  fechaEstadoObra: string;
  estadoAMC: string;
  arquitectura: ContactoEntidad;
  constructora: ContactoEntidad;
  ito: ContactoEntidad;
  duenos: ContactoEntidad;
  empresasVinculadas: string[]; // empresa IDs
  montoEstimado?: number;
  adjudicado: boolean;
}

export interface ContactoEntidad {
  nombre: string;
  contacto: string;
  mail: string;
  telefono: string;
}

export type EstadoAMC = string;

export const ESTADOS_AMC_DEFAULT: EstadoAMC[] = [
  "Vigente",
  "Descartado",
  "Todo Ofrecido",
  "Sin Respuesta",
];

export interface ResumenFinanciero {
  gananciasPotenciales: number;
  gananciasEfectivas: number;
  feesTotal: number;
  comisionesTotal: number;
}
