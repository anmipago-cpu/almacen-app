import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Pencil, Check, X, Download, Printer, Paperclip, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useProductos } from '../hooks/useProductos';
import { exportarExcel } from '../lib/utils';

interface GestionRecord {
  id: string;
  producto_code: string;
  estado: string;
  stock_actual: number;
  informado_a?: string;
  notas?: string;
  adjunto_url?: string;
  created_at: string;
}

const ESTADO_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  AGOTADO:  { bg: 'bg-slate-900',   text: 'text-white',       label: 'Sin stock' },
  ROJO:     { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Crítico' },
  AMARILLO: { bg: 'bg-yellow-100',  text: 'text-yellow-700',  label: 'Alerta' },
  VERDE:    { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'OK' },
};

function EstadoBadge({ estado }: { estado: string }) {
  const s = ESTADO_STYLES[estado] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: estado };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function nombreArchivo(url: string) {
  try { return decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? 'archivo'); }
  catch { return 'archivo'; }
}

export function SolicitudesInformadas() {
  const [registros, setRegistros]     = useState<GestionRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [busqueda, setBusqueda]       = useState('');
  const [fechaDesde, setFechaDesde]   = useState('');
  const [fechaHasta, setFechaHasta]   = useState('');
  const [editandoId, setEditandoId]   = useState<string | null>(null);
  const [notaEditar, setNotaEditar]   = useState('');
  const [adjuntoEditar, setAdjuntoEditar] = useState<string | undefined>(undefined);
  const [subiendo, setSubiendo]       = useState(false);
  const [guardando, setGuardando]     = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const { productos }                 = useProductos();

  const productoMap = useMemo(() => {
    const m: Record<string, { name: string }> = {};
    productos.forEach(p => { m[p.code] = { name: p.name }; });
    return m;
  }, [productos]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase
      .from('alertas_gestion')
      .select('*')
      .neq('informado_a', 'SISTEMA')
      .order('created_at', { ascending: false });
    if (data) setRegistros(data as GestionRecord[]);
    setLoading(false);
  }

  function iniciarEdicion(r: GestionRecord) {
    setEditandoId(r.id);
    setNotaEditar(r.notas ?? '');
    setAdjuntoEditar(r.adjunto_url);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setNotaEditar('');
    setAdjuntoEditar(undefined);
  }

  async function subirAdjunto(file: File, registroId: string) {
    setSubiendo(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `${registroId}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('ordenes-compra')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('ordenes-compra').getPublicUrl(path);
      setAdjuntoEditar(data.publicUrl);
      toast.success('Archivo cargado. Guarda para confirmar.');
    } catch (e: unknown) {
      toast.error(`Error al subir archivo: ${e instanceof Error ? e.message : 'desconocido'}`);
    } finally {
      setSubiendo(false);
    }
  }

  async function eliminarAdjunto() {
    setAdjuntoEditar(undefined);
  }

  async function guardarEdicion(id: string) {
    setGuardando(true);
    const { error } = await supabase
      .from('alertas_gestion')
      .update({
        notas:       notaEditar.trim() || null,
        adjunto_url: adjuntoEditar ?? null,
      })
      .eq('id', id);
    if (error) {
      toast.error('No se pudo guardar.');
    } else {
      setRegistros(prev => prev.map(r =>
        r.id === id
          ? { ...r, notas: notaEditar.trim() || undefined, adjunto_url: adjuntoEditar }
          : r
      ));
      toast.success('Guardado correctamente.');
      setEditandoId(null);
    }
    setGuardando(false);
  }

  const filtrados = useMemo(() => {
    const q     = busqueda.trim().toLowerCase();
    const desde = fechaDesde ? new Date(fechaDesde + 'T00:00:00') : null;
    const hasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : null;
    return registros.filter(r => {
      const prod  = productoMap[r.producto_code];
      const fecha = new Date(r.created_at);
      const matchTexto = !q ||
        r.producto_code.toLowerCase().includes(q) ||
        (prod?.name ?? '').toLowerCase().includes(q) ||
        r.estado.toLowerCase().includes(q) ||
        (r.notas ?? '').toLowerCase().includes(q);
      const matchDesde = !desde || fecha >= desde;
      const matchHasta = !hasta || fecha <= hasta;
      return matchTexto && matchDesde && matchHasta;
    });
  }, [registros, busqueda, fechaDesde, fechaHasta, productoMap]);

  const contadores = useMemo(() => {
    const hoy7 = new Date(); hoy7.setDate(hoy7.getDate() - 7);
    return {
      total:     registros.length,
      ultimos7:  registros.filter(r => new Date(r.created_at) >= hoy7).length,
      criticos:  registros.filter(r => r.estado === 'ROJO' || r.estado === 'AGOTADO').length,
    };
  }, [registros]);

  function handleExportExcel() {
    if (!filtrados.length) { toast.info('No hay registros para exportar.'); return; }
    const ESTADO_LABEL: Record<string, string> = {
      AGOTADO: 'Sin stock', ROJO: 'Crítico', AMARILLO: 'Alerta', VERDE: 'OK',
    };
    const datos = filtrados.map(r => ({
      'Fecha solicitud': formatFecha(r.created_at),
      'Código':          r.producto_code,
      'Producto':        productoMap[r.producto_code]?.name ?? r.producto_code,
      'Estado':          ESTADO_LABEL[r.estado] ?? r.estado,
      'Stock al informar': r.stock_actual,
      'Notas':           r.notas ?? '',
      'Adjunto':         r.adjunto_url ?? '',
    }));
    exportarExcel(datos as Record<string, unknown>[], 'solicitudes_informadas');
  }

  return (
    <div>
      <Header
        title="Solicitudes Informadas"
        subtitle="Historial de productos en alarma informados al área de compras."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" icon={<Download size={15} />} onClick={handleExportExcel}>
              Exportar Excel
            </Button>
            <Button variant="outline" icon={<Printer size={15} />} onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total registros</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '—' : contadores.total}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Últimos 7 días</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '—' : contadores.ultimos7}</p>
        </div>
        <div className="rounded-3xl border border-red-100 bg-red-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-400">Críticos / Sin stock</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{loading ? '—' : contadores.criticos}</p>
        </div>
      </div>

      <Card>
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4 no-print">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="pointer-events-none absolute left-4 top-3.5 text-slate-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por código, nombre, estado o nota..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-12 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex flex-col justify-center">
            <label className="text-xs text-slate-400 mb-1 ml-1">Desde</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
              className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="flex flex-col justify-center">
            <label className="text-xs text-slate-400 mb-1 ml-1">Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
              className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none" />
          </div>
          {(busqueda || fechaDesde || fechaHasta) && (
            <div className="flex items-end">
              <button onClick={() => { setBusqueda(''); setFechaDesde(''); setFechaHasta(''); }}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-50">
                Limpiar filtros
              </button>
            </div>
          )}
          <div className="flex items-end ml-auto">
            <span className="text-xs text-slate-400">{loading ? '...' : `${filtrados.length} registros`}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Fecha solicitud</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Stock al informar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Adjunto</th>
                <th className="px-4 py-3 w-10 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">No hay registros.</td></tr>
              ) : filtrados.map((r, i) => {
                const prod    = productoMap[r.producto_code];
                const editando = editandoId === r.id;
                return (
                  <tr key={r.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{formatFecha(r.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-slate-700 text-xs">{r.producto_code}</td>
                    <td className="px-4 py-3 text-slate-900">{prod?.name ?? r.producto_code}</td>
                    <td className="px-4 py-3"><EstadoBadge estado={r.estado} /></td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{r.stock_actual.toLocaleString('es-CO')}</td>

                    {/* Nota */}
                    <td className="px-4 py-3 min-w-[180px]">
                      {editando ? (
                        <input
                          autoFocus
                          value={notaEditar}
                          onChange={e => setNotaEditar(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') cancelarEdicion(); }}
                          placeholder="Escribe una nota..."
                          className="w-full rounded-xl border border-blue-400 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">
                          {r.notas || <span className="text-slate-300 italic">Sin nota</span>}
                        </span>
                      )}
                    </td>

                    {/* Adjunto */}
                    <td className="px-4 py-3 min-w-[160px]">
                      {editando ? (
                        <div className="flex flex-col gap-1">
                          {adjuntoEditar ? (
                            <div className="flex items-center gap-1.5">
                              <a href={adjuntoEditar} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate max-w-[120px]">
                                <Paperclip size={11} />
                                {nombreArchivo(adjuntoEditar)}
                              </a>
                              <button onClick={eliminarAdjunto} title="Quitar adjunto"
                                className="text-red-400 hover:text-red-600 shrink-0">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={subiendo}
                              className="flex items-center gap-1 text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg px-2 py-1 hover:border-blue-400 hover:text-blue-600 transition disabled:opacity-50"
                            >
                              <Paperclip size={11} />
                              {subiendo ? 'Subiendo...' : 'Adjuntar archivo'}
                            </button>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) subirAdjunto(file, r.id);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      ) : r.adjunto_url ? (
                        <a href={r.adjunto_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                          <ExternalLink size={11} />
                          <span className="truncate max-w-[130px]">{nombreArchivo(r.adjunto_url)}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300 italic">Sin adjunto</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 no-print">
                      {editando ? (
                        <div className="flex gap-1">
                          <button onClick={() => guardarEdicion(r.id)} disabled={guardando}
                            title="Guardar" className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelarEdicion} title="Cancelar"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => iniciarEdicion(r)} title="Editar"
                          className="rounded-lg p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition">
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
