import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Producto } from '../../types';

interface ComboboxProductoProps {
  productos: Producto[];
  value?: Producto | null;
  onChange: (producto: Producto | null) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export function ComboboxProducto({ productos, value, onChange, placeholder = 'Buscar por nombre o código...', label, error, disabled }: ComboboxProductoProps) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setBusqueda('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtrados = busqueda.trim()
    ? productos.filter(p =>
        p.name.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.code.toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 20)
    : productos.slice(0, 20);

  function handleSelect(p: Producto) {
    onChange(p);
    setOpen(false);
    setBusqueda('');
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setBusqueda('');
  }

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
          className={cn(
            'w-full flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-left',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            error && 'border-red-400',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className={value ? 'text-slate-900' : 'text-slate-400'}>
            {value ? (
              <span>
                <span className="font-mono text-xs text-slate-500 mr-2">{value.code}</span>
                {value.name}
              </span>
            ) : placeholder}
          </span>
          <span className="flex items-center gap-1">
            {value && <X size={14} className="text-slate-400 hover:text-slate-700" onClick={handleClear} />}
            <ChevronDown size={14} className="text-slate-400" />
          </span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 flex flex-col">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
                <input
                  ref={inputRef}
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <ul className="overflow-auto flex-1">
              {filtrados.length === 0 ? (
                <li className="px-3 py-4 text-sm text-slate-500 text-center">Sin resultados</li>
              ) : filtrados.map(p => (
                <li
                  key={p.code}
                  onClick={() => handleSelect(p)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm',
                    value?.code === p.code && 'bg-blue-50 font-medium'
                  )}
                >
                  <span className="font-mono text-xs text-slate-400 w-24 shrink-0">{p.code}</span>
                  <span className="text-slate-800">{p.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
