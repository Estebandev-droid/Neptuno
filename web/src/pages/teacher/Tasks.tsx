import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Task } from '../../types/tasks'
import { listTasks, createTask, updateTask, publishTask, deleteTask, type PagedResult } from '../../lib/tasksService'
import { listCourses } from '../../lib/coursesService'
import type { Course } from '../../types/courses'

import { PencilIcon, TrashIcon, EyeIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function TasksPage() {
  const qc = useQueryClient()

  // Query tareas
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [filterCourse, setFilterCourse] = useState<string>('')
  const [filterPublished, setFilterPublished] = useState<string>('all')

  const { data, isLoading, isFetching, error } = useQuery<PagedResult<Task>, Error, PagedResult<Task>>({
    queryKey: ['tasks', { search, page, pageSize, filterCourse, filterPublished }],
    queryFn: () => listTasks({ 
      search, 
      page, 
      pageSize, 
      courseId: filterCourse || undefined,
      isPublished: filterPublished === 'all' ? undefined : filterPublished === 'published'
    }),
  })

  const tasks = useMemo(() => data?.data ?? [], [data])
  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Query auxiliares para filtros y formularios
  const { data: coursesData } = useQuery({ 
    queryKey: ['courses', { for: 'tasks' }], 
    queryFn: () => listCourses({ page: 1, pageSize: 100, onlyActive: true }) 
  })
  const courses = useMemo(() => (coursesData?.data ?? []) as Course[], [coursesData])

  // Crear tarea
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCourseId, setNewCourseId] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newMaxScore, setNewMaxScore] = useState('100')
  const [newIsPublished, setNewIsPublished] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: () => createTask({ 
      title: newTitle, 
      description: newDescription || undefined, 
      course_id: newCourseId,
      due_date: newDueDate || undefined,
      max_score: parseFloat(newMaxScore) || 100,
      is_published: newIsPublished
    }),
    onSuccess: () => {
      setNewTitle('')
      setNewDescription('')
      setNewCourseId('')
      setNewDueDate('')
      setNewMaxScore('100')
      setNewIsPublished(false)
      setFormError(null)
      // Invalidar todas las queries de tasks para actualizar la lista
      qc.invalidateQueries({ queryKey: ['tasks'] })
      // También refrescar la query actual específicamente
      qc.refetchQueries({ queryKey: ['tasks', { search, page, pageSize, filterCourse, filterPublished }] })
    },
    onError: (err: Error) => {
      setFormError(err.message)
    }
  })

  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ 
    title: string
    description?: string
    due_date?: string
    max_score: number
    is_published: boolean
  }>({ title: '', max_score: 100, is_published: false })
  const [rowError, setRowError] = useState<Record<string, string | null>>({})

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('Sin ID')
      const title = editing.title?.trim()
      if (!title || title.length < 3) throw new Error('El título es obligatorio (mínimo 3 caracteres)')
      return updateTask(editingId, editing)
    },
    onSuccess: () => {
      setEditingId(null)
      setRowError({})
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err: Error) => {
      if (!editingId) return
      setRowError(prev => ({ ...prev, [editingId]: err.message }))
    }
  })

  const publishMut = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) => publishTask(id, published),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] })
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (err: Error) => alert(err.message)
  })

  const handleCreate = () => {
    const title = newTitle.trim()
    if (!title || title.length < 3) {
      setFormError('El título es obligatorio (mínimo 3 caracteres)')
      return
    }
    if (!newCourseId) {
      setFormError('El curso es obligatorio')
      return
    }
    createMut.mutate()
  }

  const startEdit = (task: Task) => {
    setEditingId(task.id)
    setEditing({ 
      title: task.title, 
      description: task.description ?? '', 
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      max_score: task.max_score,
      is_published: task.is_published
    })
  }

  const handleDelete = (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta tarea? Esta acción no se puede deshacer.')) {
      deleteMut.mutate(id)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sin fecha'
    return new Date(dateStr).toLocaleDateString('es-ES')
  }

  const getCourseTitle = (courseId: string) => {
    const course = courses.find(c => c.id === courseId)
    return course?.title || 'Curso no encontrado'
  }

  return (
    <div className="py-6">
      <div className="flex flex-col gap-4 mb-6">
        <h2 className="text-xl font-bold">Tareas</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="glass-input px-3 py-2 rounded-lg flex-1 min-w-0"
            placeholder="Buscar tareas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="glass-input px-3 py-2 rounded-lg"
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
          >
            <option value="">Todos los cursos</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <select
            className="glass-input px-3 py-2 rounded-lg"
            value={filterPublished}
            onChange={(e) => setFilterPublished(e.target.value)}
          >
            <option value="all">Todas</option>
            <option value="published">Publicadas</option>
            <option value="draft">Borradores</option>
          </select>
        </div>
      </div>

      {/* Formulario nueva tarea */}
      <div className="glass-card p-4 mb-6">
        <h3 className="font-semibold mb-3">Nueva Tarea</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
          <input
            className="glass-input px-3 py-2 rounded-lg"
            placeholder="Título de la tarea"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <select
            className="glass-input px-3 py-2 rounded-lg"
            value={newCourseId}
            onChange={(e) => setNewCourseId(e.target.value)}
          >
            <option value="">Seleccionar curso</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          <input
            type="date"
            className="glass-input px-3 py-2 rounded-lg"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
          />
          <input
            type="number"
            className="glass-input px-3 py-2 rounded-lg"
            placeholder="Puntuación máxima"
            value={newMaxScore}
            onChange={(e) => setNewMaxScore(e.target.value)}
            min="0"
            step="0.01"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newIsPublished}
              onChange={(e) => setNewIsPublished(e.target.checked)}
            />
            <span>Publicar inmediatamente</span>
          </label>
        </div>
        <textarea
          className="glass-input px-3 py-2 rounded-lg w-full mb-3"
          placeholder="Descripción de la tarea"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          rows={3}
        />
        {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}
        <div className="mt-4 flex justify-end">
          <button
            className="glass-button px-4 py-2 rounded-lg w-full sm:w-auto disabled:opacity-50"
            onClick={handleCreate}
            disabled={createMut.isPending}
          >
            {createMut.isPending ? 'Creando...' : 'Crear Tarea'}
          </button>
        </div>
      </div>

      {/* Lista de tareas */}
      {isLoading ? (
        <div className="text-center py-8">Cargando tareas...</div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">Error: {error.message}</div>
      ) : (
        <>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto scrollbar-styled">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-3">Título</th>
                    <th className="text-left p-3">Curso</th>
                    <th className="text-left p-3">Fecha límite</th>
                    <th className="text-left p-3">Puntuación</th>
                    <th className="text-left p-3">Estado</th>
                    <th className="text-left p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-white/10">
                      {editingId === task.id ? (
                        <>
                          <td className="p-3">
                            <input
                              className="glass-input px-2 py-1 rounded w-full"
                              value={editing.title}
                              onChange={(e) => setEditing(prev => ({ ...prev, title: e.target.value }))}
                            />
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-gray-400">{getCourseTitle(task.course_id)}</span>
                          </td>
                          <td className="p-3">
                            <input
                              type="date"
                              className="glass-input px-2 py-1 rounded w-full"
                              value={editing.due_date || ''}
                              onChange={(e) => setEditing(prev => ({ ...prev, due_date: e.target.value }))}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              className="glass-input px-2 py-1 rounded w-20"
                              value={editing.max_score}
                              onChange={(e) => setEditing(prev => ({ ...prev, max_score: parseFloat(e.target.value) || 0 }))}
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="p-3">
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={editing.is_published}
                                onChange={(e) => setEditing(prev => ({ ...prev, is_published: e.target.checked }))}
                              />
                              <span className="text-sm">Publicada</span>
                            </label>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <button
                                className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                                onClick={() => saveMut.mutate()}
                                disabled={saveMut.isPending}
                              >
                                <CheckIcon className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1 text-gray-400 hover:bg-gray-400/20 rounded"
                                onClick={() => setEditingId(null)}
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                            {rowError[task.id] && (
                              <p className="text-red-500 text-xs mt-1">{rowError[task.id]}</p>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3">
                            <div>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-gray-400 mt-1">{task.description}</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-sm">{getCourseTitle(task.course_id)}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-sm">{formatDate(task.due_date ?? null)}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-sm">{task.max_score} pts</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              task.is_published 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {task.is_published ? 'Publicada' : 'Borrador'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <button
                                className="p-1 text-blue-400 hover:bg-blue-400/20 rounded"
                                onClick={() => startEdit(task)}
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                className={`p-1 rounded ${
                                  task.is_published
                                    ? 'text-yellow-400 hover:bg-yellow-400/20'
                                    : 'text-green-400 hover:bg-green-400/20'
                                }`}
                                onClick={() => publishMut.mutate({ id: task.id, published: !task.is_published })}
                                disabled={publishMut.isPending}
                              >
                                <EyeIcon className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1 text-red-400 hover:bg-red-400/20 rounded"
                                onClick={() => handleDelete(task.id)}
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                className="px-3 py-1 rounded glass-card disabled:opacity-50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
              >
                Anterior
              </button>
              <span className="px-3 py-1">
                Página {page} de {totalPages} ({total} tareas)
              </span>
              <button
                className="px-3 py-1 rounded glass-card disabled:opacity-50"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
