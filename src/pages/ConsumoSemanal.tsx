import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, AlertTriangle, Search } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useProductos } from '../hooks/useProductos';
import { CATEGORIAS, SUBCATEGORIAS } from '../types';
import * as XLSX from 'xlsx';
import type { ConsumoSemanal } from '../types';

interface ParsedRow {
  code: string;
  name: string;
  cantidad: number;
}

export function ConsumoSemanal() {
  const { productos } = useProductos();

  // ── Filtros buscador ────────────────────────────────────────────────────
  const [busqueda, setBusqueda]         = useState('');
  const [catFiltro, setCatFiltro]       = useState('');
  const [subFiltro, setSubFiltro]       = useState('');

  const subcatsDisponibles = useMemo(() => {
    const cat = catFiltro || '';
    if (!cat) return [];
    return Object.entries(SUBCATEGORIAS[cat] || {}).map(([key, label]) => ({ key: `${cat}:${key}`, label }));
  }, [catFiltro]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(p => {
      const matchCat  = !catFiltro || p.category === catFiltro;
      const matchSub  = !subFiltro || `${p.category}:${p.subcategory}` === subFiltro;
      const matchText = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      return matchCat && matchSub && matchText && p.active !== false;
    });
  }, [productos, catFiltro, subFiltro, busqueda]);

  // ── Upload ──────────────────────────────────────────────────────────────
  const [fileName, setFileName]   = useState('');
  const [warnings, setWarnings]   = useState<string[]>([]);
  const [summary, setSummary]     = useState<{ imports: number; warnings: number } | null>(null);
  const [loading, setLoading]     = useState(false);
  const [weekLabel, setWeekLabel] = useState('');

  async function parseCSV(text: string): Promise<{ rows: ParsedRow[]; weekNumber: number | null; year: number | null }> {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) throw new Error('El archivo debe contener cabecera y al menos una fila de datos.');

    const headers = lines[0].split(',').map(h => h.trim());
    const weekHeader = headers.find(h => /semana/i.test(h));
    const weekNumber = weekHeader ? parseInt(weekHeader.replace(/[^0-9]/g, ''), 10) : NaN;
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return { code: values[0] || '', name: values[1] || '', cantidad: Number(values[2] ?? 0) };
    });
    return { rows, weekNumber: Number.isNaN(weekNumber) ? null : weekNumber, year: new Date().getFullYear() };
  }

  async function parseXLSX(file: File) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    if (raw.length < 2) throw new Error('El archivo debe contener cabecera y al menos una fila de datos.');

    const headers = (raw[0] as string[]).map(h => String(h ?? '').trim());
    const weekHeader = headers.find(h => /semana/i.test(h));
    const weekNumber = weekHeader ? parseInt(weekHeader.replace(/[^0-9]/g, ''), 10) : NaN;
    const rows = raw.slice(1).map((row) => {
      const values = row as unknown[];
      return {
        code: String(values[0] ?? '').trim(),
        name: String(values[1] ?? '').trim(),
        cantidad: Number(values[2] ?? 0),
      };
    });
    return { rows, weekNumber: Number.isNaN(weekNumber) ? null : weekNumber, year: new Date().getFullYear() };
  }

  async function processFile(file: File) {
    setSummary(null);
    setWarnings([]);
    setFileName(file.name);
    setLoading(true);
    try {
      let parseResult;
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        parseResult = await parseXLSX(file);
      } else {
        const text = await file.text();
        parseResult = await parseCSV(text);
      }

      const semana = parseResult.weekNumber ?? parseInt(prompt('No se detectó el número de semana. Ingresa la semana manualmente:') || '', 10);
      if (!semana || Number.isNaN(semana)) throw new Error('No se encontró un número de semana válido.');

      setWeekLabel(`Semana ${semana}`);
      const codes = parseResult.rows.map(row => row.code).filter(Boolean);
      const { data: existing, error: err } = await supabase.from('productos').select('code,name').in('code', codes);
      if (err) throw err;

      const existingMap = new Map<string, string>();
      (existing || []).forEach(item => { if (item.code) existingMap.set(item.code, item.name ?? ''); });

      const missingCodes: string[] = [];
      const toInsert: Partial<ConsumoSemanal>[] = [];

      parseResult.rows.forEach(row => {
        if (!row.code || !row.name) return;
        if (!existingMap.has(row.code)) { missingCodes.push(row.code); return; }
        toInsert.push({
          semana_numero: semana,
          año: new Date().getFullYear(),
          producto_code: row.code,
          producto_name: row.name,
          cantidad_consumida: row.cantidad,
          fuente: 'ARCHIVO',
        });
      });

      if (toInsert.length === 0) throw new Error('No se encontraron registros válidos para importar.');

      const { error: insertError } = await supabase
        .from('consumos_semanales')
        .upsert(toInsert, { onConflict: 'semana_numero,año,producto_code' });
      if (insertError) throw insertError;

      toast.success(`Importados ${toInsert.length} productos${missingCodes.length ? `, ${missingCodes.length} códigos no encontrados` : ''}.`);
      setWarnings(missingCodes.map(code => `Código no encontrado: ${code}`));
      setSummary({ imports: toInsert.length, warnings: missingCodes.length });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Fallo al procesar el archivo';
      toast.error(message);
      setWarnings([message]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header
        title="Carga Semanal (Solo monitoreo)"
        subtitle="Registra consumos históricos por semana para seguimiento. No descuenta inventario."
      />

      {/* Aviso */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-red-400 bg-red-50 px-5 py-4 shadow-sm">
        <span className="mt-0.5 text-2xl">⚠️</span>
        <div>
          <p className="text-sm font-bold text-red-700 uppercase tracking-wide">Esta opción NO descuenta inventario</p>
          <p className="text-sm text-red-700 mt-1">
            Los datos cargados aquí son únicamente para <strong>monitoreo y estadísticas</strong>. Para descontar materiales del inventario usa el módulo <strong>Consumo</strong>.
          </p>
        </div>
      </div>

      {/* ── Buscador de productos por categoría ── */}
      <Card className="mb-5">
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-800">Consultar productos por categoría</h2>

          {/* Filtros de categoría */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORIAS).map(([code, cat]) => (
              <button
                key={code}
                onClick={() => { setCatFiltro(catFiltro === code ? '' : code); setSubFiltro(''); }}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  catFiltro === code
                    ? `${cat.bg} ${cat.text} ${cat.border} border`
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
            {catFiltro && (
              <button onClick={() => { setCatFiltro(''); setSubFiltro(''); setBusqueda(''); }}
                className="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200">
                Limpiar
              </button>
            )}
          </div>

          {/* Subcategorías */}
          {subcatsDisponibles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {subcatsDisponibles.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSubFiltro(subFiltro === s.key ? '' : s.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                    subFiltro === s.key
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Búsqueda por texto */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o código..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tabla de productos */}
          {(catFiltro || busqueda) && (
            <div className="overflow-auto max-h-72 rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-28">Código</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Nombre</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-24">Unidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productosFiltrados.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">Sin resultados</td></tr>
                  ) : productosFiltrados.map(p => (
                    <tr key={p.code} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{p.code}</td>
                      <td className="px-3 py-2 text-slate-800">{p.name}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{p.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">
                {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Carga de archivo ── */}
      <Card>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Cargar consumo semanal</h2>
              <p className="text-sm text-slate-500">Selecciona un archivo con las columnas Código, Nombre y Semana N.</p>
            </div>
            <div className="flex items-center justify-end">
              <Button variant="secondary" icon={<UploadCloud size={16} />} onClick={() => document.getElementById('consumo-file')?.click()} loading={loading}>
                Seleccionar archivo
              </Button>
            </div>
          </div>

          <input id="consumo-file" type="file" accept=".csv,.xlsx"
            onChange={e => { const file = e.target.files?.[0]; if (file) processFile(file); }}
            className="hidden" />

          {fileName && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Archivo seleccionado</p>
              <p>{fileName}</p>
              {weekLabel && <p className="mt-1 text-slate-500">{weekLabel}</p>}
            </div>
          )}

          {summary && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">Productos registrados</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{summary.imports}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">Advertencias</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{summary.warnings}</p>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} /> Advertencias</div>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            <p className="font-semibold text-slate-900">Formato aceptado</p>
            <p className="mt-2">Columna A: Código, Columna B: Nombre, Columna C: Semana N.</p>
            <p>Ejemplo de cabecera: <span className="font-mono">Código, Nombre, Semana 12</span></p>
          </div>
        </div>
      </Card>
    </div>
  );
}
