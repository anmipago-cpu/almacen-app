import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Proveedor } from '../types';

export function useProveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('proveedores')
        .select('*')
        .order('code');
      if (err) throw err;
      setProveedores(data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  }

  async function crearProveedor(proveedor: Omit<Proveedor, 'id' | 'created_at'>) {
    const { error: err } = await supabase.from('proveedores').insert(proveedor);
    if (err) throw err;
    await cargar();
  }

  async function actualizarProveedor(code: string, cambios: Partial<Proveedor>) {
    const proveedorActual = proveedores.find(p => p.code === code);
    const { error: err } = await supabase
      .from('proveedores')
      .update(cambios)
      .eq('code', code);
    if (err) throw err;
    // Si cambió el nombre, actualizar los registros históricos que tenían el nombre anterior
    if (cambios.name && proveedorActual?.name && cambios.name !== proveedorActual.name) {
      await supabase
        .from('recepciones')
        .update({ proveedor: cambios.name })
        .eq('proveedor', proveedorActual.name);
    }
    setProveedores(prev => prev.map(p => p.code === code ? { ...p, ...cambios } : p));
  }

  return { proveedores, loading, error, recargar: cargar, crearProveedor, actualizarProveedor };
}
