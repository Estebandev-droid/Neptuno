import { type ReactNode } from 'react'
import { SidebarContext } from '../contexts/SidebarContext'
import { useState, useEffect, useCallback } from 'react'

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    return saved ? JSON.parse(saved) : false
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed))
  }, [collapsed])

  const toggle = useCallback((c?: boolean) => setCollapsed(c ?? !collapsed), [collapsed])

  const openMobile = () => setMobileOpen(true)
  const closeMobile = () => setMobileOpen(false)
  const toggleMobile = () => setMobileOpen((o) => !o)

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, mobileOpen, openMobile, closeMobile, toggleMobile }}>
      {children}
    </SidebarContext.Provider>
  )
}
