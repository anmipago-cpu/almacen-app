import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import type { Producto } from '../types';

export function useProductos() {
  const { productos, setProductos } = useStore();
  const [loading, setLoading] = useState(productos.length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productos.length > 0) return;
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('productos')
        .select('*')
        .order('code');
      if (err) throw err;
      setProductos(data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }

  async function actualizarProducto(code: string, cambios: Partial<Producto>) {
    const { error: err } = await supabase
      .from('productos')
      .update(cambios)
      .eq('code', code);
    if (err) throw err;
    setProductos(productos.map(p => p.code === code ? { ...p, ...cambios } : p));
  }

  return { productos, loading, error, recargar: cargar, actualizarProducto };
}
