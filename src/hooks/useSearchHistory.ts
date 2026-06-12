import { useState, useCallback } from 'react';

const MAX = 10;

export function useSearchHistory(namespace: string) {
  const key = `search_history_${namespace}`;

  const load = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  };

  const [history, setHistory] = useState<string[]>(load);

  const addSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    setHistory(prev => {
      const next = [trimmed, ...prev.filter(h => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX);
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(key);
    setHistory([]);
  }, [key]);

  return { history, addSearch, clearHistory };
}
