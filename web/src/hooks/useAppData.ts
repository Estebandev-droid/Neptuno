import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { listCategories } from '../lib/categoriesService'
import { listRoles } from '../lib/rolesService'
import { listProfiles } from '../lib/usersService'
import type { Category } from '../types/categories'
import type { Profile } from '../types/users'

/**
 * Hook centralizado para datos compartidos de la aplicación
 * Evita múltiples llamadas a las mismas APIs desde diferentes componentes
 */
export function useAppData() {
  const queryClient = useQueryClient()

  // Categorías activas (usadas en múltiples páginas)
  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesError
  } = useQuery({
    queryKey: ['categories', { active: true }],
    queryFn: () => listCategories({ page: 1, pageSize: 100, onlyActive: true }),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  })

  // Roles (usados en páginas de usuarios y permisos)
  const {
    data: roles,
    isLoading: rolesLoading,
    error: rolesError
  } = useQuery({
    queryKey: ['roles'],
    queryFn: listRoles,
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos
  })

  // Perfiles de usuarios (instructores, etc.)
  const {
    data: profiles,
    isLoading: profilesLoading,
    error: profilesError
  } = useQuery({
    queryKey: ['profiles', { for: 'app-data' }],
    queryFn: listProfiles,
    staleTime: 3 * 60 * 1000, // 3 minutos
    gcTime: 8 * 60 * 1000, // 8 minutos
  })

  // Datos procesados y memoizados
  const categories = useMemo(() => 
    (categoriesData?.data ?? []) as Category[], 
    [categoriesData]
  )

  const instructors = useMemo(() => 
    (profiles ?? []).filter(profile => 
      profile.role === 'instructor' || profile.role === 'admin'
    ) as Profile[], 
    [profiles]
  )

  const allUsers = useMemo(() => 
    (profiles ?? []) as Profile[], 
    [profiles]
  )

  // Estados de carga combinados
  const isLoading = categoriesLoading || rolesLoading || profilesLoading
  const hasError = categoriesError || rolesError || profilesError

  // Funciones de utilidad para invalidar cache
  const invalidateCategories = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] })
  }

  const invalidateRoles = () => {
    queryClient.invalidateQueries({ queryKey: ['roles'] })
  }

  const invalidateProfiles = () => {
    queryClient.invalidateQueries({ queryKey: ['profiles'] })
  }

  const invalidateAll = () => {
    invalidateCategories()
    invalidateRoles()
    invalidateProfiles()
  }

  return {
    // Datos
    categories,
    roles: roles ?? [],
    profiles: allUsers,
    instructors,
    
    // Estados
    isLoading,
    hasError,
    categoriesLoading,
    rolesLoading,
    profilesLoading,
    
    // Errores específicos
    categoriesError,
    rolesError,
    profilesError,
    
    // Utilidades
    invalidateCategories,
    invalidateRoles,
    invalidateProfiles,
    invalidateAll,
  }
}

/**
 * Hook específico para obtener solo categorías activas
 */
export function useActiveCategories() {
  const { categories, categoriesLoading, categoriesError } = useAppData()
  
  return {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  }
}

/**
 * Hook específico para obtener solo instructores
 */
export function useInstructors() {
  const { instructors, profilesLoading, profilesError } = useAppData()
  
  return {
    instructors,
    isLoading: profilesLoading,
    error: profilesError,
  }
}

/**
 * Hook específico para obtener roles
 */
export function useRoles() {
  const { roles, rolesLoading, rolesError } = useAppData()
  
  return {
    roles,
    isLoading: rolesLoading,
    error: rolesError,
  }
}