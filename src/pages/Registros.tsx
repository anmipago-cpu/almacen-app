import { useState, useMemo } from 'react';
import { Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeTipo } from '../components/ui/Badge';
import { useRegistros } from '../hooks/useRegistros';
import { useProductos } from '../hooks/useProductos';
import { formatFecha, formatNumero, exportarExcel } from '../lib/utils';

const POR_PAGINA = 25;
const TIPOS = ['', 'RECEPCION', 'CONSUMO', 'AJUSTE', 'DEVOLUCION'];

export function Registros() {
  const [pagina, setPagina] = useState(1);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipo, setTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [lote, setLote] = useState('');
  const [categoria, setCategoria] = useState('');

  const { productos } = useProductos();

  const categorias = useMemo(
    () => [...new Set(productos.map(p => p.category).filter(Boolean))].sort(),
    [productos]
  );

  const codigosProducto = useMemo(
    () => categoria ? productos.filter(p => p.category === categoria).map(p => p.code) : undefined,
    [categoria, productos]
  );

  const { registros, loading, total } = useRegistros({ fechaDesde, fechaHasta, tipo, busqueda, lote, codigosProducto, pagina, porPagina: POR_PAGINA });

  const totalPaginas = Math.ceil(total / POR_PAGINA);

  function stockDespues(tipo: string | undefined, antes: number | null | undefined, total: number): number | null {
    if (antes == null) return null;
    return (!tipo || tipo === 'RECEPCION' || tipo === 'DEVOLUCION') ? antes + total : antes - total;
  }

  function handleExport() {
    exportarExcel(registros.map(r => {
      const despues = stockDespues(r.tipo, r.stock_antes, r.total_unidades_base);
      return {
        Fecha: r.fecha, Tipo: r.tipo || 'RECEPCION', Código: r.producto_code, Producto: r.producto_name,
        Lote: r.lote || '', Proveedor: r.proveedor || '', 'Recibido/Por': r.recibido_por || '',
        Cantidad: r.cantidad_unidad_natural, Movimiento: r.total_unidades_base,
        'Stock antes': r.stock_antes ?? '',
        'Stock después': despues ?? '',
        Observaciones: r.observaciones || '',
      };
    }), 'registros');
  }

  function resetFiltros() {
    setFechaDesde(''); setFechaHasta(''); setTipo(''); setBusqueda(''); setLote(''); setCategoria(''); setPagina(1);
  }

  return (
    <div>
      <Header
        title="Historial de Registros"
        subtitle={`${total} movimientos en total`}
        actions={
          <Button variant="outline" icon={<Download size={15} />} onClick={handleExport} size="sm">
            Exportar Excel
          </Button>
        }
      />

      <Card className="!p-0 overflow-hidden">
        {/* Filtros */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Desde</label>
              <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPagina(1); }}
                className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Hasta</label>
              <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPagina(1); }}
                className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select
              value={tipo}
              onChange={e => { setTipo(e.target.value); setPagina(1); }}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los tipos</option>
              {TIPOS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="relative flex-1 min-w-40">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
                placeholder="Buscar producto..."
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input
              value={lote}
              onChange={e => { setLote(e.target.value); setPagina(1); }}
              placeholder="Lote..."
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
            />
            <select
              value={categoria}
              onChange={e => { setCategoria(e.target.value); setPagina(1); }}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={resetFiltros} className="text-xs text-blue-600 hover:underline">Limpiar filtros</button>
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando registros...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Fecha', 'Tipo', 'Producto', 'Lote', 'Proveedor / Por', 'Cantidad', 'Movimiento', 'Stock antes', 'Stock después', 'Obs.'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-slate-400">Sin registros</td></tr>
                ) : registros.map((r, idx) => {
                  const esEntrada = !r.tipo || r.tipo === 'RECEPCION' || r.tipo === 'DEVOLUCION';
                  const despues = stockDespues(r.tipo, r.stock_antes, r.total_unidades_base);
                  return (
                  <tr key={r.id} className={`border-b border-slate-50 hover:bg-blue-50/20 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatFecha(r.fecha)}</td>
                    <td className="px-4 py-3"><BadgeTipo tipo={r.tipo || 'RECEPCION'} /></td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.producto_name}</div>
                      <div className="text-xs text-slate-400 mono">{r.producto_code}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 mono text-xs">{r.lote || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-32 truncate">
                      {r.proveedor || r.recibido_por || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-right">
                      <div>{formatNumero(r.cantidad_unidad_natural)}</div>
                      {r.unidad_natural && <div className="text-xs text-slate-400 font-sans">{r.unidad_natural}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-right">
                      <span className={esEntrada ? 'text-green-700' : 'text-red-600'}>
                        {esEntrada ? '+' : '-'}{formatNumero(r.total_unidades_base)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-slate-500">
                      {r.stock_antes != null ? formatNumero(r.stock_antes) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-right">
                      {despues != null ? (
                        <span className={despues < 0 ? 'text-red-600' : 'text-slate-800'}>
                          {formatNumero(despues)}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-40 truncate" title={r.observaciones || ''}>
                      {r.observaciones || '—'}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <span>{total} registros · Página {pagina} de {Math.max(1, totalPaginas)}</span>
          <div className="flex items-center gap-2">
            <button
              disabled={pagina <= 1}
              onClick={() => setPagina(p => p - 1)}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span>{pagina}</span>
            <button
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina(p => p + 1)}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
