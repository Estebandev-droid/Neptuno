import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Si ya hay sesión (por ejemplo, después del retorno de OAuth), redirige
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/app/dev/dashboard', { replace: true })
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate('/app/dev/dashboard', { replace: true })
      }
    })
    return () => {
      listener.subscription.unsubscribe()
    }
  }, [navigate])

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Redirección de desarrollo
      navigate('/app/dev/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
      if (error) throw error
      // OAuth redirige fuera; al volver la sesión estará en local y el efecto hará navigate
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar con Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
          <div className="px-6 py-6 sm:px-8">
            <div className="mb-6 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-slate-900 dark:bg-white grid place-items-center">
                <span className="text-white dark:text-slate-900 font-bold">N</span>
              </div>
              <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">Iniciar sesión</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Accede a tu cuenta de Neptuno</p>
            </div>

            <form className="space-y-4" onSubmit={handleEmailPassword}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 shadow-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Contraseña
                  </label>
                  <a href="#" className="text-sm text-indigo-600 hover:text-indigo-500">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 shadow-sm"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center items-center rounded-lg bg-indigo-600 text-white font-medium px-4 py-2.5 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </button>

              <div className="relative text-center">
                <span className="px-2 bg-white dark:bg-slate-900 text-xs text-slate-500 relative z-10">o</span>
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-slate-200/60 dark:border-slate-800/60" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full inline-flex justify-center items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-medium px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <span className="text-lg">G</span>
                <span>Continuar con Google</span>
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              ¿No tienes cuenta?{' '}
              <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">
                Crea una
              </a>
            </div>
          </div>
          <div className="px-6 py-4 sm:px-8 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-950/40">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Protegido por RLS y Supabase Auth. Multi‑tenant.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}