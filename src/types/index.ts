export interface Producto {
  id?: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  identifier?: string;
  supplier?: string;
  supplier_code?: string;
  manufacturer?: string;
  presentation?: string;
  unit?: string;
  unit_content?: number;
  unit_base?: string;
  stock_min: number;
  stock_bajo: number;
  lead_time_semanas?: number;
  consumo_promedio_semanal?: number;
  requires_lot?: boolean;
  requires_expiry?: boolean;
  active?: boolean;
  created_at?: string;
}

export interface Proveedor {
  id?: string;
  code: string;
  name: string;
  description?: string;
  phone?: string;
  contact?: string;
  email?: string;
  created_at?: string;
}

export interface Registro {
  id?: string;
  recepcion_number?: number;
  fecha: string;
  recibido_por: string;
  po?: string;
  lote?: string;
  fecha_vencimiento?: string;
  tipo?: string;
  producto_code: string;
  producto_name: string;
  proveedor?: string;
  cantidad_unidad_natural: number;
  unidad_natural?: string;
  contenido_por_unidad?: number;
  total_unidades_base: number;
  observaciones?: string;
  created_at?: string;
}

export interface InventarioItem {
  code: string;
  name: string;
  category: string;
  supplier?: string;
  presentation?: string;
  unit?: string;
  unit_content?: number;
  unit_base?: string;
  requires_lot?: boolean;
  stock_min: number;
  stock_bajo: number;
  total_recibido: number;
  total_consumido: number;
  stock_actual: number;
  stock_ultimo_inventario: number;
  promedio_consumo_semanal: number;
  lead_time_semanas?: number;
  semanas_restantes?: number;
}

export interface ConsumoSemanal {
  id?: string;
  semana_numero: number;
  año: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  producto_code: string;
  producto_name: string;
  cantidad_consumida: number;
  fuente?: string;
  created_at?: string;
}

export interface InventarioFisicoItem {
  id?: string;
  fecha: string;
  realizado_por: string;
  producto_code: string;
  producto_name: string;
  lote?: string;
  cantidad_contada: number;
  unidad?: string;
  total_unidades_base: number;
  created_at?: string;
}

export interface CategoriaDB {
  code: string;
  label: string;
  color: string;
  active?: boolean;
}

export interface SubcategoriaDB {
  id?: number;
  categoria_code: string;
  code: string;
  label: string;
  active?: boolean;
}

export const COLOR_OPTIONS = [
  'slate','purple','orange','yellow','blue','green',
  'teal','gray','cyan','red','indigo','pink','violet','amber','lime','rose',
] as const;

export const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  slate:  { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200'  },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200'   },
  green:  { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-200'  },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-200'   },
  gray:   { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-200'   },
  cyan:   { bg: 'bg-cyan-100',   text: 'text-cyan-800',   border: 'border-cyan-200'   },
  red:    { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200'    },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-200'   },
  violet: { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-200'  },
  lime:   { bg: 'bg-lime-100',   text: 'text-lime-800',   border: 'border-lime-200'   },
  rose:   { bg: 'bg-rose-100',   text: 'text-rose-800',   border: 'border-rose-200'   },
};

export type EstadoStock = 'OK' | 'BAJO' | 'CRITICO' | 'AGOTADO';

export interface Categoria {
  label: string;
  color: string;
  bg: string;
  text: string;
  border: string;
}

export const CATEGORIAS: Record<string, Categoria> = {
  'AD': { label: 'Aditivos',             color: 'purple', bg: 'bg-purple-100',  text: 'text-purple-800',  border: 'border-purple-200' },
  'CH': { label: 'Insumos Químicos',     color: 'orange', bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-200' },
  'CL': { label: 'Insumos Limpieza',     color: 'yellow', bg: 'bg-yellow-100',  text: 'text-yellow-800',  border: 'border-yellow-200' },
  'EQ': { label: 'Maquinaria',           color: 'blue',   bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-200'   },
  'IN': { label: 'Ingredientes',         color: 'green',  bg: 'bg-green-100',   text: 'text-green-800',   border: 'border-green-200'  },
  'LB': { label: 'Insumos Laboratorio',  color: 'teal',   bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-200'   },
  'MS': { label: 'Insumos Manufactura',  color: 'gray',   bg: 'bg-gray-100',    text: 'text-gray-700',    border: 'border-gray-200'   },
  'PP': { label: 'Empaque Primario',     color: 'cyan',   bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-cyan-200'   },
  'SF': { label: 'Insumos Seguridad',    color: 'red',    bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-200'    },
  'SP': { label: 'Empaque Secundario',   color: 'indigo', bg: 'bg-indigo-100',  text: 'text-indigo-800',  border: 'border-indigo-200' },
  'UT': { label: 'Utensilios',           color: 'slate',  bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-200'  },
};

export const SUBCATEGORIAS: Record<string, Record<string, string>> = {
  'AD': { '01': 'Aditivos' },
  'CH': { '01': 'Químicos' },
  'CL': { '01': 'Limpieza' },
  'EQ': { '01': 'Producción', '02': 'Control' },
  'IN': { '01': 'Materia Prima' },
  'LB': { '01': 'Laboratorio' },
  'MS': { '01': 'Manufactura' },
  'PP': { '01': 'Bolsas', '02': 'Envase' },
  'SF': { '01': 'BPM' },
  'SP': { '01': 'Cajas', '02': 'Etiquetas' },
  'UT': { '01': 'Acero Inoxidable', '02': 'Plástico', '03': 'Otros' },
};

export function getEstado(item: Pick<InventarioItem, 'stock_actual' | 'stock_min' | 'stock_bajo'>): EstadoStock {
  if (item.stock_actual <= 0) return 'AGOTADO';
  if (item.stock_actual <= item.stock_min) return 'CRITICO';
  if (item.stock_actual <= item.stock_bajo) return 'BAJO';
  return 'OK';
}

export const ESTADO_CONFIG = {
  OK:      { label: 'OK',      bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  BAJO:    { label: 'ALERTA',  bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  CRITICO: { label: 'CRÍTICO', bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
  AGOTADO: { label: 'AGOTADO', bg: 'bg-slate-900',  text: 'text-slate-100',  dot: 'bg-slate-400'  },
};
