import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { useProductos } from '../hooks/useProductos';
import { useSearchContext } from '../context/SearchContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeCategoria } from '../components/ui/Badge';
import { formatNumero } from '../lib/utils';

export function Buscador() {
  const { productos, loading } = useProductos();
  const { selectedProduct, setSelectedProduct, searchQuery, setSearchQuery } = useSearchContext();

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return productos;
    return productos.filter(product =>
      product.name.toLowerCase().includes(query) ||
      product.code.toLowerCase().includes(query) ||
      product.supplier?.toLowerCase().includes(query)
    );
  }, [productos, searchQuery]);

  return (
    <div>
      <Header
        title="Buscador de Productos"
        subtitle="Busca productos por código, nombre o proveedor y autocompleta los formularios del sistema."
      />

      <Card>
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Ingrese código, nombre o proveedor..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-12 py-4 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

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
              <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Selecciona un producto para autocompletar el formulario activo.</div>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">Cargando productos...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">No se encontraron productos.</td></tr>
              ) : filtered.map((product, index) => (
                <tr key={product.code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-3 font-mono text-slate-700">{product.code}</td>
                  <td className="px-4 py-3 text-slate-900">{product.name}</td>
                  <td className="px-4 py-3"><BadgeCategoria category={product.category} /></td>
                  <td className="px-4 py-3 text-slate-600">{product.supplier || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{product.presentation || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{product.unit || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700 font-mono">{formatNumero(product.unit_content || 1, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
