import { useState, useMemo } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { ArrowUpDown, Download, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeCategoria, BadgeEstado } from '../components/ui/Badge';
import { useInventario } from '../hooks/useInventario';
import { useRegistros } from '../hooks/useRegistros';
import { CATEGORIAS, getEstado, type InventarioItem } from '../types';
import { formatNumero, exportarExcel, hoy } from '../lib/utils';

const ESTADOS = ['', 'AGOTADO', 'CRITICO', 'BAJO', 'OK'];

export function Inventario() {
  const { inventario, loading, recargar } = useInventario();
  const { guardarRegistro } = useRegistros({ porPagina: 1 });
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [ajusteValor, setAjusteValor] = useState<Record<string, string>>({});

  const datos = useMemo(() => {
    return inventario.filter(i => {
      const busq = busqueda.toLowerCase();
      const matchBusq = !busqueda || i.name.toLowerCase().includes(busq) || i.code.toLowerCase().includes(busq);
      const matchCat  = !categoriaFiltro || i.category === categoriaFiltro;
      const matchEst  = !estadoFiltro || getEstado(i) === estadoFiltro;
      return matchBusq && matchCat && matchEst;
    });
  }, [inventario, busqueda, categoriaFiltro, estadoFiltro]);

  async function guardarAjuste(item: InventarioItem) {
    const nuevoStock = Number(ajusteValor[item.code]);
    if (isNaN(nuevoStock)) return;
    const diff = nuevoStock - item.stock_actual;
    if (diff === 0) { setAjustando(null); return; }

    try {
      const tipo = diff > 0 ? 'RECEPCION' : 'AJUSTE';
      await guardarRegistro({
        fecha: hoy(),
        tipo,
        producto_code: item.code,
        producto_name: item.name,
        cantidad_unidades: Math.abs(diff),
        total_unidades: Math.abs(diff),
        contenido_por_unidad: 1,
        observaciones: 'Ajuste manual desde inventario',
        recibido_por: '',
      });
      toast.success(`Ajuste guardado para ${item.name}`);
      recargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al ajustar');
    } finally {
      setAjustando(null);
    }
  }

  const columns = useMemo<ColumnDef<InventarioItem>[]>(() => [
    {
      accessorKey: 'code',
      header: 'Código',
      cell: ({ getValue }) => <span className="font-mono text-xs text-slate-500">{getValue() as string}</span>,
    },
    {
      accessorKey: 'category',
      header: 'Categoría',
      cell: ({ getValue }) => <BadgeCategoria category={getValue() as string} />,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <button className="flex items-center gap-1 hover:text-slate-800" onClick={() => column.toggleSorting()}>
          Producto <ArrowUpDown size={12} />
        </button>
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-slate-800 text-sm">{row.original.name}</div>
          {row.original.supplier && <div className="text-xs text-slate-400">{row.original.supplier}</div>}
        </div>
      ),
    },
    {
      accessorKey: 'unit',
      header: 'Unidad',
      cell: ({ getValue }) => <span className="text-xs text-slate-500">{getValue() as string || '—'}</span>,
    },
    {
      accessorKey: 'total_recibido',
      header: ({ column }) => (
        <button className="flex items-center gap-1 hover:text-slate-800 ml-auto" onClick={() => column.toggleSorting()}>
          Recibido <ArrowUpDown size={12} />
        </button>
      ),
      cell: ({ getValue }) => <span className="font-mono text-sm text-right block">{formatNumero(getValue() as number)}</span>,
    },
    {
      accessorKey: 'total_consumido',
      header: 'Consumido',
      cell: ({ getValue }) => <span className="font-mono text-sm text-right block text-red-600">{formatNumero(getValue() as number)}</span>,
    },
    {
      accessorKey: 'stock_actual',
      header: ({ column }) => (
        <button className="flex items-center gap-1 hover:text-slate-800 ml-auto" onClick={() => column.toggleSorting()}>
          Stock <ArrowUpDown size={12} />
        </button>
      ),
      cell: ({ row }) => {
        const item = row.original;
        const isEdit = ajustando === item.code;
        if (isEdit) {
          return (
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="any"
                defaultValue={item.stock_actual}
                onChange={e => setAjusteValor(v => ({ ...v, [item.code]: e.target.value }))}
                className="w-20 px-1 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') guardarAjuste(item); if (e.key === 'Escape') setAjustando(null); }}
              />
              <button onClick={() => guardarAjuste(item)} className="text-xs text-blue-600 font-medium hover:underline">OK</button>
            </div>
          );
        }
        return (
          <button
            title="Clic para ajustar"
            onClick={() => { setAjustando(item.code); setAjusteValor(v => ({ ...v, [item.code]: String(item.stock_actual) })); }}
            className="font-mono font-semibold text-sm hover:bg-blue-50 hover:text-blue-700 rounded px-1 transition-colors"
          >
            {formatNumero(item.stock_actual)}
          </button>
        );
      },
    },
    {
      accessorKey: 'promedio_semanal',
      header: 'Prom/Sem.',
      cell: ({ getValue }) => <span className="font-mono text-xs text-slate-500 text-right block">{formatNumero(getValue() as number, 1)}</span>,
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: ({ row }) => <BadgeEstado estado={getEstado(row.original)} />,
    },
  ], [ajustando, ajusteValor]);

  const table = useReactTable({
    data: datos,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function handleExport() {
    exportarExcel(datos.map(i => ({
      Código: i.code, Categoría: i.category, Producto: i.name, Proveedor: i.supplier || '',
      Unidad: i.unit || '', Recibido: i.total_recibido, Consumido: i.total_consumido,
      'Stock Actual': i.stock_actual, 'Stock Min': i.stock_min, Estado: getEstado(i),
    })), 'inventario');
  }

  return (
    <div>
      <Header
        title="Inventario"
        subtitle={`${inventario.length} productos totales`}
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={recargar} size="sm">Actualizar</Button>
            <Button variant="outline" icon={<Download size={15} />} onClick={handleExport} size="sm">Exportar Excel</Button>
          </>
        }
      />

      <Card className="!p-0 overflow-hidden">
        {/* Filtros */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o código..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoriaFiltro('')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${!categoriaFiltro ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              Todas
            </button>
            {Object.entries(CATEGORIAS).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setCategoriaFiltro(categoriaFiltro === key ? '' : key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${categoriaFiltro === key ? `${cat.bg} ${cat.text} ${cat.border}` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <select
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.filter(Boolean).map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando inventario...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(h => (
                      <th key={h.id} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-slate-400">Sin productos que mostrar</td></tr>
                ) : table.getRowModel().rows.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-slate-50 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
          Mostrando {datos.length} de {inventario.length} productos · Haz clic en el stock para ajustarlo manualmente
        </div>
      </Card>
    </div>
  );
}
