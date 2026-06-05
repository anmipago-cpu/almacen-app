import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Producto } from '../types';

interface SearchContextValue {
  selectedProduct: Producto | null;
  setSelectedProduct: (product: Producto | null) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SearchContext.Provider value={{ selectedProduct, setSelectedProduct, searchOpen, setSearchOpen, searchQuery, setSearchQuery }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
}
