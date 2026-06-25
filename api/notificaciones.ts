import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

interface AlertProduct {
  code: string;
  name: string;
  category: string;
  stock_actual: number;
  stock_min: number;
  stock_bajo: number;
  lead_time_semanas?: number;
  promedio_consumo_semanal: number;
  semanas_restantes: string;
  estado: 'AGOTADO' | 'ROJO' | 'AMARILLO' | 'VERDE';
}

function fecha() {
  return new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildWhatsApp(productos: AlertProduct[], hoy: string, recordatorio = false): string {
  const agotados = productos.filter(p => p.estado === 'AGOTADO');
  const criticos  = productos.filter(p => p.estado === 'ROJO');
  const alertas   = productos.filter(p => p.estado === 'AMARILLO');

  const titulo = recordatorio
    ? `⏰ *RECORDATORIO STOCK CRÍTICO – ${hoy}*\nEstos productos llevan 4+ días sin solución:`
    : `🚨 *ALERTA DE STOCK – ${hoy}*\n${productos.length} producto(s) requieren atención.`;
  let msg = titulo + '\n';

  if (agotados.length) {
    msg += `\n⚫ *SIN STOCK (${agotados.length}):*\n`;
    agotados.forEach(p => { msg += `• ${p.code} | ${p.name} | Stock: 0\n`; });
  }
  if (criticos.length) {
    msg += `\n🔴 *CRÍTICO (${criticos.length}):*\n`;
    criticos.forEach(p => { msg += `• ${p.code} | ${p.name} | Stock: ${p.stock_actual} | ${p.semanas_restantes} sem\n`; });
  }
  if (alertas.length) {
    msg += `\n🟡 *ALERTA (${alertas.length}):*\n`;
    alertas.forEach(p => { msg += `• ${p.code} | ${p.name} | Stock: ${p.stock_actual} | ${p.semanas_restantes} sem\n`; });
  }

  return msg.trim();
}

function buildEmailHtml(productos: AlertProduct[], hoy: string): string {
  const agotados = productos.filter(p => p.estado === 'AGOTADO');
  const criticos  = productos.filter(p => p.estado === 'ROJO');
  const alertas   = productos.filter(p => p.estado === 'AMARILLO');

  const tableRow = (p: AlertProduct, color: string, label: string) => `
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#334155">${p.code}</td>
      <td style="padding:8px 12px;font-size:13px;color:#0f172a">${p.name}</td>
      <td style="padding:8px 12px;text-align:center;font-weight:700;color:${color};font-size:12px">${label}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:13px">${p.stock_actual.toLocaleString('es-CO')}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:13px;color:#64748b">${p.stock_min}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:13px;color:#64748b">${p.semanas_restantes}</td>
    </tr>`;

  const rows = [
    ...agotados.map(p => tableRow(p, '#0f172a', 'SIN STOCK')),
    ...criticos.map(p => tableRow(p, '#dc2626', 'CRÍTICO')),
    ...alertas.map(p => tableRow(p, '#d97706', 'ALERTA')),
  ].join('');

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif">
  <div style="max-width:680px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0f172a;padding:24px 28px">
      <h1 style="color:white;margin:0;font-size:20px;font-weight:700">🚨 Alerta de Stock</h1>
      <p style="color:#94a3b8;margin:6px 0 0;font-size:13px">${hoy} &mdash; ${productos.length} producto(s) requieren atención de compra</p>
    </div>
    <div style="padding:24px 28px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:600">Código</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:600">Producto</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:600">Estado</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:600">Stock actual</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:600">Stock mín.</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:600">Sem. rest.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">Generado por Almacén App &mdash; ${hoy}</p>
    </div>
  </div>
</body>
</html>`;
}

const ESTADO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  AGOTADO: { label: 'SIN STOCK',  color: '#ffffff', bg: '#0f172a' },
  ROJO:    { label: 'CRÍTICO',    color: '#ffffff', bg: '#dc2626' },
  AMARILLO:{ label: 'ALERTA',     color: '#92400e', bg: '#fef3c7' },
  VERDE:   { label: 'OK',         color: '#166534', bg: '#dcfce7' },
};

function buildGestionEmailHtml(p: AlertProduct, hoy: string): string {
  const est = ESTADO_LABELS[p.estado] ?? ESTADO_LABELS.AMARILLO;
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0f172a;padding:24px 28px">
      <h1 style="color:white;margin:0;font-size:20px;font-weight:700">📋 Producto informado al área de compras</h1>
      <p style="color:#94a3b8;margin:6px 0 0;font-size:13px">${hoy}</p>
    </div>
    <div style="padding:28px">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <tr style="background:#f8fafc">
          <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;width:40%">Código</td>
          <td style="padding:10px 16px;font-family:monospace;font-size:14px;color:#0f172a;font-weight:700">${p.code}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;border-top:1px solid #f1f5f9">Producto</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;border-top:1px solid #f1f5f9">${p.name}</td>
        </tr>
        <tr style="background:#f8fafc">
          <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;border-top:1px solid #f1f5f9">Categoría</td>
          <td style="padding:10px 16px;font-size:14px;color:#334155;border-top:1px solid #f1f5f9">${p.category}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;border-top:1px solid #f1f5f9">Estado alarma</td>
          <td style="padding:10px 16px;border-top:1px solid #f1f5f9">
            <span style="background:${est.bg};color:${est.color};padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700">${est.label}</span>
          </td>
        </tr>
        <tr style="background:#f8fafc">
          <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;border-top:1px solid #f1f5f9">Stock actual</td>
          <td style="padding:10px 16px;font-family:monospace;font-size:14px;font-weight:700;color:#0f172a;border-top:1px solid #f1f5f9">${p.stock_actual.toLocaleString('es-CO')}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;border-top:1px solid #f1f5f9">Stock mínimo</td>
          <td style="padding:10px 16px;font-family:monospace;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">${p.stock_min}</td>
        </tr>
        <tr style="background:#f8fafc">
          <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;border-top:1px solid #f1f5f9">Semanas restantes</td>
          <td style="padding:10px 16px;font-family:monospace;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">${p.semanas_restantes} sem</td>
        </tr>
        ${p.lead_time_semanas != null ? `<tr>
          <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;border-top:1px solid #f1f5f9">Lead time</td>
          <td style="padding:10px 16px;font-family:monospace;font-size:14px;color:#64748b;border-top:1px solid #f1f5f9">${p.lead_time_semanas} sem</td>
        </tr>` : ''}
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#64748b">Este correo fue generado al marcar el producto como <strong>informado</strong> en el módulo de Alarmas.</p>
    </div>
    <div style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:12px;color:#94a3b8">Almacén App &mdash; ${hoy}</p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const type: string        = req.body?.type ?? 'alerta';
  const recordatorio: boolean = req.body?.recordatorio ?? false;
  const productos: AlertProduct[] = req.body?.productos ?? [];
  if (!productos.length) return res.status(400).json({ error: 'Sin productos en alerta' });

  const hoy = fecha();
  const results: Record<string, string> = {};

  // ── Tipo "gestion": solo email al área de compras ──────────────────────
  if (type === 'gestion') {
    const resendKey = process.env.RESEND_API_KEY;
    const emailTos  = (process.env.GESTION_EMAIL_TO ?? '').split(/[,\n\r]+/).map(s => s.trim()).filter(Boolean);
    const emailFrom = process.env.ALERT_EMAIL_FROM ?? 'onboarding@resend.dev';
    if (resendKey && emailTos.length) {
      const resend = new Resend(resendKey);
      const p = productos[0];
      const est = ESTADO_LABELS[p.estado]?.label ?? p.estado;
      const subject = `[COMPRAS ${hoy}] ${est} – ${p.code} ${p.name}`;
      const emailResults: string[] = [];
      for (const to of emailTos) {
        try {
          const { error } = await resend.emails.send({ from: emailFrom, to, subject, html: buildGestionEmailHtml(p, hoy) });
          emailResults.push(`${to}: ${error ? `error ${error.message}` : 'ok'}`);
        } catch (e) {
          emailResults.push(`${to}: error ${(e as Error).message}`);
        }
      }
      results.email = emailResults.join(' | ');
    } else {
      results.email = 'no configurado (faltan RESEND_API_KEY / GESTION_EMAIL_TO)';
    }
    return res.status(200).json({ ok: true, results });
  }

  // ── WhatsApp via CallMeBot (soporta múltiples números) ────────────────
  const waPhones  = (process.env.CALLMEBOT_PHONE  ?? '').split(/[,\n\r]+/).map(s => s.trim()).filter(Boolean);
  const waApiKeys = (process.env.CALLMEBOT_APIKEY ?? '').split(/[,\n\r]+/).map(s => s.trim()).filter(Boolean);
  if (waPhones.length && waApiKeys.length) {
    const text = encodeURIComponent(buildWhatsApp(productos, hoy, recordatorio));
    const waResults: string[] = [];
    for (let i = 0; i < waPhones.length; i++) {
      const phone  = waPhones[i];
      const apikey = waApiKeys[i] ?? waApiKeys[0]; // si hay menos keys que números, reutiliza la primera
      const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${apikey}`;
      try {
        // CallMeBot requiere esperar 1s entre mensajes
        if (i > 0) await new Promise(r => setTimeout(r, 1500));
        const r = await fetch(url);
        waResults.push(`${phone}: ${r.ok ? 'ok' : `error ${r.status}`}`);
      } catch (e) {
        waResults.push(`${phone}: error ${(e as Error).message}`);
      }
    }
    results.whatsapp = waResults.join(' | ');
  } else {
    results.whatsapp = 'no configurado (faltan CALLMEBOT_PHONE / CALLMEBOT_APIKEY)';
  }

  // ── Email via Resend (soporta múltiples destinatarios) ─────────────────
  const resendKey = process.env.RESEND_API_KEY;
  const emailTos  = (process.env.ALERT_EMAIL_TO ?? '').split(/[,\n\r]+/).map(s => s.trim()).filter(Boolean);
  const emailFrom = process.env.ALERT_EMAIL_FROM ?? 'onboarding@resend.dev';
  if (resendKey && emailTos.length) {
    const resend = new Resend(resendKey);
    const codigos  = productos.slice(0, 3).map(p => p.code).join(', ') + (productos.length > 3 ? '...' : '');
    const prefijo  = recordatorio ? '[RECORDATORIO STOCK]' : '[ALERTA STOCK]';
    const subject  = `${prefijo} ${hoy} – ${productos.length} producto(s) – ${codigos}`;
    const emailResults: string[] = [];
    for (const to of emailTos) {
      try {
        const { error } = await resend.emails.send({ from: emailFrom, to, subject, html: buildEmailHtml(productos, hoy) });
        emailResults.push(`${to}: ${error ? `error ${error.message}` : 'ok'}`);
      } catch (e) {
        emailResults.push(`${to}: error ${(e as Error).message}`);
      }
    }
    results.email = emailResults.join(' | ');
  } else {
    results.email = 'no configurado (faltan RESEND_API_KEY / ALERT_EMAIL_TO)';
  }

  return res.status(200).json({ ok: true, results });
}
