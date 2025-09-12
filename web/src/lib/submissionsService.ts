import { supabase } from './supabaseClient'
import type { Submission } from '../types/submissions'

export interface ListSubmissionsParams {
  taskId: string
  search?: string
  page?: number
  pageSize?: number
}

export interface PagedResult<T> {
  data: T[]
  count: number
}

export async function listSubmissions({ taskId, search = '', page = 1, pageSize = 10 }: ListSubmissionsParams): Promise<PagedResult<Submission>> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  let query = supabase.from('submissions').select('*', { count: 'exact' }).eq('task_id', taskId)
  if (search && search.trim()) {
    // Buscar por contenido
    query = query.ilike('content', `%${search.trim()}%`)
  }
  const { data, error, count } = await query.order('submitted_at', { ascending: false }).range(from, to)
  if (error) throw error
  return { data: (data as Submission[]) || [], count: count || 0 }
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  const { data, error } = await supabase.from('submissions').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Submission) ?? null
}

export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await supabase.from('submissions').delete().eq('id', id)
  if (error) throw error
}