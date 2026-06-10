import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Persona {
  id: string;
  code: string;
  nombre: string;
  activo: boolean;
}

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('personas')
      .select('*')
      .eq('activo', true)
      .order('code');
    setPersonas(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregarPersona(nombre: string) {
    const { data: all } = await supabase.from('personas').select('code');
    const codes = new Set((all || []).map((p: { code: string }) => p.code));
    let n = 1;
    while (codes.has(`PER-${String(n).padStart(3, '0')}`)) n++;
    const code = `PER-${String(n).padStart(3, '0')}`;
    const { error } = await supabase.from('personas').insert({ code, nombre: nombre.trim(), activo: true });
    if (error) throw error;
    await cargar();
  }

  async function actualizarPersona(id: string, nombre: string) {
    const { error } = await supabase.from('personas').update({ nombre: nombre.trim() }).eq('id', id);
    if (error) throw error;
    await cargar();
  }

  async function eliminarPersona(id: string) {
    const { error } = await supabase.from('personas').update({ activo: false }).eq('id', id);
    if (error) throw error;
    await cargar();
  }

  return { personas, loading, recargar: cargar, agregarPersona, actualizarPersona, eliminarPersona };
}
