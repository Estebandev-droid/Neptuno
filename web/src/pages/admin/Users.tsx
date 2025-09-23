import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUsers } from '../../hooks/useUsers'
import { useRoles } from '../../hooks/useAppData'
import { getUserRoles } from '../../lib/usersService'
import type { Profile } from '../../types/users'

export default function UsersPage() {
  const { 
    profiles, 
    isLoading, 
    error, 
    createUser, 
    assignRole, 
    revokeRole, 
    deleteUser,
    isCreating
  } = useUsers()
  
  const { roles } = useRoles()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [signatureUrl, setSignatureUrl] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [roleName, setRoleName] = useState('student')

  const [openCreate, setOpenCreate] = useState(false)
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string; roleName?: string }>({})

  // Establecer rol por defecto cuando se cargan los roles
  useState(() => {
    if (roles && roles.length > 0) {
      const hasCurrent = roles.some(r => r.name === roleName)
      if (!hasCurrent) {
        const student = roles.find(r => r.name === 'student')
        setRoleName(student?.name ?? roles[0].name)
      }
    }
  })

  const validate = () => {
    const errs: { email?: string; password?: string; roleName?: string } = {}
    const emailTrim = email.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailTrim) {
      errs.email = 'El correo es obligatorio'
    } else if (!emailRegex.test(emailTrim)) {
      errs.email = 'Ingresa un correo válido'
    }
    if (!password || password.length < 6) {
      errs.password = 'La contraseña debe tener al menos 6 caracteres'
    }
    if (!roleName) {
      errs.roleName = 'Selecciona un rol'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreateUser = async () => {
    if (!validate()) return
    
    try {
      await createUser.mutateAsync({
        email,
        password,
        fullName,
        roleName,
        phone,
        signatureUrl,
        photoUrl
      })
      
      // Limpiar formulario
      setEmail('')
      setPassword('')
      setFullName('')
      setPhone('')
      setSignatureUrl('')
      setPhotoUrl('')
      setRoleName('student')
      setOpenCreate(false)
      setFormErrors({})
    } catch (error) {
      console.error('Error creating user:', error)
    }
  }

  const handleAssignRole = async (userId: string, role: string) => {
    try {
      await assignRole.mutateAsync({ userId, roleName: role })
    } catch (error) {
      console.error('Error assigning role:', error)
    }
  }

  const handleRevokeRole = async (userId: string, role: string) => {
    try {
      await revokeRole.mutateAsync({ userId, roleName: role })
    } catch (error) {
      console.error('Error revoking role:', error)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser.mutateAsync(userId)
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

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
            <div>
              <input className={`glass-input px-4 py-2 rounded-lg w-full ${formErrors.email ? 'ring-1 ring-red-400' : ''}`} placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} />
              {formErrors.email && <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>}
            </div>
            <div>
              <input className="glass-input px-4 py-2 rounded-lg w-full" placeholder="Nombre completo (opcional)" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <input className={`glass-input px-4 py-2 rounded-lg w-full ${formErrors.password ? 'ring-1 ring-red-400' : ''}`} placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {formErrors.password && <p className="text-red-400 text-xs mt-1">{formErrors.password}</p>}
            </div>
            <div>
              <input className="glass-input px-4 py-2 rounded-lg w-full" placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <select className={`glass-input px-4 py-2 rounded-lg w-full ${formErrors.roleName ? 'ring-1 ring-red-400' : ''}`} value={roleName} onChange={(e) => setRoleName(e.target.value)}>
                {roles?.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
              {formErrors.roleName && <p className="text-red-400 text-xs mt-1">{formErrors.roleName}</p>}
            </div>
            <div>
              <input className="glass-input px-4 py-2 rounded-lg w-full" placeholder="URL de firma (opcional)" value={signatureUrl} onChange={(e) => setSignatureUrl(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 mt-3">
            <input className="glass-input px-4 py-2 rounded-lg" placeholder="URL de foto (opcional)" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>
          {createUser.error && (
            <div className="text-red-400 text-sm mt-2">
              {(createUser.error as Error).message || 'Error al crear usuario'}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button
              className="glass-button px-4 py-2 rounded-lg disabled:opacity-50"
              disabled={isCreating}
              onClick={handleCreateUser}
            >{isCreating ? 'Creando...' : 'Guardar'}</button>
            <button className="glass-nav-item px-4 py-2 rounded-lg" onClick={() => { setOpenCreate(false); setFormErrors({}) }}>Cancelar</button>
          </div>
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
            onAssign={(role) => handleAssignRole(p.id, role)}
            onRevoke={(role) => handleRevokeRole(p.id, role)}
            onDelete={() => {
              if (confirm(`¿Estás seguro de que quieres eliminar al usuario ${p.full_name || p.id}?`)) {
                handleDeleteUser(p.id)
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

function UserCard({ 
  profile, 
  roles, 
  onAssign, 
  onRevoke, 
  onDelete 
}: {
  profile: Profile;
  roles: string[];
  onAssign: (role: string) => void;
  onRevoke: (role: string) => void;
  onDelete: () => void;
}) {
  const { data: userRoles, refetch } = useQuery({ 
    queryKey: ['user_roles', profile.id], 
    queryFn: () => getUserRoles(profile.id) 
  })

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
            {userRoles.map((r: string) => (
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
