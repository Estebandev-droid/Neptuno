import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listRoles, createRole, renameRole, deleteRole } from '../lib/rolesService'

export default function RolesPage() {
  const qc = useQueryClient()
  const { data: roles, isLoading, error } = useQuery({ queryKey: ['roles'], queryFn: listRoles })
  const [newRole, setNewRole] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formErrors, setFormErrors] = useState<{ name?: string }>({})
  const [editing, setEditing] = useState<{ id: string; oldName: string; newName: string } | null>(null)

  const createMut = useMutation({
    mutationFn: (name: string) => createRole(name),
    onSuccess: () => {
      setNewRole('')
      setShowCreateForm(false)
      setFormErrors({})
      qc.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (error: Error) => {
      console.error('Error creating role:', error)
    }
  })

  const renameMut = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) => renameRole(oldName, newName),
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
      createMut.mutate(newRole.trim())
    }
  }

  const handleCancelCreate = () => {
    setShowCreateForm(false)
    setNewRole('')
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
              <div className="flex items-center gap-2">
                <input
                  value={editing.newName}
                  onChange={(e) => setEditing({ ...editing, newName: e.target.value })}
                  className="glass-input px-3 py-2 rounded-lg flex-1"
                />
                <button className="glass-button px-3 py-2 rounded-lg" onClick={() => renameMut.mutate({ oldName: editing.oldName, newName: editing.newName })}>Guardar</button>
                <button className="glass-nav-item px-3 py-2 rounded-lg" onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  {r.description && <p className="text-sm text-light/70">{r.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button className="glass-nav-item px-3 py-2 rounded-lg" onClick={() => setEditing({ id: r.id, oldName: r.name, newName: r.name })}>Editar</button>
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