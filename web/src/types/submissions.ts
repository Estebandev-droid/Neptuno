export interface Submission {
  id: string
  task_id: string
  student_id: string
  content?: string | null
  file_url?: string | null
  submitted_at?: string | null
  graded_at?: string | null
}

export interface GradeSummary {
  student_id: string
  task_id: string
  score: number
  feedback?: string | null
  graded_by?: string | null
  created_at?: string
  updated_at?: string
}