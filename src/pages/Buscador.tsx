import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useProductos } from '../hooks/useProductos';
import { useSearchContext } from '../context/SearchContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeCategoria } from '../components/ui/Badge';
import { formatNumero } from '../lib/utils';
import { CATEGORIAS, SUBCATEGORIAS } from '../types';

export function Buscador() {
  const { productos, loading } = useProductos();
  const { selectedProduct, setSelectedProduct, searchQuery, setSearchQuery } = useSearchContext();
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([]);
  const [subcategoriasFiltro, setSubcategoriasFiltro] = useState<string[]>([]);
  const [soloActivos, setSoloActivos] = useState(true);

  const subcategoriasDisponibles = useMemo(() => {
    const cats = categoriasFiltro.length > 0 ? categoriasFiltro : Object.keys(CATEGORIAS);
    const result: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    cats.forEach(cat => {
      Object.entries(SUBCATEGORIAS[cat] || {}).forEach(([key, label]) => {
        const id = `${cat}:${key}`;
        if (!seen.has(id)) { seen.add(id); result.push({ key: id, label }); }
      });
    });
    return result;
  }, [categoriasFiltro]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return productos.filter(p => {
      const matchText = !query ||
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.supplier?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query);
      const matchCat = categoriasFiltro.length === 0 || categoriasFiltro.includes(p.category);
      const matchSub = subcategoriasFiltro.length === 0 ||
        subcategoriasFiltro.includes(`${p.category}:${p.subcategory}`);
      const matchActivo = !soloActivos || p.active !== false;
      return matchText && matchCat && matchSub && matchActivo;
    });
  }, [productos, searchQuery, categoriasFiltro, subcategoriasFiltro, soloActivos]);

  const hayFiltros = searchQuery || categoriasFiltro.length > 0 || subcategoriasFiltro.length > 0;

  function limpiarFiltros() {
    setSearchQuery('');
    setCategoriasFiltro([]);
    setSubcategoriasFiltro([]);
  }

  return (
    <div>
      <Header
        title="Buscador de Productos"
        subtitle="Busca productos por código, nombre, proveedor o descripción y autocompleta los formularios del sistema."
      />

      <Card>
        <div className="space-y-4">
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por código, nombre, proveedor o descripción..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-12 py-4 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectCategorias
              value={categoriasFiltro}
              onChange={v => { setCategoriasFiltro(v); setSubcategoriasFiltro([]); }}
            />
            {subcategoriasDisponibles.length > 0 && (
              <MultiSelectSubcategorias
                opciones={subcategoriasDisponibles}
                value={subcategoriasFiltro}
                onChange={setSubcategoriasFiltro}
              />
            )}
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none ml-1">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={e => setSoloActivos(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Solo activos
            </label>
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                className="text-xs text-slate-500 hover:text-slate-800 underline ml-1"
              >
                Limpiar filtros
              </button>
            )}
            <span className="text-xs text-slate-400 ml-auto">
              {loading ? '...' : filtered.length} productos
            </span>
          </div>

          {/* Stats + selección */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-600">Productos encontrados</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '...' : filtered.length}</p>
            </div>
            {selectedProduct ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-600">Último producto seleccionado</p>
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-slate-500">{selectedProduct.name}</p>
                  <p className="text-xs text-slate-400">{selectedProduct.code}</p>
                  <BadgeCategoria category={selectedProduct.category} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedProduct(null)}>Limpiar selección</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Selecciona un producto para autocompletar el formulario activo.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Presentación</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Unidad</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Contenido</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-slate-500">Cargando productos...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-slate-500">No se encontraron productos.</td></tr>
              ) : filtered.map((product, index) => (
                <tr
                  key={product.code}
                  className={`cursor-pointer transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50`}
                  onClick={() => setSelectedProduct(product)}
                >
                  <td className="px-4 py-3 font-mono text-slate-700">{product.code}</td>
                  <td className="px-4 py-3 text-slate-900">{product.name}</td>
                  <td className="px-4 py-3"><BadgeCategoria category={product.category} /></td>
                  <td className="px-4 py-3 text-slate-600">{product.supplier || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{product.presentation || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{product.unit || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700 font-mono">{formatNumero(product.unit_content || 1, 0)}</td>
                  <td className="px-4 py-3 text-center">
                    {product.active === false
                      ? <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">Inactivo</span>
                      : <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">Activo</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

  const label = value.length === 0 ? 'Todas las categorías'
    : value.length === 1 ? CATEGORIAS[value[0]]?.label
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
              <input
                type="checkbox"
                checked={value.includes(key)}
                onChange={() => onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key])}
                className="h-4 w-4 rounded"
              />
              <span className="text-slate-700">{cat.label}</span>
            </label>
          ))}
        </div>
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

  const label = value.length === 0 ? 'Todas las subcategorías'
    : value.length === 1 ? opciones.find(o => o.key === value[0])?.label
    : `${value.length} subcategorías`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 min-w-[180px] justify-between"
      >
        <span>{label}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 rounded-2xl border border-slate-200 bg-white shadow-lg py-1 max-h-60 overflow-y-auto">
          <label className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} className="h-4 w-4 rounded" />
            <span className="text-slate-700">Todas las subcategorías</span>
          </label>
          <div className="border-t border-slate-100 my-1" />
          {opciones.map(({ key, label: lbl }) => (
            <label key={key} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(key)}
                onChange={() => onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key])}
                className="h-4 w-4 rounded"
              />
              <span className="text-slate-700">{lbl}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
