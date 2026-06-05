import { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { formatNumero, hoy } from '../lib/utils';
import type { ConsumoSemanal } from '../types';

function getWeekLabel(item: ConsumoSemanal) {
  return `Semana ${item.semana_numero} / ${item.año}`;
}

export function Historial() {
  const [datos, setDatos] = useState<ConsumoSemanal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('consumos_semanales')
        .select('*')
        .order('año', { ascending: false })
        .order('semana_numero', { ascending: false });
      if (err) throw err;
      setDatos(data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }

  const resumenPorProducto = useMemo(() => {
    const result = new Map<string, { total: number; semanas: number; recent: ConsumoSemanal[] }>();
    const recent = datos.slice(0, 26);

    recent.forEach(item => {
      const key = item.producto_code;
      const current = result.get(key) ?? { total: 0, semanas: 0, recent: [] };
      result.set(key, {
        total: current.total + item.cantidad_consumida,
        semanas: current.semanas + 1,
        recent: [...current.recent, item],
      });
    });

    return Array.from(result.values()).map(product => ({
      ...product.recent[0],
      semanas: product.semanas,
      promedio: product.semanas ? product.total / product.semanas : 0,
      total_consumo: product.total,
    }));
  }, [datos]);

  const ultimasSemanas = useMemo(() => datos.slice(0, 6), [datos]);

  return (
    <div>
      <Header
        title="Historial de Consumo"
        subtitle="Consulta las últimas semanas y los promedios para detectar tendencias de inventario."
        actions={
          <Button variant="outline" onClick={cargar}>
            Refrescar
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr] mb-5">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Últimas 6 semanas</h2>
              <p className="text-sm text-slate-500">Revisa los consumos recientes por producto.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Actualizado {hoy()}</span>
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Cargando historial...</div>
            ) : error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
            ) : ultimasSemanas.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">No hay consumo registrado aún.</div>
            ) : (
              <div className="grid gap-3">
                {ultimasSemanas.map(item => (
                  <div key={`${item.producto_code}-${item.semana_numero}-${item.año}`} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.producto_name}</p>
                        <p className="text-xs text-slate-500">{getWeekLabel(item)}</p>
                      </div>
                      <p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{formatNumero(item.cantidad_consumida, 0)} unidades</p>
                    </div>
                    {item.fuente && <p className="mt-3 text-sm text-slate-500">Fuente: {item.fuente}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Promedio móvil</h2>
            <p className="text-sm text-slate-500">Promedio de consumo por producto en las últimas semanas.</p>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Cargando cálculos...</div>
          ) : resumenPorProducto.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">No hay datos suficientes para calcular promedios.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Promedio semanal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Total últimas {resumenPorProducto[0]?.semanas || 0} semanas</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenPorProducto.map(item => (
                    <tr key={item.producto_code} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-slate-900">{item.producto_name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{formatNumero(item.promedio, 1)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatNumero(item.total_consumo, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
