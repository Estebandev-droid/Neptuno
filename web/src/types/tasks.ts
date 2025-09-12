export interface Task {
  id: string
  tenant_id?: string | null
  course_id: string
  title: string
  description?: string | null
  due_date?: string | null
  max_score: number
  is_published: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateTaskRequest {
  course_id: string
  title: string
  description?: string
  due_date?: string
  max_score?: number
  is_published?: boolean
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  due_date?: string
  max_score?: number
  is_published?: boolean
}

export interface TaskFilters {
  course_id?: string
  is_published?: boolean
  search?: string
}
