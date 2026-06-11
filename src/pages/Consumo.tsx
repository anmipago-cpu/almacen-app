import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Save, RotateCcw, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ComboboxProducto } from '../components/ui/Combobox';
import { useProductos } from '../hooks/useProductos';
import { useInventario } from '../hooks/useInventario';
import { usePersonas } from '../hooks/usePersonas';
import { supabase } from '../lib/supabase';
import { hoy, formatNumero, formatFecha } from '../lib/utils';
import type { Producto, Registro } from '../types';

const METODOS = [
  { value: 'CONSUMO',    label: 'Consumo',    tipo: 'CONSUMO'    as const },
  { value: 'AJUSTE',     label: 'Ajuste',     tipo: 'AJUSTE'     as const },
  { value: 'DEVOLUCION', label: 'Devolución', tipo: 'DEVOLUCION' as const },
];

interface LineaConsumo {
  id: number;
  producto: Producto;
  cantidad: number;         // unidades de conteo (ej: CAJA)
  cantidadBase: number;     // unidades base (ej: UND) — lo que se descuenta
  lote: string;
  stock_actual: number;
  esConteoFisico?: boolean; // true cuando viene de modo "por conteo físico"
  conteoFisicoBase?: number; // el stock físico ingresado, en base units
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getMesActual() {
  const now = new Date();
  return { mes: now.getMonth() + 1, año: now.getFullYear() };
}

function rangoMes(mes: number, año: number) {
  const inicio = `${año}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = new Date(año, mes, 0).getDate();
  const fin = `${año}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  return { inicio, fin };
}

function getSemanaActual(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function isoWeekToRange(weekStr: string): { inicio: string; fin: string; label: string } {
  const [yearStr, wStr] = weekStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayW1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  const inicio = new Date(mondayW1.getTime() + (week - 1) * 7 * 86400000);
  const fin = new Date(inicio.getTime() + 6 * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const mesesCortos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const label = `Sem. ${week} · ${inicio.getDate()} ${mesesCortos[inicio.getMonth()]} - ${fin.getDate()} ${mesesCortos[fin.getMonth()]} ${year}`;
  return { inicio: fmt(inicio), fin: fmt(fin), label };
}

let _lineaId = 0;

export function Consumo() {
  const { productos, loading: loadingProd } = useProductos();
  const { inventario } = useInventario();
  const { personas } = usePersonas();

  // Período
  const [modo, setModo] = useState<'diario' | 'semanal'>('diario');
  const [fecha, setFecha] = useState(hoy());
  const [semana, setSemana] = useState(getSemanaActual());
  const [responsable, setResponsable] = useState('');
  const [metodo, setMetodo] = useState('CONSUMO');

  // Agregar producto
  const [productoSel, setProductoSel] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [tipoUnidad, setTipoUnidad] = useState<'conteo' | 'base'>('conteo');
  const [modoConteo, setModoConteo] = useState(false);
  const [lote, setLote] = useState('');
  const [lotesDisponibles, setLotesDisponibles] = useState<{ lote: string; stock_base: number }[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [productoError, setProductoError] = useState('');

  // Lista de consumos a guardar
  const [lineas, setLineas] = useState<LineaConsumo[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Historial
  const [mesFiltro, setMesFiltro] = useState(getMesActual);
  const [historial, setHistorial] = useState<Registro[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // CSV bulk
  const [bulkItems, setBulkItems] = useState<Omit<Registro, 'id' | 'created_at'>[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkResponsable, setBulkResponsable] = useState('');
  const [bulkFecha, setBulkFecha] = useState(hoy());
  const [bulkMetodo, setBulkMetodo] = useState('CONSUMO');
  const [importing, setImporting] = useState(false);

  const { inicio: mesInicio, fin: mesFin } = rangoMes(mesFiltro.mes, mesFiltro.año);

  const cargarHistorial = useCallback(async () => {
    setLoadingHist(true);
    const { data } = await supabase
      .from('recepciones')
      .select('*')
      .in('tipo', ['CONSUMO', 'AJUSTE', 'DEVOLUCION'])
      .gte('fecha', mesInicio)
      .lte('fecha', mesFin)
      .order('created_at', { ascending: false })
      .limit(300);
    setHistorial((data || []) as Registro[]);
    setLoadingHist(false);
  }, [mesInicio, mesFin]);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const historialFiltrado = historial.filter(rec => {
    const q = busqueda.toLowerCase();
    const matchText = !busqueda ||
      rec.producto_code.toLowerCase().includes(q) ||
      rec.producto_name.toLowerCase().includes(q) ||
      (rec.lote || '').toLowerCase().includes(q);
    const matchDesde = !fechaDesde || rec.fecha >= fechaDesde;
    const matchHasta = !fechaHasta || rec.fecha <= fechaHasta;
    return matchText && matchDesde && matchHasta;
  });

  function getFechaGuardar(): string {
    return modo === 'semanal' ? isoWeekToRange(semana).inicio : fecha;
  }

  function getObsPrefix(): string {
    return modo === 'semanal' ? `[${isoWeekToRange(semana).label}] ` : '';
  }

  function getStockActual(code: string): number {
    return inventario.find(i => i.code === code)?.stock_actual ?? 0;
  }

  async function cargarLotes(productoCode: string) {
    setLoadingLotes(true);
    setLotesDisponibles([]);
    const { data } = await supabase
      .from('recepciones')
      .select('lote, tipo, total_unidades_base')
      .eq('producto_code', productoCode)
      .not('lote', 'is', null);
    if (data) {
      const map = new Map<string, number>();
      data.forEach(r => {
        const key = r.lote as string;
        const delta = (!r.tipo || r.tipo === 'RECEPCION' || r.tipo === 'DEVOLUCION')
          ? (r.total_unidades_base || 0)
          : -(r.total_unidades_base || 0);
        map.set(key, (map.get(key) || 0) + delta);
      });
      setLotesDisponibles(
        Array.from(map.entries())
          .map(([lote, stock_base]) => ({ lote, stock_base }))
          .filter(l => l.stock_base > 0.001)
          .sort((a, b) => a.lote.localeCompare(b.lote))
      );
    }
    setLoadingLotes(false);
  }

  function getStockParaCalculo(): number {
    if (lote && lotesDisponibles.length > 0) {
      return lotesDisponibles.find(l => l.lote === lote)?.stock_base
        ?? getStockActual(productoSel?.code ?? '');
    }
    return getStockActual(productoSel?.code ?? '');
  }

  function agregarLinea() {
    if (!productoSel) { setProductoError('Selecciona un producto'); return; }
    const cant = parseFloat(cantidad.replace(',', '.'));
    if (isNaN(cant) || cant < 0) { toast.error('Ingresa una cantidad válida'); return; }
    const ya = lineas.find(l => l.producto.code === productoSel.code && l.lote === lote.trim());
    if (ya) { toast.error('Ese producto y lote ya están en la lista'); return; }
    const unitContent = productoSel.unit_content || 1;
    const stockActualBase = getStockParaCalculo();

    if (modoConteo) {
      // MODO CONTEO FÍSICO: el usuario ingresa cuánto tiene ahora
      const conteoFisicoBase = tipoUnidad === 'conteo' ? cant * unitContent : cant;
      const diferencia = stockActualBase - conteoFisicoBase;
      if (diferencia <= 0) {
        toast.error(
          diferencia === 0
            ? 'El conteo coincide con el sistema, no hay diferencia'
            : `El conteo (${formatNumero(conteoFisicoBase, 0)}) es MAYOR que el stock registrado (${formatNumero(stockActualBase, 0)}). Crea una Recepción para la diferencia.`
        );
        return;
      }
      const cantidadConteo = diferencia / unitContent;
      setLineas(prev => [...prev, {
        id: ++_lineaId,
        producto: productoSel,
        cantidad: cantidadConteo,
        cantidadBase: diferencia,
        lote: lote.trim(),
        stock_actual: stockActualBase,
        esConteoFisico: true,
        conteoFisicoBase,
      }]);
    } else {
      // MODO NORMAL: el usuario ingresa cuánto consumió
      if (cant <= 0) { toast.error('Ingresa una cantidad mayor a 0'); return; }
      const cantidadConteo = tipoUnidad === 'conteo' ? cant : cant / unitContent;
      const cantidadBase   = tipoUnidad === 'conteo' ? cant * unitContent : cant;
      setLineas(prev => [...prev, {
        id: ++_lineaId,
        producto: productoSel,
        cantidad: cantidadConteo,
        cantidadBase,
        lote: lote.trim(),
        stock_actual: stockActualBase,
      }]);
    }
    setProductoSel(null);
    setCantidad('');
    setLote('');
    setProductoError('');
  }

  async function guardarTodo() {
    if (!lineas.length) { toast.error('Agrega al menos un producto'); return; }
    if (!responsable) { toast.error('Selecciona el responsable'); return; }
    setGuardando(true);
    const metodoConfig = METODOS.find(m => m.value === metodo) || METODOS[0];
    const obsPrefix = getObsPrefix();
    try {
      const payload = lineas.map(linea => ({
        fecha: getFechaGuardar(),
        tipo: metodoConfig.tipo,
        producto_code: linea.producto.code,
        producto_name: linea.producto.name,
        lote: linea.lote || undefined,
        proveedor: linea.producto.supplier,
        recibido_por: responsable,
        cantidad_unidad_natural: linea.cantidad,
        unidad_natural: linea.producto.unit || 'UNIDAD',
        contenido_por_unidad: linea.producto.unit_content || 1,
        total_unidades_base: linea.cantidadBase,
        observaciones: `${obsPrefix}${metodoConfig.label}`,
      }));
      const { error } = await supabase.from('recepciones').insert(payload);
      if (error) throw error;
      toast.success(`${lineas.length} consumo${lineas.length > 1 ? 's' : ''} registrado${lineas.length > 1 ? 's' : ''}`);
      setLineas([]);
      cargarHistorial();
    } catch (e: unknown) {
      toast.error((e as any)?.message ?? 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  function parseCsvConsumos(text: string) {
    const rows = text.split(/\r?\n/).filter(Boolean);
    if (!rows.length) return [];
    const sep = rows[0].includes(';') ? ';' : ',';
    const headers = rows[0].split(sep).map(h => h.trim().toLowerCase());
    const tieneEncabezado = headers.some(h => ['codigo', 'code', 'cantidad'].includes(h));
    const filas = tieneEncabezado ? rows.slice(1) : rows;
    return filas.map(line => {
      const values = line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''));
      const record: Record<string, string> = {};
      if (tieneEncabezado) {
        headers.forEach((field, i) => { record[field] = values[i] || ''; });
      } else {
        record.codigo = values[0] || '';
        record.cantidad = values[1] || '0';
        record.lote = values[2] || '';
      }
      const code = record.codigo || record.code || record.producto_code || '';
      const found = productos.find(p => p.code === code);
      const cant = parseFloat((record.cantidad || '0').replace(',', '.'));
      const met = METODOS.find(m => m.value === (record.metodo || '').toUpperCase()) || METODOS[0];
      return {
        fecha: record.fecha || bulkFecha,
        tipo: met.tipo,
        producto_code: code,
        producto_name: found?.name || '',
        lote: record.lote || undefined,
        proveedor: found?.supplier || '',
        recibido_por: record.responsable || bulkResponsable,
        cantidad_unidad_natural: cant,
        unidad_natural: found?.unit || 'UNIDAD',
        contenido_por_unidad: found?.unit_content || 1,
        total_unidades_base: cant * (found?.unit_content || 1),
        observaciones: `${getObsPrefix()}${met.label}`,
      };
    });
  }

  async function handleBulkFile(event: ChangeEvent<HTMLInputElement>) {
    setBulkErrors([]);
    setBulkItems([]);
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCsvConsumos(text);
      const errors: string[] = [];
      const valid: Omit<Registro, 'id' | 'created_at'>[] = [];
      parsed.forEach((item, i) => {
        const row = i + 2;
        if (!item.producto_code) { errors.push(`Fila ${row}: falta código`); return; }
        if (!item.producto_name) { errors.push(`Fila ${row}: "${item.producto_code}" no existe en el catálogo`); return; }
        if (!(item.cantidad_unidad_natural > 0)) { errors.push(`Fila ${row}: cantidad debe ser mayor que 0`); return; }
        valid.push(item);
      });
      setBulkItems(valid);
      setBulkErrors(errors);
      if (!errors.length) toast.success(`${valid.length} consumos listos para importar`);
    } catch (e: unknown) {
      setBulkErrors([e instanceof Error ? e.message : 'Error al procesar archivo']);
    } finally {
      setImporting(false);
    }
  }

  async function importarBulk() {
    if (!bulkItems.length) { toast.error('No hay consumos válidos'); return; }
    if (!bulkResponsable.trim()) { toast.error('Selecciona el responsable'); return; }
    setImporting(true);
    const metodoConfig = METODOS.find(m => m.value === bulkMetodo) || METODOS[0];
    try {
      const payload = bulkItems.map(item => ({
        ...item,
        tipo: metodoConfig.tipo,
        recibido_por: item.recibido_por || bulkResponsable,
        fecha: item.fecha || bulkFecha,
      }));
      const { error } = await supabase.from('recepciones').insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} consumos importados`);
      setBulkItems([]);
      setBulkErrors([]);
      cargarHistorial();
    } catch (e: unknown) {
      toast.error((e as any)?.message ?? 'Error al importar');
    } finally {
      setImporting(false);
    }
  }

  const periodoActual = modo === 'semanal' && semana ? isoWeekToRange(semana) : null;

  return (
    <div>
      <Header title="Registro de Consumo" subtitle="Registra salidas de materiales del almacén por día o semana." />

      {/* Toggle */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-2xl p-1 w-fit">
        <button onClick={() => setModo('diario')}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${modo === 'diario' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
          Diario
        </button>
        <button onClick={() => setModo('semanal')}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${modo === 'semanal' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
          Semanal
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2 items-start mb-5">

        {/* Formulario */}
        <Card>
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            {modo === 'diario' ? 'Consumo Diario' : 'Consumo Semanal'}
          </h2>
          <div className="space-y-4">

            {/* Período y Responsable */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {modo === 'diario' ? (
                <div>
                  <label className="text-sm font-medium text-slate-700">Fecha *</label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Semana *</label>
                  <input type="week" value={semana} onChange={e => setSemana(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {periodoActual && (
                    <p className="text-xs text-slate-500 mt-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1">
                      📆 {periodoActual.label}
                    </p>
                  )}
                </div>
              )}
              <div className={modo === 'diario' ? '' : 'sm:col-span-1'}>
                <label className="text-sm font-medium text-slate-700">Responsable *</label>
                <select value={responsable} onChange={e => setResponsable(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">Selecciona responsable</option>
                  {personas.map(p => <option key={p.code} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
            </div>

            {/* Método */}
            <div>
              <label className="text-sm font-medium text-slate-700">Método</label>
              <div className="flex gap-2 mt-1">
                {METODOS.map(m => (
                  <button key={m.value} type="button" onClick={() => setMetodo(m.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${metodo === m.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Agregar producto */}
            <div className={`rounded-2xl border p-3 space-y-3 ${modoConteo ? 'border-purple-200 bg-purple-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Agregar producto</p>
                <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 gap-0.5 shadow-sm">
                  <button type="button" onClick={() => { setModoConteo(false); setCantidad(''); }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${!modoConteo ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                    Directo
                  </button>
                  <button type="button" onClick={() => { setModoConteo(true); setCantidad(''); setMetodo('AJUSTE'); }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${modoConteo ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                    Por conteo físico
                  </button>
                </div>
              </div>
              {modoConteo && (
                <div className="rounded-xl bg-purple-100 border border-purple-200 px-3 py-2 text-xs text-purple-800">
                  Ingresa cuánto tienes físicamente ahora. El sistema calcula y registra la diferencia como <strong>Ajuste</strong>.
                </div>
              )}

              <ComboboxProducto
                label=""
                productos={productos.filter(p => p.active !== false)}
                value={productoSel}
                onChange={p => {
                  setProductoSel(p);
                  setProductoError('');
                  setTipoUnidad('conteo');
                  setCantidad('');
                  setLote('');
                  setLotesDisponibles([]);
                  if (p) cargarLotes(p.code);
                }}
                disabled={loadingProd}
                error={productoError}
              />

              {productoSel && (() => {
                const stockBase = getStockParaCalculo();
                const uc = productoSel.unit_content ?? 1;
                const loteSelInfo = lote ? lotesDisponibles.find(l => l.lote === lote) : null;
                return (
                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs">
                        {loteSelInfo ? `Stock lote ${lote}` : 'Stock total disponible'}
                      </span>
                      <div className="text-right">
                        {uc > 1 ? (
                          <>
                            <span className="font-mono font-bold text-slate-800">
                              {formatNumero(stockBase / uc, 1)} {productoSel.unit}
                            </span>
                            <span className="ml-2 text-xs text-slate-400">
                              ({formatNumero(stockBase, 0)} {productoSel.unit_base || 'und'})
                            </span>
                          </>
                        ) : (
                          <span className="font-mono font-bold text-slate-800">
                            {formatNumero(stockBase, 0)} {productoSel.unit_base || productoSel.unit || 'und'}
                          </span>
                        )}
                      </div>
                    </div>
                    {loadingLotes && <p className="text-xs text-slate-400">Cargando lotes...</p>}
                    {!loadingLotes && lotesDisponibles.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5 border-t border-slate-100">
                        {lotesDisponibles.map(l => (
                          <button key={l.lote} type="button"
                            onClick={() => setLote(lote === l.lote ? '' : l.lote)}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${lote === l.lote ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
                            {l.lote} · {uc > 1 ? `${formatNumero(l.stock_base / uc, 1)} ${productoSel.unit}` : `${formatNumero(l.stock_base, 0)} ${productoSel.unit_base || ''}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-600">
                      {modoConteo ? (
                        <>Tienes ahora en <span className="font-semibold text-purple-700">{tipoUnidad === 'conteo' ? (productoSel?.unit || 'conteo') : (productoSel?.unit_base || 'base')}</span> *</>
                      ) : (
                        <>Consumiste en <span className="font-semibold text-slate-800">{tipoUnidad === 'conteo' ? (productoSel?.unit || 'conteo') : (productoSel?.unit_base || 'base')}</span> *</>
                      )}
                    </label>
                    {productoSel && (productoSel.unit || productoSel.unit_base) && (
                      <div className="flex bg-slate-200 rounded-lg p-0.5 gap-0.5">
                        <button type="button" onClick={() => { setTipoUnidad('conteo'); setCantidad(''); }}
                          className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${tipoUnidad === 'conteo' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                          {productoSel.unit || 'Conteo'}
                        </button>
                        <button type="button" onClick={() => { setTipoUnidad('base'); setCantidad(''); }}
                          className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${tipoUnidad === 'base' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                          {productoSel.unit_base || 'Base'}
                        </button>
                      </div>
                    )}
                  </div>
                  <input type="number" min="0" step="any" value={cantidad}
                    onChange={e => setCantidad(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarLinea(); } }}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {productoSel && cantidad && parseFloat(cantidad) >= 0 && (productoSel.unit_content ?? 1) > 1 && (() => {
                    const cant = parseFloat(cantidad);
                    const uc = productoSel.unit_content || 1;
                    const enBase = tipoUnidad === 'conteo' ? cant * uc : cant;
                    const enConteo = tipoUnidad === 'conteo' ? cant : cant / uc;
                    if (modoConteo) {
                      const stockBase = getStockParaCalculo();
                      const diferencia = stockBase - enBase;
                      return (
                        <div className={`mt-1 rounded-lg px-2 py-1.5 text-xs ${diferencia > 0 ? 'bg-purple-100 text-purple-800' : diferencia < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                          {diferencia > 0 ? (
                            <>Diferencia a ajustar: <strong>{formatNumero(diferencia / uc, 2)} {productoSel.unit}</strong> ({formatNumero(diferencia, 0)} {productoSel.unit_base || 'und'})</>
                          ) : diferencia < 0 ? (
                            <>⚠ El conteo supera el stock registrado en {formatNumero(Math.abs(diferencia / uc), 2)} {productoSel.unit}</>
                          ) : (
                            <>El conteo coincide con el sistema</>
                          )}
                        </div>
                      );
                    }
                    return (
                      <p className="text-xs text-blue-500 mt-1 font-medium">
                        {tipoUnidad === 'conteo'
                          ? `= ${formatNumero(enBase, 0)} ${productoSel.unit_base || 'und'}`
                          : `= ${formatNumero(enConteo, 2)} ${productoSel.unit || 'caja'}`}
                      </p>
                    );
                  })()}
                  {productoSel && tipoUnidad === 'conteo' && !((productoSel.unit_content ?? 0) > 1) && productoSel.unit !== productoSel.unit_base && (
                    <p className="text-xs text-amber-500 mt-1">
                      Sin conversión configurada en catálogo — se guardará como unidades individuales
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-600">
                    Lote {lotesDisponibles.length > 0 ? <span className="text-blue-600 font-medium">(selecciona arriba)</span> : '(opcional)'}
                  </label>
                  <input type="text" value={lote}
                    onChange={e => setLote(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarLinea(); } }}
                    placeholder={lotesDisponibles.length > 0 ? 'Seleccionado arriba' : 'Ej: L-12345'}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${lote ? 'border-blue-400 bg-blue-50 font-semibold text-blue-900' : 'border-slate-300 bg-white'}`}
                  />
                  {lote && lotesDisponibles.length > 0 && (
                    <button type="button" onClick={() => setLote('')}
                      className="text-xs text-slate-400 hover:text-red-500 mt-0.5">
                      × Quitar lote
                    </button>
                  )}
                </div>
              </div>

              <Button type="button" icon={<Plus size={15} />} onClick={agregarLinea} variant="outline" className="w-full">
                Agregar a lista
              </Button>
            </div>

            {/* Lista de lineas */}
            {lineas.length > 0 && (
              <div className="rounded-2xl border border-blue-200 overflow-hidden">
                <div className="bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 border-b border-blue-200 flex items-center justify-between">
                  <span>{lineas.length} producto{lineas.length > 1 ? 's' : ''} en la lista</span>
                  {periodoActual && <span className="text-blue-500 font-normal">{periodoActual.label}</span>}
                </div>
                <div className="divide-y divide-slate-100 bg-white">
                  {lineas.map(linea => {
                    const stockRes = linea.stock_actual - linea.cantidadBase;
                    const colorRes = stockRes < 0 ? 'text-red-600' : stockRes <= linea.producto.stock_min ? 'text-yellow-600' : 'text-emerald-600';
                    const uc = linea.producto.unit_content || 1;
                    const tieneDobleUnidad = uc !== 1;
                    return (
                      <div key={linea.id} className={`flex items-center gap-2 px-3 py-2.5 ${linea.esConteoFisico ? 'bg-purple-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-400">{linea.producto.code}</span>
                            <span className="text-sm font-medium text-slate-800 truncate">{linea.producto.name}</span>
                            {linea.esConteoFisico && <span className="text-xs bg-purple-200 text-purple-700 rounded px-1.5 py-0.5 font-semibold">Conteo</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {linea.esConteoFisico ? (
                              <span className="text-xs text-slate-500">
                                Físico: <strong>{tieneDobleUnidad ? `${formatNumero(linea.conteoFisicoBase! / uc, 2)} ${linea.producto.unit}` : formatNumero(linea.conteoFisicoBase!, 0)}</strong>
                                {' · '}Sistema: <strong>{tieneDobleUnidad ? `${formatNumero(linea.stock_actual / uc, 2)} ${linea.producto.unit}` : formatNumero(linea.stock_actual, 0)}</strong>
                                {' · '}Ajuste: <span className="text-purple-700 font-semibold">-{tieneDobleUnidad ? `${formatNumero(linea.cantidad, 2)} ${linea.producto.unit}` : formatNumero(linea.cantidadBase, 0)}</span>
                                {linea.lote && <> · <span className="text-blue-600">Lote: {linea.lote}</span></>}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">
                                {tieneDobleUnidad
                                  ? <>{formatNumero(linea.cantidad, 2)} {linea.producto.unit} <span className="text-slate-400">= {formatNumero(linea.cantidadBase, 0)} {linea.producto.unit_base || ''}</span></>
                                  : <>{formatNumero(linea.cantidadBase, 0)} {linea.producto.unit || 'unid'}</>
                                }
                                {linea.lote && <> · <span className="text-blue-600">Lote: {linea.lote}</span></>}
                              </span>
                            )}
                            <span className={`text-xs font-semibold ${colorRes}`}>
                              → {tieneDobleUnidad ? `${formatNumero(stockRes / uc, 2)} ${linea.producto.unit}` : formatNumero(stockRes, 0)}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => setLineas(p => p.filter(l => l.id !== linea.id))}
                          className="text-slate-200 hover:text-red-500 shrink-0 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-blue-200 bg-blue-50 p-3 flex gap-2">
                  <Button onClick={guardarTodo} loading={guardando} icon={<Save size={16} />}
                    className="flex-1" disabled={!responsable}>
                    Guardar {lineas.length} consumo{lineas.length > 1 ? 's' : ''}
                  </Button>
                  <Button variant="outline" icon={<RotateCcw size={14} />} onClick={() => setLineas([])}>
                    Vaciar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* CSV Bulk */}
        <Card>
          <h2 className="text-base font-semibold text-slate-900 mb-1">Carga masiva CSV</h2>
          <p className="text-sm text-slate-500 mb-4">Importa múltiples consumos desde un archivo.</p>

          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              <p className="font-semibold mb-1">Formato del archivo:</p>
              <p className="font-mono bg-blue-100 rounded px-2 py-1 mb-2">codigo, cantidad, fecha, lote, metodo</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                <li><strong>codigo</strong>: código exacto del catálogo</li>
                <li><strong>cantidad</strong>: cantidad consumida</li>
                <li><strong>fecha</strong>: AAAA-MM-DD (opcional)</li>
                <li><strong>lote</strong>: opcional</li>
                <li><strong>metodo</strong>: CONSUMO, AJUSTE o DEVOLUCION</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Responsable *</label>
                <select value={bulkResponsable} onChange={e => setBulkResponsable(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">Selecciona</option>
                  {personas.map(p => <option key={p.code} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Fecha por defecto</label>
                <input type="date" value={bulkFecha} onChange={e => setBulkFecha(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Método por defecto</label>
              <div className="flex gap-2 mt-1">
                {METODOS.map(m => (
                  <button key={m.value} type="button" onClick={() => setBulkMetodo(m.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${bulkMetodo === m.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Archivo CSV</label>
              <input type="file" accept=".csv,.txt" onChange={handleBulkFile}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </div>

            {bulkErrors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p className="font-semibold mb-1">Filas con problemas:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {bulkErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {bulkItems.length > 0 && (
              <div className="space-y-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 font-medium">
                  ✓ {bulkItems.length} consumos listos para importar
                  {bulkErrors.length > 0 && ` · ${bulkErrors.length} omitidos`}
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Código', 'Nombre', 'Cantidad', 'Lote', 'Fecha'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bulkItems.slice(0, 10).map((item, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-1.5 font-mono text-slate-700">{item.producto_code}</td>
                          <td className="px-3 py-1.5 text-slate-800">{item.producto_name}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{item.cantidad_unidad_natural}</td>
                          <td className="px-3 py-1.5 text-slate-400">{item.lote || '—'}</td>
                          <td className="px-3 py-1.5 text-slate-500">{item.fecha}</td>
                        </tr>
                      ))}
                      {bulkItems.length > 10 && (
                        <tr><td colSpan={5} className="px-3 py-1.5 text-slate-400 text-center italic">...y {bulkItems.length - 10} más</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Button icon={<Database size={16} />} onClick={importarBulk} loading={importing} disabled={!bulkResponsable.trim()}>
                  Importar {bulkItems.length} consumos
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Historial */}
      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Historial de consumos</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {historialFiltrado.length} registro{historialFiltrado.length !== 1 ? 's' : ''}
                {(busqueda || fechaDesde || fechaHasta) ? ' (filtrado)' : ` · ${MESES[mesFiltro.mes - 1]} ${mesFiltro.año}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMesFiltro(prev => ({
                mes: prev.mes === 1 ? 12 : prev.mes - 1,
                año: prev.mes === 1 ? prev.año - 1 : prev.año,
              }))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={16} /></button>
              <span className="text-sm font-semibold text-slate-700 min-w-[150px] text-center">
                {MESES[mesFiltro.mes - 1]} {mesFiltro.año}
              </span>
              <button onClick={() => setMesFiltro(prev => ({
                mes: prev.mes === 12 ? 1 : prev.mes + 1,
                año: prev.mes === 12 ? prev.año + 1 : prev.año,
              }))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por código, nombre o lote..."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm min-w-[220px] flex-1" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap">Desde</label>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap">Hasta</label>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm" />
            </div>
            {(busqueda || fechaDesde || fechaHasta) && (
              <button onClick={() => { setBusqueda(''); setFechaDesde(''); setFechaHasta(''); }}
                className="text-xs text-slate-500 hover:text-slate-800 underline whitespace-nowrap">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {loadingHist ? (
          <div className="p-8 text-center text-sm text-slate-400">Cargando...</div>
        ) : historialFiltrado.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            {historial.length === 0
              ? `No hay consumos registrados en ${MESES[mesFiltro.mes - 1]} ${mesFiltro.año}.`
              : 'No hay consumos que coincidan con los filtros.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Fecha</th>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Código</th>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Lote</th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Cantidad</th>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Responsable</th>
                  <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-slate-500">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historialFiltrado.map((rec, i) => {
                  const prod = productos.find(p => p.code === rec.producto_code);
                  const tipoColor =
                    rec.tipo === 'DEVOLUCION' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    rec.tipo === 'AJUSTE'     ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                               'bg-slate-100 text-slate-600 border-slate-200';
                  return (
                    <tr key={rec.id ?? i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatFecha(rec.fecha)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tipoColor}`}>{rec.tipo}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">{rec.producto_code}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-800 font-medium max-w-[200px] truncate" title={rec.producto_name}>{rec.producto_name}</td>
                      <td className="px-3 py-2">
                        {rec.lote
                          ? <span className="rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 font-medium text-blue-800">{rec.lote}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800">{formatNumero(rec.cantidad_unidad_natural, 0)}</span>
                        {(rec.unidad_natural || prod?.unit) && <span className="ml-1 text-slate-400">{rec.unidad_natural || prod?.unit}</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{rec.recibido_por || '—'}</td>
                      <td className="px-3 py-2 text-slate-400 max-w-[200px] truncate" title={rec.observaciones || ''}>{rec.observaciones || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={5} className="px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide text-xs">
                    Total · {historialFiltrado.length} registros
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                    {formatNumero(historialFiltrado.reduce((s, r) => s + (r.cantidad_unidad_natural || 0), 0), 0)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
