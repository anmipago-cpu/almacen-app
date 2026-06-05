import { create } from 'zustand';
import type { Producto, Registro, InventarioItem } from '../types';

interface AppStore {
  productos: Producto[];
  registros: Registro[];
  inventario: InventarioItem[];
  loading: boolean;
  setProductos: (productos: Producto[]) => void;
  setRegistros: (registros: Registro[]) => void;
  setInventario: (inventario: InventarioItem[]) => void;
  setLoading: (loading: boolean) => void;
  addRegistro: (registro: Registro) => void;
}

export const useStore = create<AppStore>((set) => ({
  productos: [],
  registros: [],
  inventario: [],
  loading: false,
  setProductos: (productos) => set({ productos }),
  setRegistros: (registros) => set({ registros }),
  setInventario: (inventario) => set({ inventario }),
  setLoading: (loading) => set({ loading }),
  addRegistro: (registro) => set((state) => ({
    registros: [registro, ...state.registros],
  })),
}));
