import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Resource } from '../types/resources'
import { listResources, createResource, updateResource, deleteResource, uploadResourceFile, type PagedResult } from '../lib/resourcesService'
import { listCourses } from '../lib/coursesService'
import type { Course } from '../types/courses'
import { DocumentTextIcon, VideoCameraIcon, LinkIcon, PhotoIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import FilePreview from '../components/FilePreview'

const resourceTypeIcons = {
  document: DocumentTextIcon,
  video: VideoCameraIcon,
  link: LinkIcon,
  image: PhotoIcon,
}

const resourceTypeLabels = {
  document: 'Documento',
  video: 'Video',
  link: 'Enlace',
  image: 'Imagen',
}

export default function ResourcesPage() {
  const qc = useQueryClient()

  // Query recursos
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 12
  const [filterCourse, setFilterCourse] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterPublic, setFilterPublic] = useState<string>('')

  const { data, isLoading, isFetching, error } = useQuery<PagedResult<Resource>, Error, PagedResult<Resource>>({
    queryKey: ['resources', { search, page, pageSize, filterCourse, filterType, filterPublic }],
    queryFn: () => listResources({ 
      search, 
      page, 
      pageSize, 
      course_id: filterCourse || undefined,
      resource_type: (filterType as 'document' | 'video' | 'link' | 'image') || undefined,
      is_public: filterPublic === '' ? undefined : filterPublic === 'true'
    }),
  })

  const resources = useMemo(() => data?.data ?? [], [data])
  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Query auxiliares para filtros y formularios
  const { data: coursesData } = useQuery({ 
    queryKey: ['courses', { for: 'resources' }], 
    queryFn: () => listCourses({ page: 1, pageSize: 100, onlyActive: true }) 
  })
  const courses = useMemo(() => (coursesData?.data ?? []) as Course[], [coursesData])

  // Crear recurso
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCourseId, setNewCourseId] = useState('')
  const [newType, setNewType] = useState<'document' | 'video' | 'link' | 'image'>('document')
  const [newFileUrl, setNewFileUrl] = useState('')
  const [newIsPublic, setNewIsPublic] = useState(false)
  const [newFile, setNewFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Estado para previsualización
  const [previewingResource, setPreviewingResource] = useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: () => createResource({ 
      title: newTitle, 
      description: newDescription || undefined, 
      course_id: newCourseId,
      resource_type: newType,
      file_url: newFileUrl || undefined,
      is_public: newIsPublic
    }),
    onSuccess: async (id: string) => {
      try {
        if (newFile) {
          const url = await uploadResourceFile(newFile, id, newType)
          await updateResource(id, { file_url: url })
        }
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'Error al subir archivo')
      }
      setNewTitle('')
      setNewDescription('')
      setNewCourseId('')
      setNewType('document')
      setNewFileUrl('')
      setNewIsPublic(false)
      setNewFile(null)
      setFormError(null)
      qc.invalidateQueries({ queryKey: ['resources'] })
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : 'Error al crear recurso')
    }
  })

  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ 
    title: string
    description?: string
    resource_type: 'document' | 'video' | 'link' | 'image'
    file_url?: string
    is_public: boolean
  }>({ title: '', resource_type: 'document', is_public: false })
  const [editingFile, setEditingFile] = useState<Record<string, File | null>>({})
  const [rowError, setRowError] = useState<Record<string, string | null>>({})

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('Sin ID')
      const title = editing.title?.trim()
      if (!title || title.length < 3) throw new Error('El título es obligatorio (mínimo 3 caracteres)')
      const file = editingId ? editingFile[editingId] : null
      const changes = { ...editing }
      if (file) {
        const url = await uploadResourceFile(file, editingId, editing.resource_type)
        changes.file_url = url
      }
      return updateResource(editingId, changes)
    },
    onSuccess: () => {
      setEditingId(null)
      setRowError({})
      qc.invalidateQueries({ queryKey: ['resources'] })
    },
    onError: (err: unknown) => {
      if (!editingId) return
      setRowError(prev => ({ ...prev, [editingId]: err instanceof Error ? err.message : 'Error al guardar' }))
    }
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
    onError: (err: unknown) => alert(err instanceof Error ? err.message : 'Error al eliminar')
  })

  const handleCreate = () => {
    const title = newTitle.trim()
    if (!title || title.length < 3) {
      setFormError('El título es obligatorio (mínimo 3 caracteres)')
      return
    }
    if (!newCourseId) {
      setFormError('Debe seleccionar un curso')
      return
    }
    createMut.mutate()
  }

  const startEdit = (r: Resource) => {
    setEditingId(r.id)
    setEditing({ 
      title: r.title, 
      description: r.description ?? '', 
      resource_type: r.resource_type,
      file_url: r.file_url ?? '',
      is_public: r.is_public
    })
  }

  const handleDelete = (id: string) => {
    if (confirm('¿Seguro que deseas eliminar este recurso? Esta acción no se puede deshacer.')) {
      deleteMut.mutate(id)
    }
  }

  const openResource = (resource: Resource) => {
    if (resource.file_url) {
      window.open(resource.file_url, '_blank')
    }
  }

  return (
    <div className="py-6">
      <div className="flex flex-col gap-4 mb-6">
        <h2 className="text-xl font-bold">Recursos</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="glass-input px-3 py-2 rounded-lg flex-1 min-w-0"
            placeholder="Buscar recursos..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl mb-6">
        <h3 className="font-semibold mb-4">Crear nuevo recurso</h3>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input 
              className="glass-input px-3 py-2 rounded-lg" 
              placeholder="Título" 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
            />
            <select 
              className="glass-input px-3 py-2 rounded-lg" 
              value={newCourseId} 
              onChange={(e) => setNewCourseId(e.target.value)}
            >
              <option value="">Seleccionar curso</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <textarea 
            className="glass-input px-3 py-2 rounded-lg w-full resize-none" 
            rows={2}
            placeholder="Descripción (opcional)" 
            value={newDescription} 
            onChange={(e) => setNewDescription(e.target.value)} 
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select 
              className="glass-input px-3 py-2 rounded-lg" 
              value={newType} 
              onChange={(e) => setNewType(e.target.value as 'document' | 'video' | 'link' | 'image')}
            >
              <option value="document">Documento</option>
              <option value="video">Video</option>
              <option value="link">Enlace</option>
              <option value="image">Imagen</option>
            </select>
            <input 
              className="glass-input px-3 py-2 rounded-lg" 
              placeholder="URL del archivo/enlace (opcional)" 
              value={newFileUrl} 
              onChange={(e) => setNewFileUrl(e.target.value)} 
            />
          </div>
          {newType !== 'link' && (
            <div>
              <label className="block text-sm font-medium mb-2">O subir archivo</label>
              <input 
                type="file" 
                className="glass-input px-3 py-2 rounded-lg w-full" 
                accept={newType === 'image' ? 'image/*' : newType === 'video' ? 'video/*' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'}
                onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} 
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 glass-nav-item px-3 py-2 rounded-lg w-fit">
              <input 
                type="checkbox" 
                checked={newIsPublic} 
                onChange={(e) => setNewIsPublic(e.target.checked)} 
              />
              <span className="text-sm">Recurso público</span>
            </label>
          </div>
        </div>
        {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}
        <div className="mt-4 flex justify-end">
          <button 
            className="glass-button px-4 py-2 rounded-lg w-full sm:w-auto" 
            onClick={handleCreate} 
            disabled={createMut.isPending}
          >
            {createMut.isPending ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card p-4 rounded-xl mb-6">
        <h4 className="font-medium mb-3 text-sm text-light/80">Filtros</h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-2">Curso</label>
            <select 
              className="glass-input px-3 py-2 rounded-lg w-full" 
              value={filterCourse} 
              onChange={(e) => { setFilterCourse(e.target.value); setPage(1) }}
            >
              <option value="">Todos los cursos</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Tipo</label>
            <select 
              className="glass-input px-3 py-2 rounded-lg w-full" 
              value={filterType} 
              onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
            >
              <option value="">Todos los tipos</option>
              <option value="document">Documento</option>
              <option value="video">Video</option>
              <option value="link">Enlace</option>
              <option value="image">Imagen</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Visibilidad</label>
            <select 
              className="glass-input px-3 py-2 rounded-lg w-full" 
              value={filterPublic} 
              onChange={(e) => { setFilterPublic(e.target.value); setPage(1) }}
            >
              <option value="">Todos</option>
              <option value="true">Públicos</option>
              <option value="false">Privados</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl">
        {isLoading && <div className="text-light/70">Cargando recursos...</div>}
        {error && <div className="text-red-400">Error al cargar recursos</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map(r => {
            const IconComponent = resourceTypeIcons[r.resource_type]
            const course = courses.find(c => c.id === r.course_id)
            
            return (
              <div key={r.id} className="glass-card p-4 rounded-xl flex flex-col h-full">
                {editingId === r.id ? (
                  <div className="space-y-3">
                    <input 
                      className="glass-input px-3 py-2 rounded-lg w-full text-sm" 
                      value={editing.title} 
                      onChange={(e) => setEditing(prev => ({ ...prev, title: e.target.value }))} 
                    />
                    <textarea 
                      className="glass-input px-3 py-2 rounded-lg w-full text-sm resize-none" 
                      rows={2} 
                      placeholder="Descripción" 
                      value={editing.description ?? ''} 
                      onChange={(e) => setEditing(prev => ({ ...prev, description: e.target.value }))} 
                    />
                    <div className="space-y-2">
                      <select 
                        className="glass-input px-3 py-2 rounded-lg w-full text-sm" 
                        value={editing.resource_type} 
                        onChange={(e) => setEditing(prev => ({ ...prev, resource_type: e.target.value as 'document' | 'video' | 'link' | 'image' }))}
                      >
                        <option value="document">Documento</option>
                        <option value="video">Video</option>
                        <option value="link">Enlace</option>
                        <option value="image">Imagen</option>
                      </select>
                      <input 
                        className="glass-input px-3 py-2 rounded-lg w-full text-sm" 
                        placeholder="URL del archivo/enlace" 
                        value={editing.file_url ?? ''} 
                        onChange={(e) => setEditing(prev => ({ ...prev, file_url: e.target.value }))} 
                      />
                      {editing.resource_type !== 'link' && (
                        <input 
                          type="file" 
                          className="glass-input px-3 py-2 rounded-lg w-full text-sm" 
                          accept={editing.resource_type === 'image' ? 'image/*' : editing.resource_type === 'video' ? 'video/*' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'}
                          onChange={(e) => setEditingFile(prev => ({ ...prev, [r.id]: e.target.files?.[0] ?? null }))} 
                        />
                      )}
                    </div>
                    <label className="flex items-center gap-2 glass-nav-item px-3 py-2 rounded-lg w-fit">
                      <input 
                        type="checkbox" 
                        checked={editing.is_public} 
                        onChange={(e) => setEditing(prev => ({ ...prev, is_public: e.target.checked }))} 
                      />
                      <span className="text-xs">Público</span>
                    </label>
                    {rowError[r.id] && <p className="text-red-400 text-xs">{rowError[r.id]}</p>}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button 
                        className="glass-button px-3 py-2 rounded-lg text-sm flex-1" 
                        onClick={() => saveMut.mutate()} 
                        disabled={saveMut.isPending}
                      >
                        Guardar
                      </button>
                      <button 
                        className="glass-nav-item px-3 py-2 rounded-lg text-sm flex-1" 
                        onClick={() => { setEditingId(null); setRowError(prev => ({ ...prev, [r.id]: null })) }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 mb-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-shrink-0">
                          <IconComponent className="w-6 h-6 text-light/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-base mb-1 line-clamp-2">{r.title}</h4>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-1 rounded-full glass-nav-item">
                              {resourceTypeLabels[r.resource_type]}
                            </span>
                            {r.is_public ? (
                              <EyeIcon className="w-4 h-4 text-green-400" title="Público" />
                            ) : (
                              <EyeSlashIcon className="w-4 h-4 text-light/40" title="Privado" />
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-light/70 text-sm mb-3 line-clamp-3">{r.description || 'Sin descripción'}</p>
                      <div className="space-y-1">
                        <div className="text-xs text-light/60">
                          <span className="inline-block">📚 {course?.title ?? 'Curso no encontrado'}</span>
                        </div>
                        <div className="text-xs text-light/60">
                          <span className="inline-block">📅 {new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      {/* Sección de previsualización */}
                      {previewingResource === r.id && r.file_url && (
                        <div className="mt-4 p-4 bg-black/20 rounded-lg border border-white/10">
                          <h5 className="text-sm font-medium text-light/80 mb-3">Vista previa del archivo:</h5>
                          <FilePreview 
                            fileUrl={r.file_url}
                            fileName={r.title}
                            className="max-w-full"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        {r.file_url && (
                          <>
                            <button 
                              className="glass-button px-3 py-2 rounded-lg text-sm flex-1" 
                              onClick={() => openResource(r)}
                            >
                              Abrir
                            </button>
                            <button 
                              className={`px-3 py-2 rounded-lg text-sm flex-1 transition-colors ${
                                previewingResource === r.id 
                                  ? 'bg-blue-500 text-white' 
                                  : 'glass-nav-item'
                              }`}
                              onClick={() => setPreviewingResource(
                                previewingResource === r.id ? null : r.id
                              )}
                            >
                              {previewingResource === r.id ? 'Ocultar' : 'Vista previa'}
                            </button>
                          </>
                        )}
                        <button 
                          className="glass-nav-item px-3 py-2 rounded-lg text-sm flex-1" 
                          onClick={() => startEdit(r)}
                        >
                          Editar
                        </button>
                      </div>
                      <button 
                        className="glass-nav-item px-3 py-2 rounded-lg text-sm w-full" 
                        onClick={() => handleDelete(r.id)} 
                        disabled={deleteMut.isPending}
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Paginación */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-light/10">
          <div className="text-sm text-light/70 order-2 sm:order-1">
            {isFetching ? 'Actualizando...' : `Mostrando ${resources.length} de ${total} recursos`}
          </div>
          <div className="flex items-center gap-3 order-1 sm:order-2">
            <button 
              className="glass-nav-item px-4 py-2 rounded-lg disabled:opacity-50 text-sm" 
              onClick={() => setPage((p) => Math.max(1, p - 1))} 
              disabled={page <= 1}
            >
              <span className="hidden sm:inline">Anterior</span>
              <span className="sm:hidden">‹</span>
            </button>
            <span className="text-sm font-medium px-2">Página {page} de {totalPages}</span>
            <button 
              className="glass-nav-item px-4 py-2 rounded-lg disabled:opacity-50 text-sm" 
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
              disabled={page >= totalPages}
            >
              <span className="hidden sm:inline">Siguiente</span>
              <span className="sm:hidden">›</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}