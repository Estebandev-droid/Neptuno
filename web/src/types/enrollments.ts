export type EnrollmentStatus = 'active' | 'completed' | 'dropped'

export interface Enrollment {
  id: string
  tenant_id?: string | null
  student_id: string
  course_id: string
  enrolled_at?: string | null
  status: EnrollmentStatus
}

//