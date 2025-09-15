import { createContext } from 'react'
import type { Session, AuthError } from '@supabase/supabase-js'
import type { ExtendedUser } from '../types/users'

export interface AuthContextType {
  user: ExtendedUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)