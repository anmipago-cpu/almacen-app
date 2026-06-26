@echo off
echo.
echo ========================================
echo   Backup AlmacenApp - Base de Datos
echo ========================================
cd /d "C:\Users\Andrea Palacio\almacen-app"
node scripts\backup_local.mjs
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [ERROR] El backup fallo. Revisa el mensaje de arriba.
  pause
) else (
  echo.
  echo [OK] Backup completado exitosamente.
  timeout /t 5
)
