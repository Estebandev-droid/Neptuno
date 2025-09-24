import { useState, useEffect } from 'react'
import { useCourses } from '../../hooks/useCourses'
import { useActiveCategories, useInstructors } from '../../hooks/useAppData'
import type { Course } from '../../types/courses'
import { Link } from 'react-router-dom'

export default function CoursesPage() {
  // Estados de filtros y paginación
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [onlyActive, setOnlyActive] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [instructorFilter, setInstructorFilter] = useState<string>('')

  // Hooks optimizados
  const {
    courses,
    total,
    totalPages,
    isLoading,
    isFetching,
    error,
    createCourse,
    updateCourse,
    toggleActive,
    deleteCourse,
    isCreating,
    isUpdating,
    isDeleting
  } = useCourses({
    search,
    page,
    pageSize,
    onlyActive,
    categoryId: categoryFilter || null,
    instructorId: instructorFilter || null
  })

  const { categories } = useActiveCategories()
  const { instructors } = useInstructors()

  // Estados del formulario de creación
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newInstructorId, setNewInstructorId] = useState('')
  const [newCoverImage, setNewCoverImage] = useState('')
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; courseId: string | null; courseTitle: string }>({ isOpen: false, courseId: null, courseTitle: '' })

  // Función para crear curso
  const handleCreateCourse = async () => {
    try {
      setFormError(null)
      await createCourse.mutateAsync({
        courseData: {
          title: newTitle,
          description: newDescription || null,
          category_id: newCategoryId || null,
          instructor_id: newInstructorId || null,
          cover_image: newCoverImage || null
        },
        coverFile: newCoverFile
      })

      // Limpiar formulario
      setNewTitle('')
      setNewDescription('')
      setNewCategoryId('')
      setNewInstructorId('')
      setNewCoverImage('')
      setNewCoverFile(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Error al crear curso')
    }
  }

  // Estados de edición inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Record<string, { title: string; description?: string; category_id?: string | null; instructor_id?: string | null; cover_image?: string | null }>>({})
  const [editingCoverFile, setEditingCoverFile] = useState<Record<string, File | null>>({})

  // Limpiar URLs de objeto para evitar memory leaks
  useEffect(() => {
    return () => {
      // Limpiar URLs de objeto al desmontar el componente
      Object.values(editingCoverFile).forEach(file => {
        if (file) {
          URL.revokeObjectURL(URL.createObjectURL(file))
        }
      })
      if (newCoverFile) {
        URL.revokeObjectURL(URL.createObjectURL(newCoverFile))
      }
    }
  }, [editingCoverFile, newCoverFile])
  const [rowError, setRowError] = useState<Record<string, string | null>>({})

  // Función para guardar edición
  const handleSaveEdit = async () => {
    if (!editingId || !editingData[editingId]) return
    
    // Validar antes de guardar
    const validationError = validateEditCourse()
    if (validationError) {
      setRowError(prev => ({ ...prev, [editingId]: validationError }))
      return
    }
    
    try {
      setRowError(prev => ({ ...prev, [editingId]: null }))
      
      const editing = editingData[editingId]
      // Convertir cadenas vacías a null para campos UUID
      const changes = {
        ...editing,
        category_id: editing.category_id === '' ? null : editing.category_id,
        instructor_id: editing.instructor_id === '' ? null : editing.instructor_id,
        description: editing.description === '' ? null : editing.description,
        cover_image: editing.cover_image === '' ? null : editing.cover_image
      }
      const file = editingCoverFile[editingId]
      
      await updateCourse.mutateAsync({
        courseId: editingId,
        updates: changes,
        coverFile: file
      })

      // Limpiar estado de edición
      setEditingCoverFile(prev => {
        const copy = { ...prev }
        if (editingId in copy) {
          delete copy[editingId]
        }
        return copy
      })
      setEditingData(prev => {
        const copy = { ...prev }
        if (editingId in copy) {
          delete copy[editingId]
        }
        return copy
      })
      setEditingId(null)
      setRowError({})
    } catch (error) {
      setRowError(prev => ({ 
        ...prev, 
        [editingId]: error instanceof Error ? error.message : 'Error al guardar' 
      }))
    }
  }

  // Funciones para toggle y delete
  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await toggleActive.mutateAsync({ courseId: id, active })
    } catch (error) {
      console.error('Error al cambiar estado:', error)
    }
  }



  // Función de validación para el formulario de creación
  const validateNewCourse = () => {
    const errors: Record<string, string> = {}
    
    // Validar título
    const title = newTitle.trim()
    if (!title) {
      errors.title = 'El título es obligatorio'
    } else if (title.length < 3) {
      errors.title = 'El título debe tener al menos 3 caracteres'
    } else if (title.length > 100) {
      errors.title = 'El título no puede exceder 100 caracteres'
    }
    
    // Validar descripción (opcional pero con límite)
    if (newDescription && newDescription.trim().length > 500) {
      errors.description = 'La descripción no puede exceder 500 caracteres'
    }
    
    // Validar archivo de imagen
    if (newCoverFile) {
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (newCoverFile.size > maxSize) {
        errors.coverFile = 'La imagen no puede exceder 5MB'
      }
      if (!newCoverFile.type.startsWith('image/')) {
        errors.coverFile = 'El archivo debe ser una imagen'
      }
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Función de validación para edición
  const validateEditCourse = () => {
    if (!editingId || !editingData[editingId]) return 'Error de validación'
    const editing = editingData[editingId]
    const title = editing.title?.trim()
    if (!title || title.length < 3) {
      return 'El título es obligatorio (mínimo 3 caracteres)'
    }
    if (title.length > 100) {
      return 'El título no puede exceder 100 caracteres'
    }
    if (editing.description && editing.description.trim().length > 500) {
      return 'La descripción no puede exceder 500 caracteres'
    }
    return null
  }

  const handleCreate = () => {
    if (!validateNewCourse()) {
      setFormError('Por favor corrige los errores en el formulario')
      return
    }
    
    setFormError(null)
    setValidationErrors({})
    handleCreateCourse()
  }

  const startEdit = (c: Course) => {
    // Limpiar cualquier edición previa y establecer nueva edición
    setEditingId(c.id)
    setEditingData({
      [c.id]: {
        title: c.title, 
        description: c.description ?? '', 
        category_id: c.category_id ?? null, 
        instructor_id: c.instructor_id ?? null, 
        cover_image: c.cover_image ?? '' 
      }
    })
    
    // Limpiar errores previos
    setRowError(prev => ({ ...prev, [c.id]: null }))
  }

  const handleDeleteClick = (course: Course) => {
    setDeleteConfirmation({ isOpen: true, courseId: course.id, courseTitle: course.title })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation.courseId) return
    
    try {
      await deleteCourse.mutateAsync(deleteConfirmation.courseId)
      setDeleteConfirmation({ isOpen: false, courseId: null, courseTitle: '' })
    } catch (error) {
      console.error('Error al eliminar curso:', error)
      // El error se mostrará automáticamente por el hook
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirmation({ isOpen: false, courseId: null, courseTitle: '' })
  }

  return (
    <div className="py-6">
      <div className="flex flex-col gap-4 mb-6">
        <h2 className="text-xl font-bold">Cursos</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="glass-input px-3 py-2 rounded-lg flex-1 min-w-0"
            placeholder="Buscar cursos..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <label className="flex items-center gap-2 glass-nav-item px-3 py-2 rounded-lg whitespace-nowrap">
            <input type="checkbox" checked={onlyActive} onChange={(e) => { setOnlyActive(e.target.checked); setPage(1) }} />
            <span className="text-sm">Solo activos</span>
          </label>
        </div>
        
        {/* Filtros adicionales */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            className="glass-input px-3 py-2 rounded-lg flex-1"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
          >
            <option value="">Todas las categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          
          <select 
            className="glass-input px-3 py-2 rounded-lg flex-1"
            value={instructorFilter}
            onChange={(e) => { setInstructorFilter(e.target.value); setPage(1) }}
          >
            <option value="">Todos los instructores</option>
            {instructors.map(i => (
              <option key={i.id} value={i.id}>{i.full_name ?? i.id}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl mb-6">
        <h3 className="font-semibold mb-4">Crear nuevo curso</h3>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <input 
                className={`glass-input px-3 py-2 rounded-lg ${
                  validationErrors.title ? 'border-red-400 focus:border-red-400' : ''
                }`}
                placeholder="Título *" 
                value={newTitle} 
                onChange={(e) => {
                  setNewTitle(e.target.value)
                  if (validationErrors.title) {
                    setValidationErrors(prev => ({ ...prev, title: '' }))
                  }
                }} 
              />
              {validationErrors.title && (
                <p className="text-red-400 text-xs mt-1">{validationErrors.title}</p>
              )}
            </div>
            <div>
              <input 
                className={`glass-input px-3 py-2 rounded-lg ${
                  validationErrors.description ? 'border-red-400 focus:border-red-400' : ''
                }`}
                placeholder="Descripción (opcional)" 
                value={newDescription} 
                onChange={(e) => {
                  setNewDescription(e.target.value)
                  if (validationErrors.description) {
                    setValidationErrors(prev => ({ ...prev, description: '' }))
                  }
                }} 
              />
              {validationErrors.description && (
                <p className="text-red-400 text-xs mt-1">{validationErrors.description}</p>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="glass-input px-3 py-2 rounded-lg" value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="glass-input px-3 py-2 rounded-lg" value={newInstructorId} onChange={(e) => setNewInstructorId(e.target.value)}>
              <option value="">Sin instructor</option>
              {instructors.map(i => <option key={i.id} value={i.id}>{i.full_name ?? i.id}</option>)}
            </select>
          </div>
          <input className="glass-input px-3 py-2 rounded-lg w-full" placeholder="URL de portada (opcional)" value={newCoverImage} onChange={(e) => setNewCoverImage(e.target.value)} />
          <div className="space-y-2">
            <input 
              type="file" 
              accept="image/*" 
              className={`glass-input px-3 py-2 rounded-lg w-full ${
                validationErrors.coverFile ? 'border-red-400 focus:border-red-400' : ''
              }`}
              onChange={(e) => {
                setNewCoverFile(e.target.files?.[0] ?? null)
                if (validationErrors.coverFile) {
                  setValidationErrors(prev => ({ ...prev, coverFile: '' }))
                }
              }} 
            />
            {newCoverFile && (
              <div className="relative">
                <img src={URL.createObjectURL(newCoverFile)} alt="Vista previa" className="w-full h-32 object-cover rounded-lg" />
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">Vista previa</div>
              </div>
            )}
            {validationErrors.coverFile && (
              <p className="text-red-400 text-xs mt-1">{validationErrors.coverFile}</p>
            )}
            <p className="text-xs text-light/60 mt-1">Máximo 5MB, formatos: JPG, PNG, GIF</p>
          </div>
        </div>
        {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}
        <div className="mt-4 flex justify-end">
          <button className="glass-button px-4 py-2 rounded-lg w-full sm:w-auto" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Creando curso...
              </span>
            ) : 'Crear Curso'}
          </button>
        </div>
      </div>

      {/* Filtros adicionales */}
      <div className="glass-card p-4 rounded-xl mb-6">
        <h4 className="font-medium mb-3 text-sm text-light/80">Filtros</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-2">Categoría</label>
            <select className="glass-input px-3 py-2 rounded-lg w-full" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Instructor</label>
            <select className="glass-input px-3 py-2 rounded-lg w-full" value={instructorFilter} onChange={(e) => { setInstructorFilter(e.target.value); setPage(1) }}>
              <option value="">Todos los instructores</option>
              {instructors.map(i => <option key={i.id} value={i.id}>{i.full_name ?? i.id}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl">
        {isLoading && <div className="text-light/70">Cargando cursos...</div>}
        {error && <div className="text-red-400">Error al cargar cursos</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map(c => (
            <div key={c.id} className="glass-card p-0 rounded-xl overflow-hidden flex flex-col h-full">
              {c.cover_image && (
                <div className="aspect-video w-full overflow-hidden">
                  <img src={c.cover_image} alt={c.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4 flex flex-col flex-1">
                {editingId === c.id && editingData[c.id] ? (
                  <div className="space-y-3">
                    <input className="glass-input px-3 py-2 rounded-lg w-full text-sm" value={editingData[c.id]?.title || ''} onChange={(e) => setEditingData(prev => ({ ...prev, [c.id]: { ...prev[c.id], title: e.target.value } }))} />
                    <textarea className="glass-input px-3 py-2 rounded-lg w-full text-sm resize-none" rows={2} placeholder="Descripción" value={editingData[c.id]?.description ?? ''} onChange={(e) => setEditingData(prev => ({ ...prev, [c.id]: { ...prev[c.id], description: e.target.value } }))} />
                    <div className="space-y-2">
                      <select className="glass-input px-3 py-2 rounded-lg w-full text-sm" value={editingData[c.id]?.category_id ?? ''} onChange={(e) => setEditingData(prev => ({ ...prev, [c.id]: { ...prev[c.id], category_id: e.target.value || null } }))}>
                        <option value="">Sin categoría</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                      <select className="glass-input px-3 py-2 rounded-lg w-full text-sm" value={editingData[c.id]?.instructor_id ?? ''} onChange={(e) => setEditingData(prev => ({ ...prev, [c.id]: { ...prev[c.id], instructor_id: e.target.value || null } }))}>
                        <option value="">Sin instructor</option>
                        {instructors.map(i => <option key={i.id} value={i.id}>{i.full_name ?? i.id}</option>)}
                      </select>
                    </div>
                    <input className="glass-input px-3 py-2 rounded-lg w-full text-sm" placeholder="URL de portada" value={editingData[c.id]?.cover_image ?? ''} onChange={(e) => setEditingData(prev => ({ ...prev, [c.id]: { ...prev[c.id], cover_image: e.target.value } }))} />
                    <div className="space-y-2">
                      <input type="file" accept="image/*" className="glass-input px-3 py-2 rounded-lg w-full text-sm" onChange={(e) => setEditingCoverFile(prev => ({ ...prev, [c.id]: e.target.files?.[0] ?? null }))} />
                      {editingCoverFile[c.id] && (
                        <div className="relative">
                          <img src={URL.createObjectURL(editingCoverFile[c.id]!)} alt="Vista previa" className="w-full h-32 object-cover rounded-lg" />
                          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">Vista previa</div>
                        </div>
                      )}
                    </div>
                    {rowError[c.id] && <p className="text-red-400 text-xs">{rowError[c.id]}</p>}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button className="glass-button px-3 py-2 rounded-lg text-sm flex-1" onClick={handleSaveEdit} disabled={isUpdating}>
                        {isUpdating ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Guardando...
                          </span>
                        ) : 'Guardar'}
                      </button>
                      <button className="glass-nav-item px-3 py-2 rounded-lg text-sm flex-1" onClick={() => { 
                        setEditingId(null); 
                        setEditingData(prev => {
                          const copy = { ...prev }
                          if (c.id in copy) {
                            delete copy[c.id]
                          }
                          return copy
                        });
                        setRowError(prev => ({ ...prev, [c.id]: null })) 
                      }} disabled={isUpdating}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 mb-4">
                      <h4 className="font-semibold text-base mb-2 line-clamp-2">{c.title}</h4>
                      <p className="text-light/70 text-sm mb-3 line-clamp-3">{c.description || 'Sin descripción'}</p>
                      <div className="space-y-1">
                        <div className="text-xs text-light/60">
                          <span className="inline-block">{c.category_id ? `📂 ${categories.find(cat => cat.id === c.category_id)?.name ?? 'Categoría'}` : '📂 Sin categoría'}</span>
                        </div>
                        <div className="text-xs text-light/60">
                          <span className="inline-block">{c.instructor_id ? `👨‍🏫 ${instructors.find(i => i.id === c.instructor_id)?.full_name ?? 'Instructor'}` : '👨‍🏫 Sin instructor'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Link className="glass-button px-3 py-2 rounded-lg text-sm text-center flex-1" to={`/courses/${c.id}`}>Ver</Link>
                        <button className="glass-nav-item px-3 py-2 rounded-lg text-sm flex-1" onClick={() => startEdit(c)}>Editar</button>
                      </div>
                      <div className="flex gap-2">
                        <button className="glass-nav-item px-3 py-2 rounded-lg text-sm flex-1" onClick={() => handleDeleteClick(c)} disabled={isDeleting}>
                          {isDeleting ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              Eliminando...
                            </span>
                          ) : 'Eliminar'}
                        </button>
                        <button className={`px-3 py-2 rounded-lg text-sm flex-1 ${c.is_active ? 'glass-nav-item' : 'glass-button'}`} onClick={() => handleToggleActive(c.id, !c.is_active)} disabled={isUpdating}>
                          {isUpdating ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              {c.is_active ? 'Desactivando...' : 'Activando...'}
                            </span>
                          ) : (c.is_active ? 'Desactivar' : 'Activar')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Paginación */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-light/10">
          <div className="text-sm text-light/70 order-2 sm:order-1">
            {isFetching ? 'Actualizando...' : `Mostrando ${courses.length} de ${total} cursos`}
          </div>
          <div className="flex items-center gap-3 order-1 sm:order-2">
            <button className="glass-nav-item px-4 py-2 rounded-lg disabled:opacity-50 text-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <span className="hidden sm:inline">Anterior</span>
              <span className="sm:hidden">‹</span>
            </button>
            <span className="text-sm font-medium px-2">Página {page} de {totalPages}</span>
            <button className="glass-nav-item px-4 py-2 rounded-lg disabled:opacity-50 text-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <span className="hidden sm:inline">Siguiente</span>
              <span className="sm:hidden">›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para eliminar */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 rounded-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirmar eliminación</h3>
            <p className="text-light/80 mb-6">
              ¿Estás seguro de que deseas eliminar el curso <strong>"{deleteConfirmation.courseTitle}"</strong>?
            </p>
            <p className="text-sm text-yellow-400 mb-6">
              ⚠️ Esta acción no se puede deshacer. Si el curso tiene inscripciones, recursos o tareas asociadas, no podrá ser eliminado.
            </p>
            <div className="flex gap-3">
              <button 
                className="glass-nav-item px-4 py-2 rounded-lg flex-1" 
                onClick={handleDeleteCancel}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex-1 disabled:opacity-50" 
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Eliminando...
                  </span>
                ) : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
