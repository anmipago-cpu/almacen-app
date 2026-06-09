import { useMemo } from 'react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeCategoria, BadgeEstado } from '../components/ui/Badge';
import { useInventario } from '../hooks/useInventario';
import { formatNumero, exportarExcel } from '../lib/utils';
import type { InventarioItem } from '../types';
import { Download } from 'lucide-react';
function getSemaforo(item: InventarioItem) {
  if (item.stock_actual <= 0) return 'AGOTADO';
  const semanas = item.semanas_restantes ?? (item.promedio_consumo_semanal > 0 ? item.stock_actual / item.promedio_consumo_semanal : Infinity);
  if (semanas < 1) return 'ROJO';
  if (semanas <= 3) return 'AMARILLO';
  return 'VERDE';
}

export function Alarmas() {
  const { inventario, loading, recargar } = useInventario();

  const datos = useMemo(() => {
    return [...inventario].sort((a, b) => {
      const aScore = a.stock_actual <= 0 ? -1 : (a.semanas_restantes ?? (a.promedio_consumo_semanal > 0 ? a.stock_actual / a.promedio_consumo_semanal : 999));
      const bScore = b.stock_actual <= 0 ? -1 : (b.semanas_restantes ?? (b.promedio_consumo_semanal > 0 ? b.stock_actual / b.promedio_consumo_semanal : 999));
      return aScore - bScore;
    });
  }, [inventario]);

  function handleExport() {
    exportarExcel(datos.map(item => ({
      Código: item.code,
      Nombre: item.name,
      Categoría: item.category,
      Proveedor: item.supplier || '',
      'Stock actual': item.stock_actual,
      'Promedio semanal': item.promedio_consumo_semanal,
      'Semanas restantes': item.semanas_restantes ?? '',
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
            <p className="text-sm font-medium text-red-700">Rojo</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{inventario.filter(i => getSemaforo(i) === 'ROJO').length}</p>
            <p className="text-sm text-slate-500">Menos de 1 semana</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-700">Amarillo</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{inventario.filter(i => getSemaforo(i) === 'AMARILLO').length}</p>
            <p className="text-sm text-slate-500">Entre 1 y 3 semanas</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-700">Verde</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{inventario.filter(i => getSemaforo(i) === 'VERDE').length}</p>
            <p className="text-sm text-slate-500">Más de 3 semanas</p>
          </div>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Listado de alarmas</h2>
            <p className="text-sm text-slate-500">Ordenado por urgencia.</p>
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
                  {['Código', 'Nombre', 'Categoría', 'Stock actual', 'Promedio sem.', 'Semanas restantes', 'Estado'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500">No hay alarmas para mostrar.</td></tr>
                ) : datos.map((item, index) => (
                  <tr key={item.code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 font-mono text-slate-700">{item.code}</td>
                    <td className="px-4 py-3 text-slate-900">{item.name}</td>
                    <td className="px-4 py-3"><BadgeCategoria category={item.category} /></td>
                    <td className="px-4 py-3 font-mono text-slate-700">{formatNumero(item.stock_actual)}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{formatNumero(item.promedio_consumo_semanal, 1)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.semanas_restantes !== undefined ? formatNumero(item.semanas_restantes, 1) : 'N/A'}</td>
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
