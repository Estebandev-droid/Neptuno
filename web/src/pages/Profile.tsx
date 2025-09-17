import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { updateProfile } from '../lib/usersService'
import { useUser } from '../hooks/useUsers'

export default function ProfilePage() {
  const { user: authUser } = useAuth()
  const userId = authUser?.id || ''
  const { user: profile, isLoading, error } = useUser(userId)
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || profile.name || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  const isDisabled = useMemo(() => !authUser || isLoading, [authUser, isLoading])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('No autenticado')
      await updateProfile(userId, {
        full_name: fullName?.trim() || null,
        avatar_url: avatarUrl?.trim() || null,
      })
    },
    onSuccess: async () => {
      setMessage('Perfil actualizado correctamente')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
      ])
      setTimeout(() => setMessage(null), 3000)
    },
    onError: (err: Error) => {
      setMessage(err?.message || 'Error al actualizar el perfil')
      setTimeout(() => setMessage(null), 4000)
    }
  })

  if (!authUser) {
    return (
      <div className="p-6">
        <div className="glass-card rounded-xl p-6">
          <p className="text-red-500">Debes iniciar sesión para ver tu perfil.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Mi Perfil</h1>
          <p className="text-sm text-light/60">Gestiona tu información personal</p>
        </header>

        <div className="glass-card rounded-xl p-6">
          {isLoading ? (
            <div className="flex items-center gap-3 text-light/70">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              Cargando perfil...
            </div>
          ) : error ? (
            <p className="text-red-500">Ocurrió un error al cargar tu perfil.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                mutation.mutate()
              }}
              className="space-y-5"
            >
              <div className="flex items-center gap-4">
                <img
                  src={avatarUrl || '/logo.webp'}
                  alt="Avatar"
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).src = '/logo.webp'
                  }}
                />
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">URL de avatar</label>
                  <input
                    type="url"
                    className="glass-input w-full px-3 py-2 rounded-lg"
                    placeholder="https://..."
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    disabled={isDisabled || mutation.isPending}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nombre completo</label>
                <input
                  type="text"
                  className="glass-input w-full px-3 py-2 rounded-lg"
                  placeholder="Tu nombre"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isDisabled || mutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="text-xs text-light/60">
                  <p><span className="font-semibold">ID:</span> {authUser.id}</p>
                  {profile?.email && <p><span className="font-semibold">Email:</span> {profile.email}</p>}
                </div>
                <button
                  type="submit"
                  className="glass-button px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
                  disabled={isDisabled || mutation.isPending}
                >
                  {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>

              {message && (
                <div className={`mt-2 text-sm ${message.includes('Error') ? 'text-red-500' : 'text-emerald-500'}`}>
                  {message}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}