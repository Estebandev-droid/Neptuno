import { createContext } from 'react'

export interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
  toggleMobile: () => void
}

export const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)