import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface RegistroAuditoria {
  id: string;
  producto_code: string;
  producto_name: string | null;
  accion: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  created_at: string;
}

interface FiltrosAuditoria {
  busqueda?: string;
  accion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  porPagina?: number;
}

export function useAuditoriaCatalogo(filtros: FiltrosAuditoria = {}) {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const { busqueda, accion, fechaDesde, fechaHasta, pagina = 1, porPagina = 50 } = filtros;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('auditoria_catalogo')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (busqueda) {
        query = query.or(
          `producto_code.ilike.%${busqueda}%,producto_name.ilike.%${busqueda}%,usuario_nombre.ilike.%${busqueda}%`
        );
      }
      if (accion) query = query.eq('accion', accion);
      if (fechaDesde) query = query.gte('created_at', fechaDesde);
      if (fechaHasta) query = query.lte('created_at', fechaHasta + 'T23:59:59');

      const from = (pagina - 1) * porPagina;
      query = query.range(from, from + porPagina - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      setRegistros((data || []) as RegistroAuditoria[]);
      setTotal(count || 0);
    } catch (e) {
      console.error('Error cargando auditoría:', e);
    } finally {
      setLoading(false);
    }
  }, [busqueda, accion, fechaDesde, fechaHasta, pagina, porPagina]);

  useEffect(() => { cargar(); }, [cargar]);

  return { registros, loading, total, recargar: cargar };
}
