"""
Exporta todas las tablas de Supabase a archivos JSON.
Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY como variables de entorno.
"""
import requests
import json
import os
import sys
from datetime import datetime

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SERVICE_KEY  = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
DATE         = datetime.now().strftime('%Y-%m-%d')
OUT_DIR      = f'backup_output/{DATE}'

TABLES = [
    'productos',
    'recepciones',
    'user_profiles',
    'alertas_gestion',
    'inventarios_fisicos',
]

if not SUPABASE_URL or not SERVICE_KEY:
    print('ERROR: Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    sys.exit(1)

os.makedirs(OUT_DIR, exist_ok=True)

headers = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'count=exact',
}

resumen = {'fecha': DATE, 'timestamp': datetime.now().isoformat(), 'tablas': {}}

for table in TABLES:
    try:
        resp = requests.get(
            f'{SUPABASE_URL}/rest/v1/{table}?select=*',
            headers=headers,
            timeout=30
        )
        if resp.status_code == 200:
            data = resp.json()
            path = f'{OUT_DIR}/{table}.json'
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            resumen['tablas'][table] = len(data)
            print(f'  {table}: {len(data)} registros')
        else:
            resumen['tablas'][table] = f'error {resp.status_code}'
            print(f'  {table}: ERROR {resp.status_code} - {resp.text[:100]}')
    except Exception as e:
        resumen['tablas'][table] = f'excepcion: {e}'
        print(f'  {table}: EXCEPCION - {e}')

with open(f'{OUT_DIR}/resumen.json', 'w', encoding='utf-8') as f:
    json.dump(resumen, f, ensure_ascii=False, indent=2)

print(f'\nBackup completado en {OUT_DIR}')
