import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import type { InventarioItem } from '../types';

export function useInventario() {
  const { inventario, setInventario } = useStore();
  const [loading, setLoading] = useState(inventario.length === 0);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('inventario_actual')
        .select('*')
        .order('name');
      if (err) throw err;
      setInventario((data || []) as InventarioItem[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  }, [setInventario]);

  useEffect(() => {
    cargar();

    const channel = supabase
      .channel('inventario-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recepciones' }, () => {
        cargar();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [cargar]);

  return { inventario, loading, error, recargar: cargar };
}
