-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category VARCHAR(5) NOT NULL,
  supplier TEXT,
  presentation TEXT,
  unit VARCHAR(50),
  stock_min NUMERIC DEFAULT 5,
  stock_bajo NUMERIC DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de registros de movimientos
CREATE TABLE IF NOT EXISTS registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('RECEPCION','CONSUMO','AJUSTE','DEVOLUCION')),
  producto_code VARCHAR(20) NOT NULL REFERENCES productos(code),
  producto_name TEXT NOT NULL,
  lote VARCHAR(50),
  pallet VARCHAR(30),
  proveedor TEXT,
  recibido_por TEXT,
  cantidad_unidades NUMERIC NOT NULL,
  total_unidades NUMERIC NOT NULL,
  contenido_por_unidad NUMERIC DEFAULT 1,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_registros_producto ON registros(producto_code);
CREATE INDEX IF NOT EXISTS idx_registros_tipo ON registros(tipo);
CREATE INDEX IF NOT EXISTS idx_registros_created ON registros(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_productos_code ON productos(code);
CREATE INDEX IF NOT EXISTS idx_productos_category ON productos(category);

-- Vista de inventario actual
CREATE OR REPLACE VIEW inventario_actual AS
SELECT
  p.code,
  p.name,
  p.category,
  p.supplier,
  p.presentation,
  p.unit,
  p.stock_min,
  p.stock_bajo,
  COALESCE(SUM(CASE
    WHEN r.tipo IN ('RECEPCION', 'DEVOLUCION') THEN r.total_unidades
    ELSE 0 END), 0) AS total_recibido,
  COALESCE(SUM(CASE
    WHEN r.tipo IN ('CONSUMO', 'AJUSTE') THEN r.total_unidades
    ELSE 0 END), 0) AS total_consumido,
  COALESCE(SUM(CASE
    WHEN r.tipo IN ('RECEPCION', 'DEVOLUCION') THEN  r.total_unidades
    WHEN r.tipo IN ('CONSUMO', 'AJUSTE')       THEN -r.total_unidades
    ELSE 0 END), 0) AS stock_actual,
  COALESCE(
    SUM(CASE
      WHEN r.tipo = 'CONSUMO' AND r.fecha >= CURRENT_DATE - INTERVAL '28 days'
      THEN r.total_unidades ELSE 0 END)
    / NULLIF(
      COUNT(DISTINCT CASE
        WHEN r.tipo = 'CONSUMO' AND r.fecha >= CURRENT_DATE - INTERVAL '28 days'
        THEN r.fecha END
      ), 0) * 7,
  0) AS promedio_semanal
FROM productos p
LEFT JOIN registros r ON p.code = r.producto_code
GROUP BY p.code, p.name, p.category, p.supplier, p.presentation, p.unit, p.stock_min, p.stock_bajo;

-- RLS: permitir todo (sin autenticación en v1)
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all productos" ON productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all registros" ON registros FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para la tabla registros
ALTER PUBLICATION supabase_realtime ADD TABLE registros;
