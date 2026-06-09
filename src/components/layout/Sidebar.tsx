import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PackagePlus, PackageMinus,
  Boxes, ClipboardList, ChevronLeft, ChevronRight,
  Archive, AlertTriangle, Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';

const NAV_ITEMS = [
  { to: '/',               icon: LayoutDashboard, label: 'Dashboard'          },
  { to: '/recepciones',    icon: PackagePlus,     label: 'Recepciones'        },
  { to: '/inventario-fisico', icon: Boxes,         label: 'Inventario Físico'  },
  { to: '/consumo-semanal', icon: PackageMinus,   label: 'Consumo Semanal'    },
  { to: '/alarmas',        icon: AlertTriangle,   label: 'Alarmas'            },
  { to: '/historial',      icon: ClipboardList,   label: 'Historial'          },
  { to: '/catalogo',       icon: Archive,         label: 'Catálogo'           },
  { to: '/proveedores',    icon: PackagePlus,     label: 'Proveedores'        },
  { to: '/buscador',       icon: ChevronRight,    label: 'Buscador'           },
  { to: '/parametros',     icon: Settings,        label: 'Parámetros'         },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      'flex flex-col h-screen sticky top-0 transition-all duration-300 shrink-0 border-r border-white/10 bg-[#1E3A5F] shadow-xl',
      collapsed ? 'w-20' : 'w-64'
    )}>
      <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-white/10">
        {!collapsed ? (
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Sistema empresarial</p>
            <h1 className="mt-3 text-xl font-semibold text-white">AlmacénApp</h1>
            <p className="mt-1 text-sm text-slate-300">Control de inventario</p>
          </div>
        ) : (
          <div className="h-10 w-10 rounded-lg bg-white/10" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-2xl px-4 py-3 mx-3 text-sm font-medium transition-all duration-200',
              'text-slate-200 hover:bg-white/10 hover:text-white',
              isActive ? 'bg-white/15 text-white shadow-sm' : 'bg-transparent',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/10">
        {!collapsed && (
          <div className="rounded-2xl bg-white/5 p-3 text-center text-xs text-slate-300">
            Versión 1.0 · Profesional
          </div>
        )}
      </div>
    </aside>
  );
}
