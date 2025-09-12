import { supabase } from './supabaseClient'
import type { Grade, UpsertTaskGradeRequest } from '../types/grades'

export async function getGradeForTask(taskId: string, studentId: string): Promise<Grade | null> {
  const { data, error } = await supabase
    .from('grades')
    .select('*')
    .eq('task_id', taskId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw error
  return (data as Grade) ?? null
}

export async function upsertTaskGrade(payload: UpsertTaskGradeRequest): Promise<void> {
  // Primero verificar si existe una calificación previa
  const { data: existing, error: getErr } = await supabase
    .from('grades')
    .select('id')
    .eq('task_id', payload.task_id)
    .eq('student_id', payload.student_id)
    .maybeSingle()
  if (getErr) throw getErr

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from('grades')
      .update({ score: payload.score, feedback: payload.feedback ?? null })
      .eq('id', existing.id)
    if (updErr) throw updErr
  } else {
    const { error: insErr } = await supabase
      .from('grades')
      .insert({
        student_id: payload.student_id,
        task_id: payload.task_id,
        score: payload.score,
        feedback: payload.feedback ?? null,
        graded_by: payload.graded_by ?? null,
      })
    if (insErr) throw insErr
  }

  // Actualizar la marca de fecha de calificación en la entrega
  const { error: subErr } = await supabase
    .from('submissions')
    .update({ graded_at: new Date().toISOString() })
    .eq('task_id', payload.task_id)
    .eq('student_id', payload.student_id)
  if (subErr) throw subErr
}