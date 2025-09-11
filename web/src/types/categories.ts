export interface Category {
  id: string
  tenant_id?: string | null
  name: string
  is_active: boolean
  created_at?: string
}