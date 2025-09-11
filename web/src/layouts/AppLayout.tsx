import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import { SidebarProvider } from '../components/SidebarProvider'
import { useSidebar } from '../hooks/useSidebar'
import { useAuth } from '../hooks/useAuth'
import { Bars3Icon } from '@heroicons/react/24/outline'

function LayoutShell() {
  const { collapsed, toggle, mobileOpen, toggleMobile, closeMobile } = useSidebar()
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleLogout = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark text-light">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:block" collapsed={collapsed} onToggle={toggle} />

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <>
          {/* Mobile Overlay - Transparent background to keep page visible */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={closeMobile}
          />
          <Sidebar
            className="md:hidden fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out translate-x-0 shadow-2xl"
            onNavigate={closeMobile}
            position="fixed"
          />
        </>
      )}

      <header className={`${collapsed ? 'md:ml-20 lg:ml-24' : 'md:ml-64 lg:ml-72'} glass-header transition-[margin] duration-300 ease-in-out`}>
        <div className="w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobile}
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-light glass-nav-item hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 flex-shrink-0"
              aria-label="Abrir menú"
            >
              <Bars3Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>

            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-md glass-card border border-primary/30 grid place-items-center glow-effect flex-shrink-0">
              <span className="text-primary font-bold text-xs sm:text-sm">N</span>
            </div>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-light">Neptuno</h1>
              {user?.email && <p className="text-xs sm:text-sm text-light/70 truncate max-w-[150px] sm:max-w-[200px] lg:max-w-none">{user.email}</p>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={signingOut}
            className="inline-flex items-center gap-1 sm:gap-2 rounded-lg glass-button px-2 sm:px-3 py-2 text-xs sm:text-sm text-light hover:scale-105 transition-all duration-300 disabled:opacity-50 font-medium flex-shrink-0"
          >
            <span className="hidden sm:inline">{signingOut ? 'Cerrando…' : 'Cerrar sesión'}</span>
            <span className="sm:hidden">{signingOut ? '...' : 'Salir'}</span>
          </button>
        </div>
      </header>

      <main className={`pt-[73px] transition-[margin] duration-300 ease-in-out ${collapsed ? 'md:ml-20 lg:ml-24' : 'md:ml-64 lg:ml-72'} min-h-[calc(100vh-73px)]`}>
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default function AppLayout() {
  return (
    <SidebarProvider>
      <LayoutShell />
    </SidebarProvider>
  )
}