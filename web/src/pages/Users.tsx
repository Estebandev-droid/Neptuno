import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listProfiles, assignRole, getUserRoles, createUser } from '../lib/usersService'
import { listRoles } from '../lib/rolesService'
import type { Profile } from '../types/users'

export default function UsersPage() {
  const qc = useQueryClient()
  const { data: profiles, isLoading, error } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: listRoles })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const [openCreate, setOpenCreate] = useState(false)

  const signUpMut = useMutation({
    mutationFn: () => createUser(email, password, fullName),
    onSuccess: () => {
      setEmail(''); setPassword(''); setFullName('')
      setOpenCreate(false)
      qc.invalidateQueries({ queryKey: ['profiles'] })
    }
  })

  const assignMut = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) => assignRole(userId, roleName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] })
  })

  // UI
  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Usuarios</h2>
        <button className="glass-button px-4 py-2 rounded-lg" onClick={() => setOpenCreate(true)}>Crear usuario</button>
      </div>

      {openCreate && (
        <div className="glass-card p-4 rounded-xl mb-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="Nombre completo (opcional)" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-4">
            <button className="glass-button px-4 py-2 rounded-lg" onClick={() => signUpMut.mutate()}>Guardar</button>
            <button className="glass-nav-item px-4 py-2 rounded-lg" onClick={() => setOpenCreate(false)}>Cancelar</button>
          </div>
          <p className="text-xs text-light/70 mt-2">Nota: El usuario deberá verificar su correo si la configuración de Supabase lo requiere.</p>
        </div>
      )}

      {isLoading && <div className="text-light/70">Cargando usuarios...</div>}
      {error && <div className="text-red-400">Error al cargar usuarios</div>}

      <div className="grid gap-4">
        {profiles?.map((p: Profile) => (
          <UserCard key={p.id} profile={p} roles={roles?.map(r => r.name) ?? []} onAssign={(role) => assignMut.mutate({ userId: p.id, roleName: role })} />
        ))}
      </div>
    </div>
  )
}

function UserCard({ profile, roles, onAssign }: { profile: Profile; roles: string[]; onAssign: (role: string) => void }) {
  const { data: userRoles, refetch } = useQuery({ queryKey: ['user_roles', profile.id], queryFn: () => getUserRoles(profile.id) })

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <p className="font-semibold">{profile.full_name ?? '(Sin nombre)'} <span className="text-light/60 text-sm">{profile.id}</span></p>
      </div>
      <div className="flex items-center gap-2">
        <select className="glass-input px-3 py-2 rounded-lg" value="" onChange={(e) => { onAssign(e.target.value); refetch() }}>
          <option value="" disabled>Asignar rol</option>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {userRoles?.map((r) => (
            <span key={r} className="px-2 py-1 rounded-lg glass-nav-item text-sm">{r}</span>
          ))}
        </div>
      </div>
    </div>
  )
}