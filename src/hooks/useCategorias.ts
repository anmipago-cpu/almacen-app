import { useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import type { CategoriaDB, SubcategoriaDB } from '../types';

export function useCategorias() {
  const { categorias, subcategorias, categoriasDB, subcategoriasDB, setCategoriasDB, setSubcategoriasDB } = useStore();

  const cargar = useCallback(async () => {
    const [{ data: cats }, { data: subs }] = await Promise.all([
      supabase.from('categorias').select('*').eq('active', true).order('code'),
      supabase.from('subcategorias').select('*').eq('active', true).order('categoria_code').order('code'),
    ]);
    if (cats) setCategoriasDB(cats as CategoriaDB[]);
    if (subs) setSubcategoriasDB(subs as SubcategoriaDB[]);
  }, [setCategoriasDB, setSubcategoriasDB]);

  useEffect(() => {
    if (categoriasDB.length === 0) cargar();
  }, [categoriasDB.length, cargar]);

  async function crearCategoria(row: Omit<CategoriaDB, 'active'>) {
    const { error } = await supabase.from('categorias').insert({ ...row, active: true });
    if (error) throw error;
    await cargar();
  }

  async function actualizarCategoria(code: string, cambios: Partial<CategoriaDB>) {
    const { error } = await supabase.from('categorias').update(cambios).eq('code', code);
    if (error) throw error;
    await cargar();
  }

  async function eliminarCategoria(code: string) {
    const { error } = await supabase.from('categorias').update({ active: false }).eq('code', code);
    if (error) throw error;
    await cargar();
  }

  async function crearSubcategoria(row: Omit<SubcategoriaDB, 'id' | 'active'>) {
    const { error } = await supabase.from('subcategorias').insert({ ...row, active: true });
    if (error) throw error;
    await cargar();
  }

  async function actualizarSubcategoria(id: number, cambios: Partial<SubcategoriaDB>) {
    const { error } = await supabase.from('subcategorias').update(cambios).eq('id', id);
    if (error) throw error;
    await cargar();
  }

  async function eliminarSubcategoria(id: number) {
    const { error } = await supabase.from('subcategorias').update({ active: false }).eq('id', id);
    if (error) throw error;
    await cargar();
  }

  return {
    categorias,
    subcategorias,
    categoriasDB,
    subcategoriasDB,
    recargar: cargar,
    crearCategoria,
    actualizarCategoria,
    eliminarCategoria,
    crearSubcategoria,
    actualizarSubcategoria,
    eliminarSubcategoria,
  };
}
