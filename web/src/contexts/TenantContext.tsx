import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getUserMemberships, type Membership } from '../lib/membershipsService'
import { TenantContext, type TenantContextType } from './TenantContextDefinition'

interface TenantProviderProps {
  children: ReactNode
}

export function TenantProvider({ children }: TenantProviderProps) {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [selectedTenant, setSelectedTenant] = useState<Membership | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshMemberships = useCallback(async () => {
    if (!user?.id) {
      setMemberships([])
      setSelectedTenant(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const userMemberships = await getUserMemberships(user.id)
      setMemberships(userMemberships)
      
      // Si no hay tenant seleccionado, seleccionar el primero disponible
      if (!selectedTenant && userMemberships.length > 0) {
        // Priorizar memberships con rol de admin/owner
        const priorityMembership = userMemberships.find(m => 
          m.role === 'owner' || m.role === 'admin'
        ) || userMemberships[0]
        
        setSelectedTenant(priorityMembership)
      }
      
      // Verificar si el tenant seleccionado sigue siendo válido
      if (selectedTenant) {
        const stillValid = userMemberships.find(m => m.id === selectedTenant.id)
        if (!stillValid) {
          setSelectedTenant(userMemberships[0] || null)
        }
      }
    } catch (err) {
      console.error('Error al cargar memberships:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, selectedTenant])

  useEffect(() => {
    refreshMemberships()
  }, [user?.id, refreshMemberships])

  const value: TenantContextType = {
    memberships,
    selectedTenant,
    setSelectedTenant,
    isLoading,
    error,
    refreshMemberships
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}