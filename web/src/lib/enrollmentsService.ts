import { supabase } from './supabaseClient'
import type { Enrollment, EnrollmentStatus } from '../types/enrollments'
import type { PostgrestError } from '@supabase/supabase-js'

export interface ListEnrollmentsParams {
  page?: number // 1-based
  pageSize?: number
  courseId?: string | null
  studentId?: string | null
  status?: EnrollmentStatus | 'all'
}

export interface PagedResult<T> {
  data: T[]
  count: number
}

export async function listEnrollments({ page = 1, pageSize = 10, courseId = null, studentId = null, status = 'all' }: ListEnrollmentsParams): Promise<PagedResult<Enrollment>> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('enrollments')
    .select('*', { count: 'exact' })

  if (courseId) query = query.eq('course_id', courseId)
  if (studentId) query = query.eq('student_id', studentId)
  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error, count } = await query
    .order('enrolled_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('Error al listar inscripciones:', error)
    throw error
  }

  return { data: (data as Enrollment[]) || [], count: count || 0 }
}

export async function enrollStudent(courseId: string, studentId: string): Promise<Enrollment> {
  const { data, error } = await supabase
    .from('enrollments')
    .insert({ course_id: courseId, student_id: studentId })
    .select('*')
    .single()

  if (error) {
    const pgErr = error as PostgrestError & { code?: string }
    if (pgErr.code === '23505') {
      throw new Error('El estudiante ya está inscrito en este curso')
    }
    console.error('Error al inscribir estudiante:', error)
    throw error
  }

  return data as Enrollment
}

export async function unenrollStudent(enrollmentId: string): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .delete()
    .eq('id', enrollmentId)

  if (error) {
    console.error('Error al desinscribir estudiante:', error)
    throw error
  }
}

export async function updateEnrollmentStatus(enrollmentId: string, status: EnrollmentStatus): Promise<Enrollment> {
  const { data, error } = await supabase
    .from('enrollments')
    .update({ status })
    .eq('id', enrollmentId)
    .select('*')
    .single()

  if (error) {
    console.error('Error al actualizar estado de inscripción:', error)
    throw error
  }

  return data as Enrollment
}