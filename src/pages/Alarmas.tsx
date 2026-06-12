import { useMemo } from 'react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeCategoria, BadgeEstado } from '../components/ui/Badge';
import { useInventario } from '../hooks/useInventario';
import { useProductos } from '../hooks/useProductos';
import { formatNumero, exportarExcel } from '../lib/utils';
import type { InventarioItem } from '../types';
import { Download } from 'lucide-react';

function getSemaforo(item: InventarioItem) {
  if (item.stock_actual <= 0) return 'AGOTADO';
  const lt = item.lead_time_semanas;
  if (lt && lt > 0 && item.promedio_consumo_semanal > 0) {
    const semanas = item.stock_actual / item.promedio_consumo_semanal;
    if (semanas <= lt) return 'ROJO';
    if (semanas <= lt * 2) return 'AMARILLO';
    return 'VERDE';
  }
  if (item.stock_min > 0 && item.stock_actual <= item.stock_min) return 'ROJO';
  if (item.stock_bajo > 0 && item.stock_actual <= item.stock_bajo) return 'AMARILLO';
  return 'VERDE';
}

function getSemanasLabel(item: InventarioItem): string {
  const lt = item.lead_time_semanas;
  if (lt && lt > 0 && item.promedio_consumo_semanal > 0) {
    return formatNumero(item.stock_actual / item.promedio_consumo_semanal, 1);
  }
  return 'N/A';
}

export function Alarmas() {
  const { inventario, loading, recargar } = useInventario();
  const { productos } = useProductos();

  const leadTimeMap = useMemo(() => {
    const map = new Map<string, number | null>();
    productos.forEach(p => map.set(p.code, p.lead_time_semanas ?? null));
    return map;
  }, [productos]);

  const enriched = useMemo<InventarioItem[]>(() => {
    return inventario.map(item => ({
      ...item,
      lead_time_semanas: leadTimeMap.get(item.code) ?? item.lead_time_semanas,
    }));
  }, [inventario, leadTimeMap]);

  const datos = useMemo(() => {
    return [...enriched].sort((a, b) => {
      const score = (item: InventarioItem) => {
        if (item.stock_actual <= 0) return -1;
        const lt = item.lead_time_semanas;
        if (lt && lt > 0 && item.promedio_consumo_semanal > 0) {
          return item.stock_actual / item.promedio_consumo_semanal;
        }
        return 999;
      };
      return score(a) - score(b);
    });
  }, [enriched]);

  function handleExport() {
    exportarExcel(datos.map(item => ({
      Código: item.code,
      Nombre: item.name,
      Categoría: item.category,
      Proveedor: item.supplier || '',
      'Stock actual': item.stock_actual,
      'Stock mín.': item.stock_min,
      'Stock bajo': item.stock_bajo,
      'Lead time (sem)': item.lead_time_semanas ?? '',
      'Promedio semanal': item.promedio_consumo_semanal,
      'Semanas restantes': item.lead_time_semanas && item.promedio_consumo_semanal > 0
        ? formatNumero(item.stock_actual / item.promedio_consumo_semanal, 1)
        : '',
      Estado: getSemaforo(item),
    })), 'alarmas');
  }

  return (
    <div>
      <Header
        title="Alarmas y Semáforo"
        subtitle="Visualiza los productos más urgentes y su estado de reabastecimiento."
        actions={
          <Button variant="outline" onClick={recargar}>
            Actualizar
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Rojo — Crítico</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{enriched.filter(i => getSemaforo(i) === 'ROJO').length}</p>
            <p className="text-sm text-slate-500">Reabastecer urgente</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-700">Amarillo — Bajo</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{enriched.filter(i => getSemaforo(i) === 'AMARILLO').length}</p>
            <p className="text-sm text-slate-500">Planificar pedido pronto</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-700">Verde — OK</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{enriched.filter(i => getSemaforo(i) === 'VERDE').length}</p>
            <p className="text-sm text-slate-500">Stock suficiente</p>
          </div>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Listado de alarmas</h2>
            <p className="text-sm text-slate-500">
              Semáforo por semanas si tiene lead time; si no, por stock mín./bajo.
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} icon={<Download size={16} />}>Exportar Excel</Button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando alarmas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Código', 'Nombre', 'Categoría', 'Stock actual', 'Stock mín.', 'Stock bajo', 'Lead time', 'Promedio sem.', 'Semanas restantes', 'Estado'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.length === 0 ? (
                  <tr><td colSpan={10} className="p-6 text-center text-slate-500">No hay alarmas para mostrar.</td></tr>
                ) : datos.map((item, index) => (
                  <tr key={item.code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 font-mono text-slate-700">{item.code}</td>
                    <td className="px-4 py-3 text-slate-900">{item.name}</td>
                    <td className="px-4 py-3"><BadgeCategoria category={item.category} /></td>
                    <td className="px-4 py-3 font-mono text-slate-700">{formatNumero(item.stock_actual)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{item.stock_min}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{item.stock_bajo}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{item.lead_time_semanas != null ? `${item.lead_time_semanas} sem` : '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{formatNumero(item.promedio_consumo_semanal, 1)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{getSemanasLabel(item)}</td>
                    <td className="px-4 py-3"><BadgeEstado estado={item.stock_actual <= 0 ? 'AGOTADO' : getSemaforo(item) === 'ROJO' ? 'CRITICO' : getSemaforo(item) === 'AMARILLO' ? 'BAJO' : 'OK'} /></td>
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
