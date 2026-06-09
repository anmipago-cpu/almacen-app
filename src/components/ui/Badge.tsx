import { CATEGORIAS, ESTADO_CONFIG, type EstadoStock } from '../../types';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';

interface BadgeCategoriaProps {
  category: string;
  className?: string;
}

export function BadgeCategoria({ category, className }: BadgeCategoriaProps) {
  const cats = useStore(s => s.categorias);
  const cat = cats[category] ?? CATEGORIAS[category];
  if (!cat) return <span className={cn('px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700', className)}>{category}</span>;
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', cat.bg, cat.text, cat.border, className)}>
      {cat.label}
    </span>
  );
}

interface BadgeEstadoProps {
  estado: EstadoStock;
  className?: string;
}

export function BadgeEstado({ estado, className }: BadgeEstadoProps) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold', cfg.bg, cfg.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

interface BadgeTipoProps {
  tipo: string;
  className?: string;
}

export function BadgeTipo({ tipo, className }: BadgeTipoProps) {
  const config: Record<string, string> = {
    RECEPCION:  'bg-green-100 text-green-800 border-green-200',
    CONSUMO:    'bg-red-100 text-red-800 border-red-200',
    AJUSTE:     'bg-yellow-100 text-yellow-800 border-yellow-200',
    DEVOLUCION: 'bg-blue-100 text-blue-800 border-blue-200',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', config[tipo] || 'bg-gray-100 text-gray-700', className)}>
      {tipo}
    </span>
  );
}
