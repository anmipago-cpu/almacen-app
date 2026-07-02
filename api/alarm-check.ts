import type { VercelRequest, VercelResponse } from '@vercel/node';

const SEVERIDAD: Record<string, number> = { VERDE: 0, AMARILLO: 1, ROJO: 2, AGOTADO: 3 };

interface InvItem {
  code: string;
  name: string;
  stock_actual: number;
  stock_min: number;
  stock_bajo: number;
  lead_time_semanas: number | null;
  promedio_consumo_semanal: number;
}

function getEstado(item: InvItem): string {
  const { stock_actual: stock, stock_min, stock_bajo, lead_time_semanas: lt, promedio_consumo_semanal: promedio } = item;
  if (stock <= 0) return 'AGOTADO';
  if (lt && lt > 0 && promedio > 0) {
    const semanas = stock / promedio;
    if (semanas <= lt)     return 'ROJO';
    if (semanas <= lt + 1) return 'AMARILLO';
    return 'VERDE';
  }
  if (stock_min > 0 && stock <= stock_min)  return 'ROJO';
  if (stock_bajo > 0 && stock <= stock_bajo) return 'AMARILLO';
  return 'VERDE';
}

function buildMsg(items: InvItem[], hoy: string): string {
  let msg = `🚨 *ALERTA DE STOCK – ${hoy}*\n`;
  for (const p of items) {
    const estado = getEstado(p);
    const icon = estado === 'AGOTADO' ? '⚫' : estado === 'ROJO' ? '🔴' : '🟡';
    const lt = p.lead_time_semanas;
    const sems = lt && p.promedio_consumo_semanal > 0
      ? ` | ${(p.stock_actual / p.promedio_consumo_semanal).toFixed(1)} sem`
      : '';
    msg += `${icon} ${p.code} | ${p.name.slice(0, 40)} | Stock: ${p.stock_actual}${sems}\n`;
  }
  return msg.trim();
}

async function sbGet(url: string, key: string, path: string) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function sbPost(url: string, key: string, table: string, data: object) {
  await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
}

async function sendWhatsApp(msg: string) {
  const phones  = (process.env.CALLMEBOT_PHONE  ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const apikeys = (process.env.CALLMEBOT_APIKEY ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (!phones.length || !apikeys.length) return;
  const text = encodeURIComponent(msg);
  for (let i = 0; i < phones.length; i++) {
    const apikey = apikeys[i] ?? apikeys[0];
    if (i > 0) await new Promise(r => setTimeout(r, 1500));
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phones[i]}&text=${text}&apikey=${apikey}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Supabase no configurado' });

  const codes: string[] = (req.body?.codes ?? []).filter(Boolean);
  if (!codes.length) return res.status(400).json({ error: 'Sin códigos' });

  console.log('[alarm-check] códigos recibidos:', codes);

  const codesParam = codes.join(','); // PostgREST no necesita comillas para strings simples

  let items: InvItem[] = [];
  let gestiones: { producto_code: string; estado: string }[] = [];
  try {
    [items, gestiones] = await Promise.all([
      sbGet(url, key,
        `inventario_actual?select=code,name,stock_actual,stock_min,stock_bajo,lead_time_semanas,promedio_consumo_semanal&code=in.(${codesParam})`),
      sbGet(url, key,
        `alertas_gestion?select=producto_code,estado&informado_a=eq.SISTEMA&producto_code=in.(${codesParam})&order=created_at.desc`),
    ]);
  } catch (e) {
    console.error('[alarm-check] error consultando Supabase:', e);
    return res.status(500).json({ error: String(e) });
  }

  console.log('[alarm-check] items encontrados:', items.length, '| gestiones previas:', gestiones.length);

  // Último estado SISTEMA por producto
  const ultimoEstado: Record<string, string> = {};
  for (const g of gestiones) {
    if (!ultimoEstado[g.producto_code]) ultimoEstado[g.producto_code] = g.estado;
  }

  const empeorados: InvItem[] = [];
  const toRegister: object[] = [];

  for (const item of items) {
    const estadoActual = getEstado(item);
    const estadoPrevio = ultimoEstado[item.code] ?? 'VERDE';
    const sevActual = SEVERIDAD[estadoActual] ?? 0;
    const sevPrevio = SEVERIDAD[estadoPrevio] ?? 0;

    if (sevActual !== sevPrevio) {
      toRegister.push({
        producto_code: item.code,
        estado: estadoActual,
        stock_actual: item.stock_actual,
        informado_a: 'SISTEMA',
        notas: sevActual > sevPrevio ? 'Auto-notificado' : 'Recuperado',
      });
      if (sevActual > sevPrevio) empeorados.push(item);
    }
  }

  console.log('[alarm-check] empeorados:', empeorados.map(i => `${i.code}(${getEstado(i)})`));
  console.log('[alarm-check] registrar:', toRegister.length, 'cambios de estado');

  // Enviar WhatsApp en línea
  if (empeorados.length) {
    const hoy = new Date().toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota',
    });
    await sendWhatsApp(buildMsg(empeorados, hoy));
  }

  // Registrar nuevos estados
  await Promise.all(toRegister.map(r => sbPost(url, key, 'alertas_gestion', r)));

  return res.status(200).json({ checked: items.length, worsened: empeorados.length });
}
