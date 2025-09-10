export interface Profile {
  id: string
  full_name?: string | null
  avatar_url?: string | null
  phone?: string | null
  extra?: Record<string, unknown>
  created_at?: string
}

export interface UserRole {
  user_id: string
  role_id: string
  created_at?: string
}