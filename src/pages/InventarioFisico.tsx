import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Save, RefreshCw, Upload, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

interface FilaCSV {
  codigo: string;
  cantidad: number;
  lote: string;
  nombre?: string;
  unidad?: string;
  unit_content?: number;
  total_base?: number;
  encontrado: boolean;
}

export function InventarioFisico() {
  const { productos, recargar } = useProductos();
  const [counts, setCounts] = useState<Record<string, ConteoFila[]>>({});
  const [fecha, setFecha] = useState(hoy());
  const [realizadoPor, setRealizadoPor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvRows, setCsvRows] = useState<FilaCSV[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  function parsearCSV(text: string): FilaCSV[] {
    const lineas = text.split(/\r?\n/).filter(l => l.trim());
    if (!lineas.length) return [];
    // detectar separador
    const sep = lineas[0].includes(';') ? ';' : ',';
    // detectar si tiene encabezado
    const primeraLinea = lineas[0].toLowerCase();
    const tieneEncabezado = primeraLinea.includes('codigo') || primeraLinea.includes('código') || primeraLinea.includes('code') || primeraLinea.includes('cantidad');
    const filas = tieneEncabezado ? lineas.slice(1) : lineas;

    return filas.map(linea => {
      const cols = linea.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const codigo = cols[0] ?? '';
      const cantidad = Number(cols[1] ?? 0);
      const lote = cols[2] ?? '';
      const prod = productos.find(p => p.code === codigo);
      return {
        codigo,
        cantidad: isNaN(cantidad) ? 0 : cantidad,
        lote,
        nombre: prod?.name,
        unidad: prod?.unit,
        unit_content: prod?.unit_content ?? 1,
        total_base: cantidad * (prod?.unit_content ?? 1),
        encontrado: !!prod,
      };
    }).filter(f => f.codigo);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      try {
        const rows = parsearCSV(text);
        if (!rows.length) { setCsvError('El archivo no tiene filas válidas.'); return; }
        setCsvRows(rows);
      } catch {
        setCsvError('No se pudo leer el archivo. Verifica que sea CSV o TXT.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }

  async function guardarDesdeCSV() {
    if (!realizadoPor) { setCsvError('Ingresa el responsable del inventario antes de guardar.'); return; }
    const validas = csvRows.filter(r => {
      if (!r.encontrado || r.cantidad <= 0) return false;
      const prod = productos.find(p => p.code === r.codigo);
      if ((prod?.category === 'PP' || prod?.requires_lot) && !r.lote) return false;
      return true;
    });
    if (!validas.length) { setCsvError('No hay filas válidas para guardar. Verifica los códigos y que los empaques primarios tengan lote.'); return; }

    setSaving(true);
    setCsvError(null);
    try {
      const entries: InventarioFisicoItem[] = validas.map(r => ({
        fecha,
        realizado_por: realizadoPor,
        producto_code: r.codigo,
        producto_name: r.nombre!,
        lote: r.lote || undefined,
        cantidad_contada: r.cantidad,
        unidad: r.unidad || 'UNIDAD',
        total_unidades_base: r.total_base!,
      }));
      const { error: err } = await supabase.from('inventarios_fisicos').insert(entries);
      if (err) throw err;
      setShowImport(false);
      setCsvRows([]);
      await recargar();
    } catch (e: unknown) {
      setCsvError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
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
          <div className="flex gap-2">
            <Button variant="outline" icon={<Upload size={16} />} onClick={() => { setShowImport(true); setCsvRows([]); setCsvError(null); }}>
              Importar CSV
            </Button>
            <Button variant="outline" icon={<RefreshCw size={16} />} onClick={recargar}>
              Refrescar
            </Button>
          </div>
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

      {/* Modal importación CSV */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl mt-8 mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Importar inventario desde CSV</h2>
                <p className="text-sm text-slate-500">Formato: <code className="bg-slate-100 px-1 rounded text-xs">codigo, cantidad, lote</code> — el lote es obligatorio para Empaque Primario (PP)</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Instrucciones */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 space-y-1">
                <p className="font-semibold">Cómo preparar el archivo:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                  <li>En Excel, guarda como CSV (separado por comas o punto y coma)</li>
                  <li>Columna A: Código del producto (ej: <code className="bg-blue-100 px-1 rounded">PP-01-001</code>)</li>
                  <li>Columna B: Cantidad en unidad de conteo (número de cajas)</li>
                  <li>Columna C: Lote — <strong>obligatorio para PP</strong>, dejar vacío para SP y demás</li>
                  <li>Puede o no tener fila de encabezado, se detecta automáticamente</li>
                </ol>
              </div>

              {/* Selector de archivo */}
              <div className="flex items-center gap-3">
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
                <Button variant="outline" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
                  Seleccionar archivo
                </Button>
                {csvRows.length > 0 && (
                  <span className="text-sm text-slate-600">{csvRows.length} filas leídas</span>
                )}
              </div>

              {csvError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {csvError}
                </div>
              )}

              {/* Preview tabla */}
              {csvRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Estado', 'Código', 'Nombre', 'Cant. (unidad)', 'Unidad conteo', 'Cant. base', 'Unidad base', 'Lote'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => {
                        const prod = productos.find(p => p.code === row.codigo);
                        const necesitaLote = prod?.category === 'PP' || prod?.requires_lot;
                        const sinLote = necesitaLote && !row.lote;
                        const rowOk = row.encontrado && row.cantidad > 0 && !sinLote;
                        return (
                          <tr key={i} className={!row.encontrado ? 'bg-red-50' : sinLote ? 'bg-yellow-50' : 'hover:bg-slate-50'}>
                            <td className="px-3 py-2">
                              {rowOk ? (
                                <CheckCircle2 size={16} className="text-green-500" />
                              ) : !row.encontrado ? (
                                <span className="text-xs text-red-600 font-medium">No encontrado</span>
                              ) : sinLote ? (
                                <span className="text-xs text-yellow-700 font-medium">Falta lote</span>
                              ) : (
                                <span className="text-xs text-slate-400">Cantidad 0</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.codigo}</td>
                            <td className="px-3 py-2 text-slate-900">{row.nombre ?? <span className="text-red-500 italic">—</span>}</td>
                            <td className="px-3 py-2 text-right font-mono">{row.cantidad}</td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{row.unidad ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">{row.total_base !== undefined ? formatNumero(row.total_base, 0) : '—'}</td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{prod?.unit_base ?? '—'}</td>
                            <td className={`px-3 py-2 text-xs ${sinLote ? 'text-yellow-700 font-semibold' : 'text-slate-600'}`}>
                              {row.lote || (necesitaLote ? '⚠ requerido' : '—')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Resumen */}
              {csvRows.length > 0 && (() => {
                const ok = csvRows.filter(r => r.encontrado && r.cantidad > 0 && !(r.codigo.startsWith('PP') && !r.lote && productos.find(p => p.code === r.codigo)?.category === 'PP')).length;
                const noEncontrados = csvRows.filter(r => !r.encontrado).length;
                const sinLote = csvRows.filter(r => {
                  const p = productos.find(px => px.code === r.codigo);
                  return r.encontrado && (p?.category === 'PP' || p?.requires_lot) && !r.lote;
                }).length;
                return (
                  <div className="flex flex-wrap gap-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm">
                    <span className="text-green-700 font-medium"><CheckCircle2 size={14} className="inline mr-1" />{ok} filas listas para importar</span>
                    {noEncontrados > 0 && <span className="text-red-600 font-medium"><AlertTriangle size={14} className="inline mr-1" />{noEncontrados} código(s) no encontrado(s) — se omitirán</span>}
                    {sinLote > 0 && <span className="text-yellow-700 font-medium"><AlertTriangle size={14} className="inline mr-1" />{sinLote} empaque(s) primario(s) sin lote — se omitirán</span>}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <Button variant="outline" onClick={() => setShowImport(false)}>Cancelar</Button>
              <Button
                icon={<Save size={16} />}
                onClick={guardarDesdeCSV}
                loading={saving}
                disabled={!csvRows.some(r => r.encontrado && r.cantidad > 0)}
              >
                Guardar inventario
              </Button>
            </div>
          </div>
        </div>
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
