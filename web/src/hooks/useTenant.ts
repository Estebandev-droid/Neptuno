import { useContext } from 'react'
import { TenantContext, type TenantContextType } from '../contexts/TenantContextDefinition'

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}