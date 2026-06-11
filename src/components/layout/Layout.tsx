import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';
import { SearchProvider, useSearchContext } from '../../context/SearchContext';
import { SearchModal } from './SearchModal';
import { Search, Menu } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

function LayoutContent({ children }: LayoutProps) {
  const { setSearchOpen } = useSearchContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <main className="flex-1 overflow-auto bg-slate-50 min-w-0">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 backdrop-blur-lg">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <Menu size={18} />
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex flex-1 max-w-sm items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-slate-900"
            >
              <Search size={16} />
              <span className="hidden sm:inline">Buscar producto (Ctrl+K)</span>
              <span className="sm:hidden">Buscar...</span>
            </button>

            <div className="hidden sm:flex items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">Busca por código, nombre o proveedor</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto rounded-[2rem] bg-white p-4 sm:p-6 shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
            {children}
          </div>
        </div>
      </main>
      <SearchModal />
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <SearchProvider>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <LayoutContent>{children}</LayoutContent>
        <Toaster position="top-right" richColors />
      </div>
    </SearchProvider>
  );
}
