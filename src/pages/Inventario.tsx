import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, Layers, BarChart2 } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeCategoria, BadgeEstado } from '../components/ui/Badge';
import { SearchInput } from '../components/ui/SearchInput';
import { useInventario } from '../hooks/useInventario';
import { useProductos } from '../hooks/useProductos';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { getEstado, CATEGORIAS, SUBCATEGORIAS } from '../types';
import { formatNumero, formatFecha, exportarExcel } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface LoteItem {
  producto_code: string;
  producto_name: string;
  lote: string;
  proveedor: string;
  unidad_natural: string;
  unit_base: string;
  total_conteo: number;
  total_base: number;
  ultima_fecha: string;
  fecha_vencimiento: string;
  category: string;
  subcategory: string;
}

export function Inventario() {
  const { inventario, loading, error, recargar } = useInventario();
  const { productos } = useProductos();
  const { history: searchHistory, addSearch, clearHistory } = useSearchHistory('inventario');
  const [tab, setTab] = useState<'general' | 'lote'>('general');
  const [busqueda, setBusqueda] = useState('');
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([]);
  const [subcategoriasFiltro, setSubcategoriasFiltro] = useState<string[]>([]);
  const [soloConStock, setSoloConStock] = useState(true);

  // --- Por lote ---
  const [lotesData, setLotesData] = useState<LoteItem[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [busquedaLote, setBusquedaLote] = useState('');
  const [categoriasFiltroLote, setCategoriasFiltroLote] = useState<string[]>([]);
  const [subcategoriasFiltroLote, setSubcategoriasFiltroLote] = useState<string[]>([]);

  const cargarLotes = useCallback(async () => {
    setLoadingLotes(true);
    const { data } = await supabase
      .from('recepciones')
      .select('producto_code, producto_name, lote, proveedor, tipo, cantidad_unidad_natural, total_unidades_base, fecha, unidad_natural, fecha_vencimiento')
      .not('lote', 'is', null)
      .neq('lote', '')
      .order('producto_code')
      .order('lote');

    if (data) {
      const map = new Map<string, LoteItem>();
      data.forEach(rec => {
        const key = `${rec.producto_code}||${rec.lote}`;
        const prod = productos.find(p => p.code === rec.producto_code);
        const esEntrada = !rec.tipo || rec.tipo === 'RECEPCION' || rec.tipo === 'DEVOLUCION';
        const delta = esEntrada ? (rec.total_unidades_base || 0) : -(rec.total_unidades_base || 0);
        const deltaConteo = esEntrada ? (rec.cantidad_unidad_natural || 0) : -(rec.cantidad_unidad_natural || 0);

        if (map.has(key)) {
          const ex = map.get(key)!;
          ex.total_conteo += deltaConteo;
          ex.total_base += delta;
          if (rec.fecha > ex.ultima_fecha) ex.ultima_fecha = rec.fecha;
          if (esEntrada && rec.fecha_vencimiento && (!ex.fecha_vencimiento || rec.fecha_vencimiento < ex.fecha_vencimiento)) {
            ex.fecha_vencimiento = rec.fecha_vencimiento;
          }
        } else {
          map.set(key, {
            producto_code: rec.producto_code,
            producto_name: rec.producto_name,
            lote: rec.lote,
            proveedor: rec.proveedor || '',
            unidad_natural: rec.unidad_natural || prod?.unit || '',
            unit_base: prod?.unit_base || '',
            total_conteo: deltaConteo,
            total_base: delta,
            ultima_fecha: rec.fecha,
            fecha_vencimiento: (esEntrada ? rec.fecha_vencimiento : '') || '',
            category: prod?.category || '',
            subcategory: prod?.subcategory || '',
          });
        }
      });
      // Solo mostrar lotes con stock positivo
      setLotesData(Array.from(map.values()).filter(l => l.total_base > 0.001));
    }
    setLoadingLotes(false);
  }, [productos]);

  useEffect(() => {
    if (tab === 'lote' && lotesData.length === 0) cargarLotes();
  }, [tab, lotesData.length, cargarLotes]);

  const subcategoriasDisponiblesLote = useMemo(() => {
    const cats = categoriasFiltroLote.length > 0 ? categoriasFiltroLote : Object.keys(CATEGORIAS);
    const result: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    cats.forEach(cat => {
      const subs = SUBCATEGORIAS[cat] || {};
      Object.entries(subs).forEach(([key, label]) => {
        const id = `${cat}:${key}`;
        if (!seen.has(id)) { seen.add(id); result.push({ key: id, label }); }
      });
    });
    return result;
  }, [categoriasFiltroLote]);

  const lotesFiltrados = useMemo(() => {
    const q = busquedaLote.toLowerCase();
    return lotesData.filter(item => {
      const matchText = !busquedaLote ||
        item.producto_code.toLowerCase().includes(q) ||
        item.producto_name.toLowerCase().includes(q) ||
        item.lote.toLowerCase().includes(q) ||
        item.proveedor.toLowerCase().includes(q);
      const matchCat = categoriasFiltroLote.length === 0 || categoriasFiltroLote.includes(item.category);
      const matchSub = subcategoriasFiltroLote.length === 0 ||
        subcategoriasFiltroLote.includes(`${item.category}:${item.subcategory}`);
      return matchText && matchCat && matchSub;
    });
  }, [lotesData, busquedaLote, categoriasFiltroLote, subcategoriasFiltroLote]);

  // --- General ---
  const items = useMemo(() => {
    return inventario.map(item => {
      const prod = productos.find(p => p.code === item.code);
      const subcategory = prod?.subcategory || '';
      const unit_content = Number(item.unit_content) > 0 ? Number(item.unit_content) : 1;
      const unit = item.unit || 'UNIDAD';
      const unit_base = item.unit_base || '';
      const stock = Number(item.stock_actual) || 0;
      const cantidad_conteo = stock / unit_content;
      return { ...item, stock_actual: stock, unit_content, unit, unit_base, subcategory, cantidad_conteo };
    });
  }, [inventario, productos]);

  const subcategoriasDisponibles = useMemo(() => {
    const cats = categoriasFiltro.length > 0 ? categoriasFiltro : Object.keys(CATEGORIAS);
    const result: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    cats.forEach(cat => {
      const subs = SUBCATEGORIAS[cat] || {};
      Object.entries(subs).forEach(([key, label]) => {
        const id = `${cat}:${key}`;
        if (!seen.has(id)) { seen.add(id); result.push({ key: id, label }); }
      });
    });
    return result;
  }, [categoriasFiltro]);

  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase();
    return items.filter(item => {
      const matchText = !busqueda ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.supplier ?? '').toLowerCase().includes(q) ||
        (item.presentation ?? '').toLowerCase().includes(q);
      const matchCat = categoriasFiltro.length === 0 || categoriasFiltro.includes(item.category);
      const matchSub = subcategoriasFiltro.length === 0 ||
        subcategoriasFiltro.includes(`${item.category}:${item.subcategory}`);
      const matchStock = !soloConStock || item.stock_actual > 0;
      return matchText && matchCat && matchSub && matchStock;
    });
  }, [items, busqueda, categoriasFiltro, subcategoriasFiltro, soloConStock]);

  function handleExport() {
    exportarExcel(filtered.map(item => ({
      Código: item.code,
      Nombre: item.name,
      Categoría: CATEGORIAS[item.category]?.label || item.category,
      Subcategoría: SUBCATEGORIAS[item.category]?.[item.subcategory] || item.subcategory || '',
      [`Cant. (${item.unit || 'UNIDAD'})`]: formatNumero(item.cantidad_conteo, 2),
      'Unidad conteo': item.unit || 'UNIDAD',
      'Cant. base': formatNumero(item.stock_actual, 0),
      'Unidad base': item.unit_base,
      'Stock mín': item.stock_min,
      Estado: getEstado(item),
    })), 'inventario');
  }

  function handleExportLotes() {
    exportarExcel(lotesFiltrados.map(item => ({
      Código: item.producto_code,
      Nombre: item.producto_name,
      Lote: item.lote,
      Proveedor: item.proveedor,
      'Cant. conteo': item.total_conteo,
      'Unidad conteo': item.unidad_natural,
      'Cant. base': item.total_base,
      'Unidad base': item.unit_base,
      'Última recepción': item.ultima_fecha,
    })), 'inventario_por_lote');
  }

  const totalProductos = filtered.length;
  const conStock = filtered.filter(i => i.stock_actual > 0).length;
  const agotados = filtered.filter(i => i.stock_actual <= 0).length;

  return (
    <div>
      <Header
        title="Inventario Actual"
        subtitle="Stock en tiempo real calculado desde recepciones y consumos."
        actions={
          <div className="flex gap-2">
            {tab === 'general' ? (
              <>
                <Button variant="outline" icon={<Download size={16} />} onClick={handleExport} size="sm">Exportar</Button>
                <Button variant="outline" icon={<RefreshCw size={16} />} onClick={recargar} size="sm">Actualizar</Button>
              </>
            ) : (
              <>
                <Button variant="outline" icon={<Download size={16} />} onClick={handleExportLotes} size="sm">Exportar</Button>
                <Button variant="outline" icon={<RefreshCw size={16} />} onClick={cargarLotes} size="sm">Actualizar</Button>
              </>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-2xl p-1 w-fit">
        <button
          onClick={() => setTab('general')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'general' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart2 size={15} />
          General
        </button>
        <button
          onClick={() => setTab('lote')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === 'lote' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers size={15} />
          Por Lote
        </button>
      </div>

      {tab === 'general' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{totalProductos}</p>
              <p className="text-xs text-slate-500 mt-1">Productos</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{conStock}</p>
              <p className="text-xs text-emerald-600 mt-1">Con stock</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-slate-500">{agotados}</p>
              <p className="text-xs text-slate-400 mt-1">Sin stock</p>
            </div>
          </div>

          <Card className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
              <div className="min-w-[240px] flex-1">
                <SearchInput
                  value={busqueda}
                  onChange={setBusqueda}
                  onSearch={addSearch}
                  history={searchHistory}
                  onClearHistory={clearHistory}
                  placeholder="Buscar por código, nombre, proveedor o descripción..."
                />
              </div>
              <MultiSelectCategorias value={categoriasFiltro} onChange={v => { setCategoriasFiltro(v); setSubcategoriasFiltro([]); }} />
              {subcategoriasDisponibles.length > 0 && (
                <MultiSelectSubcategorias opciones={subcategoriasDisponibles} value={subcategoriasFiltro} onChange={setSubcategoriasFiltro} />
              )}
              {(busqueda || categoriasFiltro.length > 0 || subcategoriasFiltro.length > 0) && (
                <button onClick={() => { setBusqueda(''); setCategoriasFiltro([]); setSubcategoriasFiltro([]); }} className="text-xs text-slate-500 hover:text-slate-800 underline">
                  Limpiar filtros
                </button>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={soloConStock} onChange={e => setSoloConStock(e.target.checked)} className="h-4 w-4 rounded" />
                Solo con stock
              </label>
              <span className="text-xs text-slate-400 ml-auto">{filtered.length} productos</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500">Cargando inventario...</div>
            ) : error ? (
              <div className="p-8 text-center text-rose-500 text-sm">Error al cargar inventario: {error}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[120px]">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[220px]">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[150px]">Categoría</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[130px]">Subcategoría</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[120px]">Cant. conteo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[100px]">Unidad conteo</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[120px]">Cant. base</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[100px]">Unidad base</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[90px]">Stock mín</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[90px]">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[130px]">Proveedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={10} className="p-8 text-center text-slate-400">
                        {items.length === 0 ? 'No hay stock registrado aún.' : 'No hay productos que coincidan con los filtros.'}
                      </td></tr>
                    ) : filtered.map((item, index) => (
                      <tr key={item.code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">{item.code}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-900 font-medium">{item.name}</td>
                        <td className="px-4 py-3"><BadgeCategoria category={item.category} /></td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{SUBCATEGORIAS[item.category]?.[item.subcategory] || item.subcategory || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{formatNumero(item.cantidad_conteo, 2)}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs font-medium">{item.unit || 'UNIDAD'}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{formatNumero(item.stock_actual, 0)}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs font-medium">{item.unit_base || '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{item.stock_min}</td>
                        <td className="px-4 py-3 text-center"><BadgeEstado estado={getEstado(item)} /></td>
                        <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[130px]">{item.supplier || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'lote' && (
        <>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
              Muestra el total recibido por lote. El saldo restante requiere registrar consumos por lote.
            </div>
            <span className="text-xs text-slate-400">{lotesFiltrados.length} lotes</span>
          </div>

          <Card className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
              <input
                value={busquedaLote}
                onChange={e => setBusquedaLote(e.target.value)}
                placeholder="Buscar por código, nombre, lote o proveedor..."
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm min-w-[240px] flex-1"
              />
              <MultiSelectCategorias value={categoriasFiltroLote} onChange={v => { setCategoriasFiltroLote(v); setSubcategoriasFiltroLote([]); }} />
              {subcategoriasDisponiblesLote.length > 0 && (
                <MultiSelectSubcategorias opciones={subcategoriasDisponiblesLote} value={subcategoriasFiltroLote} onChange={setSubcategoriasFiltroLote} />
              )}
              {(busquedaLote || categoriasFiltroLote.length > 0 || subcategoriasFiltroLote.length > 0) && (
                <button onClick={() => { setBusquedaLote(''); setCategoriasFiltroLote([]); setSubcategoriasFiltroLote([]); }} className="text-xs text-slate-500 hover:text-slate-800 underline">
                  Limpiar filtros
                </button>
              )}
            </div>

            {loadingLotes ? (
              <div className="p-8 text-center text-slate-500">Cargando lotes...</div>
            ) : lotesFiltrados.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                {lotesData.length === 0 ? 'No hay recepciones con lote registradas.' : 'No hay lotes que coincidan con la búsqueda.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Código</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Categoría</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Lote</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Vencimiento</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">Proveedor</th>
                      <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Total conteo</th>
                      <th className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Total base</th>
                      <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Última recep.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotesFiltrados.map((item, i) => (
                      <tr key={`${item.producto_code}-${item.lote}-${i}`} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">{item.producto_code}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 font-medium max-w-[200px] truncate" title={item.producto_name}>{item.producto_name}</td>
                        <td className="px-4 py-2.5"><BadgeCategoria category={item.category} /></td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 font-semibold text-blue-800">{item.lote}</span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {item.fecha_vencimiento
                            ? <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">{formatFecha(item.fecha_vencimiento)}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 max-w-[130px] truncate">{item.proveedor || '—'}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-800">{formatNumero(item.total_conteo, 0)}</span>
                          {item.unidad_natural && <span className="ml-1 text-slate-400">{item.unidad_natural}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <span className="font-mono font-semibold text-emerald-700">{formatNumero(item.total_base, 0)}</span>
                          {item.unit_base && <span className="ml-1 text-slate-400">{item.unit_base}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatFecha(item.ultima_fecha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function MultiSelectSubcategorias({ opciones, value, onChange }: { opciones: { key: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key]);
  }

  const label = value.length === 0 ? 'Todas las subcategorías' : value.length === 1 ? opciones.find(o => o.key === value[0])?.label : `${value.length} subcategorías`;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 min-w-[180px] justify-between">
        <span>{label}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-52 rounded-2xl border border-slate-200 bg-white shadow-lg py-1">
          <label className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} className="h-4 w-4 rounded" />
            <span className="text-slate-700">Todas las subcategorías</span>
          </label>
          <div className="border-t border-slate-100 my-1" />
          {opciones.map(({ key, label: lbl }) => (
            <label key={key} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={value.includes(key)} onChange={() => toggle(key)} className="h-4 w-4 rounded" />
              <span className="text-slate-700">{lbl}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiSelectCategorias({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key]);
  }

  const label = value.length === 0 ? 'Todas las categorías' : value.length === 1 ? CATEGORIAS[value[0]]?.label : `${value.length} categorías`;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 min-w-[160px] justify-between">
        <span>{label}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-52 rounded-2xl border border-slate-200 bg-white shadow-lg py-1">
          <label className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} className="h-4 w-4 rounded" />
            <span className="text-slate-700">Todas las categorías</span>
          </label>
          <div className="border-t border-slate-100 my-1" />
          {Object.entries(CATEGORIAS).map(([key, cat]) => (
            <label key={key} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={value.includes(key)} onChange={() => toggle(key)} className="h-4 w-4 rounded" />
              <span className="text-slate-700">{cat.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
