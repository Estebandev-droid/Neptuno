import { supabase } from './supabaseClient'
import type { Course } from '../types/courses'

export interface ListCoursesParams {
  search?: string
  page?: number // 1-based
  pageSize?: number
  onlyActive?: boolean
  categoryId?: string | null
  instructorId?: string | null
}

export interface PagedResult<T> {
  data: T[]
  count: number
}

export async function listCourses({ search = '', page = 1, pageSize = 10, onlyActive = false, categoryId = null, instructorId = null }: ListCoursesParams): Promise<PagedResult<Course>> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('courses')
    .select('*', { count: 'exact' })

  if (search && search.trim().length > 0) {
    query = query.ilike('title', `%${search.trim()}%`)
  }
  if (onlyActive) query = query.eq('is_active', true)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (instructorId) query = query.eq('instructor_id', instructorId)

  const { data, error, count } = await query
    .order('title', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('Error al listar cursos:', error)
    throw error
  }

  return { data: (data as Course[]) || [], count: count || 0 }
}

export async function createCourse(payload: { title: string; description?: string | null; cover_image?: string | null; category_id?: string | null; instructor_id?: string | null }): Promise<string> {
  const title = payload.title?.trim()
  if (!title || title.length < 3) throw new Error('El título es obligatorio (mínimo 3 caracteres)')

  const insertPayload = {
    title,
    description: payload.description ?? null,
    cover_image: payload.cover_image ?? null,
    category_id: payload.category_id ?? null,
    instructor_id: payload.instructor_id ?? null,
  }

  const { data, error } = await supabase.from('courses').insert(insertPayload).select('id').single()
  if (error) {
    console.error('Error al crear curso:', error)
    throw error
  }
  return (data as { id: string }).id
}

export async function updateCourse(id: string, changes: Partial<Pick<Course, 'title' | 'description' | 'cover_image' | 'category_id' | 'instructor_id'>>): Promise<void> {
  if (!id) throw new Error('ID requerido')
  const { error } = await supabase.from('courses').update(changes).eq('id', id)
  if (error) {
    console.error('Error al actualizar curso:', error)
    throw error
  }
}

export async function setCourseActive(id: string, active: boolean): Promise<void> {
  if (!id) throw new Error('ID requerido')
  const { error } = await supabase.from('courses').update({ is_active: active }).eq('id', id)
  if (error) {
    console.error('Error al cambiar estado del curso:', error)
    throw error
  }
}

export async function deleteCourse(id: string): Promise<void> {
  if (!id) throw new Error('ID requerido')
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) {
    // 23503 = foreign_key_violation (enrollments/resources/tasks/evaluations)
    const code = (error as { code?: string }).code
    if (code === '23503') {
      throw new Error('No se puede eliminar el curso porque tiene datos asociados (inscripciones, recursos o tareas).')
    }
    console.error('Error al eliminar curso:', error)
    throw error
  }
}

export async function getCourseById(id: string): Promise<Course | null> {
  if (!id) throw new Error('ID requerido')
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).single()
  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      // Not found
      return null
    }
    console.error('Error al obtener curso por ID:', error)
    throw error
  }
  return data as Course
}

export async function uploadCourseCover(file: File, courseId: string): Promise<string> {
  if (!file) throw new Error('Archivo de imagen requerido')
  if (!courseId) throw new Error('ID de curso requerido')
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen')
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) throw new Error('La imagen excede 5MB')

  const bucket = 'course-covers'
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${courseId}/cover-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })
  if (uploadError) {
    console.error('Error al subir portada:', uploadError)
    throw uploadError
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  const publicUrl = data.publicUrl
  if (!publicUrl) throw new Error('No se pudo obtener URL pública de la portada')
  return publicUrl
}