import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Select } from '../components/ui/Input';
import { ComboboxProducto } from '../components/ui/Combobox';
import { useProductos } from '../hooks/useProductos';
import { useInventario } from '../hooks/useInventario';
import { useRegistros } from '../hooks/useRegistros';
import { hoy, formatNumero } from '../lib/utils';
import type { Producto } from '../types';

interface FormData {
  fecha: string;
  registrado_por: string;
  lote: string;
  metodo: string;
  cantidad: number;
  observaciones: string;
}

const METODOS = [
  { value: 'CONSUMO',    label: 'Consumo Directo',     tipo: 'CONSUMO'    as const },
  { value: 'INVENTARIO', label: 'Inventario Físico',    tipo: 'AJUSTE'     as const },
  { value: 'AJUSTE',     label: 'Ajuste Manual',        tipo: 'AJUSTE'     as const },
  { value: 'DEVOLUCION', label: 'Devolución',           tipo: 'DEVOLUCION' as const },
];

export function Consumo() {
  const { productos, loading: loadingProd } = useProductos();
  const { inventario } = useInventario();
  const { guardarRegistro } = useRegistros({ porPagina: 1 });
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [productoError, setProductoError] = useState('');

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      fecha: hoy(),
      registrado_por: '',
      lote: '',
      metodo: 'CONSUMO',
      cantidad: 1,
      observaciones: '',
    }
  });

  const metodoActual = watch('metodo');
  const cantidadActual = Number(watch('cantidad')) || 0;

  const stockActual = productoSeleccionado
    ? inventario.find(i => i.code === productoSeleccionado.code)?.stock_actual ?? 0
    : 0;

  const metodoConfig = METODOS.find(m => m.value === metodoActual) || METODOS[0];
  const esDevolucion = metodoActual === 'DEVOLUCION';
  const esInventario = metodoActual === 'INVENTARIO';

  const stockResultante = esDevolucion
    ? stockActual + cantidadActual
    : esInventario
      ? cantidadActual
      : stockActual - cantidadActual;

  const ajusteInventario = esInventario ? cantidadActual - stockActual : null;

  function limpiar() {
    setProductoSeleccionado(null);
    setProductoError('');
    reset({
      fecha: hoy(),
      registrado_por: '',
      lote: '',
      metodo: 'CONSUMO',
      cantidad: 1,
      observaciones: '',
    });
  }

  async function onSubmit(data: FormData) {
    if (!productoSeleccionado) {
      setProductoError('Selecciona un producto');
      return;
    }

    let totalUnidades = cantidadActual;
    if (esInventario) {
      totalUnidades = Math.abs(ajusteInventario!);
    }

    let tipoFinal = metodoConfig.tipo;
    if (esInventario && ajusteInventario !== null && ajusteInventario > 0) {
      tipoFinal = 'AJUSTE';
    }

    setGuardando(true);
    try {
      await guardarRegistro({
        fecha: data.fecha,
        tipo: tipoFinal,
        producto_code: productoSeleccionado.code,
        producto_name: productoSeleccionado.name,
        lote: data.lote || null as unknown as string,
        proveedor: productoSeleccionado.supplier,
        recibido_por: data.registrado_por,
        cantidad_unidades: totalUnidades,
        total_unidades: totalUnidades,
        contenido_por_unidad: 1,
        observaciones: `${metodoConfig.label}${data.observaciones ? ': ' + data.observaciones : ''}`,
      });

      toast.success(`Registrado: ${productoSeleccionado.name} — ${formatNumero(totalUnidades)} ${productoSeleccionado.unit || 'unidades'}`);
      limpiar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  const cantidadLabel = esInventario
    ? 'Stock contado físicamente'
    : esDevolucion
      ? 'Cantidad a devolver'
      : 'Cantidad consumida';

  return (
    <div className="max-w-2xl">
      <Header
        title="Registrar Consumo"
        subtitle="Registrar salida de materiales del almacén"
      />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fecha *"
              type="date"
              {...register('fecha', { required: 'Requerido' })}
              error={errors.fecha?.message}
            />
            <Input
              label="Registrado por"
              placeholder="Nombre del responsable"
              {...register('registrado_por')}
            />
          </div>

          <Select
            label="Método"
            {...register('metodo')}
          >
            {METODOS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>

          <div>
            <ComboboxProducto
              label="Producto *"
              productos={productos}
              value={productoSeleccionado}
              onChange={(p) => { setProductoSeleccionado(p); setProductoError(''); }}
              disabled={loadingProd}
              error={productoError}
            />
          </div>

          {productoSeleccionado && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Stock actual:</span>
                <span className="font-mono font-bold text-slate-800 text-base">{formatNumero(stockActual)} {productoSeleccionado.unit}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`${cantidadLabel} *`}
              type="number"
              min={0}
              step="any"
              {...register('cantidad', { required: 'Requerido', min: { value: 0, message: 'No puede ser negativo' } })}
              error={errors.cantidad?.message}
            />
            <Input
              label="Lote (opcional)"
              placeholder="Ej: LOT-2024-001"
              {...register('lote')}
            />
          </div>

          {/* Stock resultante */}
          {productoSeleccionado && cantidadActual > 0 && (
            <div className={`rounded-xl border p-4 ${
              stockResultante < 0
                ? 'bg-red-50 border-red-200'
                : stockResultante <= productoSeleccionado.stock_min
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-green-50 border-green-200'
            }`}>
              {esInventario && ajusteInventario !== null && (
                <p className="text-xs text-slate-500 mb-2 text-center">
                  Ajuste: {ajusteInventario > 0 ? '+' : ''}{formatNumero(ajusteInventario)} unidades
                </p>
              )}
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-1">Stock resultante</p>
                <p className={`text-4xl font-bold font-mono ${
                  stockResultante < 0 ? 'text-red-700' : stockResultante <= productoSeleccionado.stock_min ? 'text-yellow-700' : 'text-green-700'
                }`}>
                  {formatNumero(stockResultante)}
                </p>
                {productoSeleccionado.unit && <p className="text-sm text-slate-500 mt-1">{productoSeleccionado.unit}</p>}
              </div>
              {stockResultante < 0 && (
                <div className="flex items-center gap-2 mt-3 p-2 bg-red-100 rounded-lg">
                  <AlertTriangle size={16} className="text-red-600 shrink-0" />
                  <p className="text-sm text-red-700 font-medium">El stock quedaría en negativo. Se guardará de todas formas.</p>
                </div>
              )}
              {stockResultante >= 0 && stockResultante <= productoSeleccionado.stock_min && (
                <div className="flex items-center gap-2 mt-3 p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle size={16} className="text-yellow-600 shrink-0" />
                  <p className="text-sm text-yellow-700 font-medium">Stock quedaría en nivel crítico.</p>
                </div>
              )}
            </div>
          )}

          <Textarea
            label="Observaciones (opcional)"
            placeholder="Notas adicionales..."
            rows={2}
            {...register('observaciones')}
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={guardando} icon={<Save size={16} />} size="lg" className="flex-1">
              Guardar Registro
            </Button>
            <Button type="button" variant="outline" icon={<RotateCcw size={16} />} onClick={limpiar}>
              Limpiar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
