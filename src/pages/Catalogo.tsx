import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, PlusCircle, Database } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { BadgeCategoria } from '../components/ui/Badge';
import { useProductos } from '../hooks/useProductos';
import { useProveedores } from '../hooks/useProveedores';
import { supabase } from '../lib/supabase';
import { CATEGORIAS, type Producto } from '../types';

const UNIDADES = ['CAJA', 'BULTO', 'PALLET', 'UNIDAD', 'ROLLO', 'SET', 'DRUM', 'SACK'];

const EMPTY_FORM = {
  code: '',
  category: '',
  subcategory: '',
  identifier: '',
  name: '',
  description: '',
  supplier: '',
  supplier_code: '',
  manufacturer: '',
  presentation: '',
  unit: 'UNIDAD',
  unit_content: '1',
  unit_base: 'UNIDAD',
  stock_min: '0',
  stock_bajo: '0',
  requires_lot: false,
  active: true,
};

function formatCode(category: string, subcategory: string, identifier: string) {
  const cat = category.trim().toUpperCase();
  const sub = String(subcategory).padStart(2, '0');
  const id = String(identifier).padStart(3, '0');
  if (!cat || !subcategory || !identifier) return '';
  return `${cat}-${sub}-${id}`;
}

export function Catalogo() {
  const { productos, recargar } = useProductos();
  const { proveedores } = useProveedores();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [bulkItems, setBulkItems] = useState<Producto[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkName, setBulkName] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [editando, setEditando] = useState<Record<string, Partial<Producto>>>({});
  const [editingProductCode, setEditingProductCode] = useState<string | null>(null);

  const code = editingProductCode ? form.code : formatCode(form.category, form.subcategory, form.identifier);

  useEffect(() => {
    if (!editingProductCode) {
      setForm(prev => ({ ...prev, code }));
    }
  }, [code, editingProductCode]);

  const filtered = useMemo(() => {
    return productos.filter(p => {
      const query = filter.toLowerCase();
      const matchText = !filter || p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query) || p.supplier?.toLowerCase().includes(query);
      const matchCat = !categoriaFiltro || p.category === categoriaFiltro;
      return matchText && matchCat;
    });
  }, [productos, filter, categoriaFiltro]);

  function handleField(field: keyof typeof EMPTY_FORM, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'supplier') {
      const provider = proveedores.find(p => p.name === value || p.code === value);
      setForm(prev => ({ ...prev, supplier_code: provider?.code || '' }));
    }
  }

  async function createProduct() {
    if (!form.name || !form.category || !form.unit) {
      toast.error('Completa todos los campos obligatorios antes de guardar.');
      return;
    }
    const payload: Producto = {
      code,
      name: form.name,
      description: form.description,
      category: form.category,
      subcategory: form.subcategory,
      identifier: form.identifier,
      supplier: form.supplier,
      supplier_code: form.supplier_code,
      manufacturer: form.manufacturer,
      presentation: form.presentation,
      unit: form.unit,
      unit_content: Number(form.unit_content) || 1,
      unit_base: form.unit_base || 'UNIDAD',
      stock_min: Number(form.stock_min) || 0,
      stock_bajo: Number(form.stock_bajo) || 0,
      requires_lot: Boolean(form.requires_lot),
      active: Boolean(form.active),
    };
    setSaving(true);
    try {
      const { error } = await supabase.from('productos').insert(payload);
      if (error) throw error;
      toast.success('Producto creado correctamente.');
      setForm({ ...EMPTY_FORM });
      recargar();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al guardar producto');
    } finally {
      setSaving(false);
    }
  }

  async function guardarEdicion(code: string) {
    const cambios = editando[code];
    if (!cambios || Object.keys(cambios).length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('productos').update(cambios).eq('code', code);
      if (error) throw error;
      setEditando(prev => { const next = { ...prev }; delete next[code]; return next; });
      setEditingProductCode(null);
      toast.success('Producto actualizado.');
      recargar();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar producto');
    } finally {
      setSaving(false);
    }
  }

  async function eliminarProducto(code: string) {
    if (!confirm(`¿Eliminar producto ${code}? Esta acción no se puede deshacer.`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('productos').delete().eq('code', code);
      if (error) throw error;
      toast.success('Producto eliminado.');
      recargar();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar producto');
    } finally {
      setSaving(false);
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    setBulkErrors([]);
    setBulkItems([]);
    const file = event.target.files?.[0];
    if (!file) return;
    setBulkName(file.name);
    setImporting(true);

    try {
      const text = await file.text();
      const rows = text.split(/\r?\n/).filter(Boolean);
      const headers = rows[0].split(',').map(header => header.trim().toLowerCase());
      const result: Producto[] = rows.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        const record: Record<string, string> = {};
        headers.forEach((field, index) => { record[field] = values[index] || ''; });
        return {
          code: record.code || record.codigo || '',
          name: record.name || record.nombre || '',
          description: record.description || record.descripcion || '',
          category: record.category || record.categoria || '',
          supplier: record.supplier || record.proveedor || '',
          manufacturer: record.manufacturer || record.fabricante || '',
          presentation: record.presentation || record.presentacion || '',
          supplier_code: record.supplier_code || record.codigo_proveedor || '',
          unit: record.unit || record.unidad || 'UNIDAD',
          unit_content: Number(record.unit_content || record.contenido || 1),
          unit_base: record.unit_base || record.unidad_base || 'UNIDAD',
          stock_min: Number(record.stock_min || record.stockmin || 0),
          stock_bajo: Number(record.stock_bajo || record.stockbajo || 0),
          active: (record.active || record.activo) ? ((record.active || record.activo).toLowerCase() === 'true' || (record.active || record.activo).toLowerCase() === 'si' || (record.active || record.activo) === '1') : true,
        } as Producto;
      });

      const errors: string[] = [];
      const valid: Producto[] = [];

      // Detect duplicate product codes inside CSV
      const codeCounts = result.reduce((acc, it) => { acc[it.code] = (acc[it.code] || 0) + 1; return acc; }, {} as Record<string, number>);
      Object.entries(codeCounts).forEach(([code, cnt]) => {
        if (!code) return; // empty codes handled below
        if (cnt > 1) errors.push(`Código repetido en CSV: ${code}`);
      });

      // Validate rows and collect candidate codes
      const candidateCodes: string[] = [];
      result.forEach((item, index) => {
        if (!item.code || !item.name || !item.category) {
          errors.push(`Fila ${index + 2}: faltan campos obligatorios (se requieren: code, name, category)`);
        } else {
          valid.push(item);
          candidateCodes.push(item.code);
        }
      });

      // Check DB for existing product codes - abort import if any exist
      if (candidateCodes.length) {
        const { data: existingProducts, error: prodErr } = await supabase.from('productos').select('code').in('code', candidateCodes);
        if (prodErr) throw prodErr;
        const existingCodes = new Set(existingProducts?.map(p => p.code) || []);
        existingCodes.forEach(code => errors.push(`Código ya existe en la base de datos: ${code}`));
      }

      setBulkItems(valid);
      setBulkErrors(errors);
      if (!errors.length) {
        toast.success(`${valid.length} productos listos para importar`);
      }
    } catch (error: unknown) {
      setBulkErrors([error instanceof Error ? error.message : 'Error al procesar el archivo']);
    } finally {
      setImporting(false);
    }
  }

  async function importBulk() {
    if (!bulkItems.length) {
      toast.error('No hay productos válidos para importar.');
      return;
    }
    setImporting(true);
    try {
      // Prepare items: move supplier_code to supplier field (as text) and never send supplier_code to avoid FK constraints
      const prepared = bulkItems.map(item => {
        const payload: any = {
          code: item.code,
          name: item.name,
          description: item.description || '',
          category: item.category,
          supplier: item.supplier || '',
          manufacturer: item.manufacturer || '',
          presentation: item.presentation || '',
          unit: item.unit || 'UNIDAD',
          unit_content: Number(item.unit_content) || 1,
          unit_base: item.unit_base || 'UNIDAD',
          stock_min: Number(item.stock_min) || 0,
          stock_bajo: Number(item.stock_bajo) || 0,
          requires_lot: Boolean(item.requires_lot),
          active: Boolean(item.active),
        };
        // If supplier_code exists, append it to supplier field (as text, not FK)
        const sc = (item as any).supplier_code || '';
        if (sc && !payload.supplier.includes(sc)) {
          payload.supplier = payload.supplier ? `${payload.supplier} (${sc})` : sc;
        }
        // Do NOT include supplier_code field to avoid FK constraint violation
        return payload as Producto;
      });

      const codes = prepared.map(product => product.code);
      const { data: existing, error } = await supabase.from('productos').select('code').in('code', codes);
      if (error) throw error;
      const existingCodes = new Set(existing?.map(item => item.code) || []);
      const newItems = prepared.filter(item => !existingCodes.has(item.code));
      if (!newItems.length) {
        toast.info('Todos los productos del archivo ya existen.');
        return;
      }
      const { error: insertError } = await supabase.from('productos').insert(newItems);
      if (insertError) {
        console.error('Supabase insert error:', insertError);
        const msg = insertError.message || JSON.stringify(insertError);
        setBulkErrors(prev => [...prev, `Error Supabase: ${msg}`]);
        toast.error(`Error Supabase: ${msg}`);
        return;
      }
      toast.success(`${newItems.length} productos importados correctamente.`);
      recargar();
      setBulkItems([]);
      setBulkName('');
    } catch (error: unknown) {
      console.error('Import bulk products error:', error);
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      setBulkErrors(prev => [...prev, msg]);
      toast.error(msg || 'Error al importar productos');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <Header
        title="Catálogo de Productos"
        subtitle="Administra el catálogo completo de productos con carga individual o masiva."
        actions={
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={recargar}>
            Actualizar catálogo
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr] mb-5">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nuevo/editar producto</h2>
              <p className="text-sm text-slate-500">Genera el código según la estructura de categoría y mantén el catálogo alineado.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">Código: CATEGORÍA-SUBCATEGORÍA-IDENTIFICADOR</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Categoría" value={form.category} onChange={e => handleField('category', e.target.value)}>
              <option value="">Selecciona categoría</option>
              {Object.entries(CATEGORIAS).map(([key, cat]) => (
                <option key={key} value={key}>{cat.label}</option>
              ))}
            </Select>
            <Input label="Subcategoría" value={form.subcategory} onChange={e => handleField('subcategory', e.target.value)} placeholder="01" />
            <Input label="Identificador" value={form.identifier} onChange={e => handleField('identifier', e.target.value)} placeholder="001" />
            <Input label="Código generado" value={code} readOnly />
            <Input label="Nombre" value={form.name} onChange={e => handleField('name', e.target.value)} className="sm:col-span-2" />
            <Textarea label="Descripción" value={form.description} onChange={e => handleField('description', e.target.value)} className="sm:col-span-2" rows={3} />
            <Select label="Proveedor" value={form.supplier} onChange={e => handleField('supplier', e.target.value)}>
              <option value="">Selecciona proveedor</option>
              {proveedores.map(provider => (
                <option key={provider.code} value={provider.name}>{provider.name}</option>
              ))}
            </Select>
            <Input label="Código del proveedor" value={form.supplier_code} readOnly />
            <Input label="Presentación" value={form.presentation} onChange={e => handleField('presentation', e.target.value)} />
            <Select label="Unidad de conteo" value={form.unit} onChange={e => handleField('unit', e.target.value)}>
              {UNIDADES.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </Select>
            <Input label="Contenido por unidad" type="number" value={form.unit_content} onChange={e => handleField('unit_content', e.target.value)} />
            <Input label="Unidad base" value={form.unit_base} onChange={e => handleField('unit_base', e.target.value)} />
            <Input label="Stock mínimo" type="number" value={form.stock_min} onChange={e => handleField('stock_min', e.target.value)} />
            <Input label="Stock bajo" type="number" value={form.stock_bajo} onChange={e => handleField('stock_bajo', e.target.value)} />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.requires_lot} onChange={e => handleField('requires_lot', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                Requiere control por lote
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => handleField('active', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                Activo
              </label>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button icon={<PlusCircle size={16} />} onClick={createProduct} loading={saving}>
                Agregar producto
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Importación masiva</h2>
            <p className="text-sm text-slate-500">Importa un archivo CSV con tu catálogo completo.</p>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Archivo</label>
            <input type="file" accept=".csv" onChange={handleFile} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
              Columnas esperadas: <strong>code, name, description, category, supplier, manufacturer, presentation, supplier_code, active</strong>
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
                <p>{bulkItems.length} productos listos para importar.</p>
                <Button variant="primary" icon={<Database size={16} />} onClick={importBulk} loading={importing}>Importar productos</Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Lista de productos</h2>
            <p className="text-sm text-slate-500">Filtra y edita los datos esenciales del catálogo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Buscar..."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            />
            <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <option value="">Todas las categorías</option>
              {Object.entries(CATEGORIAS).map(([key, cat]) => <option key={key} value={key}>{cat.label}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 border-b border-slate-300 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Código</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700 min-w-[260px]">Nombre</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Descripción</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Categoría</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Proveedor</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Código proveedor</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Presentación</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Unidad</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Stock min</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Stock bajo</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Activo</th>
                <th className="px-2 py-2 text-left font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} className="p-4 text-center text-slate-500">No hay productos que coincidan.</td></tr>
              ) : filtered.map((product, index) => {
                const cambios = editando[product.code] || {};
                const isEditing = editingProductCode === product.code;
                return (
                  <tr key={product.code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-2 py-2 font-mono text-slate-700 whitespace-nowrap">
                      {isEditing ? (
                        <input
                          value={cambios.code ?? product.code}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], code: e.target.value } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        product.code
                      )}
                    </td>
                    <td className="px-2 py-2 min-w-[260px]">
                      {isEditing ? (
                        <input
                          value={cambios.name ?? product.name ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], name: e.target.value } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        <span className="text-slate-900">{product.name || '—'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <textarea
                          value={cambios.description ?? product.description ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], description: e.target.value } }))}
                          rows={2}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        <span className="text-slate-600 block max-w-[280px] break-words">{product.description || '—'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <select
                          value={cambios.category ?? product.category}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], category: e.target.value } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        >
                          <option value="">Selecciona</option>
                          {Object.entries(CATEGORIAS).map(([key, cat]) => (
                            <option key={key} value={key}>{cat.label}</option>
                          ))}
                        </select>
                      ) : (
                        <BadgeCategoria category={cambios.category ?? product.category} />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <select
                          value={cambios.supplier_code ?? product.supplier_code ?? ''}
                          onChange={e => {
                            const selectedCode = e.target.value;
                            const selectedProvider = proveedores.find(p => p.code === selectedCode);
                            setEditando(prev => ({
                              ...prev,
                              [product.code]: {
                                ...prev[product.code],
                                supplier: selectedProvider?.name ?? '',
                                supplier_code: selectedProvider?.code ?? selectedCode,
                              },
                            }));
                          }}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        >
                          <option value="">Selecciona proveedor</option>
                          {proveedores.map(provider => (
                            <option key={provider.code} value={provider.code}>{provider.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600">{product.supplier || '—'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <input
                          value={cambios.supplier_code ?? product.supplier_code ?? ''}
                          readOnly
                          className="w-full rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        <span className="text-slate-600">{product.supplier_code || '—'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <input
                          value={cambios.presentation ?? product.presentation ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], presentation: e.target.value } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        <span className="text-slate-600">{product.presentation || '—'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <input
                          value={cambios.unit ?? product.unit ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], unit: e.target.value } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        <span className="text-slate-600">{product.unit || '—'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <input
                          type="number"
                          value={cambios.stock_min ?? product.stock_min ?? 0}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], stock_min: Number(e.target.value) } }))}
                          className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        <span className="text-slate-700">{product.stock_min}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <input
                          type="number"
                          value={cambios.stock_bajo ?? product.stock_bajo ?? 0}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], stock_bajo: Number(e.target.value) } }))}
                          className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        <span className="text-slate-700">{product.stock_bajo}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={Boolean(cambios.active ?? product.active ?? true)}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], active: e.target.checked } }))}
                          className="h-4 w-4"
                        />
                      ) : (
                        <span>{product.active ? 'Sí' : 'No'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => guardarEdicion(product.code)} loading={saving} className="text-xs px-2 py-0.5">
                              Guardar
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => {
                              setEditingProductCode(null);
                              setEditando(prev => { const next = { ...prev }; delete next[product.code]; return next; });
                            }} className="text-xs px-2 py-0.5">
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => {
                              setEditingProductCode(product.code);
                              setEditando(prev => ({ ...prev, [product.code]: { ...product } }));
                            }} className="text-xs px-2 py-0.5">
                              Editar
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => eliminarProducto(product.code)} loading={saving} className="text-xs px-2 py-0.5">
                              Eliminar
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
