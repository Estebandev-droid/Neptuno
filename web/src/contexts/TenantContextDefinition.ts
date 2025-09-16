import { createContext } from 'react'
import type { Membership } from '../lib/membershipsService'

export interface TenantContextType {
  memberships: Membership[]
  selectedTenant: Membership | null
  setSelectedTenant: (membership: Membership | null) => void
  isLoading: boolean
  error: string | null
  refreshMemberships: () => Promise<void>
}

export const TenantContext = createContext<TenantContextType | undefined>(undefined)