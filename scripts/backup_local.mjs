/**
 * Backup local de la base de datos Supabase → carpeta en tu PC.
 * Ejecutar: node scripts/backup_local.mjs
 * Requiere: SUPABASE_URL y SUPABASE_KEY en scripts/backup_config.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configuración ──────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, 'backup_config.json');
const DESTINO_DEFAULT = path.join('C:\\', 'Backups', 'AlmacenApp');

if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`
❌ No se encontró el archivo de configuración.
   Crea el archivo: scripts/backup_config.json con el siguiente contenido:

{
  "SUPABASE_URL": "https://xxxxxxxxxxxx.supabase.co",
  "SUPABASE_KEY": "tu-service-role-key",
  "DESTINO": "C:\\\\Backups\\\\AlmacenApp"
}
`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
const { SUPABASE_URL, SUPABASE_KEY, DESTINO = DESTINO_DEFAULT } = config;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL y SUPABASE_KEY son obligatorios en backup_config.json');
  process.exit(1);
}

// ─── Tablas a respaldar ──────────────────────────────────────────────────────
const TABLAS = [
  'productos',
  'recepciones',
  'user_profiles',
  'alertas_gestion',
  'inventarios_fisicos',
  'consumos_semanales',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fechaHoy() {
  const ahora = new Date();
  return ahora.toISOString().slice(0, 10); // YYYY-MM-DD
}

function timestamp() {
  return new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
}

async function exportarTabla(tabla) {
  const url = `${SUPABASE_URL}/rest/v1/${tabla}?select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al exportar "${tabla}": ${await res.text()}`);
  }
  return res.json();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const fecha = fechaHoy();
  const carpeta = path.join(DESTINO, fecha);

  console.log(`\n🗄️  Backup AlmacénApp — ${timestamp()}`);
  console.log(`📂 Destino: ${carpeta}\n`);

  // Crear carpeta destino
  fs.mkdirSync(carpeta, { recursive: true });

  const resumen = { fecha, timestamp: new Date().toISOString(), tablas: {} };
  let exitosos = 0;

  for (const tabla of TABLAS) {
    try {
      const datos = await exportarTabla(tabla);
      const archivo = path.join(carpeta, `${tabla}.json`);
      fs.writeFileSync(archivo, JSON.stringify(datos, null, 2), 'utf-8');
      resumen.tablas[tabla] = datos.length;
      console.log(`  ✅ ${tabla}: ${datos.length} registros`);
      exitosos++;
    } catch (err) {
      resumen.tablas[tabla] = `ERROR: ${err.message}`;
      console.error(`  ❌ ${tabla}: ${err.message}`);
    }
  }

  // Guardar resumen
  fs.writeFileSync(
    path.join(carpeta, 'resumen.json'),
    JSON.stringify(resumen, null, 2),
    'utf-8'
  );

  // ─── ZIP del código fuente ───────────────────────────────────────────────
  try {
    const os     = await import('os');
    const REPO_DIR = path.join(__dirname, '..');
    const zipPath  = path.join(carpeta, `codigo_almacen_${fecha}.zip`);
    const { execSync } = await import('child_process');
    const tmpDir = path.join(os.default.tmpdir(), 'almacen_backup_temp');

    // Script PowerShell: copia repo (sin node_modules/.git/dist) y comprime
    const psScript = `
$src  = '${REPO_DIR}'
$dest = '${zipPath}'
$tmp  = '${tmpDir}'
$excl = @('node_modules','.git','dist','backup_output')
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null
Get-ChildItem -Path $src | Where-Object { $excl -notcontains $_.Name } | Copy-Item -Destination $tmp -Recurse -Force
Compress-Archive -Path "$tmp\\*" -DestinationPath $dest -Force
Remove-Item $tmp -Recurse -Force
`.trim();

    const psFile = path.join(os.default.tmpdir(), 'backup_zip.ps1');
    fs.writeFileSync(psFile, psScript, 'utf-8');
    execSync(`powershell -ExecutionPolicy Bypass -File "${psFile}"`, { stdio: 'pipe' });
    fs.unlinkSync(psFile);

    const sizeKB = Math.round(fs.statSync(zipPath).size / 1024);
    console.log(`  ✅ código fuente: ${sizeKB} KB → ${path.basename(zipPath)}`);
  } catch (err) {
    console.error(`  ❌ ZIP código fuente: ${err.message}`);
  }

  // ─── Limpiar backups con más de 30 días ─────────────────────────────────
  const hace30 = new Date();
  hace30.setDate(hace30.getDate() - 30);

  const carpetas = fs.readdirSync(DESTINO).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
  let eliminados = 0;
  for (const c of carpetas) {
    const fecha_c = new Date(c);
    if (fecha_c < hace30) {
      fs.rmSync(path.join(DESTINO, c), { recursive: true, force: true });
      eliminados++;
    }
  }
  if (eliminados > 0) console.log(`\n🧹 ${eliminados} backup(s) antiguo(s) eliminado(s)`);

  console.log(`\n✔  Backup completado: ${exitosos}/${TABLAS.length} tablas + código fuente en ${carpeta}`);
  if (exitosos < TABLAS.length) process.exit(1);
}

main().catch(err => {
  console.error('\n💥 Error inesperado:', err.message);
  process.exit(1);
});
