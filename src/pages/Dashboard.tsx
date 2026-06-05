import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, AlertTriangle, TrendingDown, XCircle, PackagePlus, ClipboardList, Database } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { StatCard, Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BadgeEstado, BadgeCategoria } from '../components/ui/Badge';
import { useInventario } from '../hooks/useInventario';
import { getEstado } from '../types';
import { formatNumero } from '../lib/utils';

const STATE_LABELS = [
  { key: 'AGOTADO', title: 'Agotados', icon: XCircle, color: 'gray' },
  { key: 'CRITICO', title: 'Críticos', icon: AlertTriangle, color: 'red' },
  { key: 'BAJO', title: 'Bajos', icon: TrendingDown, color: 'yellow' },
  { key: 'OK', title: 'OK', icon: Boxes, color: 'green' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { inventario, loading } = useInventario();

  const resumen = useMemo(() => {
    const counts = { AGOTADO: 0, CRITICO: 0, BAJO: 0, OK: 0 } as Record<string, number>;
    inventario.forEach(item => {
      const estado = getEstado(item);
      counts[estado] += 1;
    });
    return counts;
  }, [inventario]);

  const urgentes = useMemo(() => {
    return [...inventario]
      .sort((a, b) => (a.semanas_restantes ?? 999) - (b.semanas_restantes ?? 999))
      .slice(0, 10);
  }, [inventario]);


  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Estatus rápido del inventario y accesos clave para los módulos principales."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button icon={<PackagePlus size={16} />} onClick={() => navigate('/recepciones')}>
              Nueva Recepción
            </Button>
            <Button variant="success" icon={<Database size={16} />} onClick={() => navigate('/consumo-semanal')}>
              Cargar Consumo Semanal
            </Button>
            <Button variant="outline" icon={<ClipboardList size={16} />} onClick={() => navigate('/inventario-fisico')}>
              Inventario Físico
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Agotados" value={resumen.agotados} icon={<XCircle size={22} />} color="gray" />
        <StatCard title="Críticos" value={resumen.criticos} icon={<AlertTriangle size={22} />} color="red" />
        <StatCard title="Bajos" value={resumen.bajos} icon={<TrendingDown size={22} />} color="yellow" />
        <StatCard title="OK" value={resumen.ok} icon={<Boxes size={22} />} color="green" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Productos urgentes</h2>
              <p className="text-sm text-slate-500">Ordenados por menos semanas restantes.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              Top 10
            </span>
          </div>
          {loading ? (
            <div className="p-6 text-center text-slate-500">Cargando información...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Código', 'Producto', 'Categoría', 'Stock', 'Sem. restantes', 'Estado'].map(header => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {urgentes.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-slate-500">No hay productos urgentes.</td></tr>
                  ) : urgentes.map((item, index) => (
                    <tr key={item.code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-3 font-mono text-slate-700">{item.code}</td>
                      <td className="px-4 py-3 text-slate-900">{item.name}</td>
                      <td className="px-4 py-3"><BadgeCategoria category={item.category} /></td>
                      <td className="px-4 py-3 font-mono text-slate-700">{formatNumero(item.stock_actual)} {item.unit || 'u'}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{item.semanas_restantes !== undefined ? formatNumero(item.semanas_restantes, 1) : 'N/A'}</td>
                      <td className="px-4 py-3"><BadgeEstado estado={getEstado(item)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Indicadores rápidos</h2>
              <p className="text-sm text-slate-500">Monitorea tendencias de consumo y alarmas desde un vistazo.</p>
            </div>
            <div className="grid gap-3">
              {STATE_LABELS.map(item => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><item.icon size={18} /></span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="text-xs text-slate-500">Estatus por categoría</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-slate-900">{resumen[item.key]}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
