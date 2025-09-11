import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listProfiles, assignRole, getUserRoles, createUser, removeProfile, revokeRole } from '../lib/usersService'
import { listRoles } from '../lib/rolesService'
import type { Profile } from '../types/users'

export default function UsersPage() {
  const qc = useQueryClient()
  const { data: profiles, isLoading, error } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles })
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: listRoles })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [signatureUrl, setSignatureUrl] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [roleName, setRoleName] = useState('student')

  const [openCreate, setOpenCreate] = useState(false)

  const signUpMut = useMutation({
    mutationFn: () => createUser(email, password, fullName, roleName, phone, signatureUrl, photoUrl),
    onSuccess: () => {
      setEmail(''); setPassword(''); setFullName(''); setPhone(''); setSignatureUrl(''); setPhotoUrl(''); setRoleName('student')
      setOpenCreate(false)
      qc.invalidateQueries({ queryKey: ['profiles'] })
    }
  })

  const assignMut = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) => assignRole(userId, roleName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] })
  })

  const deleteMut = useMutation({
    mutationFn: (userId: string) => removeProfile(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] })
  })

  const revokeMut = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) => revokeRole(userId, roleName),
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
          <h3 className="text-lg font-semibold mb-4">Crear nuevo usuario</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="Correo (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <select className="glass-input px-4 py-2 rounded-lg" value={roleName} onChange={(e) => setRoleName(e.target.value)}>
              <option value="student">Estudiante</option>
              <option value="teacher">Profesor</option>
              <option value="admin">Administrador</option>
              <option value="superadmin">Super Administrador</option>
            </select>
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="URL de firma (opcional)" value={signatureUrl} onChange={(e) => setSignatureUrl(e.target.value)} />
          </div>
          <div className="grid gap-3 mt-3">
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="URL de foto (opcional)" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-4">
            <button className="glass-button px-4 py-2 rounded-lg" onClick={() => signUpMut.mutate()}>Guardar</button>
            <button className="glass-nav-item px-4 py-2 rounded-lg" onClick={() => setOpenCreate(false)}>Cancelar</button>
          </div>
          <p className="text-xs text-light/70 mt-2">Nota: El email es opcional. Si no se proporciona, se generará un usuario sin email.</p>
        </div>
      )}

      {isLoading && <div className="text-light/70">Cargando usuarios...</div>}
      {error && <div className="text-red-400">Error al cargar usuarios</div>}

      <div className="grid gap-4">
        {profiles?.map((p: Profile) => (
          <UserCard 
            key={p.id} 
            profile={p} 
            roles={roles?.map(r => r.name) ?? []} 
            onAssign={(role) => assignMut.mutate({ userId: p.id, roleName: role })}
            onRevoke={(role) => revokeMut.mutate({ userId: p.id, roleName: role })}
            onDelete={() => {
              if (confirm(`¿Estás seguro de que quieres eliminar al usuario ${p.full_name || p.id}?`)) {
                deleteMut.mutate(p.id)
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

function UserCard({ profile, roles, onAssign, onRevoke, onDelete }: { 
  profile: Profile; 
  roles: string[]; 
  onAssign: (role: string) => void;
  onRevoke: (role: string) => void;
  onDelete: () => void;
}) {
  const { data: userRoles, refetch } = useQuery({ queryKey: ['user_roles', profile.id], queryFn: () => getUserRoles(profile.id) })

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-semibold">{profile.full_name ?? '(Sin nombre)'}</p>
          <p className="text-light/60 text-sm">{profile.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="glass-input px-3 py-2 rounded-lg" value="" onChange={(e) => { onAssign(e.target.value); refetch() }}>
            <option value="" disabled>Asignar rol</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button 
            className="glass-button-danger px-3 py-2 rounded-lg text-sm"
            onClick={onDelete}
            title="Eliminar usuario"
          >
            🗑️
          </button>
        </div>
      </div>
      
      {userRoles && userRoles.length > 0 && (
        <div className="border-t border-light/10 pt-3">
          <p className="text-sm text-light/70 mb-2">Roles asignados:</p>
          <div className="flex flex-wrap gap-2">
            {userRoles.map((r) => (
              <div key={r} className="flex items-center gap-1 px-2 py-1 rounded-lg glass-nav-item text-sm">
                <span>{r}</span>
                <button 
                  className="text-red-400 hover:text-red-300 ml-1"
                  onClick={() => {
                    if (confirm(`¿Quitar el rol "${r}" del usuario?`)) {
                      onRevoke(r)
                      refetch()
                    }
                  }}
                  title="Quitar rol"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}