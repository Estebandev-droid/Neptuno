export interface Course {
  id: string
  tenant_id?: string | null
  title: string
  description?: string | null
  cover_image?: string | null
  category_id?: string | null
  instructor_id?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}