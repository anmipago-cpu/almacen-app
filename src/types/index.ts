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
  requires_lot?: boolean;
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
  active?: boolean;
  created_at?: string;
}

export interface Registro {
  id?: string;
  fecha: string;
  tipo: 'RECEPCION' | 'CONSUMO' | 'AJUSTE' | 'DEVOLUCION';
  producto_code: string;
  producto_name: string;
  lote?: string;
  pallet?: string;
  proveedor?: string;
  recibido_por?: string;
  cantidad_unidades: number;
  total_unidades: number;
  contenido_por_unidad?: number;
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
  stock_min: number;
  stock_bajo: number;
  total_recibido: number;
  total_consumido: number;
  stock_actual: number;
  promedio_semanal: number;
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

export type EstadoStock = 'OK' | 'BAJO' | 'CRITICO' | 'AGOTADO';

export interface Categoria {
  label: string;
  color: string;
  bg: string;
  text: string;
  border: string;
}

export const CATEGORIAS: Record<string, Categoria> = {
  'AD': { label: 'Aditivos',     color: 'purple', bg: 'bg-purple-100',  text: 'text-purple-800',  border: 'border-purple-200' },
  'CH': { label: 'Químicos',     color: 'orange', bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-200' },
  'CL': { label: 'Limpieza',     color: 'yellow', bg: 'bg-yellow-100',  text: 'text-yellow-800',  border: 'border-yellow-200' },
  'EQ': { label: 'Equipos',      color: 'blue',   bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-200'   },
  'IN': { label: 'Ingredientes', color: 'green',  bg: 'bg-green-100',   text: 'text-green-800',   border: 'border-green-200'  },
  'LB': { label: 'Laboratorio',  color: 'teal',   bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-200'   },
  'MS': { label: 'Misceláneos',  color: 'gray',   bg: 'bg-gray-100',    text: 'text-gray-700',    border: 'border-gray-200'   },
  'PP': { label: 'Empaques',     color: 'cyan',   bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-cyan-200'   },
  'SF': { label: 'Seguridad',    color: 'red',    bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-200'    },
  'SP': { label: 'Cajas',        color: 'indigo', bg: 'bg-indigo-100',  text: 'text-indigo-800',  border: 'border-indigo-200' },
  'UT': { label: 'Utensilios',   color: 'slate',  bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-200'  },
};

export function getEstado(item: Pick<InventarioItem, 'stock_actual' | 'stock_min' | 'stock_bajo'>): EstadoStock {
  if (item.stock_actual <= 0) return 'AGOTADO';
  if (item.stock_actual <= item.stock_min) return 'CRITICO';
  if (item.stock_actual <= item.stock_bajo) return 'BAJO';
  return 'OK';
}

export const ESTADO_CONFIG = {
  OK:      { label: 'OK',      bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  BAJO:    { label: 'BAJO',    bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  CRITICO: { label: 'CRÍTICO', bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
  AGOTADO: { label: 'AGOTADO', bg: 'bg-gray-200',   text: 'text-gray-700',   dot: 'bg-gray-500'   },
};
