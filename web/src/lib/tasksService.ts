import { supabase } from './supabaseClient'
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '../types/tasks'
import type { PostgrestError } from '@supabase/supabase-js'

export interface ListTasksParams {
  search?: string
  page?: number // 1-based
  pageSize?: number
  courseId?: string
  isPublished?: boolean
}

export interface PagedResult<T> {
  data: T[]
  count: number
}

export async function listTasks({ search = '', page = 1, pageSize = 10, courseId, isPublished }: ListTasksParams): Promise<PagedResult<Task>> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('tasks')
    .select('*', { count: 'exact' })

  if (search && search.trim().length > 0) {
    query = query.ilike('title', `%${search.trim()}%`)
  }
  if (courseId) query = query.eq('course_id', courseId)
  if (isPublished !== undefined) query = query.eq('is_published', isPublished)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('Error al listar tareas:', error)
    throw error
  }

  return { data: (data as Task[]) || [], count: count || 0 }
}

export async function createTask(payload: CreateTaskRequest): Promise<string> {
  const title = payload.title?.trim()
  if (!title || title.length < 3) throw new Error('El título es obligatorio (mínimo 3 caracteres)')
  if (!payload.course_id) throw new Error('El curso es obligatorio')

  const insertPayload = {
    course_id: payload.course_id,
    title,
    description: payload.description ?? null,
    due_date: payload.due_date ?? null,
    max_score: payload.max_score ?? 100,
    is_published: payload.is_published ?? false,
  }

  const { data, error } = await supabase.from('tasks').insert(insertPayload).select('id').single()
  if (error) {
    console.error('Error al crear tarea:', error)
    throw error
  }
  return (data as { id: string }).id
}

export async function updateTask(id: string, changes: UpdateTaskRequest): Promise<void> {
  if (!id) throw new Error('ID requerido')
  
  const updatePayload: Record<string, string | number | boolean | null> = {}
  if (changes.title !== undefined) updatePayload.title = changes.title
  if (changes.description !== undefined) updatePayload.description = changes.description
  if (changes.due_date !== undefined) updatePayload.due_date = changes.due_date
  if (changes.max_score !== undefined) updatePayload.max_score = changes.max_score
  if (changes.is_published !== undefined) updatePayload.is_published = changes.is_published

  const { error } = await supabase.from('tasks').update(updatePayload).eq('id', id)
  if (error) {
    console.error('Error al actualizar tarea:', error)
    throw error
  }
}

export async function publishTask(id: string, published: boolean): Promise<void> {
  if (!id) throw new Error('ID requerido')
  const { error } = await supabase.from('tasks').update({ is_published: published }).eq('id', id)
  if (error) {
    console.error('Error al cambiar estado de publicación de la tarea:', error)
    throw error
  }
}

export async function deleteTask(id: string): Promise<void> {
  if (!id) throw new Error('ID requerido')
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) {
    // 23503 = foreign_key_violation (submissions/grades)
    const code = (error as PostgrestError & { code?: string }).code
    if (code === '23503') {
      throw new Error('No se puede eliminar la tarea porque tiene entregas o calificaciones asociadas.')
    }
    console.error('Error al eliminar tarea:', error)
    throw error
  }
}

export async function getTaskById(id: string): Promise<Task | null> {
  if (!id) throw new Error('ID requerido')
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null // No encontrado
    console.error('Error al obtener tarea:', error)
    throw error
  }
  return data as Task
}

export async function getTasksByCourse(courseId: string): Promise<Task[]> {
  if (!courseId) throw new Error('ID del curso requerido')
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error al obtener tareas del curso:', error)
    throw error
  }
  return (data as Task[]) || []
}