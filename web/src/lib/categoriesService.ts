import { supabase } from './supabaseClient'
import type { Category } from '../types/categories'

export interface ListCategoriesParams {
  search?: string
  page?: number // 1-based
  pageSize?: number
  onlyActive?: boolean
}

export interface PagedResult<T> {
  data: T[]
  count: number
}

export async function listCategories({ search = '', page = 1, pageSize = 10, onlyActive = false }: ListCategoriesParams): Promise<PagedResult<Category>> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('categories')
    .select('*', { count: 'exact' })

  if (search && search.trim().length > 0) {
    query = query.ilike('name', `%${search.trim()}%`)
  }

  if (onlyActive) {
    query = query.eq('is_active', true)
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('Error al listar categorías:', error)
    throw error
  }

  return { data: (data as Category[]) || [], count: count || 0 }
}

export async function createCategory(name: string, isActive: boolean = true): Promise<Category> {
  const clean = name?.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
  if (!clean) throw new Error('El nombre de la categoría es obligatorio')
  if (clean.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres')

  const { data, error } = await supabase
    .from('categories')
    .insert({ name: clean, is_active: isActive })
    .select()
    .single()

  if (error) {
    // Duplicado por unique(tenant_id, name)
    if (error.code === '23505') {
      throw new Error('Ya existe una categoría con ese nombre en esta institución')
    }
    console.error('Error al crear categoría:', error)
    throw error
  }

  return data as Category
}

export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ is_active: active })
    .eq('id', id)

  if (error) {
    console.error('Error al actualizar estado de la categoría:', error)
    throw error
  }
}

export async function updateCategoryName(id: string, name: string): Promise<void> {
  const clean = name?.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
  if (!clean) throw new Error('El nombre de la categoría es obligatorio')
  if (clean.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres')

  const { error } = await supabase
    .from('categories')
    .update({ name: clean })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya existe una categoría con ese nombre en esta institución')
    }
    console.error('Error al renombrar categoría:', error)
    throw error
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

  if (error) {
    if (error.code === '23503') {
      // violación de clave foránea (en uso por cursos u otros)
      throw new Error('No se puede eliminar la categoría porque está siendo utilizada')
    }
    console.error('Error al eliminar categoría:', error)
    throw error
  }
}