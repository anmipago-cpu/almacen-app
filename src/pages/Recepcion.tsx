import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Save, RotateCcw, Database, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { ComboboxProducto } from '../components/ui/Combobox';
import { useProductos } from '../hooks/useProductos';
import { useProveedores } from '../hooks/useProveedores';
import { useRegistros } from '../hooks/useRegistros';
import { useSearchContext } from '../context/SearchContext';
import { supabase } from '../lib/supabase';
import { hoy, formatNumero, formatFecha } from '../lib/utils';
import type { Producto, Registro } from '../types';

interface FormData {
  fecha: string;
  recibido_por: string;
  proveedor: string;
  po: string;
  lote: string;
  cantidad_recibida: number;
  observaciones: string;
}

function getMesActual() {
  const now = new Date();
  return { mes: now.getMonth() + 1, año: now.getFullYear() };
}

function rangoMes(mes: number, año: number) {
  const inicio = `${año}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = new Date(año, mes, 0).getDate();
  const fin = `${año}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  return { inicio, fin };
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function Recepcion() {
  const { productos, loading: loadingProd } = useProductos();
  const { proveedores } = useProveedores();
  const { guardarRegistro } = useRegistros({ porPagina: 1 });
  const [mesFiltro, setMesFiltro] = useState(getMesActual);
  const { inicio, fin } = rangoMes(mesFiltro.mes, mesFiltro.año);
  const { registros: historial, loading: loadingHistorial } = useRegistros({ fechaDesde: inicio, fechaHasta: fin, porPagina: 200 });
  const { selectedProduct, setSelectedProduct } = useSearchContext();
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [productoError, setProductoError] = useState('');
  const [loteError, setLoteError] = useState('');
  const [bulkItems, setBulkItems] = useState<Omit<Registro, 'id' | 'created_at'>[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [_bulkName, setBulkName] = useState('');
  const [bulkResponsable, setBulkResponsable] = useState('');
  const [bulkFecha, setBulkFecha] = useState(hoy());
  const [importing, setImporting] = useState(false);

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      fecha: hoy(),
      recibido_por: '',
      proveedor: '',
      po: '',
      lote: '',
      cantidad_recibida: 1,
      observaciones: '',
    }
  });

  useEffect(() => {
    if (selectedProduct && selectedProduct.code !== productoSeleccionado?.code) {
      setProductoSeleccionado(selectedProduct);
      setValue('proveedor', selectedProduct.supplier || '');
    }
  }, [selectedProduct, productoSeleccionado?.code, setValue]);

  const cantidad = watch('cantidad_recibida') || 0;
  const contenidoProducto = productoSeleccionado?.unit_content ?? 1;
  const totalUnidades = Number(cantidad) * contenidoProducto;

  function limpiarFormulario() {
    setProductoSeleccionado(null);
    setProductoError('');
    setLoteError('');
    setSelectedProduct(null);
    reset({
      fecha: hoy(),
      recibido_por: '',
      proveedor: '',
      po: '',
      lote: '',
      cantidad_recibida: 1,
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
        producto_code: productoSeleccionado.code,
        producto_name: productoSeleccionado.name,
        lote: data.lote || undefined,
        po: data.po || undefined,
        proveedor: data.proveedor,
        recibido_por: data.recibido_por,
        cantidad_unidad_natural: Number(data.cantidad_recibida),
        unidad_natural: productoSeleccionado.unit || 'UNIDAD',
        contenido_por_unidad: contenidoProducto,
        total_unidades_base: totalUnidades,
        observaciones: data.observaciones || undefined,
      });

      toast.success(`Recepción guardada: ${productoSeleccionado.name} — ${formatNumero(totalUnidades)} ${productoSeleccionado.unit_base || productoSeleccionado.unit || 'unidades'}`);
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
    const sep = rows[0].includes(';') ? ';' : ',';
    const headers = rows[0].split(sep).map(h => h.trim().toLowerCase());
    const tieneEncabezado = headers.some(h => ['producto_code', 'codigo', 'code', 'cantidad'].includes(h));
    const filas = tieneEncabezado ? rows.slice(1) : rows;
    return filas.map(line => {
      const values = line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''));
      const record: Record<string, string> = {};
      if (tieneEncabezado) {
        headers.forEach((field, i) => { record[field] = values[i] || ''; });
      } else {
        record.producto_code = values[0] || '';
        record.cantidad_recibida = values[1] || '0';
        record.lote = values[2] || '';
        record.recibido_por = values[3] || '';
      }
      const productoCode = record.producto_code || record.code || record.codigo || '';
      const found = productos.find(prod => prod.code === productoCode);
      const parsearNum = (v: string) => Number((v || '0').replace(',', '.'));
      const cantidad = parsearNum(record.cantidad_recibida || record.cantidad || '0');
      const contenido = parsearNum(record.contenido_por_unidad || record.contenido || String(found?.unit_content ?? 1));
      return {
        fecha: record.fecha || hoy(),
        producto_code: productoCode,
        producto_name: record.producto_name || record.name || found?.name || '',
        lote: record.lote || undefined,
        po: record.po || record.pallet || undefined,
        proveedor: record.proveedor || found?.supplier || '',
        recibido_por: record.recibido_por || record.recibidor || '',
        cantidad_unidad_natural: cantidad,
        unidad_natural: found?.unit || 'UNIDAD',
        contenido_por_unidad: contenido,
        total_unidades_base: cantidad * contenido,
        observaciones: record.observaciones || undefined,
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
        const rowNum = index + 2;
        let rowErrors = 0;

        if (!item.producto_code) {
          errors.push(`Fila ${rowNum}: falta código de producto`);
          rowErrors++;
        } else if (!item.producto_name) {
          errors.push(`Fila ${rowNum}: código "${item.producto_code}" no existe en el catálogo — verifica que esté creado`);
          rowErrors++;
        }
        if (!(item.cantidad_unidad_natural > 0)) {
          errors.push(`Fila ${rowNum}: cantidad debe ser mayor que 0`);
          rowErrors++;
        }
        const prod = productos.find(p => p.code === item.producto_code);
        if (prod?.requires_lot && !item.lote?.trim()) {
          errors.push(`Fila ${rowNum}: "${prod.name}" requiere número de lote`);
          rowErrors++;
        }
        if (item.producto_code) {
          codeCounts[item.producto_code] = (codeCounts[item.producto_code] || 0) + 1;
        }
        if (rowErrors === 0) valid.push(item);
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
    if (!bulkResponsable.trim()) {
      toast.error('Ingresa el nombre del responsable antes de importar.');
      return;
    }
    setImporting(true);
    try {
      const payload = bulkItems.map(item => ({
        ...item,
        fecha: item.fecha || bulkFecha,
        recibido_por: item.recibido_por || bulkResponsable,
      }));
      const { error } = await supabase.from('recepciones').insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} recepciones importadas correctamente.`);
      setBulkItems([]);
      setBulkName('');
      setBulkErrors([]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error);
      toast.error(msg || 'Error al importar recepciones');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <Header
        title="Registro de Recepciones"
        subtitle="Registra ingresos con unidad natural y total en unidades base."
      />

      <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2 items-start">
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Fecha y Responsable */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Fecha"
              type="date"
              {...register('fecha', { required: 'Requerido' })}
              error={errors.fecha?.message}
            />
            <Input
              label="Recibido por *"
              placeholder="Nombre del responsable"
              {...register('recibido_por', { required: 'Requerido' })}
              error={errors.recibido_por?.message}
            />
          </div>

          {/* Proveedor */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Proveedor *</label>
            <select
              {...register('proveedor', { required: 'Selecciona un proveedor' })}
              className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Selecciona proveedor</option>
              {proveedores.map(p => (
                <option key={p.code} value={p.name}>{p.name}</option>
              ))}
              <option value="Otro / No identificado">Otro / No identificado</option>
            </select>
            {errors.proveedor && <p className="text-xs text-red-600">{errors.proveedor.message}</p>}
            {proveedores.length === 0 && (
              <p className="text-xs text-amber-600">
                No hay proveedores registrados. Ve a <strong>Proveedores</strong> y créalos primero, o selecciona "Otro / No identificado".
              </p>
            )}
          </div>

          {/* Producto */}
          <div>
            <ComboboxProducto
              label="Producto *"
              productos={productos.filter(p => p.active !== false)}
              value={productoSeleccionado}
              onChange={(producto) => {
                setProductoSeleccionado(producto);
                setSelectedProduct(producto);
                setProductoError('');
                setLoteError('');
                if (producto) {
                  setValue('proveedor', producto.supplier || '');
                }
              }}
              disabled={loadingProd}
              error={productoError}
            />
          </div>

          {/* Info del producto seleccionado */}
          {productoSeleccionado && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 overflow-hidden text-sm">
              {/* Banner principal: unidad de conteo */}
              <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-3">
                <Package size={16} className="text-blue-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-blue-100 text-xs">Ingresa la cantidad en:</p>
                  <p className="text-white font-bold text-base leading-tight">
                    {productoSeleccionado.unit || 'UNIDAD'}
                    <span className="text-blue-200 font-normal text-xs ml-2">(unidad de conteo)</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-blue-200 text-xs">1 {productoSeleccionado.unit || 'UNIDAD'} =</p>
                  <p className="text-white font-semibold">{productoSeleccionado.unit_content ?? 1} {productoSeleccionado.unit_base || 'unidades'}</p>
                </div>
              </div>
              {/* Detalle */}
              <div className="grid grid-cols-2 gap-3 p-3">
                <div>
                  <p className="text-blue-500 text-xs">Presentación</p>
                  <p className="font-medium text-blue-900 text-xs mt-0.5">{productoSeleccionado.presentation || '—'}</p>
                </div>
                <div>
                  <p className="text-blue-500 text-xs">Unidad base</p>
                  <p className="font-medium text-blue-900 text-xs mt-0.5">{productoSeleccionado.unit_base || '—'}</p>
                </div>
              </div>
              {productoSeleccionado.requires_lot && (
                <div className="mx-3 mb-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800 font-semibold flex items-center gap-2">
                  <span className="text-red-500">⚠</span> Lote OBLIGATORIO — este producto requiere número de lote
                </div>
              )}
            </div>
          )}

          {/* PO y Lote */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="PO / Número de orden"
              placeholder="Ej: PO-2024-001"
              {...register('po')}
            />
            <Input
              label={productoSeleccionado?.requires_lot ? 'Lote *' : 'Lote'}
              placeholder="Ej: L-12345"
              hint={productoSeleccionado?.requires_lot ? 'Obligatorio para este producto' : 'Opcional'}
              error={loteError}
              {...register('lote', { onChange: () => setLoteError('') })}
            />
          </div>

          {/* Cantidad */}
          <div>
            <Input
              label={
                productoSeleccionado
                  ? `Cantidad recibida en ${productoSeleccionado.unit || 'unidades'} (unidad de conteo) *`
                  : 'Cantidad recibida *'
              }
              hint={
                productoSeleccionado
                  ? `Ingresa cuántos ${productoSeleccionado.unit || 'unidades'} llegaron. El sistema convierte a ${productoSeleccionado.unit_base || 'unidades base'} automáticamente.`
                  : undefined
              }
              type="number"
              min={0.001}
              step="any"
              {...register('cantidad_recibida', { required: 'Requerido', min: { value: 0.001, message: 'Mayor a 0' } })}
              error={errors.cantidad_recibida?.message}
            />
          </div>

          {/* Total calculado */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total en unidades base</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {Number(cantidad)} {productoSeleccionado?.unit || 'unidades'} × {contenidoProducto} = {formatNumero(totalUnidades)} {productoSeleccionado?.unit_base || ''}
              </p>
            </div>
            <p className="text-4xl font-bold text-emerald-700 font-mono">{formatNumero(totalUnidades)}</p>
          </div>

          <Textarea
            label="Observaciones"
            placeholder="Notas sobre la recepción..."
            rows={3}
            {...register('observaciones')}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" loading={guardando} icon={<Save size={16} />} className="flex-1">
              Guardar Recepción
            </Button>
            <Button type="button" variant="outline" icon={<RotateCcw size={16} />} onClick={limpiarFormulario}>
              Limpiar
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Carga masiva de recepciones</h2>
          <p className="text-sm text-slate-500">Importa un CSV. Solo se cargan filas cuyo código exista en el catálogo.</p>
        </div>
        <div className="space-y-4">

          {/* Instrucciones */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Formato del archivo CSV:</p>
            <p className="font-mono text-xs bg-blue-100 rounded px-2 py-1">producto_code, cantidad_recibida, lote, recibido_por</p>
            <ul className="list-disc list-inside text-blue-700 space-y-0.5 text-xs mt-1">
              <li><strong>producto_code</strong>: código exacto del catálogo (ej: SP-01-001)</li>
              <li><strong>cantidad_recibida</strong>: número de cajas/unidades de conteo</li>
              <li><strong>lote</strong>: obligatorio para Empaque Primario (PP), vacío para los demás</li>
              <li><strong>recibido_por</strong>: opcional si llenas el campo "Responsable" abajo</li>
            </ul>
          </div>

          {/* Responsable y fecha globales */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Responsable *"
              placeholder="Nombre de quien recibe (aplica a todas las filas)"
              value={bulkResponsable}
              onChange={e => setBulkResponsable(e.target.value)}
            />
            <Input
              label="Fecha"
              type="date"
              value={bulkFecha}
              onChange={e => setBulkFecha(e.target.value)}
            />
          </div>

          {/* Selector de archivo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Archivo CSV</label>
            <input type="file" accept=".csv,.txt" onChange={handleBulkFile} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>

          {/* Errores */}
          {bulkErrors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold mb-2">Filas con problemas (no se importarán):</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {bulkErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {/* Preview */}
          {bulkItems.length > 0 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 font-medium">
                ✓ {bulkItems.length} filas válidas listas para importar
                {bulkErrors.length > 0 && ` · ${bulkErrors.length} omitidas por errores`}
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Código', 'Nombre', 'Cantidad', 'Unidad', 'Total base', 'Lote'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkItems.map((item, i) => {
                      const prod = productos.find(p => p.code === item.producto_code);
                      return (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-1.5 font-mono text-slate-700">{item.producto_code}</td>
                          <td className="px-3 py-1.5 text-slate-900">{item.producto_name}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{item.cantidad_unidad_natural}</td>
                          <td className="px-3 py-1.5 text-slate-500">{item.unidad_natural}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatNumero(item.total_unidades_base, 0)}</td>
                          <td className="px-3 py-1.5 text-slate-500">{item.lote || (prod?.requires_lot ? '⚠' : '—')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button icon={<Database size={16} />} onClick={importBulkRecepciones} loading={importing} disabled={!bulkResponsable.trim()}>
                Importar {bulkItems.length} recepciones
              </Button>
            </div>
          )}
        </div>
      </Card>
      </div>{/* end top grid */}

      {/* Historial del mes — ancho completo */}
      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Historial de recepciones</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {historial.length} {historial.length === 1 ? 'recepción' : 'recepciones'} en {MESES[mesFiltro.mes - 1]} {mesFiltro.año}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMesFiltro(prev => {
                const m = prev.mes === 1 ? 12 : prev.mes - 1;
                const a = prev.mes === 1 ? prev.año - 1 : prev.año;
                return { mes: m, año: a };
              })}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            ><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-slate-700 min-w-[150px] text-center">
              {MESES[mesFiltro.mes - 1]} {mesFiltro.año}
            </span>
            <button
              onClick={() => setMesFiltro(prev => {
                const m = prev.mes === 12 ? 1 : prev.mes + 1;
                const a = prev.mes === 12 ? prev.año + 1 : prev.año;
                return { mes: m, año: a };
              })}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            ><ChevronRight size={16} /></button>
          </div>
        </div>

        {loadingHistorial ? (
          <div className="p-8 text-center text-sm text-slate-400">Cargando...</div>
        ) : historial.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No hay recepciones registradas en {MESES[mesFiltro.mes - 1]} {mesFiltro.año}.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Lote</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Cant. conteo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">U. conteo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">Cant. base</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">U. base</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historial.map((rec, i) => {
                    const prod = productos.find(p => p.code === rec.producto_code);
                    return (
                    <tr key={rec.id ?? i} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">{formatFecha(rec.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">{rec.producto_code}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium max-w-[200px] truncate">{rec.producto_name}</td>
                      <td className="px-4 py-3">
                        {rec.lote
                          ? <span className="inline-flex items-center rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-800">{rec.lote}</span>
                          : <span className="text-slate-300 text-xs">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[130px] truncate">{rec.proveedor || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{formatNumero(rec.cantidad_unidad_natural, 2)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{rec.unidad_natural || prod?.unit || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">{formatNumero(rec.total_unidades_base, 0)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{prod?.unit_base || '—'}</td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Total del mes · {historial.length} recepciones
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {formatNumero(historial.reduce((s, r) => s + (r.cantidad_unidad_natural || 0), 0), 2)}
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatNumero(historial.reduce((s, r) => s + (r.total_unidades_base || 0), 0), 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>

      </div>{/* end outer space-y */}
    </div>
  );
}
