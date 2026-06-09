import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useProveedores } from '../hooks/useProveedores';
import type { Proveedor } from '../types';
import { exportarExcel } from '../lib/utils';
import { supabase } from '../lib/supabase';

const TEMPLATE = {
  code: '',
  name: '',
  description: '',
  phone: '',
  contact: '',
  email: '',
  active: true,
};

function getNextProveedorCode(proveedores: Proveedor[]) {
  const maxNumber = proveedores.reduce((max, proveedor) => {
    const match = proveedor.code?.match(/^SUP-(\d+)$/i);
    const value = match ? Number(match[1]) : 0;
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return `SUP-${String(maxNumber + 1).padStart(3, '0')}`;
}

export function Proveedores() {
  const { proveedores, loading, recargar, crearProveedor, actualizarProveedor } = useProveedores();
  const [nuevo, setNuevo] = useState<Omit<Proveedor, 'id' | 'created_at'>>({ ...TEMPLATE });
  const [editingProveedorCode, setEditingProveedorCode] = useState<string | null>(null);
  const [editando, setEditando] = useState<Record<string, Partial<Proveedor>>>({});
  const [bulkItems, setBulkItems] = useState<Omit<Proveedor, 'id' | 'created_at'>[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkName, setBulkName] = useState('');
  const [importing, setImporting] = useState(false);
  const nextCode = useMemo(() => getNextProveedorCode(proveedores), [proveedores]);

  function handleExport() {
    exportarExcel(proveedores.map(provider => ({
      Código: provider.code,
      Nombre: provider.name,
      Descripción: provider.description || '',
      Teléfono: provider.phone || '',
      Contacto: provider.contact || '',
      Email: provider.email || '',
      Activo: provider.active ? 'Sí' : 'No',
    })), 'proveedores');
  }

  function handleNuevo(field: keyof typeof TEMPLATE, value: string) {
    setNuevo(prev => ({ ...prev, [field]: value }));
  }

  async function guardarProveedor() {
    if (!nuevo.name.trim()) {
      toast.error('El nombre del proveedor es obligatorio.');
      return;
    }
    const proveedor = { ...nuevo, code: nextCode };
    try {
      await crearProveedor(proveedor);
      toast.success('Proveedor creado correctamente.');
      setNuevo({ ...TEMPLATE });
    } catch (error: unknown) {
      const msg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error);
      toast.error(msg || 'Error al crear proveedor');
    }
  }

  async function guardarEdicion(code: string) {
    const cambios = editando[code];
    if (!cambios || Object.keys(cambios).length === 0) return;
    try {
      await actualizarProveedor(code, cambios);
      setEditando(prev => { const next = { ...prev }; delete next[code]; return next; });
      setEditingProveedorCode(null);
      toast.success('Proveedor actualizado.');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al actualizar proveedor');
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
      const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        const result = rows.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const record: Record<string,string> = {};
        headers.forEach((field, i) => { record[field] = values[i] || ''; });
        return {
          code: record.code || record.codigo || '',
          name: record.name || record.nombre || '',
          description: record.description || record.descripcion || '',
          phone: record.phone || record.telefono || '',
          contact: record.contact || record.contacto || '',
          email: record.email || record.correo || '',
          active: (record.active || record.activo) ? ((record.active || record.activo).toLowerCase() === 'true' || (record.active || record.activo).toLowerCase() === 'si' || (record.active || record.activo) === '1') : true,
        } as Omit<Proveedor, 'id' | 'created_at'>;
      });

      const errors: string[] = [];
      const valid: Omit<Proveedor, 'id' | 'created_at'>[] = [];
      result.forEach((item, idx) => {
        if (!item.name) {
          errors.push(`Fila ${idx + 2}: falta el nombre`);
        } else {
          valid.push(item);
        }
      });
      setBulkItems(valid);
      setBulkErrors(errors);
      if (!errors.length) toast.success(`${valid.length} proveedores listos para importar`);
    } catch (error: unknown) {
      setBulkErrors([error instanceof Error ? error.message : 'Error al procesar el archivo']);
    } finally {
      setImporting(false);
    }
  }

  async function eliminarProveedor(code: string) {
    if (!confirm(`Eliminar proveedor ${code}? Esta acción no se puede deshacer.`)) return;
    try {
      const { error } = await supabase.from('proveedores').delete().eq('code', code);
      if (error) throw error;
      toast.success('Proveedor eliminado.');
      recargar();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al eliminar proveedor');
    }
  }

  async function importBulk() {
    if (!bulkItems.length) {
      toast.error('No hay proveedores válidos para importar.');
      return;
    }
    setImporting(true);
    try {
      const codes = bulkItems.map(p => p.code).filter(Boolean);
      const { data: existing, error } = await supabase.from('proveedores').select('code').in('code', codes.length ? codes : ['']);
      if (error) throw error;
      const existingCodes = new Set(existing?.map((e:any) => e.code) || []);
      const toInsert = bulkItems.map((p, i) => ({ ...p, code: p.code || `SUP-${String(i+1).padStart(3,'0')}` })).filter(p => !existingCodes.has(p.code));
      if (!toInsert.length) {
        toast.info('Todos los proveedores del archivo ya existen.');
        return;
      }
      const { error: insertErr } = await supabase.from('proveedores').insert(toInsert);
      if (insertErr) throw insertErr;
      toast.success(`${toInsert.length} proveedores importados correctamente.`);
      recargar();
      setBulkItems([]);
      setBulkName('');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al importar proveedores');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <Header
        title="Proveedores"
        subtitle="Administra proveedores y su información de contacto."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" icon={<Download size={15} />} onClick={handleExport} size="sm">
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={recargar} loading={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] mb-5">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Nuevo proveedor</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Código" value={nextCode} readOnly hint="Se genera automáticamente" />
            <Input label="Nombre" value={nuevo.name} onChange={e => handleNuevo('name', e.target.value)} />
            <Input label="Teléfono" value={nuevo.phone} onChange={e => handleNuevo('phone', e.target.value)} />
            <Input label="Contacto" value={nuevo.contact} onChange={e => handleNuevo('contact', e.target.value)} />
            <Input label="Email" type="email" value={nuevo.email} onChange={e => handleNuevo('email', e.target.value)} />
            <div className="flex items-center gap-2 px-2">
              <input id="nuevo-active" type="checkbox" checked={Boolean(nuevo.active)} onChange={e => setNuevo(prev => ({ ...prev, active: e.target.checked }))} />
              <label htmlFor="nuevo-active" className="text-sm text-slate-700">Proveedor activo</label>
            </div>
            <Input label="Descripción" value={nuevo.description} onChange={e => handleNuevo('description', e.target.value)} />
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={guardarProveedor} loading={loading}>Crear proveedor</Button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Totales</h2>
          <div className="grid gap-3 text-sm text-slate-600">
            <div className="flex justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span>Total proveedores</span>
              <strong>{proveedores.length}</strong>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500">
              Los códigos se generan en formato <span className="font-semibold">SUP-001</span>, <span className="font-semibold">SUP-002</span>, etc.
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm text-slate-600 mb-2">Importar proveedores (CSV)</label>
            <div className="flex gap-2">
              <input type="file" accept="text/csv" onChange={handleFile} className="rounded-lg border border-slate-200 p-1 text-sm" />
              <Button onClick={importBulk} loading={importing} disabled={bulkItems.length === 0}>Importar</Button>
            </div>
            {bulkName && <p className="text-xs text-slate-500 mt-2">Archivo: {bulkName} — {bulkItems.length} filas válidas — {bulkErrors.length} errores</p>}
            {bulkErrors.length > 0 && (
              <ul className="mt-2 text-xs text-rose-600">{bulkErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Código', 'Nombre', 'Descripción', 'Teléfono', 'Contacto', 'Email', 'Activo', 'Acciones'].map(header => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
              </tr>
            </thead>
            <tbody>
              {proveedores.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">No hay proveedores registrados.</td></tr>
              ) : proveedores.map((proveedor, index) => {
                const cambios = editando[proveedor.code] || {};
                const isEditing = editingProveedorCode === proveedor.code;
                return (
                  <tr key={proveedor.code} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 font-mono text-slate-700">{proveedor.code}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={cambios.name ?? proveedor.name}
                          onChange={e => setEditando(prev => ({ ...prev, [proveedor.code]: { ...prev[proveedor.code], name: e.target.value } }))}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-slate-900">{proveedor.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={cambios.description ?? proveedor.description ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [proveedor.code]: { ...prev[proveedor.code], description: e.target.value } }))}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-slate-600">{proveedor.description || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={cambios.phone ?? proveedor.phone ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [proveedor.code]: { ...prev[proveedor.code], phone: e.target.value } }))}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-slate-600">{proveedor.phone || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={cambios.contact ?? proveedor.contact ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [proveedor.code]: { ...prev[proveedor.code], contact: e.target.value } }))}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-slate-600">{proveedor.contact || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={cambios.email ?? proveedor.email ?? ''}
                          onChange={e => setEditando(prev => ({ ...prev, [proveedor.code]: { ...prev[proveedor.code], email: e.target.value } }))}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-slate-600">{proveedor.email || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input type="checkbox" checked={Boolean(cambios.active ?? proveedor.active ?? true)} onChange={e => setEditando(prev => ({ ...prev, [proveedor.code]: { ...prev[proveedor.code], active: e.target.checked } }))} />
                      ) : (
                        <span>{proveedor.active ? 'Sí' : 'No'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {isEditing ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => guardarEdicion(proveedor.code)}>
                              Guardar
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => {
                              setEditingProveedorCode(null);
                              setEditando(prev => { const next = { ...prev }; delete next[proveedor.code]; return next; });
                            }}>
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => {
                              setEditingProveedorCode(proveedor.code);
                              setEditando(prev => ({ ...prev, [proveedor.code]: { ...proveedor } }));
                            }}>
                              Editar
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => eliminarProveedor(proveedor.code)}>
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
