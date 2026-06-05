import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, RefreshCw } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BadgeCategoria } from '../components/ui/Badge';
import { useProductos } from '../hooks/useProductos';
import { supabase } from '../lib/supabase';
import { formatNumero, hoy } from '../lib/utils';
import type { InventarioFisicoItem } from '../types';

interface ConteoFila {
  lote: string;
  cantidad: number;
}

export function InventarioFisico() {
  const { productos, recargar } = useProductos();
  const [counts, setCounts] = useState<Record<string, ConteoFila[]>>({});
  const [fecha, setFecha] = useState(hoy());
  const [realizadoPor, setRealizadoPor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productos.length) return;
    const initial: Record<string, ConteoFila[]> = {};
    productos.forEach(product => {
      if (!initial[product.code]) {
        initial[product.code] = [{ lote: '', cantidad: 0 }];
      }
    });
    setCounts(initial);
  }, [productos]);

  const totalRegistrados = useMemo(() => {
    return Object.values(counts).reduce((sum, rows) => sum + rows.reduce((acc, valor) => acc + valor.cantidad, 0), 0);
  }, [counts]);

  function handleCantidad(code: string, index: number, value: number) {
    setCounts(prev => {
      const rows = prev[code] ?? [{ lote: '', cantidad: 0 }];
      const next = [...rows];
      next[index] = { ...next[index], cantidad: value };
      return { ...prev, [code]: next };
    });
  }

  function handleLote(code: string, index: number, lote: string) {
    setCounts(prev => {
      const rows = prev[code] ?? [{ lote: '', cantidad: 0 }];
      const next = [...rows];
      next[index] = { ...next[index], lote };
      return { ...prev, [code]: next };
    });
  }

  function agregarLote(code: string) {
    setCounts(prev => {
      const rows = prev[code] ?? [{ lote: '', cantidad: 0 }];
      return { ...prev, [code]: [...rows, { lote: '', cantidad: 0 }] };
    });
  }

  const productosConConteo = useMemo(() => {
    return productos.filter(product => (counts[product.code] ?? []).some(row => row.cantidad > 0));
  }, [productos, counts]);

  async function guardarInventario() {
    if (!realizadoPor) {
      setError('Ingresa el responsable del inventario.');
      return;
    }
    const entries: InventarioFisicoItem[] = [];
    productos.forEach(product => {
      const rows = counts[product.code] ?? [];
      rows.forEach(row => {
        if (row.cantidad > 0) {
          entries.push({
            fecha,
            realizado_por: realizadoPor,
            producto_code: product.code,
            producto_name: product.name,
            lote: row.lote || undefined,
            cantidad_contada: row.cantidad,
            unidad: product.unit || 'UNIDAD',
            total_unidades_base: row.cantidad * (product.unit_content || 1),
          });
        }
      });
    });

    if (!entries.length) {
      setError('No hay conteos registrados para guardar.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('inventarios_fisicos').insert(entries);
      if (err) throw err;
      setCounts({});
      setRealizadoPor('');
      setError(null);
      await recargar();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar inventario físico.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Header
        title="Inventario Físico"
        subtitle="Registra los recuentos físicos por lote y actualiza el inventario real."
        actions={
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={recargar}>
            Refrescar productos
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Fecha del conteo" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          <Input label="Responsable" value={realizadoPor} onChange={e => setRealizadoPor(e.target.value)} placeholder="Nombre del encargado" />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Resumen</span>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{formatNumero(totalRegistrados, 0)} unidades contabilizadas</p>
              <p className="text-slate-500">Productos con conteo: {productosConConteo.length}</p>
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="mb-5 border-red-200 bg-red-50 text-red-700">
          <p>{error}</p>
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recuento por producto</h2>
            <p className="text-sm text-slate-500">Ingresa cantidades y lote por producto. Agrega líneas si el producto tiene varios lotes.</p>
          </div>
          <Button icon={<Save size={16} />} onClick={guardarInventario} loading={saving}>
            Guardar inventario
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Código', 'Nombre', 'Categoría', 'Lote', 'Cantidad', 'Total base', 'Acción'].map(header => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.map(product => {
                const rows = counts[product.code] ?? [{ lote: '', cantidad: 0 }];
                return rows.map((row, rowIndex) => (
                  <tr key={`${product.code}-${rowIndex}`} className={rowIndex === 0 ? '' : 'bg-slate-50'}>
                    {rowIndex === 0 ? (
                      <>
                        <td rowSpan={rows.length} className="px-4 py-3 font-mono text-slate-700">{product.code}</td>
                        <td rowSpan={rows.length} className="px-4 py-3 text-slate-900">{product.name}</td>
                        <td rowSpan={rows.length} className="px-4 py-3"><BadgeCategoria category={product.category} /></td>
                      </>
                    ) : null}
                    <td className="px-4 py-3">
                      <Input value={row.lote} onChange={e => handleLote(product.code, rowIndex, e.target.value)} placeholder="Lote" />
                    </td>
                    <td className="px-4 py-3">
                      <Input type="number" min={0} value={row.cantidad} onChange={e => handleCantidad(product.code, rowIndex, Number(e.target.value))} />
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{formatNumero(row.cantidad * (product.unit_content || 1), 0)}</td>
                    {rowIndex === 0 ? (
                      <td rowSpan={rows.length} className="px-4 py-3">
                        <Button variant="secondary" icon={<Plus size={16} />} onClick={() => agregarLote(product.code)}>
                          Agregar lote
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
