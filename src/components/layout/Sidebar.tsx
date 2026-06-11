import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PackagePlus, PackageMinus,
  Boxes, ClipboardList, ChevronLeft, ChevronRight,
  Archive, AlertTriangle, Settings, BarChart2, Users, LogOut, Search
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Rol } from '../../context/AuthContext';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles: Rol[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',                icon: LayoutDashboard, label: 'Dashboard',          roles: ['admin', 'operario', 'consulta'] },
  { to: '/recepciones',     icon: PackagePlus,     label: 'Recepciones',        roles: ['admin', 'operario'] },
  { to: '/inventario',      icon: BarChart2,       label: 'Inventario',         roles: ['admin', 'operario', 'consulta'] },
  { to: '/inventario-fisico', icon: Boxes,         label: 'Inventario Físico',  roles: ['admin', 'operario'] },
  { to: '/consumo-semanal', icon: PackageMinus,    label: 'Consumo Semanal',    roles: ['admin', 'operario'] },
  { to: '/alarmas',         icon: AlertTriangle,   label: 'Alarmas',            roles: ['admin', 'operario', 'consulta'] },
  { to: '/historial',       icon: ClipboardList,   label: 'Historial',          roles: ['admin', 'operario', 'consulta'] },
  { to: '/catalogo',        icon: Archive,         label: 'Catálogo',           roles: ['admin'] },
  { to: '/proveedores',     icon: PackagePlus,     label: 'Proveedores',        roles: ['admin'] },
  { to: '/buscador',        icon: Search,          label: 'Buscador',           roles: ['admin', 'operario', 'consulta'] },
  { to: '/parametros',      icon: Settings,        label: 'Parámetros',         roles: ['admin'] },
  { to: '/usuarios',        icon: Users,           label: 'Usuarios',           roles: ['admin'] },
];

const ROL_LABELS: Record<Rol, string> = {
  admin: 'Administrador',
  operario: 'Operario',
  consulta: 'Solo lectura',
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, signOut } = useAuth();
  const rol = profile?.rol ?? 'consulta';

  const navItems = NAV_ITEMS.filter(item => item.roles.includes(rol));

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
        {navItems.map(({ to, icon: Icon, label }) => (
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

      <div className="px-3 py-4 border-t border-white/10 space-y-2">
        {!collapsed && profile && (
          <div className="rounded-2xl bg-white/5 px-3 py-2.5">
            <p className="text-sm font-medium text-white truncate">{profile.nombre}</p>
            <p className="text-xs text-slate-400 mt-0.5">{ROL_LABELS[profile.rol]}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className={cn(
            'w-full flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
