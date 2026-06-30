import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, AlertTriangle, Search, Trash2, CheckCircle2, X, Download, Printer } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useProductos } from '../hooks/useProductos';
import { CATEGORIAS, SUBCATEGORIAS } from '../types';
import * as XLSX from 'xlsx';
import type { ConsumoSemanal as ConsumoSemanalType } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSemanaActual(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function isoWeekToRange(weekStr: string): { numero: number; año: number; label: string; labelCorto: string } {
  const [yearStr, wStr] = weekStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayW1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  const inicio = new Date(mondayW1.getTime() + (week - 1) * 7 * 86400000);
  const fin = new Date(inicio.getTime() + 6 * 86400000);
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const label = `Sem. ${week} · ${inicio.getDate()} ${meses[inicio.getMonth()]} - ${fin.getDate()} ${meses[fin.getMonth()]} ${year}`;
  const labelCorto = `S${week}/${String(year).slice(2)}`;
  return { numero: week, año: year, label, labelCorto };
}

function semanaKey(numero: number, año: number) { return `${año}-W${String(numero).padStart(2, '0')}`; }

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ParsedRow { code: string; name: string; cantidad: number; }
interface RegistroCS { id: string; producto_code: string; producto_name: string; cantidad_consumida: number; semana_numero: number; año: number; }

interface PendingUpload {
  fileName:    string;
  semanaLabel: string;
  toInsert:    Partial<ConsumoSemanalType>[];
  warnings:    string[];
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ConsumoSemanal() {
  const { productos } = useProductos();

  const [tab, setTab] = useState<'cargar' | 'detalle' | 'acumulado'>('cargar');

  // ── Semana activa (carga + detalle) ──
  const [semana, setSemana] = useState(getSemanaActual());
  const semanaInfo = semana ? isoWeekToRange(semana) : null;

  // ── Filtros buscador (en tab cargar) ──
  const [busqueda, setBusqueda]   = useState('');
  const [catFiltro, setCatFiltro] = useState('');
  const [subFiltro, setSubFiltro] = useState('');

  const subcatsDisponibles = useMemo(() => {
    if (!catFiltro) return [];
    return Object.entries(SUBCATEGORIAS[catFiltro] || {}).map(([key, label]) => ({ key: `${catFiltro}:${key}`, label }));
  }, [catFiltro]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(p => {
      const matchCat  = !catFiltro || p.category === catFiltro;
      const matchSub  = !subFiltro || `${p.category}:${p.subcategory}` === subFiltro;
      const matchText = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      return matchCat && matchSub && matchText && p.active !== false;
    });
  }, [productos, catFiltro, subFiltro, busqueda]);

  // ── Upload ──
  const [fileName, setFileName]       = useState('');
  const [warnings, setWarnings]       = useState<string[]>([]);
  const [summary, setSummary]         = useState<{ imports: number; warnings: number } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [pending, setPending]         = useState<PendingUpload | null>(null);
  const [confirming, setConfirming]   = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // ── Registros tab Detalle ──
  const [registrosDetalle, setRegistrosDetalle]     = useState<RegistroCS[]>([]);
  const [loadingDetalle, setLoadingDetalle]         = useState(false);
  const [busquedaDetalle, setBusquedaDetalle]       = useState('');
  const [verTodas, setVerTodas]                     = useState(false);

  const cargarDetalle = useCallback(async (semStr: string, todas = false) => {
    setLoadingDetalle(true);
    if (todas) {
      const { data } = await supabase
        .from('consumos_semanales')
        .select('id,producto_code,producto_name,cantidad_consumida,semana_numero,año')
        .order('año').order('semana_numero').order('producto_name');
      setRegistrosDetalle((data ?? []) as unknown as RegistroCS[]);
      setLoadingDetalle(false);
      return;
    }
    if (!semStr) { setLoadingDetalle(false); return; }
    const info = isoWeekToRange(semStr);
    setLoadingDetalle(true);
    const { data } = await supabase
      .from('consumos_semanales')
      .select('id,producto_code,producto_name,cantidad_consumida,semana_numero,año')
      .eq('semana_numero', info.numero)
      .eq('año', info.año)
      .order('producto_name');
    setRegistrosDetalle((data ?? []) as unknown as RegistroCS[]);
    setLoadingDetalle(false);
  }, []);

  useEffect(() => {
    if (tab === 'detalle') cargarDetalle(semana, verTodas);
  }, [tab, semana, verTodas, cargarDetalle]);

  const detallesFiltrados = useMemo(() => {
    const q = busquedaDetalle.trim().toLowerCase();
    if (!q) return registrosDetalle;
    return registrosDetalle.filter(r =>
      r.producto_code.toLowerCase().includes(q) || r.producto_name.toLowerCase().includes(q)
    );
  }, [registrosDetalle, busquedaDetalle]);

  async function eliminarRegistro(id: string) {
    const { error } = await supabase.from('consumos_semanales').delete().eq('id', id);
    if (error) { toast.error('No se pudo eliminar.'); return; }
    setRegistrosDetalle(prev => prev.filter(r => r.id !== id));
    toast.success('Registro eliminado.');
  }

  // ── Acumulado ──
  const [semanasDisponibles, setSemanasDisponibles]   = useState<{ numero: number; año: number }[]>([]);
  const [semanasSelec, setSemanasSelec]               = useState<Set<string>>(new Set());
  const [todosAcumulado, setTodosAcumulado]           = useState<RegistroCS[]>([]);
  const [loadingAcumulado, setLoadingAcumulado]       = useState(false);
  const [busquedaAcum, setBusquedaAcum]               = useState('');

  const cargarAcumulado = useCallback(async () => {
    setLoadingAcumulado(true);
    const { data: semanas } = await supabase
      .from('consumos_semanales')
      .select('semana_numero,año')
      .order('año', { ascending: false })
      .order('semana_numero', { ascending: false });

    type SemanaRow = { semana_numero: number; año: number };
    const rows = (semanas ?? []) as unknown as SemanaRow[];
    const unicas = Array.from(
      new Map(rows.map(s => [`${s.año}-${s.semana_numero}`, { numero: s.semana_numero, año: s.año }])).values()
    );
    setSemanasDisponibles(unicas);
    if (unicas.length > 0 && semanasSelec.size === 0) {
      // Pre-seleccionar las últimas 4 semanas (las más recientes)
      const ultimas4 = [...unicas].sort((a, b) => a.año !== b.año ? b.año - a.año : b.numero - a.numero).slice(0, 4);
      setSemanasSelec(new Set(ultimas4.map(s => semanaKey(s.numero, s.año))));
    }

    const { data: todos } = await supabase
      .from('consumos_semanales')
      .select('id,producto_code,producto_name,cantidad_consumida,semana_numero,año');
    setTodosAcumulado((todos ?? []) as unknown as RegistroCS[]);
    setLoadingAcumulado(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'acumulado') cargarAcumulado();
  }, [tab, cargarAcumulado]);

  const semanasOrdenadas = useMemo(() =>
    [...semanasDisponibles]
      .sort((a, b) => a.año !== b.año ? a.año - b.año : a.numero - b.numero)
      .filter(s => semanasSelec.has(semanaKey(s.numero, s.año))),
    [semanasDisponibles, semanasSelec]
  );

  const tablaAcumulada = useMemo(() => {
    if (semanasOrdenadas.length === 0) return [];
    const q = busquedaAcum.trim().toLowerCase();

    const byCode = new Map<string, { name: string; por_semana: Map<string, number> }>();
    todosAcumulado.forEach(r => {
      const key = semanaKey(r.semana_numero, r.año);
      if (!semanasSelec.has(key)) return;
      if (!byCode.has(r.producto_code)) {
        byCode.set(r.producto_code, { name: r.producto_name, por_semana: new Map() });
      }
      byCode.get(r.producto_code)!.por_semana.set(key, r.cantidad_consumida);
    });

    return [...byCode.entries()]
      .filter(([code, { name }]) =>
        !q || code.toLowerCase().includes(q) || name.toLowerCase().includes(q)
      )
      .map(([code, { name, por_semana }]) => {
        const valores = semanasOrdenadas.map(s => por_semana.get(semanaKey(s.numero, s.año)) ?? 0);
        const conDato = valores.filter(v => v > 0);
        const promedio = conDato.length > 0
          ? Math.round((conDato.reduce((a, b) => a + b, 0) / conDato.length) * 100) / 100
          : 0;
        return { code, name, valores, promedio };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [todosAcumulado, semanasOrdenadas, semanasSelec, busquedaAcum]);

  // ── Parsers ──────────────────────────────────────────────────────────────

  function parseRows(headers: string[], rawRows: string[][]): ParsedRow[] {
    const h = headers.map(x => x.trim().toLowerCase());
    const iCode = h.findIndex(x => ['codigo','código','code'].includes(x));
    const iName = h.findIndex(x => ['nombre','name'].includes(x));
    const iCant = h.findIndex(x => ['cantidad','qty','quantity'].includes(x));
    return rawRows.map(values => ({
      code:     String(values[iCode >= 0 ? iCode : 0] ?? '').trim(),
      name:     String(values[iName >= 0 ? iName : 1] ?? '').trim(),
      cantidad: Number(String(values[iCant >= 0 ? iCant : 2] ?? '0').replace(',', '.')),
    }));
  }

  async function parseCSV(text: string): Promise<ParsedRow[]> {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('El archivo debe tener cabecera y al menos una fila.');
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep);
    const rawRows = lines.slice(1).map(l => l.split(sep));
    return parseRows(headers, rawRows);
  }

  async function parseXLSX(file: File): Promise<ParsedRow[]> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    if (raw.length < 2) throw new Error('El archivo debe tener cabecera y al menos una fila.');
    const headers = (raw[0] as string[]).map(h => String(h ?? ''));
    const rawRows = raw.slice(1).map(r => (r as unknown[]).map(v => String(v ?? '')));
    return parseRows(headers, rawRows);
  }

  // Fase 1: parsear y mostrar confirmación
  async function processFile(file: File) {
    if (!semana) { toast.error('Selecciona la semana antes de cargar el archivo.'); return; }
    setSummary(null); setWarnings([]); setFileName(file.name); setLoading(true);
    try {
      const rows = file.name.toLowerCase().endsWith('.xlsx')
        ? await parseXLSX(file)
        : await parseCSV(await file.text());
      const info = isoWeekToRange(semana);
      const codes = rows.map(r => r.code).filter(Boolean);
      const { data: existing, error: err } = await supabase.from('productos').select('code,name').in('code', codes);
      if (err) throw err;
      const existingMap = new Map<string, string>();
      (existing || []).forEach(item => { if (item.code) existingMap.set(item.code, item.name ?? ''); });
      const missingCodes: string[] = [];
      const toInsert: Partial<ConsumoSemanalType>[] = [];
      rows.forEach(row => {
        if (!row.code) return;
        if (!existingMap.has(row.code)) { missingCodes.push(row.code); return; }
        if (row.cantidad <= 0) return;
        toInsert.push({
          semana_numero:      info.numero,
          año:                info.año,
          producto_code:      row.code,
          producto_name:      row.name || existingMap.get(row.code) || '',
          cantidad_consumida: row.cantidad,
          fuente:             'ARCHIVO',
        });
      });
      if (toInsert.length === 0) throw new Error('No se encontraron registros válidos (cantidad > 0) para importar.');
      setPending({
        fileName:    file.name,
        semanaLabel: info.label,
        toInsert,
        warnings:    missingCodes.map(code => `Código no encontrado en catálogo: ${code}`),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Fallo al procesar el archivo';
      toast.error(message); setWarnings([message]);
    } finally {
      setLoading(false);
    }
  }

  // Fase 2: confirmar e insertar
  async function confirmarCarga() {
    if (!pending) return;
    setConfirming(true);
    try {
      const { error } = await supabase
        .from('consumos_semanales')
        .upsert(pending.toInsert, { onConflict: 'semana_numero,año,producto_code' });
      if (error) throw error;
      toast.success(`${pending.toInsert.length} productos cargados correctamente para ${pending.semanaLabel}`);
      setWarnings(pending.warnings);
      setSummary({ imports: pending.toInsert.length, warnings: pending.warnings.length });
      setPending(null);
      // Ir al detalle para que el usuario vea lo que se cargó
      await cargarDetalle(semana);
      setTab('detalle');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al guardar';
      toast.error(message);
    } finally {
      setConfirming(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* Modal de confirmación de carga */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Confirmar carga</h2>
                <p className="text-sm text-slate-500 mt-1">{pending.fileName}</p>
              </div>
              <button onClick={() => { setPending(null); setFileName(''); }}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Semana</span>
                <span className="font-medium text-slate-800">{pending.semanaLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Productos a cargar</span>
                <span className="font-bold text-emerald-700 text-base">{pending.toInsert.length}</span>
              </div>
              {pending.warnings.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Códigos no encontrados</span>
                  <span className="font-medium text-amber-600">{pending.warnings.length}</span>
                </div>
              )}
            </div>

            {/* Vista previa de los primeros productos */}
            <div className="overflow-auto max-h-48 rounded-xl border border-slate-200 text-xs">
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-500 font-semibold">Código</th>
                    <th className="px-3 py-2 text-left text-slate-500 font-semibold">Producto</th>
                    <th className="px-3 py-2 text-right text-slate-500 font-semibold">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pending.toInsert.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-mono text-slate-600">{r.producto_code}</td>
                      <td className="px-3 py-1.5 text-slate-800">{r.producto_name}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-700">{Number(r.cantidad_consumida).toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setPending(null); setFileName(''); }}
                className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition">
                Cancelar
              </button>
              <button onClick={confirmarCarga} disabled={confirming}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60">
                <CheckCircle2 size={16} />
                {confirming ? 'Guardando...' : 'Confirmar carga'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Header
        title="Carga Semanal (Solo monitoreo)"
        subtitle="Registra consumos históricos por semana para seguimiento. No descuenta inventario."
      />

      {/* Aviso */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-red-400 bg-red-50 px-5 py-4 shadow-sm">
        <span className="mt-0.5 text-2xl">⚠️</span>
        <div>
          <p className="text-sm font-bold text-red-700 uppercase tracking-wide">Esta opción NO descuenta inventario</p>
          <p className="text-sm text-red-700 mt-1">
            Los datos cargados aquí son únicamente para <strong>monitoreo y estadísticas</strong>. Para descontar materiales del inventario usa el módulo <strong>Consumo</strong>.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'cargar',    label: 'Cargar archivo' },
          { id: 'detalle',   label: 'Detalle por semana' },
          { id: 'acumulado', label: 'Acumulado / Promedio' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: CARGAR ══════════════════════════════════════════════════════ */}
      {tab === 'cargar' && (
        <>
          {/* Buscador por categoría */}
          <Card className="mb-5">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Consultar productos por categoría</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CATEGORIAS).map(([code, cat]) => (
                  <button key={code}
                    onClick={() => { setCatFiltro(catFiltro === code ? '' : code); setSubFiltro(''); }}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                      catFiltro === code
                        ? `${cat.bg} ${cat.text} ${cat.border} border`
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}>
                    {cat.label}
                  </button>
                ))}
                {(catFiltro || busqueda) && (
                  <button onClick={() => { setCatFiltro(''); setSubFiltro(''); setBusqueda(''); }}
                    className="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200">
                    Limpiar
                  </button>
                )}
              </div>
              {subcatsDisponibles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {subcatsDisponibles.map(s => (
                    <button key={s.key} onClick={() => setSubFiltro(subFiltro === s.key ? '' : s.key)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                        subFiltro === s.key ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o código..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {(catFiltro || busqueda) && (
                <div className="overflow-auto max-h-72 rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-28">Código</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Nombre</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-24">Unidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productosFiltrados.length === 0
                        ? <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">Sin resultados</td></tr>
                        : productosFiltrados.map(p => (
                          <tr key={p.code} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-xs text-slate-600">{p.code}</td>
                            <td className="px-3 py-2 text-slate-800">{p.name}</td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{p.unit}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <p className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">
                    {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Carga */}
          <Card>
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Cargar consumo semanal</h2>
              <div>
                <label className="text-sm font-medium text-slate-700">Semana <span className="text-red-500">*</span></label>
                <input type="week" value={semana}
                  onChange={e => { setSemana(e.target.value); setSummary(null); setWarnings([]); setFileName(''); }}
                  className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {semanaInfo && <p className="mt-1 text-xs text-slate-500">{semanaInfo.label}</p>}
              </div>
              <div className="flex items-center gap-4">
                <Button variant="secondary" icon={<UploadCloud size={16} />}
                  onClick={() => fileInputRef.current?.click()} loading={loading}>
                  Seleccionar archivo CSV / Excel
                </Button>
                {fileName && <span className="text-sm text-slate-500 truncate">{fileName}</span>}
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx"
                onChange={e => { const file = e.target.files?.[0]; if (file) processFile(file); e.target.value = ''; }}
                className="hidden" />
              {summary && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">Productos registrados</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{summary.imports}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm text-slate-500">Advertencias</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{summary.warnings}</p>
                  </div>
                </div>
              )}
              {warnings.length > 0 && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} /> Advertencias</div>
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
                <p className="font-semibold text-slate-900">Formato del archivo</p>
                <p className="font-mono text-xs bg-white border border-slate-200 rounded-lg px-3 py-2">codigo, nombre, cantidad</p>
                <ul className="space-y-1 text-xs list-disc pl-4">
                  <li><strong>codigo</strong>: código exacto del catálogo (ej: SP-02-001)</li>
                  <li><strong>nombre</strong>: nombre del producto (referencia, puede quedar vacío)</li>
                  <li><strong>cantidad</strong>: cantidad consumida — filas con 0 se omiten</li>
                </ul>
                <p className="text-xs text-slate-400">La semana se toma del selector de arriba, no del archivo.</p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ══ TAB: DETALLE ════════════════════════════════════════════════════ */}
      {tab === 'detalle' && (
        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Semana</label>
                <input type="week" value={semana} disabled={verTodas}
                  onChange={e => { setSemana(e.target.value); setBusquedaDetalle(''); }}
                  className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40" />
                {!verTodas && semanaInfo && <p className="mt-1 text-xs text-slate-500">{semanaInfo.label}</p>}
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-1 whitespace-nowrap">
                <input type="checkbox" checked={verTodas}
                  onChange={e => { setVerTodas(e.target.checked); setBusquedaDetalle(''); }}
                  className="w-4 h-4 rounded accent-blue-600" />
                <span className="text-sm text-slate-600">Ver todas las semanas</span>
              </label>
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                <input value={busquedaDetalle} onChange={e => setBusquedaDetalle(e.target.value)}
                  placeholder="Buscar por código o nombre..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <span className="text-xs text-slate-400 pb-1">
                {loadingDetalle ? '...' : `${detallesFiltrados.length} productos`}
              </span>
              {registrosDetalle.length > 0 && (
                <button
                  onClick={async () => {
                    if (!semanaInfo) return;
                    if (!confirm(`¿Eliminar todos los ${registrosDetalle.length} registros de ${semanaInfo.label}?`)) return;
                    const { error } = await supabase
                      .from('consumos_semanales')
                      .delete()
                      .eq('semana_numero', semanaInfo.numero)
                      .eq('año', semanaInfo.año);
                    if (error) { toast.error('Error al eliminar.'); return; }
                    setRegistrosDetalle([]);
                    toast.success(`Semana ${semanaInfo.label} eliminada.`);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                >
                  <Trash2 size={12} /> Eliminar semana completa
                </button>
              )}
              <button
                onClick={async () => {
                  if (!confirm('¿Eliminar TODOS los registros de todas las semanas? Esta acción no se puede deshacer.')) return;
                  const { error } = await supabase.from('consumos_semanales').delete().neq('id', '');
                  if (error) { toast.error('Error al eliminar.'); return; }
                  setRegistrosDetalle([]);
                  toast.success('Todos los registros eliminados.');
                }}
                className="flex items-center gap-1.5 rounded-xl border border-red-400 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
              >
                <Trash2 size={12} /> Eliminar todo
              </button>
            </div>

            {loadingDetalle ? (
              <p className="py-8 text-center text-slate-400">Cargando...</p>
            ) : detallesFiltrados.length === 0 ? (
              <p className="py-8 text-center text-slate-400">No hay registros cargados{verTodas ? '.' : ' para esta semana.'}</p>
            ) : (
              <div className="overflow-auto max-h-[60vh] rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {verTodas && <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">Semana</th>}
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-28">Código</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-28">Cantidad</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detallesFiltrados.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        {verTodas && (
                          <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                            {isoWeekToRange(semanaKey(r.semana_numero, r.año)).labelCorto}
                          </td>
                        )}
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.producto_code}</td>
                        <td className="px-3 py-2 text-slate-800">{r.producto_name}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700">{r.cantidad_consumida.toLocaleString('es-CO')}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => eliminarRegistro(r.id)} title="Eliminar"
                            className="rounded-lg p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ══ TAB: ACUMULADO ══════════════════════════════════════════════════ */}
      {tab === 'acumulado' && (
        <div className="space-y-4">
          {/* Selector de semanas */}
          <Card>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Semanas a incluir</h2>
                <div className="flex gap-2">
                  <button onClick={() => setSemanasSelec(new Set(semanasDisponibles.map(s => semanaKey(s.numero, s.año))))}
                    className="text-xs text-blue-600 hover:underline">Todas</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={() => setSemanasSelec(new Set())}
                    className="text-xs text-slate-500 hover:underline">Ninguna</button>
                </div>
              </div>
              {loadingAcumulado ? (
                <p className="text-sm text-slate-400">Cargando semanas...</p>
              ) : semanasDisponibles.length === 0 ? (
                <p className="text-sm text-slate-400">No hay semanas cargadas aún.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[...semanasDisponibles]
                    .sort((a, b) => a.año !== b.año ? a.año - b.año : a.numero - b.numero)
                    .map(s => {
                      const key = semanaKey(s.numero, s.año);
                      const info = isoWeekToRange(key);
                      const sel = semanasSelec.has(key);
                      return (
                        <button key={key}
                          onClick={() => {
                            const next = new Set(semanasSelec);
                            sel ? next.delete(key) : next.add(key);
                            setSemanasSelec(next);
                          }}
                          title={info.label}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                            sel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'
                          }`}>
                          {info.labelCorto}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </Card>

          {/* Tabla acumulada */}
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input value={busquedaAcum} onChange={e => setBusquedaAcum(e.target.value)}
                    placeholder="Buscar por código o nombre..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{tablaAcumulada.length} productos</span>
                <button
                  onClick={() => {
                    if (!tablaAcumulada.length) return;
                    const datos = tablaAcumulada.map(row => {
                      const obj: Record<string, string | number> = { Código: row.code, Producto: row.name };
                      semanasOrdenadas.forEach((s, j) => { obj[isoWeekToRange(semanaKey(s.numero, s.año)).labelCorto] = row.valores[j] || 0; });
                      obj['Promedio'] = row.promedio;
                      return obj;
                    });
                    const ws = XLSX.utils.json_to_sheet(datos);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Acumulado');
                    XLSX.writeFile(wb, 'consumo_acumulado.xlsx');
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  <Download size={13} /> Excel
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  <Printer size={13} /> Imprimir
                </button>
              </div>

              {semanasOrdenadas.length === 0 ? (
                <p className="py-8 text-center text-slate-400">Selecciona al menos una semana para ver el acumulado.</p>
              ) : tablaAcumulada.length === 0 ? (
                <p className="py-8 text-center text-slate-400">Sin datos para las semanas seleccionadas.</p>
              ) : (
                <div className="overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-28 whitespace-nowrap">Código</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Producto</th>
                        {semanasOrdenadas.map(s => (
                          <th key={semanaKey(s.numero, s.año)}
                            className="px-3 py-2 text-right text-xs font-semibold text-slate-500 whitespace-nowrap"
                            title={isoWeekToRange(semanaKey(s.numero, s.año)).label}>
                            {isoWeekToRange(semanaKey(s.numero, s.año)).labelCorto}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right text-xs font-semibold text-blue-600 whitespace-nowrap bg-blue-50">Promedio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tablaAcumulada.map((row, i) => (
                        <tr key={row.code} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.code}</td>
                          <td className="px-3 py-2 text-slate-800">{row.name}</td>
                          {row.valores.map((v, j) => (
                            <td key={j} className={`px-3 py-2 text-right font-mono text-xs ${v === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                              {v === 0 ? '—' : v.toLocaleString('es-CO')}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-blue-700 bg-blue-50">
                            {row.promedio === 0 ? '—' : row.promedio.toLocaleString('es-CO')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
