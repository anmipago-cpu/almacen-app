# AlmacénApp — Sistema de Inventario

Sistema web de gestión de inventario para producción de quesos. Reemplaza el control en Excel.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS v4
- Supabase (PostgreSQL + Realtime)
- React Router v6, Zustand, React Hook Form, TanStack Table v8
- Deploy en Vercel

## Configuración inicial

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto
2. En el SQL Editor, ejecuta todo el contenido de `supabase/migrations/001_init.sql`
3. Copia la **Project URL** y el **anon/public key** desde Settings → API

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Edita .env con tus credenciales de Supabase
```

### 3. Instalar y ejecutar

```bash
npm install
npm run dev
```

### 4. Cargar el catálogo de productos

Cuando la app esté corriendo, ve a **Parámetros** y haz clic en **"Cargar catálogo inicial"** para insertar los ~160 productos base.

## Deploy en Vercel

1. Sube el repositorio a GitHub
2. En [vercel.com](https://vercel.com), importa el repositorio
3. Agrega las variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy automático

## Estructura de páginas

| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard con resumen y alertas |
| `/recepcion` | Registrar ingreso de materiales |
| `/consumo` | Registrar consumo/ajuste/devolución |
| `/inventario` | Tabla completa con filtros y ajuste inline |
| `/registros` | Historial completo de movimientos |
| `/parametros` | Editar productos y niveles de stock |
