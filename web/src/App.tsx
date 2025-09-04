import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setIsAuthed(!!data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setIsAuthed(!!session)
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (isAuthed === null) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-600">
        Cargando…
      </div>
    )
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/app/dev/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/app" element={<Navigate to="/app/dev/dashboard" replace />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
