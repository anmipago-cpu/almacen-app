import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Save, RotateCcw } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { ComboboxProducto } from '../components/ui/Combobox';
import { useProductos } from '../hooks/useProductos';
import { useRegistros } from '../hooks/useRegistros';
import { useSearchContext } from '../context/SearchContext';
import { hoy, formatNumero } from '../lib/utils';
import type { Producto } from '../types';

interface FormData {
  fecha: string;
  recibido_por: string;
  po: string;
  lote: string;
  cantidad_recibida: number;
  contenido_por_unidad: number;
  observaciones: string;
}

export function Recepcion() {
  const { productos, loading: loadingProd } = useProductos();
  const { guardarRegistro } = useRegistros({ porPagina: 1 });
  const { selectedProduct, setSelectedProduct } = useSearchContext();
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [productoError, setProductoError] = useState('');

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      fecha: hoy(),
      recibido_por: '',
      po: '',
      lote: '',
      cantidad_recibida: 1,
      contenido_por_unidad: 1,
      observaciones: '',
    }
  });

  useEffect(() => {
    if (selectedProduct && selectedProduct.code !== productoSeleccionado?.code) {
      setProductoSeleccionado(selectedProduct);
      setValue('contenido_por_unidad', selectedProduct.unit_content ?? 1);
    }
  }, [selectedProduct, productoSeleccionado?.code, setValue]);

  const cantidad = watch('cantidad_recibida') || 0;
  const contenido = watch('contenido_por_unidad') || 1;
  const totalUnidades = Number(cantidad) * Number(contenido);

  function limpiarFormulario() {
    setProductoSeleccionado(null);
    setProductoError('');
    setSelectedProduct(null);
    reset({
      fecha: hoy(),
      recibido_por: '',
      po: '',
      lote: '',
      cantidad_recibida: 1,
      contenido_por_unidad: 1,
      observaciones: '',
    });
  }

  async function onSubmit(data: FormData) {
    if (!productoSeleccionado) {
      setProductoError('Selecciona un producto');
      return;
    }

    setGuardando(true);
    try {
      await guardarRegistro({
        fecha: data.fecha,
        tipo: 'RECEPCION',
        producto_code: productoSeleccionado.code,
        producto_name: productoSeleccionado.name,
        lote: data.lote,
        pallet: data.po,
        proveedor: productoSeleccionado.supplier,
        recibido_por: data.recibido_por,
        cantidad_unidades: Number(data.cantidad_recibida),
        total_unidades: totalUnidades,
        contenido_por_unidad: Number(data.contenido_por_unidad) || 1,
        observaciones: data.observaciones,
      });

      toast.success(`Recepción guardada: ${productoSeleccionado.name} — ${formatNumero(totalUnidades)} ${productoSeleccionado.unit || 'unidades'}`);
      limpiarFormulario();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la recepción');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Header
        title="Registro de Recepciones"
        subtitle="Registra ingresos con unidad natural y total en unidades base."
      />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Fecha"
              type="date"
              {...register('fecha', { required: 'Requerido' })}
              error={errors.fecha?.message}
            />
            <Input
              label="Recibido por"
              placeholder="Nombre del responsable"
              {...register('recibido_por', { required: 'Requerido' })}
              error={errors.recibido_por?.message}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="PO / Número de orden"
              placeholder="Ej: PO-2024-001"
              {...register('po')}
            />
            <Input
              label="Lote"
              placeholder="Ej: L-12345"
              {...register('lote')}
            />
          </div>

          <div>
            <ComboboxProducto
              label="Producto"
              productos={productos}
              value={productoSeleccionado}
              onChange={(producto) => {
                setProductoSeleccionado(producto);
                setSelectedProduct(producto);
                setProductoError('');
                if (producto) {
                  setValue('contenido_por_unidad', producto.unit_content ?? 1);
                }
              }}
              disabled={loadingProd}
              error={productoError}
            />
          </div>

          {productoSeleccionado && (
            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Código</p>
                <p className="font-mono font-semibold text-slate-900">{productoSeleccionado.code}</p>
              </div>
              <div>
                <p className="text-slate-500">Proveedor</p>
                <p className="font-semibold text-slate-900">{productoSeleccionado.supplier || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Presentación estándar</p>
                <p className="font-semibold text-slate-900">{productoSeleccionado.presentation || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Unidad de conteo</p>
                <p className="font-semibold text-slate-900">{productoSeleccionado.unit || 'UNIDAD'}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Cantidad recibida"
              type="number"
              min={0.001}
              step="any"
              {...register('cantidad_recibida', { required: 'Requerido', min: { value: 0.001, message: 'Mayor a 0' } })}
              error={errors.cantidad_recibida?.message}
            />
            <Input
              label="Contenido por unidad"
              type="number"
              min={0.001}
              step="any"
              {...register('contenido_por_unidad', { required: 'Requerido', min: { value: 0.001, message: 'Mayor a 0' } })}
              error={errors.contenido_por_unidad?.message}
            />
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-sm text-slate-600">Total en unidades base</p>
            <p className="mt-2 text-4xl font-bold text-emerald-700 font-mono">{formatNumero(totalUnidades)}</p>
          </div>

          <Textarea
            label="Observaciones"
            placeholder="Notas sobre la recepción..."
            rows={4}
            {...register('observaciones')}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" loading={guardando} icon={<Save size={16} />} className="flex-1">
              Guardar Recepción
            </Button>
            <Button type="button" variant="outline" icon={<RotateCcw size={16} />} onClick={limpiarFormulario}>
              Limpiar formulario
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
