"""
Resumen semanal de alarmas de stock — corre los lunes a las 8 AM Colombia.
Solo envía alarmas activas que NO han sido informadas manualmente en la app.
La detección de cambios en tiempo real la maneja api/alarm-check.ts (Vercel).
"""
import os, time, requests
from datetime import datetime, timezone
from urllib.parse import quote

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
WA_PHONES    = [p.strip() for p in os.environ.get('CALLMEBOT_PHONE',  '').split(',') if p.strip()]
WA_APIKEYS   = [k.strip() for k in os.environ.get('CALLMEBOT_APIKEY', '').split(',') if k.strip()]

SEVERIDAD = {'VERDE': 0, 'AMARILLO': 1, 'ROJO': 2, 'AGOTADO': 3}

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
}


def sb_get(table, params=''):
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{table}?{params}', headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def get_estado(item):
    stock      = item.get('stock_actual', 0) or 0
    stock_min  = item.get('stock_min',    0) or 0
    stock_bajo = item.get('stock_bajo',   0) or 0
    lead_time  = item.get('lead_time_semanas') or 0
    promedio   = item.get('promedio_consumo_semanal', 0) or 0

    if stock <= 0: return 'AGOTADO'

    # Misma lógica que getSemaforo() en el frontend
    if lead_time > 0 and promedio > 0:
        semanas = stock / promedio
        if semanas <= lead_time:     return 'ROJO'
        if semanas <= lead_time + 1: return 'AMARILLO'
        return 'VERDE'

    if stock_min > 0 and stock <= stock_min:  return 'ROJO'
    if stock_bajo > 0 and stock <= stock_bajo: return 'AMARILLO'
    return 'VERDE'


def get_semanas(item):
    promedio = item.get('promedio_consumo_semanal', 0) or 0
    stock    = item.get('stock_actual', 0) or 0
    if promedio <= 0: return '—'
    return str(round(stock / promedio, 1))


def build_msg(items, titulo, hoy):
    agotados = [i for i in items if i['_estado'] == 'AGOTADO']
    criticos  = [i for i in items if i['_estado'] == 'ROJO']
    alertas   = [i for i in items if i['_estado'] == 'AMARILLO']

    msg = f'{titulo} – {hoy}\n'
    if agotados:
        msg += f'\n⚫ SIN STOCK ({len(agotados)}):\n'
        for p in agotados:
            msg += f'• {p["code"]} | {p["name"][:45]}\n'
    if criticos:
        msg += f'\n🔴 CRÍTICO ({len(criticos)}):\n'
        for p in criticos:
            msg += f'• {p["code"]} | {p["name"][:40]} | {get_semanas(p)} sem\n'
    if alertas:
        msg += f'\n🟡 ALERTA ({len(alertas)}):\n'
        for p in alertas:
            msg += f'• {p["code"]} | {p["name"][:40]} | {get_semanas(p)} sem\n'
    return msg.strip()


def send_whatsapp(msg):
    if not WA_PHONES or not WA_APIKEYS:
        print('  WhatsApp no configurado (faltan CALLMEBOT_PHONE / CALLMEBOT_APIKEY)')
        return
    for i, phone in enumerate(WA_PHONES):
        apikey = WA_APIKEYS[i] if i < len(WA_APIKEYS) else WA_APIKEYS[0]
        if i > 0: time.sleep(1.5)
        url = f'https://api.callmebot.com/whatsapp.php?phone={phone}&text={quote(msg)}&apikey={apikey}'
        try:
            r = requests.get(url, timeout=30)
            print(f'  WhatsApp {phone}: {r.status_code}')
        except Exception as e:
            print(f'  WhatsApp {phone}: error – {e}')


def main():
    hoy_str = datetime.now(timezone.utc).strftime('%d/%m/%Y')
    print(f'Resumen semanal de alarmas – {hoy_str}')

    # Inventario con umbrales configurados
    items = sb_get('inventario_actual',
                   'select=code,name,category,stock_actual,stock_min,stock_bajo,'
                   'lead_time_semanas,promedio_consumo_semanal')
    items = [i for i in items if
             i.get('stock_min') is not None or i.get('stock_bajo') is not None or
             ((i.get('lead_time_semanas') or 0) > 0 and (i.get('promedio_consumo_semanal') or 0) > 0)]
    for item in items:
        item['_estado'] = get_estado(item)
    print(f'  {len(items)} productos configurados')

    # Todas las alarmas activas (sin importar si fueron informadas o no)
    activos = sorted(
        [i for i in items if i['_estado'] != 'VERDE'],
        key=lambda x: -SEVERIDAD.get(x['_estado'], 0)
    )

    if activos:
        msg = build_msg(activos, '📋 *RESUMEN SEMANAL DE ALARMAS*', hoy_str)
        print(f'  Enviando resumen: {len(activos)} productos en alarma')
        send_whatsapp(msg)
    else:
        print('  Sin alarmas activas – no se envía resumen')

    print('Finalizado.')


if __name__ == '__main__':
    main()
