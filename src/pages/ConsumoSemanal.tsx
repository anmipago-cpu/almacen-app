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

function getSemanaActual(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function isoWeekToRange(weekStr: string): { numero: number; año: number; label: string } {
  const [yearStr, wStr] = weekStr.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayW1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  const inicio = new Date(mondayW1.getTime() + (week - 1) * 7 * 86400000);
  const fin = new Date(inicio.getTime() + 6 * 86400000);
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const label = `Sem. ${week} · ${inicio.getDate()} ${meses[inicio.getMonth()]} - ${fin.getDate()} ${meses[fin.getMonth()]} ${year}`;
  return { numero: week, año: year, label };
}

interface ParsedRow { code: string; name: string; cantidad: number; }

export function ConsumoSemanal() {
  const { productos } = useProductos();

  // ── Selector de semana ──────────────────────────────────────────────────
  const [semana, setSemana] = useState(getSemanaActual());
  const semanaInfo = semana ? isoWeekToRange(semana) : null;

  // ── Filtros buscador ────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('');
  const [catFiltro, setCatFiltro] = useState('');
  const [subFiltro, setSubFiltro] = useState('');

  const subcatsDisponibles = useMemo(() => {
    if (!catFiltro) return [];
    return Object.entries(SUBCATEGORIAS[catFiltro] || {}).map(([key, label]) => ({ key: `${catFiltro}:${key}`, label }));
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

  function parseRows(headers: string[], rawRows: string[][]): ParsedRow[] {
    const h = headers.map(x => x.trim().toLowerCase());
    const iCode = h.findIndex(x => ['codigo','código','code'].includes(x));
    const iName = h.findIndex(x => ['nombre','name'].includes(x));
    const iCant = h.findIndex(x => ['cantidad','qty','quantity'].includes(x));
    return rawRows.map(values => ({
      code:     String(values[iCode >= 0 ? iCode : 0] ?? '').trim(),
      name:     String(values[iName >= 0 ? iName : 1] ?? '').trim(),
      cantidad: Number(String(values[iCant >= 0 ? iCant : 2] ?? '0').replace(',', '.')),
    }));
  }

  async function parseCSV(text: string): Promise<ParsedRow[]> {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('El archivo debe tener cabecera y al menos una fila.');
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep);
    const rawRows = lines.slice(1).map(l => l.split(sep));
    return parseRows(headers, rawRows);
  }

  async function parseXLSX(file: File): Promise<ParsedRow[]> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    if (raw.length < 2) throw new Error('El archivo debe tener cabecera y al menos una fila.');
    const headers = (raw[0] as string[]).map(h => String(h ?? ''));
    const rawRows = raw.slice(1).map(r => (r as unknown[]).map(v => String(v ?? '')));
    return parseRows(headers, rawRows);
  }

  async function processFile(file: File) {
    if (!semana) {
      toast.error('Selecciona la semana antes de cargar el archivo.');
      return;
    }
    setSummary(null);
    setWarnings([]);
    setFileName(file.name);
    setLoading(true);
    try {
      const rows = file.name.toLowerCase().endsWith('.xlsx')
        ? await parseXLSX(file)
        : await parseCSV(await file.text());

      const info = isoWeekToRange(semana);
      const codes = rows.map(r => r.code).filter(Boolean);
      const { data: existing, error: err } = await supabase.from('productos').select('code,name').in('code', codes);
      if (err) throw err;

      const existingMap = new Map<string, string>();
      (existing || []).forEach(item => { if (item.code) existingMap.set(item.code, item.name ?? ''); });

      const missingCodes: string[] = [];
      const toInsert: Partial<ConsumoSemanal>[] = [];

      rows.forEach(row => {
        if (!row.code) return;
        if (!existingMap.has(row.code)) { missingCodes.push(row.code); return; }
        if (row.cantidad <= 0) return;
        toInsert.push({
          semana_numero: info.numero,
          año: info.año,
          producto_code: row.code,
          producto_name: row.name || existingMap.get(row.code) || '',
          cantidad_consumida: row.cantidad,
          fuente: 'ARCHIVO',
        });
      });

      if (toInsert.length === 0) throw new Error('No se encontraron registros válidos (cantidad > 0) para importar.');

      const { error: insertError } = await supabase
        .from('consumos_semanales')
        .upsert(toInsert, { onConflict: 'semana_numero,año,producto_code' });
      if (insertError) throw insertError;

      toast.success(`${toInsert.length} productos importados para ${info.label}`);
      setWarnings(missingCodes.map(code => `Código no encontrado en catálogo: ${code}`));
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

      {/* ── Buscador por categoría ── */}
      <Card className="mb-5">
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-800">Consultar productos por categoría</h2>

          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORIAS).map(([code, cat]) => (
              <button key={code}
                onClick={() => { setCatFiltro(catFiltro === code ? '' : code); setSubFiltro(''); }}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  catFiltro === code
                    ? `${cat.bg} ${cat.text} ${cat.border} border`
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                }`}>
                {cat.label}
              </button>
            ))}
            {(catFiltro || busqueda) && (
              <button onClick={() => { setCatFiltro(''); setSubFiltro(''); setBusqueda(''); }}
                className="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200">
                Limpiar
              </button>
            )}
          </div>

          {subcatsDisponibles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {subcatsDisponibles.map(s => (
                <button key={s.key}
                  onClick={() => setSubFiltro(subFiltro === s.key ? '' : s.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                    subFiltro === s.key
                      ? 'bg-slate-700 text-white border-slate-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o código..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

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
                  {productosFiltrados.length === 0
                    ? <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">Sin resultados</td></tr>
                    : productosFiltrados.map(p => (
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
          <h2 className="text-lg font-semibold text-slate-900">Cargar consumo semanal</h2>

          {/* Selector de semana */}
          <div>
            <label className="text-sm font-medium text-slate-700">Semana <span className="text-red-500">*</span></label>
            <input type="week" value={semana} onChange={e => { setSemana(e.target.value); setSummary(null); setWarnings([]); setFileName(''); }}
              className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {semanaInfo && (
              <p className="mt-1 text-xs text-slate-500">{semanaInfo.label}</p>
            )}
          </div>

          {/* Botón subir */}
          <div className="flex items-center gap-4">
            <Button variant="secondary" icon={<UploadCloud size={16} />}
              onClick={() => document.getElementById('consumo-file')?.click()} loading={loading}>
              Seleccionar archivo CSV / Excel
            </Button>
            {fileName && <span className="text-sm text-slate-500 truncate">{fileName}</span>}
          </div>

          <input id="consumo-file" type="file" accept=".csv,.xlsx"
            onChange={e => { const file = e.target.files?.[0]; if (file) processFile(file); e.target.value = ''; }}
            className="hidden" />

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

          {/* Formato */}
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
            <p className="font-semibold text-slate-900">Formato del archivo</p>
            <p className="font-mono text-xs bg-white border border-slate-200 rounded-lg px-3 py-2">
              codigo, nombre, cantidad
            </p>
            <ul className="space-y-1 text-xs list-disc pl-4">
              <li><strong>codigo</strong>: código exacto del catálogo (ej: SP-02-001)</li>
              <li><strong>nombre</strong>: nombre del producto (referencia, puede quedar vacío)</li>
              <li><strong>cantidad</strong>: cantidad consumida — filas con 0 se omiten</li>
            </ul>
            <p className="text-xs text-slate-400">La semana se toma del selector de arriba, no del archivo.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
