import { useState } from 'react';

const DEFAULT_CONTEO = ['CAJA', 'BULTO', 'PALLET', 'UNIDAD', 'ROLLO', 'SET', 'DRUM', 'SACK'];
const DEFAULT_BASE = ['BOLSA', 'TAZA', 'TAPA', 'TAZA/TAPA', 'UNIDAD', 'ROLLO', 'SET'];

const KEY_CONTEO = 'almacen_unidades_conteo';
const KEY_BASE = 'almacen_unidades_base';

function loadFromStorage(key: string, defaults: string[]): string[] {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaults;
  } catch {
    return defaults;
  }
}

function saveToStorage(key: string, values: string[]) {
  localStorage.setItem(key, JSON.stringify(values));
}

export function useUnidades() {
  const [unidadesConteo, setUnidadesConteo] = useState<string[]>(() =>
    loadFromStorage(KEY_CONTEO, DEFAULT_CONTEO)
  );
  const [unidadesBase, setUnidadesBase] = useState<string[]>(() =>
    loadFromStorage(KEY_BASE, DEFAULT_BASE)
  );

  function agregarConteo(valor: string) {
    const v = valor.trim().toUpperCase();
    if (!v || unidadesConteo.includes(v)) return;
    const nueva = [...unidadesConteo, v];
    setUnidadesConteo(nueva);
    saveToStorage(KEY_CONTEO, nueva);
  }

  function eliminarConteo(valor: string) {
    const nueva = unidadesConteo.filter(u => u !== valor);
    setUnidadesConteo(nueva);
    saveToStorage(KEY_CONTEO, nueva);
  }

  function agregarBase(valor: string) {
    const v = valor.trim().toUpperCase();
    if (!v || unidadesBase.includes(v)) return;
    const nueva = [...unidadesBase, v];
    setUnidadesBase(nueva);
    saveToStorage(KEY_BASE, nueva);
  }

  function eliminarBase(valor: string) {
    const nueva = unidadesBase.filter(u => u !== valor);
    setUnidadesBase(nueva);
    saveToStorage(KEY_BASE, nueva);
  }

  return { unidadesConteo, unidadesBase, agregarConteo, eliminarConteo, agregarBase, eliminarBase };
}
