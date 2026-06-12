import { useState, useRef, useEffect } from 'react';
import { Search, Clock, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  history: string[];
  onClearHistory: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value, onChange, onSearch, history, onClearHistory,
  placeholder = 'Buscar...', className, autoFocus,
}: SearchInputProps) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const showHistory = focused && !value.trim() && history.length > 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && value.trim()) {
      onSearch?.(value.trim());
      setFocused(false);
    }
    if (e.key === 'Escape') {
      setFocused(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-sm text-slate-900',
            'focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400',
            className
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showHistory && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Búsquedas recientes</span>
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Limpiar
            </button>
          </div>
          {history.map(term => (
            <button
              key={term}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onChange(term);
                onSearch?.(term);
                setFocused(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Clock size={13} className="shrink-0 text-slate-400" />
              <span className="truncate">{term}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
