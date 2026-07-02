"""
Notificaciones automáticas de alarmas de stock.
Corre diariamente via GitHub Actions.
- Envía WhatsApp cuando un producto EMPEORA de estado.
- Los lunes envía resumen completo de alarmas activas por criticidad.
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


def sb_post(table, data):
    r = requests.post(f'{SUPABASE_URL}/rest/v1/{table}',
                      headers={**HEADERS, 'Prefer': 'return=minimal'},
                      json=data, timeout=30)
    r.raise_for_status()


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
    hoy      = datetime.now(timezone.utc)
    es_lunes = hoy.weekday() == 0
    hoy_str  = hoy.strftime('%d/%m/%Y')

    print(f'Iniciando notificaciones – {hoy_str} (lunes={es_lunes})')

    # 1. Inventario con umbrales configurados
    items = sb_get('inventario_actual',
                   'select=code,name,category,stock_actual,stock_min,stock_bajo,'
                   'lead_time_semanas,promedio_consumo_semanal')
    # Conservar items con cualquier configuración de alarma: thresholds o lead_time+promedio
    items = [i for i in items if
             i.get('stock_min') is not None or i.get('stock_bajo') is not None or
             ((i.get('lead_time_semanas') or 0) > 0 and (i.get('promedio_consumo_semanal') or 0) > 0)]
    for item in items:
        item['_estado'] = get_estado(item)
    print(f'  {len(items)} productos configurados')

    # 2. Último estado notificado por el sistema
    gestiones = sb_get('alertas_gestion',
                        'select=producto_code,estado,created_at'
                        '&informado_a=eq.SISTEMA&order=created_at.desc')
    ultima_sistema = {}
    for g in gestiones:
        if g['producto_code'] not in ultima_sistema:
            ultima_sistema[g['producto_code']] = g['estado']

    # 3. Detectar cambios de estado
    to_notify  = []
    to_register = []

    for item in items:
        estado_actual = item['_estado']
        estado_previo = ultima_sistema.get(item['code'], 'VERDE')
        sev_actual    = SEVERIDAD.get(estado_actual, 0)
        sev_previo    = SEVERIDAD.get(estado_previo, 0)

        if sev_actual != sev_previo:
            to_register.append({
                'producto_code': item['code'],
                'estado':        estado_actual,
                'stock_actual':  item.get('stock_actual', 0),
                'informado_a':   'SISTEMA',
                'notas':         'Auto-notificado' if sev_actual > sev_previo else 'Recuperado',
            })
            if sev_actual > sev_previo:
                to_notify.append(item)

    # 4. Notificar cambios de estado
    if to_notify:
        msg = build_msg(to_notify, '🚨 *ALERTA DE STOCK*', hoy_str)
        print(f'  Enviando alerta: {len(to_notify)} productos')
        send_whatsapp(msg)
    else:
        print('  Sin cambios de estado – no se envía alerta')

    # 5. Resumen de los lunes — solo alarmas que nadie ha informado manualmente
    if es_lunes:
        # Productos que tienen al menos un registro manual (informado_a != 'SISTEMA')
        gestiones_manual = sb_get('alertas_gestion',
                                  'select=producto_code'
                                  '&informado_a=neq.SISTEMA'
                                  '&informado_a=not.is.null')
        ya_informados = {g['producto_code'] for g in gestiones_manual}

        activos = sorted(
            [i for i in items if i['_estado'] != 'VERDE' and i['code'] not in ya_informados],
            key=lambda x: -SEVERIDAD.get(x['_estado'], 0)
        )
        if activos:
            msg = build_msg(activos, '📋 *RESUMEN SEMANAL – SIN GESTIONAR*', hoy_str)
            print(f'  Enviando resumen lunes: {len(activos)} productos sin gestionar')
            send_whatsapp(msg)
        else:
            print('  Resumen lunes: todas las alarmas activas ya fueron informadas')

    # 6. Registrar nuevos estados en alertas_gestion
    for record in to_register:
        try:
            sb_post('alertas_gestion', record)
        except Exception as e:
            print(f'  Error registrando {record["producto_code"]}: {e}')

    print(f'Finalizado. Cambios registrados: {len(to_register)}')


if __name__ == '__main__':
    main()
