import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Course } from '../types/courses'
import { listCourses, createCourse, updateCourse, setCourseActive, deleteCourse, uploadCourseCover, type PagedResult } from '../lib/coursesService'
import { listCategories } from '../lib/categoriesService'
import type { Category } from '../types/categories'
import { listProfiles } from '../lib/usersService'
import type { Profile } from '../types/users'
import { Link } from 'react-router-dom'

export default function CoursesPage() {
  const qc = useQueryClient()

  // Query cursos
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [onlyActive, setOnlyActive] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterInstructor, setFilterInstructor] = useState<string>('')

  const { data, isLoading, isFetching, error } = useQuery<PagedResult<Course>, Error, PagedResult<Course>>({
    queryKey: ['courses', { search, page, pageSize, onlyActive, filterCategory, filterInstructor }],
    queryFn: () => listCourses({ search, page, pageSize, onlyActive, categoryId: filterCategory || null, instructorId: filterInstructor || null }),
  })

  const courses = useMemo(() => data?.data ?? [], [data])
  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Query auxiliares para filtros y formularios
  const { data: categoriesData } = useQuery({ queryKey: ['categories', { for: 'courses' }], queryFn: () => listCategories({ page: 1, pageSize: 100, onlyActive: true }) })
  const categories = useMemo(() => (categoriesData?.data ?? []) as Category[], [categoriesData])

  const { data: profiles } = useQuery({ queryKey: ['profiles', { for: 'courses' }], queryFn: listProfiles })
  const instructors = useMemo(() => (profiles ?? []) as Profile[], [profiles])

  // Crear curso
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newInstructorId, setNewInstructorId] = useState('')
  const [newCoverImage, setNewCoverImage] = useState('')
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: () => createCourse({ title: newTitle, description: newDescription || null, category_id: newCategoryId || null, instructor_id: newInstructorId || null, cover_image: newCoverImage || null }),
    onSuccess: async (id: string) => {
      try {
        if (newCoverFile) {
          const url = await uploadCourseCover(newCoverFile, id)
          await updateCourse(id, { cover_image: url })
        }
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'Error al subir portada')
      }
      setNewTitle('')
      setNewDescription('')
      setNewCategoryId('')
      setNewInstructorId('')
      setNewCoverImage('')
      setNewCoverFile(null)
      setFormError(null)
      qc.invalidateQueries({ queryKey: ['courses'] })
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : 'Error al crear curso')
    }
  })

  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ title: string; description?: string; category_id?: string | null; instructor_id?: string | null; cover_image?: string | null }>({ title: '' })
  const [editingCoverFile, setEditingCoverFile] = useState<Record<string, File | null>>({})
  const [rowError, setRowError] = useState<Record<string, string | null>>({})

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('Sin ID')
      const title = editing.title?.trim()
      if (!title || title.length < 3) throw new Error('El título es obligatorio (mínimo 3 caracteres)')
      const file = editingId ? editingCoverFile[editingId] : null
      const changes = { ...editing }
      if (file) {
        const url = await uploadCourseCover(file, editingId)
        changes.cover_image = url
      }
      return updateCourse(editingId, changes)
    },
    onSuccess: () => {
      if (editingId) {
        setEditingCoverFile(prev => {
          const copy = { ...prev }
          if (editingId in copy) {
            delete copy[editingId]
          }
          return copy
        })
      }
      setEditingId(null)
      setRowError({})
      qc.invalidateQueries({ queryKey: ['courses'] })
    },
    onError: (err: unknown) => {
      if (!editingId) return
      setRowError(prev => ({ ...prev, [editingId]: err instanceof Error ? err.message : 'Error al guardar' }))
    }
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCourseActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] })
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCourse(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
    onError: (err: unknown) => alert(err instanceof Error ? err.message : 'Error al eliminar')
  })

  const handleCreate = () => {
    const title = newTitle.trim()
    if (!title || title.length < 3) {
      setFormError('El título es obligatorio (mínimo 3 caracteres)')
      return
    }
    createMut.mutate()
  }

  const startEdit = (c: Course) => {
    setEditingId(c.id)
    setEditing({ title: c.title, description: c.description ?? '', category_id: c.category_id ?? null, instructor_id: c.instructor_id ?? null, cover_image: c.cover_image ?? null })
  }

  const handleDelete = (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este curso? Esta acción no se puede deshacer.')) {
      deleteMut.mutate(id)
    }
  }

  return (
    <div className="py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-bold">Cursos</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            className="glass-input px-3 py-2 rounded-lg w-full sm:w-64"
            placeholder="Buscar cursos..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <label className="flex items-center gap-2 glass-nav-item px-3 rounded-lg">
            <input type="checkbox" checked={onlyActive} onChange={(e) => { setOnlyActive(e.target.checked); setPage(1) }} />
            Solo activos
          </label>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl mb-6">
        <h3 className="font-semibold mb-3">Crear nuevo curso</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className="glass-input px-3 py-2 rounded-lg" placeholder="Título" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <input className="glass-input px-3 py-2 rounded-lg" placeholder="Descripción (opcional)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          <select className="glass-input px-3 py-2 rounded-lg" value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="glass-input px-3 py-2 rounded-lg" value={newInstructorId} onChange={(e) => setNewInstructorId(e.target.value)}>
            <option value="">Sin instructor</option>
            {instructors.map(i => <option key={i.id} value={i.id}>{i.full_name ?? i.id}</option>)}
          </select>
          <input className="glass-input px-3 py-2 rounded-lg sm:col-span-2 lg:col-span-4" placeholder="URL de portada (opcional)" value={newCoverImage} onChange={(e) => setNewCoverImage(e.target.value)} />
          <input type="file" accept="image/*" className="glass-input px-3 py-2 rounded-lg sm:col-span-2 lg:col-span-4" onChange={(e) => setNewCoverFile(e.target.files?.[0] ?? null)} />
        </div>
        {formError && <p className="text-red-400 text-sm mt-2">{formError}</p>}
        <div className="mt-3 flex justify-end">
          <button className="glass-button px-4 py-2 rounded-lg" onClick={handleCreate} disabled={createMut.isPending}>
            {createMut.isPending ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>

      {/* Filtros adicionales */}
      <div className="glass-card p-4 rounded-xl mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium mb-1">Categoría</label>
          <select className="glass-input px-3 py-2 rounded-lg w-full" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}>
            <option value="">Todas</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Instructor</label>
          <select className="glass-input px-3 py-2 rounded-lg w-full" value={filterInstructor} onChange={(e) => { setFilterInstructor(e.target.value); setPage(1) }}>
            <option value="">Todos</option>
            {instructors.map(i => <option key={i.id} value={i.id}>{i.full_name ?? i.id}</option>)}
          </select>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl">
        {isLoading && <div className="text-light/70">Cargando cursos...</div>}
        {error && <div className="text-red-400">Error al cargar cursos</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map(c => (
            <div key={c.id} className="glass-card p-0 rounded-xl overflow-hidden flex flex-col">
              {c.cover_image && (
                <img src={c.cover_image} alt={c.title} className="w-full h-32 object-cover" />
              )}
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1">
                  {editingId === c.id ? (
                    <div className="space-y-2">
                      <input className="glass-input px-3 py-2 rounded-lg w-full" value={editing.title} onChange={(e) => setEditing(prev => ({ ...prev, title: e.target.value }))} />
                      <input className="glass-input px-3 py-2 rounded-lg w-full" placeholder="Descripción" value={editing.description ?? ''} onChange={(e) => setEditing(prev => ({ ...prev, description: e.target.value }))} />
                      <div className="grid grid-cols-2 gap-2">
                        <select className="glass-input px-3 py-2 rounded-lg" value={editing.category_id ?? ''} onChange={(e) => setEditing(prev => ({ ...prev, category_id: e.target.value || null }))}>
                          <option value="">Sin categoría</option>
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                        <select className="glass-input px-3 py-2 rounded-lg" value={editing.instructor_id ?? ''} onChange={(e) => setEditing(prev => ({ ...prev, instructor_id: e.target.value || null }))}>
                          <option value="">Sin instructor</option>
                          {instructors.map(i => <option key={i.id} value={i.id}>{i.full_name ?? i.id}</option>)}
                        </select>
                      </div>
                      <input className="glass-input px-3 py-2 rounded-lg w-full" placeholder="URL de portada" value={editing.cover_image ?? ''} onChange={(e) => setEditing(prev => ({ ...prev, cover_image: e.target.value }))} />
                      <input type="file" accept="image/*" className="glass-input px-3 py-2 rounded-lg w-full" onChange={(e) => setEditingCoverFile(prev => ({ ...prev, [c.id]: e.target.files?.[0] ?? null }))} />
                      {rowError[c.id] && <p className="text-red-400 text-sm">{rowError[c.id]}</p>}
                      <div className="flex gap-2">
                        <button className="glass-button px-3 py-2 rounded-lg text-sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Guardar</button>
                        <button className="glass-nav-item px-3 py-2 rounded-lg text-sm" onClick={() => { setEditingId(null); setRowError(prev => ({ ...prev, [c.id]: null })) }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-semibold">{c.title}</h4>
                      <p className="text-light/70 text-sm">{c.description || 'Sin descripción'}</p>
                      <div className="text-xs text-light/60 mt-1">
                        <span>{c.category_id ? `Categoría: ${categories.find(cat => cat.id === c.category_id)?.name ?? c.category_id}` : 'Sin categoría'}</span>
                        <span className="ml-2">{c.instructor_id ? `Instructor: ${instructors.find(i => i.id === c.instructor_id)?.full_name ?? c.instructor_id}` : 'Sin instructor'}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  {editingId !== c.id && (
                    <>
                      <Link className="glass-button px-3 py-2 rounded-lg text-sm text-center" to={`/courses/${c.id}`}>Ver</Link>
                      <button className="glass-nav-item px-3 py-2 rounded-lg text-sm" onClick={() => startEdit(c)}>Editar</button>
                      <button className="glass-nav-item px-3 py-2 rounded-lg text-sm" onClick={() => handleDelete(c.id)} disabled={deleteMut.isPending}>Eliminar</button>
                    </>
                  )}
                  <button className={`px-3 py-2 rounded-lg text-sm ${c.is_active ? 'glass-nav-item' : 'glass-button'}`} onClick={() => toggleMut.mutate({ id: c.id, active: !c.is_active })} disabled={toggleMut.isPending}>
                    {c.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-light/70">
            {isFetching ? 'Actualizando...' : `Mostrando ${courses.length} de ${total} cursos`}
          </div>
          <div className="flex items-center gap-2">
            <button className="glass-nav-item px-3 py-2 rounded-lg disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Anterior</button>
            <span className="text-sm">Página {page} de {totalPages}</span>
            <button className="glass-nav-item px-3 py-2 rounded-lg disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  )
}