export interface Role {
  id: string
  name: string
  description?: string | null
  is_system?: boolean
  created_at?: string
}