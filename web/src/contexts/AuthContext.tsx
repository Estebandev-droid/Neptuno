import React, { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from './AuthContextDefinition'
import type { ExtendedUser } from '../types/users'


interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Función para limpiar completamente el almacenamiento de auth
  const clearAuthStorage = () => {
    try {
      // Limpiar todas las claves relacionadas con Supabase
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      // También limpiar sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith('sb-')) {
          sessionStorage.removeItem(key)
        }
      }
    } catch (error) {
      console.error('Error clearing auth storage:', error)
    }
  }

  // Función para obtener el perfil del usuario
  const getUserProfile = async (authUser: User): Promise<ExtendedUser> => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      return {
        id: authUser.id,
        email: authUser.email,
        tenant_id: profile?.tenant_id || null,
        name: profile?.full_name || null,
        full_name: profile?.full_name || null,
        role: profile?.role || null,
        created_at: authUser.created_at
      }
    } catch {
      // Si no se puede obtener el perfil, devolver solo los datos básicos
      return {
        id: authUser.id,
        email: authUser.email,
        tenant_id: null,
        name: null,
        full_name: null,
        role: null,
        created_at: authUser.created_at
      }
    }
  }

  useEffect(() => {
    let isMounted = true
    let initialLoadComplete = false
    
    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!isMounted) return
        
        if (error) {
          console.error('Error getting session:', error)
          // Si hay error con el refresh token, limpiar completamente el storage
          if (error.message.includes('refresh') || error.message.includes('token')) {
            clearAuthStorage()
            await supabase.auth.signOut()
          }
          setSession(null)
          setUser(null)
        } else {
          // Validar que la sesión no haya expirado
          if (session && session.expires_at) {
            const now = Math.floor(Date.now() / 1000)
            if (session.expires_at < now) {
              console.log('Session expired, clearing...')
              clearAuthStorage()
              await supabase.auth.signOut()
              setSession(null)
              setUser(null)
            } else {
              setSession(session)
              if (session.user) {
                const extendedUser = await getUserProfile(session.user)
                if (isMounted) {
                  setUser(extendedUser)
                }
              }
            }
          } else {
            setSession(session)
            if (session?.user) {
              const extendedUser = await getUserProfile(session.user)
              if (isMounted) {
                setUser(extendedUser)
              }
            } else {
              setUser(null)
            }
          }
        }
      } catch (error) {
        console.error('Unexpected error during session initialization:', error)
        if (isMounted) {
          setSession(null)
          setUser(null)
        }
      } finally {
        if (isMounted) {
          initialLoadComplete = true
          setLoading(false)
          console.log('Initial session load complete')
        }
      }
    }

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (!isMounted) return
        
        // Solo procesar eventos después de la carga inicial
        if (!initialLoadComplete) {
          console.log('Skipping auth state change - initial load not complete')
          return
        }
        
        // Evitar procesar eventos de refresh de token
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully')
          return
        }
        
        setSession(session)
        if (session?.user) {
          const extendedUser = await getUserProfile(session.user)
          if (isMounted) {
            setUser(extendedUser)
          }
        } else {
          setUser(null)
        }
      }
    )

    // Inicializar sesión
    getInitialSession()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Helper para sanear y normalizar el email
  const cleanEmail = (email: string) =>
    email
      ?.replace(/[\u200B-\u200D\uFEFF]/g, '') // remueve zero-width chars
      .trim()
      .toLowerCase()

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail(email),
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email: cleanEmail(email),
      password,
    })
    return { error }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error during sign out:', error)
      // Forzar limpieza completa si hay error
      clearAuthStorage()
    } finally {
      // Siempre limpiar el estado local
      setSession(null)
      setUser(null)
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail(email))
    return { error }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}