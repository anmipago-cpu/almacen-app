import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import type { Registro } from '../types';

interface FiltrosRegistros {
  fechaDesde?: string;
  fechaHasta?: string;
  tipo?: string;
  busqueda?: string;
  lote?: string;
  pagina?: number;
  porPagina?: number;
}

export function useRegistros(filtros: FiltrosRegistros = {}) {
  const { registros, setRegistros } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const { fechaDesde, fechaHasta, tipo, busqueda, lote, pagina = 1, porPagina = 25 } = filtros;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('recepciones')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (fechaDesde) query = query.gte('fecha', fechaDesde);
      if (fechaHasta) query = query.lte('fecha', fechaHasta);
      if (tipo) query = query.eq('tipo', tipo);
      if (lote) query = query.ilike('lote', `%${lote}%`);
      if (busqueda) {
        query = query.or(`producto_name.ilike.%${busqueda}%,producto_code.ilike.%${busqueda}%`);
      }

      const from = (pagina - 1) * porPagina;
      query = query.range(from, from + porPagina - 1);

      const { data, error: err, count } = await query;
      if (err) throw err;
      setRegistros((data || []) as Registro[]);
      setTotal(count || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar recepciones');
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, tipo, busqueda, lote, pagina, porPagina, setRegistros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarRegistro(registro: Omit<Registro, 'id' | 'created_at' | 'recepcion_number'>) {
    const { data, error: err } = await supabase
      .from('recepciones')
      .insert(registro)
      .select()
      .single();
    if (err) throw err;
    return data as Registro;
  }

  return { registros, loading, error, total, recargar: cargar, guardarRegistro };
}
