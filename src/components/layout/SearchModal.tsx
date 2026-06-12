import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useProductos } from '../../hooks/useProductos';
import { useSearchContext } from '../../context/SearchContext';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import { SearchInput } from '../ui/SearchInput';
import { BadgeCategoria } from '../ui/Badge';
import { cn } from '../../lib/utils';

export function SearchModal() {
  const { productos, loading } = useProductos();
  const { searchOpen, setSearchOpen, searchQuery, setSearchQuery, setSelectedProduct } = useSearchContext();
  const { history, addSearch, clearHistory } = useSearchHistory('global');

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return productos;
    return productos.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.code.toLowerCase().includes(query) ||
      product.supplier?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query) ||
      product.presentation?.toLowerCase().includes(query)
    );
  }, [productos, searchQuery]);

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 sm:p-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Buscador universal</h2>
            <p className="text-sm text-slate-500">Busca por código, nombre, proveedor, descripción o presentación.</p>
          </div>
          <button onClick={() => setSearchOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={addSearch}
            history={history}
            onClearHistory={clearHistory}
            placeholder="Código, nombre, proveedor, descripción..."
            autoFocus
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto border-t border-slate-200">
          {loading ? (
            <div className="p-6 text-center text-slate-500">Cargando productos...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No se encontraron productos.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filtered.slice(0, 50).map(product => (
                <button
                  key={product.code}
                  type="button"
                  onClick={() => {
                    if (searchQuery.trim()) addSearch(searchQuery.trim());
                    setSelectedProduct(product);
                    setSearchOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-5 py-4 transition hover:bg-slate-50',
                    'grid grid-cols-[1fr_auto] gap-4 items-start'
                  )}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{product.name}</span>
                      <span className="text-xs font-medium text-slate-500">{product.code}</span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm text-slate-500">
                      <span>{product.supplier || 'Proveedor no definido'}</span>
                      <span>{product.presentation || 'Presentación no definida'}</span>
                      {product.description && (
                        <span className="sm:col-span-2 text-xs text-slate-400 truncate">{product.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <BadgeCategoria category={product.category} />
                    <span className="text-xs text-slate-400">{product.unit_base || 'Unidad base'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
