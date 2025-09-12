export interface Grade {
  id: string
  tenant_id?: string | null
  student_id: string
  evaluation_id?: string | null
  task_id?: string | null
  score: number
  feedback?: string | null
  graded_by?: string | null
  created_at?: string
  updated_at?: string
}

export interface UpsertTaskGradeRequest {
  student_id: string
  task_id: string
  score: number
  feedback?: string
  graded_by?: string | null
}