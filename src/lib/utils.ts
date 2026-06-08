import * as XLSX from 'xlsx';

export function formatFecha(fecha: string): string {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

export function formatNumero(n: number | null | undefined, decimales = 2): string {
  if (n == null) return '0';
  return new Intl.NumberFormat('es-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  }).format(n);
}

export function hoy(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function exportarCSV(datos: Record<string, unknown>[], nombreArchivo: string): void {
  if (!datos.length) return;
  const headers = Object.keys(datos[0]);
  const filas = datos.map(row =>
    headers.map(h => {
      const val = row[h];
      const str = val == null ? '' : String(val);
      return str.includes(',') ? `"${str}"` : str;
    }).join(',')
  );
  const csv = [headers.join(','), ...filas].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo}_${hoy()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarExcel(datos: Record<string, unknown>[], nombreArchivo: string): void {
  if (!datos.length) return;
  const worksheet = XLSX.utils.json_to_sheet(datos);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo}_${hoy()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
