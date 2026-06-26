import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { formatNumero } from '../lib/utils';
import type { ConsumoSemanal } from '../types';

export function Historial() {
  const [datos, setDatos] = useState<ConsumoSemanal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [semanaFiltro, setSemanaFiltro] = useState('');
  const [vistaMode, setVistaMode] = useState<'tabla' | 'resumen'>('tabla');

  useEffect(() => { cargar(); }, []);

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

  const semanas = useMemo(() => {
    const set = new Set<string>();
    datos.forEach(d => set.add(`${d.año}-S${String(d.semana_numero).padStart(2, '0')}`));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [datos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return datos.filter(d => {
      const matchTexto = !q ||
        d.producto_code.toLowerCase().includes(q) ||
        (d.producto_name ?? '').toLowerCase().includes(q);
      const clave = `${d.año}-S${String(d.semana_numero).padStart(2, '0')}`;
      const matchSemana = !semanaFiltro || clave === semanaFiltro;
      return matchTexto && matchSemana;
    });
  }, [datos, busqueda, semanaFiltro]);

  // Resumen por producto: total y promedio entre todas las semanas
  const resumenPorProducto = useMemo(() => {
    const map = new Map<string, { name: string; total: number; semanas: Set<string> }>();
    datos.forEach(d => {
      const key = d.producto_code;
      const sem = `${d.año}-${d.semana_numero}`;
      const cur = map.get(key) ?? { name: d.producto_name ?? d.producto_code, total: 0, semanas: new Set() };
      cur.total += d.cantidad_consumida;
      cur.semanas.add(sem);
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([code, v]) => ({
        code,
        name: v.name,
        total: v.total,
        numSemanas: v.semanas.size,
        promedio: v.semanas.size ? v.total / v.semanas.size : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [datos]);

  return (
    <div>
      <Header
        title="Monitor de Consumo Semanal"
        subtitle="Historial de consumos estadísticos cargados por semana. No afecta el inventario."
        actions={<Button variant="outline" onClick={cargar}>Actualizar</Button>}
      />

      {/* Tarjetas resumen */}
      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Semanas registradas</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '—' : semanas.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Productos con historial</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '—' : resumenPorProducto.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total registros</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '—' : datos.length}</p>
        </div>
      </div>

      <Card>
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="pointer-events-none absolute left-4 top-3.5 text-slate-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por código o nombre..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <select
            value={semanaFiltro}
            onChange={e => setSemanaFiltro(e.target.value)}
            className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todas las semanas</option>
            {semanas.map(s => <option key={s} value={s}>{s.replace('-S', ' — Sem ')}</option>)}
          </select>
          <div className="flex rounded-2xl border border-slate-200 overflow-hidden text-sm">
            <button
              onClick={() => setVistaMode('tabla')}
              className={`px-4 py-2 font-medium transition ${vistaMode === 'tabla' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Por semana
            </button>
            <button
              onClick={() => setVistaMode('resumen')}
              className={`px-4 py-2 font-medium transition ${vistaMode === 'resumen' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Resumen
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando...</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : vistaMode === 'tabla' ? (
          /* Vista por semana */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Semana</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Año</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Cantidad consumida</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fuente</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">No hay registros.</td></tr>
                ) : filtrados.map((d, i) => (
                  <tr key={`${d.producto_code}-${d.semana_numero}-${d.año}`} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 font-semibold text-slate-700">Sem {d.semana_numero}</td>
                    <td className="px-4 py-3 text-slate-500">{d.año}</td>
                    <td className="px-4 py-3 font-mono text-slate-600 text-xs">{d.producto_code}</td>
                    <td className="px-4 py-3 text-slate-900">{d.producto_name}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{formatNumero(d.cantidad_consumida, 0)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{d.fuente || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-right text-xs text-slate-400">{filtrados.length} registros</p>
          </div>
        ) : (
          /* Vista resumen por producto */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Semanas</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total consumido</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Prom. semanal</th>
                </tr>
              </thead>
              <tbody>
                {resumenPorProducto.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">No hay datos.</td></tr>
                ) : resumenPorProducto.map((p, i) => (
                  <tr key={p.code} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 font-mono text-slate-600 text-xs">{p.code}</td>
                    <td className="px-4 py-3 text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{p.numSemanas}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{formatNumero(p.total, 0)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumero(p.promedio, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
