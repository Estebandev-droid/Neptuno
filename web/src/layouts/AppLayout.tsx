import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import { SidebarProvider } from '../components/SidebarProvider'
import { useSidebar } from '../hooks/useSidebar'
import { supabase } from '../lib/supabaseClient'
import { Bars3Icon } from '@heroicons/react/24/outline'

function LayoutShell() {
  const navigate = useNavigate()
  const { collapsed, toggle, mobileOpen, toggleMobile, closeMobile } = useSidebar()
  const [email, setEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setEmail(data.user?.email ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  const handleLogout = async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
    } finally {
      setSigningOut(false)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:block" collapsed={collapsed} onToggle={toggle} />

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <>
          {/* Mobile Overlay - Transparent background to keep page visible */}
          <div
            className="md:hidden fixed inset-0 bg-transparent z-40 transition-opacity duration-300"
            onClick={closeMobile}
          />
          <Sidebar
            className="md:hidden fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out translate-x-0 shadow-2xl"
            onNavigate={closeMobile}
            position="fixed"
          />
        </>
      )}

      <header className={`${collapsed ? 'md:ml-16' : 'md:ml-64'} border-b border-gray-200 bg-white shadow-sm`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobile}
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-gray-700 hover:bg-gray-100 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-600 transition-colors"
              aria-label="Abrir menú"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>

            <div className="h-8 w-8 rounded-md bg-brand-600 grid place-items-center shadow-sm">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Neptuno</h1>
              {email && <p className="text-sm text-gray-600">{email}</p>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={signingOut}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50"
          >
            {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </header>

      <main className={`${collapsed ? 'md:ml-16' : 'md:ml-64'} p-6`}>
        <div className="max-w-6xl mx-auto">
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