import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listRoles, createRole, renameRole, deleteRole, updateRoleDescription } from '../lib/rolesService'

export default function RolesPage() {
  const qc = useQueryClient()
  const { data: roles, isLoading, error } = useQuery({ queryKey: ['roles'], queryFn: listRoles })
  const [newRole, setNewRole] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formErrors, setFormErrors] = useState<{ name?: string }>({})
  const [editing, setEditing] = useState<{ id: string; oldName: string; newName: string; oldDescription?: string | null; newDescription?: string | null } | null>(null)

  const createMut = useMutation({
    mutationFn: (payload: { name: string; description?: string }) => createRole(payload.name, payload.description),
    onSuccess: () => {
      setNewRole('')
      setNewDescription('')
      setShowCreateForm(false)
      setFormErrors({})
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (error: Error) => {
      console.error('Error creating role:', error)
    }
  })

  const saveMut = useMutation({
    mutationFn: async (payload: { oldName: string; newName: string; oldDescription?: string | null; newDescription?: string | null }) => {
      const finalName = payload.newName.trim()
      if (payload.oldName !== finalName) {
        await renameRole(payload.oldName, finalName)
      }
      const oldDesc = payload.oldDescription ?? null
      const newDesc = (payload.newDescription ?? '').trim()
      const newDescNull = newDesc.length === 0 ? null : newDesc
      const descChanged = oldDesc !== newDescNull
      if (descChanged) {
        await updateRoleDescription(finalName, newDesc)
      }
    },
    onSuccess: () => {
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (name: string) => deleteRole(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })

  const validateForm = () => {
    const errors: { name?: string } = {}
    
    if (!newRole.trim()) {
      errors.name = 'El nombre del rol es requerido'
    } else if (newRole.trim().length < 2) {
      errors.name = 'El nombre debe tener al menos 2 caracteres'
    } else if (roles?.some(r => r.name.toLowerCase() === newRole.trim().toLowerCase())) {
      errors.name = 'Ya existe un rol con este nombre'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateRole = () => {
    if (validateForm()) {
      createMut.mutate({ name: newRole.trim(), description: newDescription.trim() || undefined })
    }
  }

  const handleCancelCreate = () => {
    setShowCreateForm(false)
    setNewRole('')
    setNewDescription('')
    setFormErrors({})
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Roles</h2>
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="glass-button px-4 py-2 rounded-lg"
          >
            Crear Rol
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancelCreate}
              className="glass-nav-item px-4 py-2 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="glass-card p-6 rounded-xl mb-6">
          <h3 className="text-lg font-semibold mb-4">Crear Nuevo Rol</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre del Rol *</label>
              <input
                value={newRole}
                onChange={(e) => {
                  setNewRole(e.target.value)
                  if (formErrors.name) {
                    setFormErrors({ ...formErrors, name: undefined })
                  }
                }}
                placeholder="Ingrese el nombre del rol"
                className={`glass-input px-4 py-2 rounded-lg w-full ${
                  formErrors.name ? 'border-red-400' : ''
                }`}
              />
              {formErrors.name && (
                <p className="text-red-400 text-sm mt-1">{formErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Descripción (opcional)</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe brevemente el rol"
                className="glass-input px-4 py-2 rounded-lg w-full"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCreateRole}
                disabled={createMut.isPending}
                className="glass-button px-6 py-2 rounded-lg disabled:opacity-50"
              >
                {createMut.isPending ? 'Creando...' : 'Crear Rol'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <div className="text-light/70">Cargando roles...</div>}
        {error && <div className="text-red-400">Error al cargar roles</div>}
        {roles?.map((r) => (
          <div key={r.id} className="glass-card p-4 rounded-xl">
            {editing?.id === r.id ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={editing.newName}
                    onChange={(e) => setEditing({ ...editing!, newName: e.target.value })}
                    className="glass-input px-3 py-2 rounded-lg flex-1"
                    placeholder="Nombre del rol"
                  />
                </div>
                <div>
                  <input
                    value={editing.newDescription ?? ''}
                    onChange={(e) => setEditing({ ...editing!, newDescription: e.target.value })}
                    className="glass-input px-3 py-2 rounded-lg w-full"
                    placeholder="Descripción (opcional)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button className="glass-button px-3 py-2 rounded-lg" onClick={() => editing && saveMut.mutate(editing)}>Guardar</button>
                  <button className="glass-nav-item px-3 py-2 rounded-lg" onClick={() => setEditing(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  {r.description && <p className="text-sm text-light/70">{r.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button className="glass-nav-item px-3 py-2 rounded-lg" onClick={() => setEditing({ id: r.id, oldName: r.name, newName: r.name, oldDescription: r.description ?? null, newDescription: r.description ?? '' })}>Editar</button>
                  {!r.is_system && (
                    <button className="glass-button px-3 py-2 rounded-lg" onClick={() => deleteMut.mutate(r.name)}>Eliminar</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}