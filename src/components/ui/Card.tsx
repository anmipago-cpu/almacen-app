import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={cn(
      'bg-white rounded-xl border border-slate-200 shadow-sm',
      padding && 'p-5',
      className
    )}>
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  subtitle?: string;
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   val: 'text-blue-700'  },
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600',  val: 'text-green-700' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', val: 'text-yellow-700' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',     val: 'text-red-700'   },
  gray:   { bg: 'bg-gray-50',   icon: 'bg-gray-100 text-gray-600',   val: 'text-gray-700'  },
};

export function StatCard({ title, value, icon, color = 'blue', subtitle }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={cn('rounded-xl border border-slate-200 p-5 shadow-sm', c.bg)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className={cn('text-3xl font-bold mt-1', c.val)}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={cn('p-3 rounded-lg', c.icon)}>{icon}</div>
      </div>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse bg-slate-200 rounded', className)} />;
}
