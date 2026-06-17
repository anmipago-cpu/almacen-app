"""
Sube la carpeta backup_output a Google Drive.
Requiere: GDRIVE_CREDENTIALS (JSON de service account) y GDRIVE_FOLDER_ID.
"""
import os
import json
import glob
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

CREDENTIALS_JSON = os.environ.get('GDRIVE_CREDENTIALS', '')
FOLDER_ID        = os.environ.get('GDRIVE_FOLDER_ID', '')
DATE             = datetime.now().strftime('%Y-%m-%d')
BACKUP_DIR       = f'backup_output/{DATE}'

if not CREDENTIALS_JSON or not FOLDER_ID:
    print('GDRIVE_CREDENTIALS o GDRIVE_FOLDER_ID no configurados — saltando Google Drive')
    exit(0)

creds_dict = json.loads(CREDENTIALS_JSON)
creds = service_account.Credentials.from_service_account_info(
    creds_dict,
    scopes=['https://www.googleapis.com/auth/drive.file']
)
service = build('drive', 'v3', credentials=creds)

# Crear subcarpeta con la fecha en Google Drive
folder_meta = {
    'name': f'backup-{DATE}',
    'mimeType': 'application/vnd.google-apps.folder',
    'parents': [FOLDER_ID]
}
folder = service.files().create(body=folder_meta, fields='id').execute()
subfolder_id = folder['id']
print(f'Carpeta creada en Drive: backup-{DATE} ({subfolder_id})')

# Subir todos los archivos del backup
archivos = glob.glob(f'{BACKUP_DIR}/*')
for path in archivos:
    name = os.path.basename(path)
    mime = 'application/json' if name.endswith('.json') else 'application/zip'
    file_meta = {'name': name, 'parents': [subfolder_id]}
    media = MediaFileUpload(path, mimetype=mime, resumable=True)
    f = service.files().create(body=file_meta, media_body=media, fields='id,name').execute()
    print(f'  Subido: {name} ({f["id"]})')

print(f'\nBackup subido a Google Drive correctamente.')
