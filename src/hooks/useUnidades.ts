import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULT_CONTEO = ['CAJA', 'BULTO', 'CARTON', 'PALLET', 'UNIDAD', 'ROLLO', 'SET', 'DRUM', 'SACK'];
const DEFAULT_BASE = ['BOLSA', 'TAZA', 'TAPA', 'TAZA/TAPA', 'UNIDAD', 'ROLLO', 'SET', 'SACK', 'DRUM', 'PALLET'];

export function useUnidades() {
  const [unidadesConteo, setUnidadesConteo] = useState<string[]>(DEFAULT_CONTEO);
  const [unidadesBase, setUnidadesBase] = useState<string[]>(DEFAULT_BASE);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('parametros')
      .select('key, valor')
      .in('key', ['unidades_conteo', 'unidades_base']);
    if (data) {
      const conteo = data.find(d => d.key === 'unidades_conteo');
      const base = data.find(d => d.key === 'unidades_base');
      if (conteo?.valor) setUnidadesConteo(conteo.valor as string[]);
      if (base?.valor) setUnidadesBase(base.valor as string[]);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregarConteo(valor: string) {
    const v = valor.trim().toUpperCase();
    if (!v || unidadesConteo.includes(v)) return;
    const nueva = [...unidadesConteo, v];
    await supabase.from('parametros').upsert({ key: 'unidades_conteo', valor: nueva });
    setUnidadesConteo(nueva);
  }

  async function eliminarConteo(valor: string) {
    const nueva = unidadesConteo.filter(u => u !== valor);
    await supabase.from('parametros').upsert({ key: 'unidades_conteo', valor: nueva });
    setUnidadesConteo(nueva);
  }

  async function agregarBase(valor: string) {
    const v = valor.trim().toUpperCase();
    if (!v || unidadesBase.includes(v)) return;
    const nueva = [...unidadesBase, v];
    await supabase.from('parametros').upsert({ key: 'unidades_base', valor: nueva });
    setUnidadesBase(nueva);
  }

  async function eliminarBase(valor: string) {
    const nueva = unidadesBase.filter(u => u !== valor);
    await supabase.from('parametros').upsert({ key: 'unidades_base', valor: nueva });
    setUnidadesBase(nueva);
  }

  return { unidadesConteo, unidadesBase, agregarConteo, eliminarConteo, agregarBase, eliminarBase };
}
