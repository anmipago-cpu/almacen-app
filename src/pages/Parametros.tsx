import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { toast } from 'sonner';
import { Search, Database, RefreshCw, UploadCloud, PlusCircle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { BadgeCategoria } from '../components/ui/Badge';
import { useProductos } from '../hooks/useProductos';
import { CATEGORIAS, type Producto } from '../types';
import { supabase } from '../lib/supabase';
import { PRODUCTOS_SEED } from '../data/productos_seed';

const REQUIRED_FIELDS = ['code', 'name', 'category', 'stock_min', 'stock_bajo'];

interface ProductoFormData {
  code: string;
  name: string;
  category: string;
  supplier: string;
  presentation: string;
  unit: string;
  stock_min: string;
  stock_bajo: string;
}

const JSON_SAMPLE = [
  {
    code: 'AD-01-001',
    name: 'CHY-MAX EXTRA',
    category: 'AD',
    supplier: 'Dairy Connection',
    presentation: '1 Gallon/Bottle - 4 Bottle/Case',
    unit: 'uni',
    stock_min: 5,
    stock_bajo: 10,
  },
];

function normalizeField(field: string) {
  return field.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function mapRowToProduct(row: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    normalized[normalizeField(key)] = row[key].trim();
  }

  return {
    code: normalized.code || normalized.producto || normalized.productocodigo || normalized.codigo || '',
    name: normalized.name || normalized.producto || normalized.productonombre || '',
    category: normalized.category || normalized.categoria || '',
    supplier: normalized.supplier || normalized.proveedor || '',
    presentation: normalized.presentation || normalized.presentacion || '',
    unit: normalized.unit || normalized.unidad || '',
    stock_min: Number(normalized.stockmin ?? normalized.stock_min ?? normalized.minimo ?? '0'),
    stock_bajo: Number(normalized.stockbajo ?? normalized.stock_bajo ?? normalized.bajo ?? '0'),
  } as Producto;
}

function parseCSV(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    throw new Error('El archivo CSV debe tener cabecera y al menos una fila de datos.');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(value => value.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return mapRowToProduct(row);
  });
}

async function parseBulkFile(file: File) {
  const text = await file.text();
  const data = text.trim();

  if (data.startsWith('{') || data.startsWith('[')) {
    const parsed = JSON.parse(data);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((row: Record<string, unknown>) => {
      const record: Record<string, string> = {};
      for (const key in row) {
        record[key] = String(row[key] ?? '');
      }
      return mapRowToProduct(record);
    });
  }

  return parseCSV(text);
}

function validateProduct(product: Partial<Producto>) {
  for (const field of REQUIRED_FIELDS) {
    if (!product[field as keyof Producto]) {
      return `Falta el campo obligatorio: ${field}`;
    }
  }

  if (Number.isNaN(Number(product.stock_min))) {
    return 'stock_min debe ser un número válido.';
  }
  if (Number.isNaN(Number(product.stock_bajo))) {
    return 'stock_bajo debe ser un número válido.';
  }

  return null;
}

export function Parametros() {
  const { productos, loading, recargar, actualizarProducto } = useProductos();
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [editando, setEditando] = useState<Record<string, Partial<Producto>>>({});
  const [cargandoSeed, setCargandoSeed] = useState(false);
  const [bulkItems, setBulkItems] = useState<Producto[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState<ProductoFormData>({
    code: '',
    name: '',
    category: '',
    supplier: '',
    presentation: '',
    unit: 'uni',
    stock_min: '0',
    stock_bajo: '0',
  });
  const [nuevoError, setNuevoError] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  const filtrados = productos.filter(p => {
    const busq = busqueda.toLowerCase();
    const matchBusq = !busqueda || p.name.toLowerCase().includes(busq) || p.code.toLowerCase().includes(busq);
    const matchCat = !categoriaFiltro || p.category === categoriaFiltro;
    return matchBusq && matchCat;
  });

  function handleEdit(code: string, field: keyof Producto, value: string | number) {
    setEditando(prev => ({ ...prev, [code]: { ...prev[code], [field]: value } }));
  }

  async function guardarFila(p: Producto) {
    const cambios = editando[p.code];
    if (!cambios || Object.keys(cambios).length === 0) return;
    try {
      await actualizarProducto(p.code, cambios);
      setEditando(prev => { const n = { ...prev }; delete n[p.code]; return n; });
      toast.success(`Producto ${p.name} actualizado`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async function cargarSeed() {
    setCargandoSeed(true);
    try {
      const { count } = await supabase.from('productos').select('*', { count: 'exact', head: true });
      if (count && count > 0) {
        toast.info(`Ya existen ${count} productos en la base de datos.`);
        setCargandoSeed(false);
        return;
      }

      const uniqueProducts = PRODUCTOS_SEED.filter((p, idx, arr) =>
        arr.findIndex(x => x.code === p.code) === idx
      );

      const { error } = await supabase.from('productos').insert(uniqueProducts);
      if (error) throw error;
      toast.success(`${uniqueProducts.length} productos cargados exitosamente`);
      recargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar el catálogo');
    } finally {
      setCargandoSeed(false);
    }
  }

  async function handleBulkFileChange(event: ChangeEvent<HTMLInputElement>) {
    setBulkErrors([]);
    setBulkItems([]);
    const file = event.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkLoading(true);

    try {
      const products = await parseBulkFile(file);
      const normalized = products.map(product => ({
        ...product,
        category: String(product.category).toUpperCase(),
        stock_min: Number(product.stock_min),
        stock_bajo: Number(product.stock_bajo),
      })) as Producto[];

      const errors: string[] = [];
      const validItems: Producto[] = [];

      normalized.forEach((item, idx) => {
        const err = validateProduct(item);
        if (err) {
          errors.push(`Fila ${idx + 1}: ${err}`);
          return;
        }
        validItems.push(item);
      });

      setBulkItems(validItems);
      setBulkErrors(errors);

      if (!errors.length) {
        toast.success(`${validItems.length} productos listos para importar`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al procesar el archivo';
      setBulkErrors([message]);
    } finally {
      setBulkLoading(false);
    }
  }

  async function importarBulk() {
    if (!bulkItems.length) {
      toast.error('No hay productos válidos para importar.');
      return;
    }
    setBulkLoading(true);
    try {
      const codes = bulkItems.map(item => item.code);
      const { data: existing, error: existingError } = await supabase
        .from('productos')
        .select('code')
        .in('code', codes);
      if (existingError) throw existingError;

      const existingCodes = new Set((existing || []).map(item => item.code));
      const newItems = bulkItems.filter(item => !existingCodes.has(item.code));

      if (newItems.length === 0) {
        toast.info('Todos los productos ya existen en la base de datos.');
        return;
      }

      const { error: insertError } = await supabase.from('productos').insert(newItems);
      if (insertError) throw insertError;

      toast.success(`${newItems.length} productos importados correctamente`);
      if (existingCodes.size > 0) {
        toast.info(`Se omitieron ${existingCodes.size} productos con código duplicado.`);
      }
      setBulkItems([]);
      setBulkFileName('');
      recargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al importar productos');
    } finally {
      setBulkLoading(false);
    }
  }

  function handleNuevoCampo(field: keyof ProductoFormData, value: string) {
    setNuevoProducto(prev => ({ ...prev, [field]: value }));
  }

  async function guardarNuevoProducto(event: FormEvent) {
    event.preventDefault();
    setNuevoError('');

    const nuevo: Partial<Producto> = {
      code: nuevoProducto.code.trim(),
      name: nuevoProducto.name.trim(),
      category: nuevoProducto.category.trim().toUpperCase(),
      supplier: nuevoProducto.supplier.trim(),
      presentation: nuevoProducto.presentation.trim(),
      unit: nuevoProducto.unit.trim() || 'uni',
      stock_min: Number(nuevoProducto.stock_min),
      stock_bajo: Number(nuevoProducto.stock_bajo),
    };

    const error = validateProduct(nuevo);
    if (error) {
      setNuevoError(error);
      return;
    }

    setSavingNew(true);
    try {
      const { error: insertError } = await supabase.from('productos').insert(nuevo);
      if (insertError) throw insertError;
      toast.success(`Producto ${nuevo.name} agregado`);
      setNuevoProducto({
        code: '',
        name: '',
        category: '',
        supplier: '',
        presentation: '',
        unit: 'uni',
        stock_min: '0',
        stock_bajo: '0',
      });
      recargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al crear producto');
    } finally {
      setSavingNew(false);
    }
  }

  return (
    <div>
      <Header
        title="Catálogo"
        subtitle="Carga individual o masiva de productos, y administra tu catálogo desde una sola pantalla"
        actions={
          <>
            <Button variant="outline" icon={<RefreshCw size={14} />} onClick={recargar} size="sm">Actualizar</Button>
            <Button
              variant="secondary"
              icon={<Database size={14} />}
              onClick={cargarSeed}
              loading={cargandoSeed}
              size="sm"
            >
              Cargar catálogo inicial
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr] mb-5">
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Carga individual</h2>
              <p className="text-sm text-slate-500">Agrega un producto al catálogo con los campos obligatorios.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">Requerido: code, name, category, stock_min, stock_bajo</span>
          </div>

          <form onSubmit={guardarNuevoProducto} className="grid gap-4 sm:grid-cols-2">
            <Input label="Código" value={nuevoProducto.code} onChange={e => handleNuevoCampo('code', e.target.value)} />
            <Input label="Nombre" value={nuevoProducto.name} onChange={e => handleNuevoCampo('name', e.target.value)} />
            <Select label="Categoría" value={nuevoProducto.category} onChange={e => handleNuevoCampo('category', e.target.value)}>
              <option value="">Selecciona categoría</option>
              {Object.entries(CATEGORIAS).map(([key, cat]) => (
                <option key={key} value={key}>{cat.label}</option>
              ))}
            </Select>
            <Input label="Proveedor" value={nuevoProducto.supplier} onChange={e => handleNuevoCampo('supplier', e.target.value)} />
            <Input label="Presentación" value={nuevoProducto.presentation} onChange={e => handleNuevoCampo('presentation', e.target.value)} />
            <Input label="Unidad" value={nuevoProducto.unit} onChange={e => handleNuevoCampo('unit', e.target.value)} />
            <Input label="Stock mínimo" type="number" value={nuevoProducto.stock_min} onChange={e => handleNuevoCampo('stock_min', e.target.value)} />
            <Input label="Stock bajo" type="number" value={nuevoProducto.stock_bajo} onChange={e => handleNuevoCampo('stock_bajo', e.target.value)} />
            <div className="sm:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                <p className="font-medium text-slate-900">Nota</p>
                <p>Si no defines unidad, se usará <span className="font-semibold">uni</span>.</p>
              </div>
            </div>
            <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <div className="text-sm text-red-600">{nuevoError}</div>
              <Button type="submit" icon={<PlusCircle size={16} />} loading={savingNew}>
                Agregar producto
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Carga masiva</h2>
            <p className="text-sm text-slate-500">Importa un archivo CSV o JSON con tu catálogo completo.</p>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Archivo de productos</label>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleBulkFileChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
            {bulkFileName && <p className="text-sm text-slate-500">Archivo seleccionado: {bulkFileName}</p>}
            {bulkErrors.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium">Errores de importación</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {bulkErrors.map((error, index) => <li key={index}>{error}</li>)}
                </ul>
              </div>
            )}
            {bulkItems.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p>{bulkItems.length} productos listos para importar.</p>
                <p className="text-slate-500">Elige importar cuando estés listo.</p>
              </div>
            )}
            <Button
              variant="primary"
              icon={<UploadCloud size={16} />}
              onClick={importarBulk}
              loading={bulkLoading}
              disabled={bulkItems.length === 0}
            >
              Importar productos
            </Button>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900 mb-2">Estructura aceptada</p>
              <p className="text-slate-500 mb-2">Debe incluir estos campos:</p>
              <ul className="list-disc space-y-1 pl-5 text-slate-600">
                <li><strong>code</strong>, <strong>name</strong>, <strong>category</strong>, <strong>stock_min</strong>, <strong>stock_bajo</strong></li>
                <li>Opcionales: <strong>supplier</strong>, <strong>presentation</strong>, <strong>unit</strong></li>
              </ul>
              <pre className="mt-3 overflow-auto rounded-xl bg-slate-900 px-3 py-3 text-xs text-slate-100">{JSON.stringify(JSON_SAMPLE, null, 2)}</pre>
            </div>
          </div>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        {/* Filtros */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoriaFiltro('')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${!categoriaFiltro ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              Todas
            </button>
            {Object.entries(CATEGORIAS).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setCategoriaFiltro(categoriaFiltro === key ? '' : key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${categoriaFiltro === key ? `${cat.bg} ${cat.text} ${cat.border}` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando productos...</div>
        ) : filtrados.length === 0 && productos.length === 0 ? (
          <div className="p-10 text-center">
            <Database size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">No hay productos. Carga el catálogo inicial para empezar.</p>
            <Button icon={<Database size={15} />} onClick={cargarSeed} loading={cargandoSeed}>
              Cargar catálogo inicial (190 productos)
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Código', 'Categoría', 'Producto', 'Unidad', 'Stock Mín.', 'Stock Bajo', 'Proveedor', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p, idx) => {
                  const cambios = editando[p.code] || {};
                  const hayEdicion = Object.keys(cambios).length > 0;
                  return (
                    <tr key={p.code} className={`border-b border-slate-50 hover:bg-blue-50/20 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'} ${hayEdicion ? 'bg-yellow-50' : ''}`}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.code}</td>
                      <td className="px-4 py-2"><BadgeCategoria category={p.category} /></td>
                      <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-2">
                        <EditableCell
                          value={cambios.unit ?? p.unit ?? ''}
                          onChange={v => handleEdit(p.code, 'unit', v)}
                          className="w-24"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <EditableCell
                          value={String(cambios.stock_min ?? p.stock_min)}
                          onChange={v => handleEdit(p.code, 'stock_min', Number(v))}
                          type="number"
                          className="w-20"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <EditableCell
                          value={String(cambios.stock_bajo ?? p.stock_bajo)}
                          onChange={v => handleEdit(p.code, 'stock_bajo', Number(v))}
                          type="number"
                          className="w-20"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <EditableCell
                          value={cambios.supplier ?? p.supplier ?? ''}
                          onChange={v => handleEdit(p.code, 'supplier', v)}
                          className="w-40"
                        />
                      </td>
                      <td className="px-4 py-2">
                        {hayEdicion && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => guardarFila(p)}
                              className="text-xs font-medium text-blue-600 hover:underline"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditando(prev => { const n = { ...prev }; delete n[p.code]; return n; })}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
          {filtrados.length} productos mostrados · Haz clic en cualquier campo para editarlo
        </div>
      </Card>
    </div>
  );
}

interface EditableCellProps {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}

function EditableCell({ value, onChange, type = 'text', className }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  if (editing) {
    return (
      <input
        type={type}
        value={local}
        onChange={e => { setLocal(e.target.value); onChange(e.target.value); }}
        onBlur={() => setEditing(false)}
        autoFocus
        className={`px-1.5 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
      />
    );
  }
  return (
    <span
      onClick={() => { setLocal(value); setEditing(true); }}
      className={`inline-block px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-50 hover:text-blue-700 text-sm transition-colors min-w-12 ${className}`}
      title="Clic para editar"
    >
      {value || <span className="text-slate-300 italic text-xs">editar</span>}
    </span>
  );
}
