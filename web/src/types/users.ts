export interface Profile {
  id: string
  email?: string | null
  full_name?: string | null
  name?: string | null // Alias for full_name
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

// Extended User type that includes tenant_id and name
export interface ExtendedUser {
  id: string
  email?: string
  tenant_id?: string | null
  name?: string | null
  full_name?: string | null
  role?: string | null
  created_at?: string
}