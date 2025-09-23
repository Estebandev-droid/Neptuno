import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listRelationships, createRelationship, updateRelationship, deleteRelationship, getAvailableParents, getAvailableStudents } from '../../lib/relationshipsService'
import type { RelationshipWithDetails, CreateRelationshipRequest } from '../../types/relationships'
import type { Profile } from '../../types/users'
import { PencilIcon, TrashIcon, XMarkIcon, LinkIcon } from '@heroicons/react/24/outline'

export default function RelationshipsPage() {
  const qc = useQueryClient()
  const { data: relationships, isLoading, error } = useQuery<RelationshipWithDetails[], Error>({ 
    queryKey: ['relationships'], 
    queryFn: listRelationships 
  })
  const { data: availableParents } = useQuery<Profile[]>({ 
    queryKey: ['available-parents'], 
    queryFn: getAvailableParents 
  })
  const { data: availableStudents } = useQuery<Profile[]>({ 
    queryKey: ['available-students'], 
    queryFn: getAvailableStudents 
  })
  
  const [openCreate, setOpenCreate] = useState(false)
  const [editingRelationship, setEditingRelationship] = useState<RelationshipWithDetails | null>(null)
  
  // Form states
  const [parentId, setParentId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [relationshipType, setRelationshipType] = useState('guardian')
  
  const [formErrors, setFormErrors] = useState<{ parentId?: string; studentId?: string }>({})
  
  const validate = () => {
    const errs: { parentId?: string; studentId?: string } = {}
    if (!parentId) {
      errs.parentId = 'Selecciona un padre'
    }
    if (!studentId) {
      errs.studentId = 'Selecciona un estudiante'
    }
    if (parentId === studentId) {
      errs.studentId = 'El padre y estudiante no pueden ser la misma persona'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const resetForm = () => {
    setParentId('')
    setStudentId('')
    setRelationshipType('guardian')
    setFormErrors({})
    setEditingRelationship(null)
    setOpenCreate(false)
  }

  const handleEdit = (relationship: RelationshipWithDetails) => {
    setEditingRelationship(relationship)
    setParentId(relationship.parent_id)
    setStudentId(relationship.student_id)
    setRelationshipType(relationship.relationship_type)
    setOpenCreate(true)
  }

  const createMut = useMutation({
    mutationFn: (data: CreateRelationshipRequest) => createRelationship(data),
    onSuccess: () => {
      resetForm()
      qc.invalidateQueries({ queryKey: ['relationships'] })
    },
    onError: (error: Error) => {
      console.error('Error creating relationship:', error)
      alert(error.message || 'Error al crear la relación')
    }
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { relationship_type: string } }) => 
      updateRelationship(id, data),
    onSuccess: () => {
      resetForm()
      qc.invalidateQueries({ queryKey: ['relationships'] })
    }
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRelationship(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relationships'] })
  })

  const handleSubmit = () => {
    if (!validate()) return

    const relationshipData = {
      parent_id: parentId,
      student_id: studentId,
      relationship_type: relationshipType
    }

    if (editingRelationship) {
      updateMut.mutate({ 
        id: editingRelationship.id, 
        data: { relationship_type: relationshipType } 
      })
    } else {
      createMut.mutate(relationshipData)
    }
  }

  // Verificar si ya existe una relación entre el padre y estudiante seleccionados
  const relationshipExists = relationships?.some(rel => 
    rel.parent_id === parentId && rel.student_id === studentId && 
    (!editingRelationship || rel.id !== editingRelationship.id)
  )

  // Fecha de última actualización basada en created_at más reciente
  const lastUpdateDateStr = relationships && relationships.length > 0
    ? new Date(Math.max(...relationships.map(r => new Date(r.created_at).getTime()))).toLocaleDateString()
    : '-'

  if (isLoading) return <div className="py-6"><p>Cargando relaciones...</p></div>
  if (error) return <div className="py-6"><p className="text-red-400">Error: {error.message}</p></div>

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Relaciones Padre-Estudiante</h2>
        <button 
          className="glass-button px-4 py-2 rounded-lg" 
          onClick={() => setOpenCreate(true)}
        >
          <LinkIcon className="h-4 w-4 mr-2 inline" />
          Vincular Padre-Estudiante
        </button>
      </div>

      {/* Formulario de creación/edición */}
      {openCreate && (
        <div className="glass-card p-6 rounded-xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingRelationship ? 'Editar Relación' : 'Crear nueva Relación'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-white">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Padre *</label>
              <select 
                className={`glass-input px-4 py-2 rounded-lg w-full ${formErrors.parentId ? 'ring-1 ring-red-400' : ''}`}
                value={parentId} 
                onChange={(e) => setParentId(e.target.value)}
                disabled={!!editingRelationship} // No permitir cambiar en edición
              >
                <option value="">Seleccionar padre...</option>
                {availableParents?.map(parent => (
                  <option key={parent.id} value={parent.id}>
                    {parent.full_name} ({parent.email})
                  </option>
                ))}
              </select>
              {formErrors.parentId && <p className="text-red-400 text-xs mt-1">{formErrors.parentId}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Estudiante *</label>
              <select 
                className={`glass-input px-4 py-2 rounded-lg w-full ${formErrors.studentId ? 'ring-1 ring-red-400' : ''}`}
                value={studentId} 
                onChange={(e) => setStudentId(e.target.value)}
                disabled={!!editingRelationship} // No permitir cambiar en edición
              >
                <option value="">Seleccionar estudiante...</option>
                {availableStudents?.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.full_name} ({student.email})
                  </option>
                ))}
              </select>
              {formErrors.studentId && <p className="text-red-400 text-xs mt-1">{formErrors.studentId}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Relación</label>
              <select 
                className="glass-input px-4 py-2 rounded-lg w-full"
                value={relationshipType} 
                onChange={(e) => setRelationshipType(e.target.value)}
              >
                <option value="guardian">Tutor/Guardián</option>
                <option value="parent">Padre/Madre</option>
                <option value="relative">Familiar</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
          
          {relationshipExists && !editingRelationship && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 text-sm">
                ⚠️ Ya existe una relación entre este padre y estudiante
              </p>
            </div>
          )}
          
          <div className="flex gap-2 mt-6">
            <button 
              className="glass-button px-4 py-2 rounded-lg"
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending || (relationshipExists && !editingRelationship)}
            >
              {editingRelationship ? 'Actualizar' : 'Crear Relación'}
            </button>
            <button 
              className="glass-button-secondary px-4 py-2 rounded-lg"
              onClick={resetForm}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de relaciones */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Padre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estudiante</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Creado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {relationships?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    No hay relaciones padre-estudiante registradas
                  </td>
                </tr>
              ) : (
                relationships?.map((relationship) => (
                  <tr key={relationship.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {relationship.parent?.avatar_url && (
                          <img 
                            src={relationship.parent.avatar_url} 
                            alt={relationship.parent.full_name}
                            className="h-8 w-8 rounded-full mr-3 object-cover"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">{relationship.parent?.full_name}</div>
                          <div className="text-xs text-gray-400">{relationship.parent?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {relationship.student?.avatar_url && (
                          <img 
                            src={relationship.student.avatar_url} 
                            alt={relationship.student.full_name}
                            className="h-8 w-8 rounded-full mr-3 object-cover"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">{relationship.student?.full_name}</div>
                          <div className="text-xs text-gray-400">{relationship.student?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{relationship.relationship_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(relationship.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="glass-nav-item p-2 rounded-lg"
                          onClick={() => handleEdit(relationship)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button 
                          className="glass-button-danger p-2 rounded-lg"
                          onClick={() => {
                            if (confirm('¿Eliminar esta relación?'))
                              deleteMut.mutate(relationship.id)
                          }}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Estadísticas */}
        <div className="p-6 bg-white/5 border-t border-white/10">
          <h3 className="text-lg font-semibold mb-4">Estadísticas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-4 rounded-xl">
              <div className="text-sm text-gray-400">Total de relaciones</div>
              <div className="text-2xl font-bold">{relationships?.length ?? 0}</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-sm text-gray-400">Padres únicos</div>
              <div className="text-2xl font-bold">{new Set(relationships?.map(r => r.parent_id)).size}</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-sm text-gray-400">Estudiantes únicos</div>
              <div className="text-2xl font-bold">{new Set(relationships?.map(r => r.student_id)).size}</div>
            </div>
            <div className="glass-card p-4 rounded-xl">
              <div className="text-sm text-gray-400">Última actualización</div>
              <div className="text-2xl font-bold">{lastUpdateDateStr}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
