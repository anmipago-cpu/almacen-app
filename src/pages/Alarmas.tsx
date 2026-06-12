import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bell, Download } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeCategoria, BadgeEstado } from '../components/ui/Badge';
import { useInventario } from '../hooks/useInventario';
import { useProductos } from '../hooks/useProductos';
import { formatNumero, exportarExcel } from '../lib/utils';
import type { InventarioItem } from '../types';

type Semaforo = 'AGOTADO' | 'ROJO' | 'AMARILLO' | 'VERDE';

function getSemaforo(item: InventarioItem): Semaforo {
  if (item.stock_actual <= 0) return 'AGOTADO';
  const lt = item.lead_time_semanas;
  if (lt && lt > 0 && item.promedio_consumo_semanal > 0) {
    const semanas = item.stock_actual / item.promedio_consumo_semanal;
    if (semanas <= lt)     return 'ROJO';
    if (semanas <= lt + 1) return 'AMARILLO';
    return 'VERDE';
  }
  if (item.stock_min > 0 && item.stock_actual <= item.stock_min) return 'ROJO';
  if (item.stock_bajo > 0 && item.stock_actual <= item.stock_bajo) return 'AMARILLO';
  return 'VERDE';
}

function getSemanasLabel(item: InventarioItem): string {
  const lt = item.lead_time_semanas;
  if (lt && lt > 0 && item.promedio_consumo_semanal > 0) {
    return formatNumero(item.stock_actual / item.promedio_consumo_semanal, 1);
  }
  return 'N/A';
}

const SEVERIDAD: Record<string, number> = { VERDE: 0, AMARILLO: 1, ROJO: 2, AGOTADO: 3 };

const FILTROS: { key: Semaforo | ''; label: string }[] = [
  { key: '',        label: 'Todos'     },
  { key: 'AGOTADO', label: 'Sin stock' },
  { key: 'ROJO',    label: 'Crítico'   },
  { key: 'AMARILLO',label: 'Alerta'    },
  { key: 'VERDE',   label: 'OK'        },
];

const FILTRO_STYLE: Record<string, string> = {
  '':        'bg-slate-100 text-slate-700 border-slate-200',
  'AGOTADO': 'bg-slate-800 text-white border-slate-700',
  'ROJO':    'bg-red-100 text-red-700 border-red-200',
  'AMARILLO':'bg-amber-100 text-amber-700 border-amber-200',
  'VERDE':   'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export function Alarmas() {
  const { inventario, loading, recargar } = useInventario();
  const { productos } = useProductos();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<Semaforo | ''>('');
  const [enviando, setEnviando] = useState(false);
  const notifChecked = useRef(false);

  // ── Enriquecer con datos del catálogo ───────────────────────────────────
  const leadTimeMap = useMemo(() => {
    const map = new Map<string, number | null>();
    productos
      .filter(p => p.active !== false)
      .forEach(p => map.set(p.code, p.lead_time_semanas ?? null));
    return map;
  }, [productos]);

  const consumoMap = useMemo(() => {
    const map = new Map<string, number>();
    productos
      .filter(p => p.active !== false)
      .forEach(p => {
        if (p.consumo_promedio_semanal && p.consumo_promedio_semanal > 0)
          map.set(p.code, p.consumo_promedio_semanal);
      });
    return map;
  }, [productos]);

  const enriched = useMemo<InventarioItem[]>(() => {
    return inventario.map(item => ({
      ...item,
      lead_time_semanas: leadTimeMap.get(item.code) ?? item.lead_time_semanas,
      promedio_consumo_semanal: consumoMap.get(item.code) ?? item.promedio_consumo_semanal,
    }));
  }, [inventario, leadTimeMap, consumoMap]);

  // ── Solo productos con parámetros configurados ──────────────────────────
  const configurados = useMemo(() => enriched.filter(item => {
    const lt = item.lead_time_semanas;
    return (lt && lt > 0 && item.promedio_consumo_semanal > 0) || item.stock_min > 0 || item.stock_bajo > 0;
  }), [enriched]);

  const datos = useMemo(() => {
    return enriched
      .filter(item => {
        const lt = item.lead_time_semanas;
        return (lt && lt > 0 && item.promedio_consumo_semanal > 0) || item.stock_min > 0 || item.stock_bajo > 0;
      })
      .sort((a, b) => {
        const score = (i: InventarioItem) => {
          if (i.stock_actual <= 0) return -1;
          const lt = i.lead_time_semanas;
          if (lt && lt > 0 && i.promedio_consumo_semanal > 0)
            return i.stock_actual / i.promedio_consumo_semanal;
          return 999;
        };
        return score(a) - score(b);
      });
  }, [enriched]);

  const datosFiltrados = useMemo(() => {
    return datos.filter(item => {
      const estado = getSemaforo(item);
      const matchEstado   = !filtroEstado || estado === filtroEstado;
      const q             = busqueda.toLowerCase();
      const matchBusqueda = !busqueda || item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
      return matchEstado && matchBusqueda;
    });
  }, [datos, filtroEstado, busqueda]);

  // ── Detección automática de nuevas alertas ──────────────────────────────
  useEffect(() => {
    if (loading || notifChecked.current || configurados.length === 0) return;
    notifChecked.current = true;

    const KEY = 'alarmas_last_states';
    let lastStates: Record<string, string> = {};
    try { lastStates = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* noop */ }

    const currentStates: Record<string, string> = {};
    const newAlerts: InventarioItem[] = [];

    configurados.forEach(item => {
      const estado = getSemaforo(item);
      currentStates[item.code] = estado;
      if (estado === 'VERDE') return;
      const prev = lastStates[item.code];
      if (prev === undefined) return; // primera vez: registrar sin notificar
      const prevSev = SEVERIDAD[prev] ?? 0;
      const currSev = SEVERIDAD[estado] ?? 0;
      if (currSev > prevSev) newAlerts.push(item); // solo si empeoró
    });

    localStorage.setItem(KEY, JSON.stringify(currentStates));

    if (newAlerts.length > 0) {
      toast.warning(`${newAlerts.length} nueva(s) alerta(s) detectada(s). Enviando notificaciones...`);
      sendAlerts(newAlerts);
    }
  }, [loading, configurados]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Envío de notificaciones ─────────────────────────────────────────────
  async function sendAlerts(items: InventarioItem[]) {
    const payload = items.map(item => ({
      code:                   item.code,
      name:                   item.name,
      category:               item.category,
      stock_actual:           item.stock_actual,
      stock_min:              item.stock_min,
      stock_bajo:             item.stock_bajo,
      lead_time_semanas:      item.lead_time_semanas,
      promedio_consumo_semanal: item.promedio_consumo_semanal,
      semanas_restantes:      getSemanasLabel(item),
      estado:                 getSemaforo(item),
    }));

    try {
      const res = await fetch('/api/notificaciones', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ productos: payload }),
      });
      const data: { ok: boolean; results: Record<string, string>; error?: string } = await res.json();
      if (data.ok) {
        const summary = Object.entries(data.results).map(([k, v]) => `${k}: ${v}`).join(' | ');
        toast.success(`Notificaciones enviadas. ${summary}`);
      } else {
        toast.error(data.error ?? 'Error al enviar notificaciones.');
      }
    } catch {
      toast.error('No se pudo conectar con el servidor de notificaciones.');
    }
  }

  async function handleNotificar() {
    const enAlerta = datos.filter(i => getSemaforo(i) !== 'VERDE');
    if (!enAlerta.length) { toast.info('No hay productos en alerta para notificar.'); return; }
    setEnviando(true);
    await sendAlerts(enAlerta);
    setEnviando(false);
  }

  function handleExport() {
    exportarExcel(datosFiltrados.map(item => ({
      Código:             item.code,
      Nombre:             item.name,
      Categoría:          item.category,
      Proveedor:          item.supplier || '',
      'Stock actual':     item.stock_actual,
      'Stock mín.':       item.stock_min,
      'Stock alerta':     item.stock_bajo,
      'Lead time (sem)':  item.lead_time_semanas ?? '',
      'Promedio semanal': item.promedio_consumo_semanal,
      'Semanas restantes': getSemanasLabel(item),
      Estado:             getSemaforo(item),
    })), 'alarmas');
  }

  return (
    <div>
      <Header
        title="Alarmas y Semáforo"
        subtitle="Visualiza los productos más urgentes y su estado de reabastecimiento."
        actions={
          <Button variant="outline" onClick={recargar}>Actualizar</Button>
        }
      />

      {/* ── Tarjetas resumen ── */}
      <Card className="mb-5">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-medium text-slate-300">Sin stock</p>
            <p className="mt-2 text-3xl font-bold text-white">{configurados.filter(i => getSemaforo(i) === 'AGOTADO').length}</p>
            <p className="text-sm text-slate-400">Stock = 0</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Crítico</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{configurados.filter(i => getSemaforo(i) === 'ROJO').length}</p>
            <p className="text-sm text-slate-500">≤ Stock mínimo</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-700">Alerta</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{configurados.filter(i => getSemaforo(i) === 'AMARILLO').length}</p>
            <p className="text-sm text-slate-500">≤ Stock alerta</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-700">OK</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{configurados.filter(i => getSemaforo(i) === 'VERDE').length}</p>
            <p className="text-sm text-slate-500">Stock suficiente</p>
          </div>
        </div>
      </Card>

      {/* ── Tabla ── */}
      <Card className="!p-0 overflow-hidden">
        {/* Encabezado con búsqueda y filtros */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Listado de alarmas</h2>
              <p className="text-sm text-slate-500">Solo productos con lead time o umbrales configurados. Ordenado por urgencia.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handleNotificar} loading={enviando} icon={<Bell size={15} />}>
                Notificar
              </Button>
              <Button variant="outline" onClick={handleExport} icon={<Download size={15} />}>
                Exportar Excel
              </Button>
            </div>
          </div>

          {/* Búsqueda + filtros por estado */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar código o nombre..."
                className="rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 w-52"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base leading-none">×</button>
              )}
            </div>
            <div className="flex gap-1 flex-wrap">
              {FILTROS.map(({ key, label }) => {
                const count = key === '' ? datos.length : datos.filter(i => getSemaforo(i) === key).length;
                return (
                  <button
                    key={key}
                    onClick={() => setFiltroEstado(key)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${FILTRO_STYLE[key]} ${filtroEstado === key ? 'ring-2 ring-offset-1 ring-blue-400' : 'opacity-70 hover:opacity-100'}`}
                  >
                    {label} <span className="font-bold ml-1">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando alarmas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Código', 'Nombre', 'Categoría', 'Stock actual', 'Stock mín.', 'Stock alerta', 'Lead time', 'Promedio sem.', 'Semanas restantes', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datosFiltrados.length === 0 ? (
                  <tr><td colSpan={10} className="p-6 text-center text-slate-500">No hay alarmas para mostrar.</td></tr>
                ) : datosFiltrados.map((item, idx) => (
                  <tr key={item.code} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 font-mono text-slate-700">{item.code}</td>
                    <td className="px-4 py-3 text-slate-900">{item.name}</td>
                    <td className="px-4 py-3"><BadgeCategoria category={item.category} /></td>
                    <td className="px-4 py-3 font-mono text-slate-700">{formatNumero(item.stock_actual)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{item.stock_min}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{item.stock_bajo}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{item.lead_time_semanas != null ? `${item.lead_time_semanas} sem` : '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{formatNumero(item.promedio_consumo_semanal, 1)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{getSemanasLabel(item)}</td>
                    <td className="px-4 py-3">
                      <BadgeEstado estado={
                        getSemaforo(item) === 'AGOTADO' ? 'AGOTADO'
                        : getSemaforo(item) === 'ROJO'    ? 'CRITICO'
                        : getSemaforo(item) === 'AMARILLO' ? 'BAJO'
                        : 'OK'
                      } />
                    </td>
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
