export interface Profile {
  id: string
  email?: string | null
  full_name?: string | null
  avatar_url?: string | null
  phone?: string | null
  role?: string | null
  tenant_id?: string | null
  extra?: Record<string, unknown>
  created_at?: string
}

export interface UserRole {
  user_id: string
  role_id: string
  created_at?: string
}