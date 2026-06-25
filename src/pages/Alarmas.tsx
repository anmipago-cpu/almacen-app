import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, Download, CheckCircle2, Clock } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeCategoria, BadgeEstado } from '../components/ui/Badge';
import { useInventario } from '../hooks/useInventario';
import { useProductos } from '../hooks/useProductos';
import { useAlertasGestion } from '../hooks/useAlertasGestion';
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
  { key: '',         label: 'Todos'     },
  { key: 'AGOTADO',  label: 'Sin stock' },
  { key: 'ROJO',     label: 'Crítico'   },
  { key: 'AMARILLO', label: 'Alerta'    },
  { key: 'VERDE',    label: 'OK'        },
];

const FILTRO_STYLE: Record<string, string> = {
  '':        'bg-slate-100 text-slate-700 border-slate-200',
  'AGOTADO': 'bg-slate-800 text-white border-slate-700',
  'ROJO':    'bg-red-100 text-red-700 border-red-200',
  'AMARILLO':'bg-amber-100 text-amber-700 border-amber-200',
  'VERDE':   'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function Alarmas() {
  const { inventario, loading, recargar } = useInventario();
  const { productos } = useProductos();
  const { registrar, getUltima, necesitaInformar } = useAlertasGestion();
  const [searchParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<Semaforo | ''>((searchParams.get('estado') as Semaforo) || '');
  const [enviando, setEnviando] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<InventarioItem | null>(null);
  const [notasModal, setNotasModal] = useState('');
  const notifChecked = useRef(false);

  // ── Enriquecer con catálogo ─────────────────────────────────────────────
  const leadTimeMap = useMemo(() => {
    const map = new Map<string, number | null>();
    productos.filter(p => p.active !== false)
      .forEach(p => map.set(p.code, p.lead_time_semanas ?? null));
    return map;
  }, [productos]);

  const consumoMap = useMemo(() => {
    const map = new Map<string, number>();
    productos.filter(p => p.active !== false)
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

  const configurados = useMemo(() => enriched.filter(item => {
    const lt = item.lead_time_semanas;
    return (lt && lt > 0 && item.promedio_consumo_semanal > 0) || item.stock_min > 0 || item.stock_bajo > 0;
  }), [enriched]);

  const datos = useMemo(() => enriched
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
    }), [enriched]);

  const datosFiltrados = useMemo(() => datos.filter(item => {
    const estado = getSemaforo(item);
    const matchEstado   = !filtroEstado || estado === filtroEstado;
    const q             = busqueda.toLowerCase();
    const matchBusqueda = !busqueda || item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
    return matchEstado && matchBusqueda;
  }), [datos, filtroEstado, busqueda]);

  // ── Detección automática de cambios de estado ───────────────────────────
  useEffect(() => {
    if (loading || notifChecked.current || configurados.length === 0) return;
    notifChecked.current = true;

    const KEY          = 'alarmas_last_states';
    const ENTRY_KEY    = 'alarmas_entry_times';
    const WEEKLY_KEY   = 'alarmas_weekly_sent';
    const now          = Date.now();
    const MS_4_DAYS    = 4 * 24 * 60 * 60 * 1000;
    const MS_24H       = 24 * 60 * 60 * 1000;
    const hoyDia       = new Date().getDay(); // 0=dom, 1=lun
    const inicioSemana = (() => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (hoyDia === 0 ? 6 : hoyDia - 1)); return d.toISOString().slice(0,10); })();

    let lastStates: Record<string, string> = {};
    let entryTimes: Record<string, { enteredAt: number; lastReminded: number | null }> = {};
    try { lastStates  = JSON.parse(localStorage.getItem(KEY)       || '{}'); } catch { /* noop */ }
    try { entryTimes  = JSON.parse(localStorage.getItem(ENTRY_KEY) || '{}'); } catch { /* noop */ }

    const currentStates: Record<string, string> = {};
    const newAlerts:     InventarioItem[] = [];
    const reminders:     InventarioItem[] = [];

    configurados.forEach(item => {
      const estado = getSemaforo(item);
      currentStates[item.code] = estado;

      // ── Cambios de estado (nueva alerta o primer avistamiento) ──
      if (estado !== 'VERDE') {
        const prev    = lastStates[item.code];
        const prevSev = SEVERIDAD[prev ?? 'VERDE'] ?? 0;
        const currSev = SEVERIDAD[estado] ?? 0;
        if (currSev > prevSev) newAlerts.push(item);
      }

      // ── Recordatorio 4 días en ROJO o AGOTADO ──
      const isCritical = estado === 'ROJO' || estado === 'AGOTADO';
      if (!isCritical) {
        delete entryTimes[item.code];
        return;
      }
      if (!entryTimes[item.code]) {
        entryTimes[item.code] = { enteredAt: now, lastReminded: null };
        return;
      }
      const { enteredAt, lastReminded } = entryTimes[item.code];
      const elapsed       = now - enteredAt;
      const sinceReminded = lastReminded ? now - lastReminded : Infinity;
      if (elapsed >= MS_4_DAYS && sinceReminded >= MS_24H) {
        reminders.push(item);
        entryTimes[item.code].lastReminded = now;
      }
    });

    localStorage.setItem(KEY,       JSON.stringify(currentStates));
    localStorage.setItem(ENTRY_KEY, JSON.stringify(entryTimes));

    if (newAlerts.length > 0) {
      toast.warning(`${newAlerts.length} nueva(s) alerta(s) detectada(s). Enviando notificaciones...`);
      sendAlerts(newAlerts, false);
    }
    if (reminders.length > 0) {
      toast.warning(`${reminders.length} producto(s) llevan 4+ días en estado crítico. Enviando recordatorio...`);
      sendAlerts(reminders, true);
    }

    // ── Resumen semanal (lunes, una vez por semana) ──────────────────────
    const lastWeeklySent = localStorage.getItem(WEEKLY_KEY) || '';
    if (hoyDia === 1 && lastWeeklySent !== inicioSemana) {
      const enAlerta = configurados.filter(i => getSemaforo(i) !== 'VERDE');
      if (enAlerta.length > 0) {
        localStorage.setItem(WEEKLY_KEY, inicioSemana);
        toast.info(`Enviando resumen semanal de ${enAlerta.length} producto(s) en alerta...`);
        sendAlerts(enAlerta, false);
      }
    }
  }, [loading, configurados]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Envío de notificaciones ─────────────────────────────────────────────
  async function sendAlerts(items: InventarioItem[], esRecordatorio = false) {
    const payload = items.map(item => ({
      code: item.code, name: item.name, category: item.category,
      stock_actual: item.stock_actual, stock_min: item.stock_min, stock_bajo: item.stock_bajo,
      lead_time_semanas: item.lead_time_semanas, promedio_consumo_semanal: item.promedio_consumo_semanal,
      semanas_restantes: getSemanasLabel(item), estado: getSemaforo(item),
    }));
    try {
      const res = await fetch('/api/notificaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productos: payload, recordatorio: esRecordatorio }),
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
    await sendAlerts(enAlerta, false);
    setEnviando(false);
  }

  // ── Registrar gestión con notas opcionales ──────────────────────────────
  async function marcarInformado(item: InventarioItem, notas?: string) {
    setMarcando(item.code);
    setModalItem(null);
    setNotasModal('');
    try {
      await registrar(item.code, getSemaforo(item), item.stock_actual, undefined, notas || undefined);
      const payload = [{
        code: item.code, name: item.name, category: item.category,
        stock_actual: item.stock_actual, stock_min: item.stock_min, stock_bajo: item.stock_bajo,
        lead_time_semanas: item.lead_time_semanas, promedio_consumo_semanal: item.promedio_consumo_semanal,
        semanas_restantes: getSemanasLabel(item), estado: getSemaforo(item),
      }];
      // WhatsApp + correo de alerta general
      fetch('/api/notificaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productos: payload, recordatorio: false }),
      }).catch(() => {});
      // Correo específico al área de compras
      fetch('/api/notificaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'gestion', productos: payload }),
      }).catch(() => {});
      toast.success(`${item.name} marcado como informado.`);
    } catch {
      toast.error('Error al registrar. Verifica que la tabla alertas_gestion existe en Supabase.');
    } finally {
      setMarcando(null);
    }
  }

  function handleExport() {
    exportarExcel(datosFiltrados.map(item => {
      const ultima = getUltima(item.code);
      return {
        Código: item.code, Nombre: item.name, Categoría: item.category,
        Proveedor: item.supplier || '',
        'Stock actual': item.stock_actual, 'Stock mín.': item.stock_min, 'Stock alerta': item.stock_bajo,
        'Lead time (sem)': item.lead_time_semanas ?? '', 'Promedio semanal': item.promedio_consumo_semanal,
        'Semanas restantes': getSemanasLabel(item), Estado: getSemaforo(item),
        'Informado área': ultima ? formatFecha(ultima.created_at) : '',
        'Informado a': ultima?.informado_a ?? '',
        'Notas gestión': ultima?.notas ?? '',
      };
    }), 'alarmas');
  }

  return (<>
    <div>
      <Header
        title="Alarmas y Semáforo"
        subtitle="Visualiza los productos más urgentes y su estado de reabastecimiento."
        actions={<Button variant="outline" onClick={recargar}>Actualizar</Button>}
      />

      {/* ── Tarjetas resumen ── */}
      <Card className="mb-5">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <div className={`rounded-3xl border border-slate-800 bg-slate-900 p-4 cursor-pointer transition-opacity hover:opacity-80 ${filtroEstado === 'AGOTADO' ? 'ring-2 ring-offset-2 ring-slate-600' : ''}`}
            onClick={() => setFiltroEstado(f => f === 'AGOTADO' ? '' : 'AGOTADO')}>
            <p className="text-sm font-medium text-slate-300">Sin stock</p>
            <p className="mt-2 text-3xl font-bold text-white">{configurados.filter(i => getSemaforo(i) === 'AGOTADO').length}</p>
            <p className="text-sm text-slate-400">Stock = 0</p>
          </div>
          <div className={`rounded-3xl border border-slate-200 bg-red-50 p-4 cursor-pointer transition-opacity hover:opacity-80 ${filtroEstado === 'ROJO' ? 'ring-2 ring-offset-2 ring-red-400' : ''}`}
            onClick={() => setFiltroEstado(f => f === 'ROJO' ? '' : 'ROJO')}>
            <p className="text-sm font-medium text-red-700">Crítico</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{configurados.filter(i => getSemaforo(i) === 'ROJO').length}</p>
            <p className="text-sm text-slate-500">≤ Stock mínimo</p>
          </div>
          <div className={`rounded-3xl border border-slate-200 bg-amber-50 p-4 cursor-pointer transition-opacity hover:opacity-80 ${filtroEstado === 'AMARILLO' ? 'ring-2 ring-offset-2 ring-amber-400' : ''}`}
            onClick={() => setFiltroEstado(f => f === 'AMARILLO' ? '' : 'AMARILLO')}>
            <p className="text-sm font-medium text-amber-700">Alerta</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{configurados.filter(i => getSemaforo(i) === 'AMARILLO').length}</p>
            <p className="text-sm text-slate-500">≤ Stock alerta</p>
          </div>
          <div className={`rounded-3xl border border-slate-200 bg-emerald-50 p-4 cursor-pointer transition-opacity hover:opacity-80 ${filtroEstado === 'VERDE' ? 'ring-2 ring-offset-2 ring-emerald-400' : ''}`}
            onClick={() => setFiltroEstado(f => f === 'VERDE' ? '' : 'VERDE')}>
            <p className="text-sm font-medium text-emerald-700">OK</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{configurados.filter(i => getSemaforo(i) === 'VERDE').length}</p>
            <p className="text-sm text-slate-500">Stock suficiente</p>
          </div>
        </div>
      </Card>

      {/* ── Tabla ── */}
      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Listado de alarmas</h2>
              <p className="text-sm text-slate-500">Solo productos con lead time o umbrales configurados. Ordenado por urgencia.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handleNotificar} loading={enviando} icon={<Bell size={15} />}>Notificar</Button>
              <Button variant="outline" onClick={handleExport} icon={<Download size={15} />}>Exportar Excel</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar código o nombre..."
                className="rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-8 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 w-52"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base leading-none">×</button>
              )}
            </div>
            <div className="flex gap-1 flex-wrap">
              {FILTROS.map(({ key, label }) => {
                const count = key === '' ? datos.length : datos.filter(i => getSemaforo(i) === key).length;
                return (
                  <button key={key} onClick={() => setFiltroEstado(key)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${FILTRO_STYLE[key]} ${filtroEstado === key ? 'ring-2 ring-offset-1 ring-blue-400' : 'opacity-70 hover:opacity-100'}`}>
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
                  {['Código', 'Nombre', 'Categoría', 'Stock actual', 'Stock mín.', 'Stock alerta', 'Lead time sem.', 'Promedio sem.', 'Sem. restantes', 'Estado', 'Gestión compras'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datosFiltrados.length === 0 ? (
                  <tr><td colSpan={11} className="p-6 text-center text-slate-500">No hay alarmas para mostrar.</td></tr>
                ) : datosFiltrados.map((item, idx) => {
                  const estado = getSemaforo(item);
                  const ultima = getUltima(item.code);
                  const pendiente = necesitaInformar(item.code, estado) && estado !== 'VERDE';
                  return (
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
                        <BadgeEstado estado={estado === 'AGOTADO' ? 'AGOTADO' : estado === 'ROJO' ? 'CRITICO' : estado === 'AMARILLO' ? 'BAJO' : 'OK'} />
                      </td>
                      <td className="px-4 py-3 min-w-[160px]">
                        {estado === 'VERDE' ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : pendiente ? (
                          <button
                            onClick={() => { setModalItem(item); setNotasModal(''); }}
                            disabled={marcando === item.code}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-50"
                          >
                            <span className="inline-block h-3.5 w-3.5 rounded border-2 border-current" />
                            {marcando === item.code ? 'Guardando...' : ultima ? 'Re-informar' : 'Marcar informado'}
                          </button>
                        ) : ultima ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 size={13} /> Informado
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <Clock size={11} /> {formatFecha(ultima.created_at)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>

    {/* ── Modal de notas al informar ── */}
    {modalItem && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <h3 className="text-base font-semibold text-slate-900 mb-1">Marcar como informado</h3>
          <p className="text-sm text-slate-500 mb-4">
            <span className="font-medium text-slate-700">{modalItem.code}</span> — {modalItem.name}
          </p>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Observación <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={notasModal}
            onChange={e => setNotasModal(e.target.value)}
            placeholder="Ej: Pedido enviado a proveedor, llegada estimada viernes..."
            rows={3}
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
          />
          <div className="mt-4 flex gap-2 justify-end">
            <button
              onClick={() => { setModalItem(null); setNotasModal(''); }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => marcarInformado(modalItem, notasModal)}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Confirmar e informar
            </button>
          </div>
        </div>
      </div>
    )}
  </>);
}
