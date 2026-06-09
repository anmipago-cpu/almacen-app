import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Save, RotateCcw, Database } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { ComboboxProducto } from '../components/ui/Combobox';
import { useProductos } from '../hooks/useProductos';
import { useRegistros } from '../hooks/useRegistros';
import { useSearchContext } from '../context/SearchContext';
import { supabase } from '../lib/supabase';
import { hoy, formatNumero } from '../lib/utils';
import type { Producto, Registro } from '../types';

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
  const [loteError, setLoteError] = useState('');
  const [bulkItems, setBulkItems] = useState<Omit<Registro, 'id' | 'created_at'>[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkName, setBulkName] = useState('');
  const [importing, setImporting] = useState(false);

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
    if (productoSeleccionado.requires_lot && !data.lote?.trim()) {
      setLoteError('Este producto requiere número de lote para trazabilidad.');
      return;
    }
    setLoteError('');
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

  function parseCsvRecepciones(text: string) {
    const rows = text.split(/\r?\n/).filter(Boolean);
    if (!rows.length) return [];
    const headers = rows[0].split(',').map(header => header.trim().toLowerCase());
    return rows.slice(1).map(line => {
      const values = line.split(',').map(value => value.trim());
      const record: Record<string, string> = {};
      headers.forEach((field, index) => { record[field] = values[index] || ''; });
      const productoCode = record.producto_code || record.code || record.codigo || '';
      const found = productos.find(prod => prod.code === productoCode);
      return {
        fecha: record.fecha || hoy(),
        tipo: 'RECEPCION' as const,
        producto_code: productoCode,
        producto_name: record.producto_name || record.name || found?.name || '',
        lote: record.lote || '',
        pallet: record.po || record.pallet || '',
        proveedor: record.proveedor || found?.supplier || '',
        recibido_por: record.recibido_por || record.recibidor || '',
        cantidad_unidades: Number(record.cantidad_recibida || record.cantidad || record.cantidad_unidades || 0),
        contenido_por_unidad: Number(record.contenido_por_unidad || record.contenido || 1),
        total_unidades: Number(record.cantidad_recibida || record.cantidad || 0) * Number(record.contenido_por_unidad || record.contenido || 1),
        observaciones: record.observaciones || record.observacion || '',
      };
    });
  }

  async function handleBulkFile(event: ChangeEvent<HTMLInputElement>) {
    setBulkErrors([]);
    setBulkItems([]);
    const file = event.target.files?.[0];
    if (!file) return;
    setBulkName(file.name);
    setImporting(true);

    try {
      const text = await file.text();
      const parsed = parseCsvRecepciones(text);
      const errors: string[] = [];
      const valid: Omit<Registro, 'id' | 'created_at'>[] = [];
      const codeCounts: Record<string, number> = {};

      parsed.forEach((item, index) => {
        if (!item.producto_code) {
          errors.push(`Fila ${index + 2}: falta producto_code`);
        }
        if (!item.producto_name) {
          errors.push(`Fila ${index + 2}: falta producto_name o el código de producto no existe`);
        }
        if (!item.recibido_por) {
          errors.push(`Fila ${index + 2}: falta recibido_por`);
        }
        if (!(item.cantidad_unidades > 0)) {
          errors.push(`Fila ${index + 2}: cantidad_recibida debe ser mayor que 0`);
        }
        if (!(item.contenido_por_unidad > 0)) {
          errors.push(`Fila ${index + 2}: contenido_por_unidad debe ser mayor que 0`);
        }
        const prod = productos.find(p => p.code === item.producto_code);
        if (prod?.requires_lot && !item.lote?.trim()) {
          errors.push(`Fila ${index + 2}: "${prod.name}" requiere lote — columna lote vacía`);
        }
        if (item.producto_code) {
          codeCounts[item.producto_code] = (codeCounts[item.producto_code] || 0) + 1;
        }
        valid.push(item);
      });

      Object.entries(codeCounts).forEach(([code, count]) => {
        if (count > 1) {
          errors.push(`Código repetido en CSV: ${code}`);
        }
      });

      setBulkItems(valid);
      setBulkErrors(errors);
      if (!errors.length) {
        toast.success(`${valid.length} recepciones listas para importar`);
      }
    } catch (error: unknown) {
      setBulkErrors([error instanceof Error ? error.message : 'Error al procesar el archivo']);
    } finally {
      setImporting(false);
    }
  }

  async function importBulkRecepciones() {
    if (!bulkItems.length) {
      toast.error('No hay recepciones válidas para importar.');
      return;
    }
    setImporting(true);
    try {
      const { error } = await supabase.from('registros').insert(bulkItems);
      if (error) throw error;
      toast.success(`${bulkItems.length} recepciones importadas correctamente.`);
      setBulkItems([]);
      setBulkName('');
      setBulkErrors([]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al importar recepciones');
    } finally {
      setImporting(false);
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
              label={productoSeleccionado?.requires_lot ? 'Lote *' : 'Lote'}
              placeholder="Ej: L-12345"
              hint={productoSeleccionado?.requires_lot ? 'Requerido para este producto' : undefined}
              error={loteError}
              {...register('lote', { onChange: () => setLoteError('') })}
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
                setLoteError('');
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

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Carga masiva de recepciones</h2>
          <p className="text-sm text-slate-500">Importa un CSV con los registros de recepciones ya efectuadas.</p>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Archivo CSV</label>
          <input type="file" accept=".csv" onChange={handleBulkFile} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
            Columnas esperadas: <strong>producto_code, producto_name, fecha, recibido_por, cantidad_recibida, contenido_por_unidad</strong><br />
            Opcionales: <strong>po, lote, proveedor, observaciones</strong>
          </div>
          {bulkName && <p className="text-sm text-slate-500">Archivo: {bulkName}</p>}
          {bulkErrors.length > 0 && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">Errores</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {bulkErrors.map((error, index) => <li key={index}>{error}</li>)}
              </ul>
            </div>
          )}
          {bulkItems.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>{bulkItems.length} recepciones listas para importar.</p>
              <Button variant="primary" icon={<Database size={16} />} onClick={importBulkRecepciones} loading={importing}>
                Importar recepciones
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
