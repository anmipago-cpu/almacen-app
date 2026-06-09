import { useMemo, useRef, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeCategoria, BadgeEstado } from '../components/ui/Badge';
import { useInventario } from '../hooks/useInventario';
import { useProductos } from '../hooks/useProductos';
import { getEstado, CATEGORIAS } from '../types';
import { formatNumero, exportarExcel } from '../lib/utils';

export function Inventario() {
  const { inventario, loading, recargar } = useInventario();
  const { productos } = useProductos();
  const [busqueda, setBusqueda] = useState('');
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([]);

  const items = useMemo(() => {
    return inventario.map(item => {
      const prod = productos.find(p => p.code === item.code);
      const unit_content = prod?.unit_content ?? 1;
      const unit = prod?.unit || item.unit || 'UNIDAD';
      const unit_base = prod?.unit_base || '';
      const cantidad_conteo = unit_content > 0 ? item.stock_actual / unit_content : item.stock_actual;
      return { ...item, unit_content, unit, unit_base, cantidad_conteo };
    });
  }, [inventario, productos]);

  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase();
    return items.filter(item => {
      const matchText = !busqueda ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.supplier ?? '').toLowerCase().includes(q);
      const matchCat = categoriasFiltro.length === 0 || categoriasFiltro.includes(item.category);
      return matchText && matchCat;
    });
  }, [items, busqueda, categoriasFiltro]);

  function handleExport() {
    exportarExcel(filtered.map(item => ({
      Código: item.code,
      Nombre: item.name,
      Categoría: CATEGORIAS[item.category]?.label || item.category,
      [`Cant. (${item.unit || 'UNIDAD'})`]: formatNumero(item.cantidad_conteo, 2),
      'Unidad conteo': item.unit || 'UNIDAD',
      'Cant. base': formatNumero(item.stock_actual, 0),
      'Unidad base': item.unit_base,
      'Stock mín': item.stock_min,
      Estado: getEstado(item),
    })), 'inventario');
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
            <Button variant="outline" icon={<Download size={16} />} onClick={handleExport} size="sm">
              Exportar Excel
            </Button>
            <Button variant="outline" icon={<RefreshCw size={16} />} onClick={recargar} size="sm">
              Actualizar
            </Button>
          </div>
        }
      />

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
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código, nombre o proveedor..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm min-w-[240px] flex-1"
          />
          <MultiSelectCategorias value={categoriasFiltro} onChange={setCategoriasFiltro} />
          {(busqueda || categoriasFiltro.length > 0) && (
            <button
              onClick={() => { setBusqueda(''); setCategoriasFiltro([]); }}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Limpiar filtros
            </button>
          )}
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} productos</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando inventario...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[120px]">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[220px]">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[150px]">Categoría</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[120px]">Cant. conteo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[100px]">Unidad</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[120px]">Cant. base</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[100px]">Unidad base</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[90px]">Stock mín</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-[90px]">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      {items.length === 0 ? 'No hay stock registrado aún.' : 'No hay productos que coincidan con los filtros.'}
                    </td>
                  </tr>
                ) : filtered.map((item, index) => (
                  <tr key={item.code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                        {item.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{item.name}</td>
                    <td className="px-4 py-3"><BadgeCategoria category={item.category} /></td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                      {formatNumero(item.cantidad_conteo, 2)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.unit || 'UNIDAD'}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {formatNumero(item.stock_actual, 0)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.unit_base || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{item.stock_min}</td>
                    <td className="px-4 py-3 text-center">
                      <BadgeEstado estado={getEstado(item)} />
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

  const label = value.length === 0
    ? 'Todas las categorías'
    : value.length === 1
    ? CATEGORIAS[value[0]]?.label
    : `${value.length} categorías`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 min-w-[160px] justify-between"
      >
        <span>{label}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
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
