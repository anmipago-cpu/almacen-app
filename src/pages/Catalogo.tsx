import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, PlusCircle, Database, Download } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { BadgeCategoria } from '../components/ui/Badge';
import { useProductos } from '../hooks/useProductos';
import { useProveedores } from '../hooks/useProveedores';
import { useUnidades } from '../hooks/useUnidades';
import { supabase } from '../lib/supabase';
import { exportarExcel } from '../lib/utils';
import { CATEGORIAS, SUBCATEGORIAS, type Producto } from '../types';



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

function getNextIdentifier(productos: Producto[], category: string, subcategory: string): string {
  if (!category || !subcategory) return '001';
  const prefix = `${category.trim().toUpperCase()}-${String(subcategory).padStart(2, '0')}-`;
  const matching = productos.filter(p => p.code?.startsWith(prefix));
  if (matching.length === 0) return '001';
  const maxNum = matching.reduce((max, p) => {
    const suffix = p.code.slice(prefix.length);
    const match = suffix.match(/^(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    return Math.max(max, value);
  }, 0);
  return String(maxNum + 1).padStart(3, '0');
}

export function Catalogo() {
  const { productos, recargar } = useProductos();
  const { proveedores } = useProveedores();
  const { unidadesConteo, unidadesBase } = useUnidades();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [bulkItems, setBulkItems] = useState<Producto[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkName, setBulkName] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState('');
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([]);
  const [subcategoriasFiltro, setSubcategoriasFiltro] = useState<string[]>([]);
  const [activoFiltro, setActivoFiltro] = useState<'activos' | 'inactivos' | ''>('activos');
  const [editando, setEditando] = useState<Record<string, Partial<Producto>>>({});
  const [editingProductCode, setEditingProductCode] = useState<string | null>(null);
  const [modoMasivo, setModoMasivo] = useState(false);

  const nextIdentifier = useMemo(
    () => getNextIdentifier(productos, form.category, form.subcategory),
    [productos, form.category, form.subcategory]
  );

  const code = editingProductCode ? form.code : formatCode(form.category, form.subcategory, form.identifier);

  useEffect(() => {
    if (!editingProductCode && form.category && form.subcategory) {
      setForm(prev => ({ ...prev, identifier: nextIdentifier }));
    }
  }, [nextIdentifier, editingProductCode, form.category, form.subcategory]);

  useEffect(() => {
    if (!editingProductCode) {
      setForm(prev => ({ ...prev, code }));
    }
  }, [code, editingProductCode]);

  const subcategoriasDisponibles = useMemo(() => {
    const base = categoriasFiltro.length > 0
      ? productos.filter(p => categoriasFiltro.includes(p.category))
      : productos;
    const codigos = [...new Set(base.map(p => p.subcategory).filter(Boolean))].sort() as string[];
    return codigos.map(codigo => {
      const nombre = categoriasFiltro.length === 1
        ? SUBCATEGORIAS[categoriasFiltro[0]]?.[codigo]
        : undefined;
      return { codigo, label: nombre ? `${nombre} (${codigo})` : codigo };
    });
  }, [productos, categoriasFiltro]);

  const filtered = useMemo(() => {
    return productos.filter(p => {
      const query = filter.toLowerCase();
      const matchText = !filter || p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query) || p.supplier?.toLowerCase().includes(query);
      const matchCat = categoriasFiltro.length === 0 || categoriasFiltro.includes(p.category);
      const matchSub = subcategoriasFiltro.length === 0 || subcategoriasFiltro.includes(p.subcategory ?? '');
      const matchActivo = !activoFiltro || (activoFiltro === 'activos' ? p.active !== false : p.active === false);
      return matchText && matchCat && matchSub && matchActivo;
    });
  }, [productos, filter, categoriasFiltro, subcategoriasFiltro, activoFiltro]);

  function handleExport() {
    exportarExcel(filtered.map(p => ({
      Código: p.code,
      Nombre: p.name,
      Descripción: p.description || '',
      Categoría: p.category,
      Subcategoría: p.subcategory,
      Presentación: p.presentation || '',
      Proveedor: p.supplier || '',
      'Código proveedor': p.supplier_code || '',
      Fabricante: p.manufacturer || '',
      Unidad: p.unit,
      'Contenido unidad': p.unit_content,
      'Unidad base': p.unit_base,
      'Stock mínimo': p.stock_min,
      'Stock bajo': p.stock_bajo,
      'Requiere lote': p.requires_lot ? 'Sí' : 'No',
      Activo: p.active ? 'Sí' : 'No',
    })), 'catalogo');
  }

function handleField(field: keyof typeof EMPTY_FORM, value: string | boolean) {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'category' || field === 'subcategory') {
        updated.identifier = '';
      }
      if (field === 'category') {
        updated.requires_lot = value === 'PP';
      }
      if (field === 'supplier') {
        const provider = proveedores.find(p => p.name === value || p.code === value);
        updated.supplier_code = provider?.code || '';
      }
      return updated;
    });
  }

  async function createProduct() {
    if (!form.name || !form.category || !form.unit) {
      toast.error('Completa todos los campos obligatorios antes de guardar.');
      return;
    }
    const existingCode = productos.find(p => p.code === code);
    if (existingCode) {
      toast.error(`El código ${code} ya existe en el catálogo.`);
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

  function activarModoMasivo() {
    const nuevosEditando: Record<string, Partial<Producto>> = {};
    filtered.forEach(p => { nuevosEditando[p.code] = { ...p }; });
    setEditando(nuevosEditando);
    setEditingProductCode(null);
    setModoMasivo(true);
  }

  function cancelarModoMasivo() {
    setEditando({});
    setModoMasivo(false);
  }

  async function guardarTodos() {
    const conCambios = Object.entries(editando).filter(([, v]) => Object.keys(v).length > 0);
    if (!conCambios.length) { cancelarModoMasivo(); return; }
    setSaving(true);
    try {
      for (const [code, cambios] of conCambios) {
        const { error } = await supabase.from('productos').update(cambios).eq('code', code);
        if (error) throw error;
      }
      toast.success(`${conCambios.length} productos guardados.`);
      setEditando({});
      setModoMasivo(false);
      recargar();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
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
          <div className="flex items-center gap-2">
<Button variant="outline" icon={<Download size={16} />} onClick={handleExport} size="sm">
              Exportar Excel
            </Button>
            <Button variant="outline" icon={<RefreshCw size={16} />} onClick={recargar}>
              Actualizar catálogo
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr] mb-5">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nuevo producto</h2>
              <p className="text-sm text-slate-500">Crea productos con código automático único. El identificador se genera secuencialmente.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">Formato: CAT-SUBCAT-ID</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Categoría" value={form.category} onChange={e => handleField('category', e.target.value)}>
              <option value="">Selecciona categoría</option>
              {Object.entries(CATEGORIAS).map(([key, cat]) => (
                <option key={key} value={key}>{cat.label}</option>
              ))}
            </Select>
            <Select label="Subcategoría" value={form.subcategory} onChange={e => handleField('subcategory', e.target.value)}>
              <option value="">Selecciona subcategoría</option>
              {['01','02','03','04','05','06','07'].map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </Select>
            <Input label="Identificador" value={form.identifier} readOnly hint="Consecutivo automático por categoría/subcategoría" className="bg-blue-50" />
            <Input label="Código generado" value={code} readOnly hint="Automático: CAT-SC-ID" className="bg-blue-50" />
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
              <option value="">Selecciona unidad</option>
              {unidadesConteo.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Input label="Contenido por unidad" type="number" value={form.unit_content} onChange={e => handleField('unit_content', e.target.value)} />
            <Select label="Unidad base" value={form.unit_base} onChange={e => handleField('unit_base', e.target.value)}>
              <option value="">Selecciona unidad base</option>
              {unidadesBase.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
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
            <MultiSelectCategorias value={categoriasFiltro} onChange={v => { setCategoriasFiltro(v); setSubcategoriasFiltro([]); }} />
            <MultiSelectSubcategorias opciones={subcategoriasDisponibles} value={subcategoriasFiltro} onChange={setSubcategoriasFiltro} />
            <select value={activoFiltro} onChange={e => setActivoFiltro(e.target.value as 'activos' | 'inactivos' | '')} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
            {modoMasivo ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={guardarTodos} loading={saving}>Guardar todos</Button>
                <Button size="sm" variant="outline" onClick={cancelarModoMasivo}>Cancelar</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={activarModoMasivo}>
                Editar {filtered.length} registros
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 border-b border-slate-300 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 whitespace-nowrap min-w-[120px]">Código</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[260px]">Nombre</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[200px]">Descripción</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[150px]">Categoría</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[130px]">Subcategoría</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[180px]">Proveedor</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[110px]">Cód. proveedor</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[160px]">Presentación detalle</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700 min-w-[100px]">Cant. x unidad</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[120px]">Unidad de conteo</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[110px]">Unidad base</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700 min-w-[90px]">Stock mín.</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700 min-w-[90px]">Stock bajo</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700 min-w-[80px]">Req. lote</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-700 min-w-[70px]">Activo</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700 min-w-[130px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={16} className="p-4 text-center text-slate-500">No hay productos que coincidan.</td></tr>
              ) : filtered.map((product, index) => {
                const cambios = editando[product.code] || {};
                const isEditing = modoMasivo || editingProductCode === product.code;
                return (
                  <tr key={product.code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 tracking-wide border border-slate-200">
                        {product.code}
                      </span>
                    </td>
                    <td className="px-3 py-2 min-w-[260px]">
                      {isEditing ? (
                        <input
                          value={cambios.name ?? product.name ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], name: e.target.value } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        <span className="text-slate-900 font-medium">{product.name || '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[200px]">
                      {isEditing ? (
                        <textarea
                          value={cambios.description ?? product.description ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], description: e.target.value } }))}
                          rows={2}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      ) : (
                        <span className="text-slate-600">{product.description || '—'}</span>
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
                          value={cambios.subcategory ?? product.subcategory ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], subcategory: e.target.value } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        >
                          <option value="">—</option>
                          {Object.entries(SUBCATEGORIAS[cambios.category ?? product.category] ?? {}).map(([codigo, nombre]) => (
                            <option key={codigo} value={codigo}>{nombre} ({codigo})</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600 text-xs">
                          {SUBCATEGORIAS[product.category]?.[product.subcategory ?? ''] ?? product.subcategory ?? '—'}
                        </span>
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
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className="text-slate-600 font-mono text-xs">
                        {product.supplier_code || proveedores.find(p => p.name === product.supplier)?.code || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 min-w-[160px]">
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
                    <td className="px-2 py-2 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0.001}
                          step="any"
                          value={cambios.unit_content ?? product.unit_content ?? 1}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], unit_content: Number(e.target.value) } }))}
                          className="w-20 rounded border border-slate-200 px-1 py-0.5 text-xs text-right"
                        />
                      ) : (
                        <span className="font-mono font-semibold text-slate-800">{product.unit_content ?? 1}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <select
                          value={cambios.unit ?? product.unit ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], unit: e.target.value } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        >
                          <option value="">—</option>
                          {unidadesConteo.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      ) : (
                        <span className="text-slate-600">{product.unit || '—'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <select
                          value={cambios.unit_base ?? product.unit_base ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], unit_base: e.target.value } }))}
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        >
                          <option value="">—</option>
                          {unidadesBase.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      ) : (
                        <span className="text-slate-600">{product.unit_base || '—'}</span>
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
                          checked={Boolean(cambios.requires_lot ?? product.requires_lot ?? false)}
                          onChange={e => setEditando(prev => ({ ...prev, [product.code]: { ...prev[product.code], requires_lot: e.target.checked } }))}
                          className="h-4 w-4 accent-blue-600"
                        />
                      ) : (
                        <span className={product.requires_lot ? 'text-blue-700 font-semibold' : 'text-slate-400'}>
                          {product.requires_lot ? 'Sí' : 'No'}
                        </span>
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
                        {modoMasivo ? null : isEditing ? (
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

function MultiSelectCategorias({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key]);
  }

  const label = value.length === 0 ? 'Todas las categorías' : value.length === 1
    ? CATEGORIAS[value[0]]?.label
    : `${value.length} categorías`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 min-w-[160px] justify-between"
      >
        <span>{label}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-52 rounded-2xl border border-slate-200 bg-white shadow-lg py-1">
          <label className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} className="h-4 w-4 rounded" />
            <span className="text-slate-700">Todas las categorías</span>
          </label>
          <div className="border-t border-slate-100 my-1" />
          {Object.entries(CATEGORIAS).map(([key, cat]) => (
            <label key={key} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={value.includes(key)} onChange={() => toggle(key)} className="h-4 w-4 rounded" />
              <span className="text-slate-700">{cat.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiSelectSubcategorias({ opciones, value, onChange }: { opciones: { codigo: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(codigo: string) {
    onChange(value.includes(codigo) ? value.filter(v => v !== codigo) : [...value, codigo]);
  }

  const selectedLabels = value.map(v => opciones.find(o => o.codigo === v)?.label ?? v);
  const btnLabel = value.length === 0 ? 'Todas las subcategorías' : value.length === 1 ? selectedLabels[0] : `${value.length} subcategorías`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 min-w-[180px] justify-between"
      >
        <span>{btnLabel}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-52 rounded-2xl border border-slate-200 bg-white shadow-lg py-1">
          <label className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
            <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} className="h-4 w-4 rounded" />
            <span className="text-slate-700">Todas</span>
          </label>
          <div className="border-t border-slate-100 my-1" />
          {opciones.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Sin subcategorías disponibles</p>
          ) : opciones.map(({ codigo, label }) => (
            <label key={codigo} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={value.includes(codigo)} onChange={() => toggle(codigo)} className="h-4 w-4 rounded" />
              <span className="text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
