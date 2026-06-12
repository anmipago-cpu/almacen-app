import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface GestionRecord {
  id: string;
  producto_code: string;
  estado: string;
  stock_actual: number;
  informado_a?: string;
  notas?: string;
  created_at: string;
}

const SEVERIDAD: Record<string, number> = { VERDE: 0, AMARILLO: 1, ROJO: 2, AGOTADO: 3 };

export function useAlertasGestion() {
  const [gestiones, setGestiones] = useState<GestionRecord[]>([]);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('alertas_gestion')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setGestiones(data as GestionRecord[]);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function registrar(
    producto_code: string,
    estado: string,
    stock_actual: number,
    informado_a?: string,
    notas?: string
  ) {
    const { error } = await supabase
      .from('alertas_gestion')
      .insert({ producto_code, estado, stock_actual, informado_a: informado_a || null, notas: notas || null });
    if (error) throw error;
    await cargar();
  }

  function getUltima(code: string): GestionRecord | undefined {
    return gestiones.find(g => g.producto_code === code);
  }

  // Necesita (re)informar si nunca se informó o si el estado empeoró
  function necesitaInformar(code: string, estadoActual: string): boolean {
    const ultima = getUltima(code);
    if (!ultima) return true;
    const prevSev = SEVERIDAD[ultima.estado] ?? 0;
    const currSev = SEVERIDAD[estadoActual] ?? 0;
    return currSev > prevSev;
  }

  return { gestiones, registrar, getUltima, necesitaInformar, recargar: cargar };
}
