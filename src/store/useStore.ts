import { create } from 'zustand';
import type { Producto, Registro, InventarioItem, Categoria, CategoriaDB, SubcategoriaDB } from '../types';
import { CATEGORIAS, SUBCATEGORIAS, COLOR_MAP } from '../types';

function buildCategorias(dbRows: CategoriaDB[]): Record<string, Categoria> {
  const result: Record<string, Categoria> = { ...CATEGORIAS };
  dbRows.forEach(row => {
    const colors = COLOR_MAP[row.color] ?? COLOR_MAP['slate'];
    result[row.code] = { label: row.label, color: row.color, ...colors };
  });
  return result;
}

function buildSubcategorias(dbRows: SubcategoriaDB[]): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  Object.keys(SUBCATEGORIAS).forEach(k => { result[k] = { ...SUBCATEGORIAS[k] }; });
  dbRows.forEach(row => {
    if (!result[row.categoria_code]) result[row.categoria_code] = {};
    result[row.categoria_code][row.code] = row.label;
  });
  return result;
}

interface AppStore {
  productos: Producto[];
  registros: Registro[];
  inventario: InventarioItem[];
  loading: boolean;
  categorias: Record<string, Categoria>;
  subcategorias: Record<string, Record<string, string>>;
  categoriasDB: CategoriaDB[];
  subcategoriasDB: SubcategoriaDB[];
  setProductos: (productos: Producto[]) => void;
  setRegistros: (registros: Registro[]) => void;
  setInventario: (inventario: InventarioItem[]) => void;
  setLoading: (loading: boolean) => void;
  addRegistro: (registro: Registro) => void;
  setCategoriasDB: (rows: CategoriaDB[]) => void;
  setSubcategoriasDB: (rows: SubcategoriaDB[]) => void;
}

export const useStore = create<AppStore>((set) => ({
  productos: [],
  registros: [],
  inventario: [],
  loading: false,
  categorias: { ...CATEGORIAS },
  subcategorias: { ...SUBCATEGORIAS },
  categoriasDB: [],
  subcategoriasDB: [],
  setProductos: (productos) => set({ productos }),
  setRegistros: (registros) => set({ registros }),
  setInventario: (inventario) => set({ inventario }),
  setLoading: (loading) => set({ loading }),
  addRegistro: (registro) => set((state) => ({
    registros: [registro, ...state.registros],
  })),
  setCategoriasDB: (rows) => set({
    categoriasDB: rows,
    categorias: buildCategorias(rows),
  }),
  setSubcategoriasDB: (rows) => set({
    subcategoriasDB: rows,
    subcategorias: buildSubcategorias(rows),
  }),
}));
