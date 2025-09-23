import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Category } from '../../types/categories'
import { listCategories, createCategory, setCategoryActive } from '../../lib/categoriesService'
import { updateCategoryName, deleteCategory } from '../../lib/categoriesService'
import type { PagedResult } from '../../lib/categoriesService'

export default function CategoriesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [newName, setNewName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string>('')
  const [rowError, setRowError] = useState<Record<string, string | null>>({})

  const query = useQuery<PagedResult<Category>, Error, PagedResult<Category>, [string, { search: string; page: number; pageSize: number }]>({
    queryKey: ['categories', { search, page, pageSize }],
    queryFn: () => listCategories({ search, page, pageSize }),
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })

  const data = query.data
  const isLoading = query.isLoading
  const error = query.error
  const isFetching = query.isFetching

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const categories = useMemo(() => data?.data ?? [], [data])

  const nameExists = useMemo(() => {
    const n = newName.trim().toLowerCase()
    return n && categories.some((c: Category) => c.name.trim().toLowerCase() === n)
  }, [newName, categories])

  const createMut = useMutation({
    mutationFn: () => createCategory(newName.trim(), true),
    onSuccess: () => {
      setNewName('')
      setFormError(null)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'No se pudo crear la categoría'
      setFormError(msg)
    },
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCategoryActive(id, active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateCategoryName(id, name),
    onSuccess: () => {
      setEditingId(null)
      setEditingName('')
      setRowError({})
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e: unknown, variables) => {
      const msg = e instanceof Error ? e.message : 'No se pudo actualizar la categoría'
      setRowError(prev => ({ ...prev, [variables.id]: msg }))
    }
  })

  const deleteMut = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (e: unknown, variables) => {
      const msg = e instanceof Error ? e.message : 'No se pudo eliminar la categoría'
      setRowError(prev => ({ ...prev, [variables.id]: msg }))
    }
  })

  const startEdit = (c: Category) => {
    setEditingId(c.id)
    setEditingName(c.name)
    setRowError(prev => ({ ...prev, [c.id]: null }))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveEdit = (id: string) => {
    const clean = editingName.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    if (!clean) {
      setRowError(prev => ({ ...prev, [id]: 'El nombre es obligatorio' }))
      return
    }
    if (clean.length < 2) {
      setRowError(prev => ({ ...prev, [id]: 'El nombre debe tener al menos 2 caracteres' }))
      return
    }
    updateMut.mutate({ id, name: clean })
  }

  const handleDelete = (id: string) => {
    const ok = window.confirm('¿Eliminar esta categoría? Esta acción no se puede deshacer.')
    if (!ok) return
    deleteMut.mutate({ id })
  }

  const handleCreate = () => {
    const clean = newName.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    if (!clean) {
      setFormError('El nombre de la categoría es obligatorio')
      return
    }
    if (clean.length < 2) {
      setFormError('El nombre debe tener al menos 2 caracteres')
      return
    }
    if (nameExists) {
      setFormError('Ya existe una categoría con ese nombre en esta página')
      return
    }
    createMut.mutate()
  }

  return (
    <div className="py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Categorías</h2>
        <div className="flex items-center gap-2">
          <input
            className="glass-input px-4 py-2 rounded-lg w-64"
            placeholder="Buscar categorías..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl">
        <h3 className="font-semibold mb-3">Crear nueva categoría</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className={`glass-input px-4 py-2 rounded-lg flex-1 ${formError ? 'ring-1 ring-red-400' : ''}`}
            placeholder="Nombre de la categoría"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); if (formError) setFormError(null) }}
          />
          <button
            className="glass-button px-4 py-2 rounded-lg disabled:opacity-50"
            disabled={createMut.isPending}
            onClick={handleCreate}
          >{createMut.isPending ? 'Creando...' : 'Crear'}</button>
        </div>
        {formError && <p className="text-red-400 text-sm mt-2">{formError}</p>}
      </div>

      <div className="space-y-3">
        {isLoading && <div className="text-light/70">Cargando categorías...</div>}
        {error && <div className="text-red-400">Error al cargar categorías</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c: Category) => (
            <div key={c.id} className="glass-card p-4 rounded-xl flex items-center justify-between">
              <div className="flex-1">
                {editingId === c.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="glass-input px-3 py-2 rounded-lg flex-1"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                    />
                    <button
                      className="glass-button px-3 py-2 rounded-lg"
                      onClick={() => saveEdit(c.id)}
                      disabled={updateMut.isPending}
                    >Guardar</button>
                    <button
                      className="glass-nav-item px-3 py-2 rounded-lg"
                      onClick={cancelEdit}
                      disabled={updateMut.isPending}
                    >Cancelar</button>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-light/60 mt-1">{c.is_active ? 'Activo' : 'Inactivo'}</p>
                  </div>
                )}
                {rowError[c.id] && <p className="text-red-400 text-xs mt-2">{rowError[c.id]}</p>}
              </div>
              <div className="flex items-center gap-2">
                {editingId === c.id ? null : (
                  <>
                    <button
                      className="glass-nav-item px-3 py-2 rounded-lg text-sm"
                      onClick={() => startEdit(c)}
                    >Editar</button>
                    <button
                      className="glass-nav-item px-3 py-2 rounded-lg text-sm"
                      onClick={() => handleDelete(c.id)}
                      disabled={deleteMut.isPending}
                    >Eliminar</button>
                  </>
                )}
                <button
                  className={`px-3 py-2 rounded-lg text-sm ${c.is_active ? 'glass-nav-item' : 'glass-button'}`}
                  onClick={() => toggleMut.mutate({ id: c.id, active: !c.is_active })}
                  disabled={toggleMut.isPending}
                  title={c.is_active ? 'Desactivar' : 'Activar'}
                >
                  {c.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-light/70">
            {isFetching ? 'Actualizando...' : `Mostrando ${categories.length} de ${total} categorías`}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="glass-nav-item px-3 py-2 rounded-lg disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >Anterior</button>
            <span className="text-sm">Página {page} de {totalPages}</span>
            <button
              className="glass-nav-item px-3 py-2 rounded-lg disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  )
}
