import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  listProfiles, 
  assignRole, 
  getUserRoles, 
  createUser, 
  removeProfile, 
  revokeRole,
  updateProfile
} from '../lib/usersService'
import type { Profile } from '../types/users'

interface UseUsersOptions {
  search?: string
  page?: number
  pageSize?: number
  role?: string
  enabled?: boolean
}

/**
 * Hook optimizado para la gestión de usuarios
 */
export function useUsers(options: UseUsersOptions = {}) {
  const {
    search = '',
    page = 1,
    pageSize = 10,
    role,
    enabled = true
  } = options

  const queryClient = useQueryClient()

  // Query principal de usuarios
  const {
    data: profiles,
    isLoading,
    isFetching,
    error,
    refetch
  } = useQuery({
    queryKey: ['profiles', { search, page, pageSize, role }],
    queryFn: () => listProfiles(),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  })

  // Mutación para crear usuario
  const createUserMutation = useMutation({
    mutationFn: ({
      email,
      password,
      fullName,
      roleName,
      phone,
      signatureUrl,
      photoUrl
    }: {
      email: string
      password: string
      fullName?: string
      roleName: string
      phone?: string
      signatureUrl?: string
      photoUrl?: string
    }) => createUser(email, password, fullName, roleName, phone, signatureUrl, photoUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
    onError: (error) => {
      console.error('Error creating user:', error)
    }
  })

  // Mutación para asignar rol
  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) =>
      assignRole(userId, roleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
    onError: (error) => {
      console.error('Error assigning role:', error)
    }
  })

  // Mutación para revocar rol
  const revokeRoleMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) =>
      revokeRole(userId, roleName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
    onError: (error) => {
      console.error('Error revoking role:', error)
    }
  })

  // Mutación para eliminar usuario
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => removeProfile(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
    onError: (error) => {
      console.error('Error deleting user:', error)
    }
  })

  // Mutación para actualizar perfil
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, updates }: { userId: string; updates: Partial<Profile> }) =>
      updateProfile(userId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
    onError: (error) => {
      console.error('Error updating user:', error)
    }
  })

  // Función para obtener roles de un usuario específico
  const getUserRolesQuery = (userId: string) => ({
    queryKey: ['user-roles', userId],
    queryFn: () => getUserRoles(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })

  return {
    // Datos
    profiles: profiles ?? [],
    
    // Estados
    isLoading,
    isFetching,
    error,
    
    // Mutaciones
    createUser: createUserMutation,
    assignRole: assignRoleMutation,
    revokeRole: revokeRoleMutation,
    deleteUser: deleteUserMutation,
    updateUser: updateUserMutation,
    
    // Utilidades
    refetch,
    getUserRolesQuery,
    
    // Estados de mutaciones
    isCreating: createUserMutation.isPending,
    isAssigningRole: assignRoleMutation.isPending,
    isRevokingRole: revokeRoleMutation.isPending,
    isDeleting: deleteUserMutation.isPending,
    isUpdating: updateUserMutation.isPending,
  }
}

/**
 * Hook para obtener un usuario específico
 */
export function useUser(userId: string) {
  const {
    data: user,
    isLoading,
    error
  } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const profiles = await listProfiles()
      return profiles.find(p => p.id === userId) || null
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutos
  })

  const {
    data: roles,
    isLoading: rolesLoading
  } = useQuery({
    queryKey: ['user-roles', userId],
    queryFn: () => getUserRoles(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })

  return {
    user,
    roles: roles ?? [],
    isLoading: isLoading || rolesLoading,
    error,
  }
}

/**
 * Hook para obtener solo instructores
 */
export function useInstructors() {
  const { profiles, isLoading, error } = useUsers()
  
  const instructors = profiles.filter(profile => 
    profile.role === 'teacher' || profile.role === 'admin'
  )

  return {
    instructors,
    isLoading,
    error,
  }
}