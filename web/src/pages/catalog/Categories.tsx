import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { type PostgrestError } from '@supabase/supabase-js'

interface Tenant {
  id: string
  name: string
  slug: string
}

export interface Category {
  id: string
  tenant_id: string
  parent_id: string | null
  name: string
  attributes: unknown
  created_at: string
  updated_at: string | null
}

function useTenants() {
  return useQuery<Tenant[], PostgrestError>({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_tenants')
      if (error) throw error
      return (data ?? []) as Tenant[]
    },
  })
}

function useCategories(tenantId?: string, search?: string) {
  return useQuery<Category[], PostgrestError>({
    enabled: !!tenantId,
    queryKey: ['categories', tenantId, search?.trim().toLowerCase() ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tenant_categories', {
        tenant_id: tenantId!,
        search_term: search?.trim() ?? ''
      })
      if (error) throw error
      return (data ?? []) as Category[]
    },
  })
}

export default function Categories() {
  const qc = useQueryClient()
  const { data: tenants, isLoading: tenantsLoading, error: tenantsError } = useTenants()
  const [tenantId, setTenantId] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!tenantId && tenants && tenants.length > 0) {
      setTenantId(tenants[0].id)
    }
  }, [tenants, tenantId])

  const { data: categories, isLoading, error } = useCategories(tenantId, search)

  const [editing, setEditing] = useState<Partial<Category> | null>(null)

  const createMut = useMutation<Category, PostgrestError, { name: string; parent_id: string | null; attributes: unknown }>({
    mutationFn: async (values) => {
      if (!tenantId) throw new Error('Seleccione una empresa')
      const payload = {
        tenant_id: tenantId,
        name: values.name.trim(),
        parent_id: values.parent_id,
        attributes: values.attributes ?? [],
      }
      const { data, error } = await supabase.from('categories').insert(payload).select().single()
      if (error) throw error
      return data as Category
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories', tenantId] })
    },
  })

  const updateMut = useMutation<Category, PostgrestError, { id: string; name: string; parent_id: string | null; attributes: unknown }>({
    mutationFn: async (values) => {
      if (!tenantId) throw new Error('Seleccione una empresa')
      const payload = {
        name: values.name.trim(),
        parent_id: values.parent_id,
        attributes: values.attributes ?? [],
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', values.id)
        .eq('tenant_id', tenantId)
        .select()
        .single()
      if (error) throw error
      return data as Category
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories', tenantId] })
    },
  })

  const deleteMut = useMutation<string, PostgrestError, string>({
    mutationFn: async (id) => {
      if (!tenantId) throw new Error('Seleccione una empresa')
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories', tenantId] })
      if (editing?.id) setEditing(null)
    },
  })

  const parentOptions = useMemo(() => {
    return (categories ?? []).map((c) => ({ value: c.id, label: c.name }))
  }, [categories])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') || '').trim()
    const parent_id = (String(form.get('parent_id') || '') || null) as string | null
    let attributes: unknown = []
    const attributesRaw = String(form.get('attributes') || '').trim()
    if (attributesRaw) {
      try {
        attributes = JSON.parse(attributesRaw)
      } catch {
        alert('Formato de atributos inválido. Debe ser JSON válido (ej: ["color","talla"])')
        return
      }
    }

    if (!name) {
      alert('El nombre es obligatorio')
      return
    }

    if (editing?.id) {
      updateMut.mutate({ id: editing.id, name, parent_id, attributes })
    } else {
      createMut.mutate({ name, parent_id, attributes })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Categorías</h1>
          <p className="text-gray-600">Administra las categorías del catálogo.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Empresa</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            value={tenantId ?? ''}
            onChange={(e) => setTenantId(e.target.value || undefined)}
            disabled={tenantsLoading}
          >
            {tenantsLoading && <option value="">Cargando…</option>}
            {!tenantsLoading && (!tenants || tenants.length === 0) && (
              <option value="">Sin empresas</option>
            )}
            {(tenants ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {tenantsError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-4">
          Error cargando empresas: {tenantsError?.message}
        </div>
      )}

      <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <input
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 shadow-sm transition-colors"
            disabled={!tenantId}
          >
            Nueva categoría
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Listado</h2>
            <span className="text-xs text-gray-500">{categories?.length ?? 0} elementos</span>
          </div>
          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <div className="p-6 text-gray-600">Cargando…</div>
            ) : error ? (
              <div className="p-4 bg-red-50 text-red-700">Error: {error?.message}</div>
            ) : (categories ?? []).length === 0 ? (
              <div className="p-6 text-gray-500">No hay categorías.</div>
            ) : (
              (categories ?? []).map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{c.name}</div>
                    <div className="text-xs text-gray-500 truncate">ID: {c.id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                      onClick={() => setEditing(c)}
                    >
                      Editar
                    </button>
                    <button
                      className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
                      onClick={() => {
                        if (confirm('¿Eliminar esta categoría?')) {
                          deleteMut.mutate(c.id)
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              {editing?.id ? 'Editar categoría' : 'Nueva categoría'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-sm text-gray-700">Nombre</label>
              <input
                name="name"
                defaultValue={editing?.name ?? ''}
                placeholder="Ej. Bebidas"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-700">Padre (opcional)</label>
              <select
                name="parent_id"
                defaultValue={editing?.parent_id ?? ''}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              >
                <option value="">— Sin padre —</option>
                {parentOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-700">Atributos (JSON opcional)</label>
              <textarea
                name="attributes"
                defaultValue={editing?.attributes ? JSON.stringify(editing.attributes, null, 2) : ''}
                rows={6}
                placeholder='Ej. ["color", "talla"] o {"meta":"valor"}'
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
              <p className="text-xs text-gray-500">Guarda lista o objeto JSON para metadatos.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {editing?.id && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={createMut.isPending || updateMut.isPending || !tenantId}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-60"
              >
                {editing?.id ? (updateMut.isPending ? 'Guardando…' : 'Guardar cambios') : (createMut.isPending ? 'Creando…' : 'Crear')}
              </button>
            </div>

            {(createMut.isError || updateMut.isError || deleteMut.isError) && (
              <div className="p-2 text-sm text-red-700 bg-red-50 rounded">
                {createMut.error?.message || updateMut.error?.message || deleteMut.error?.message}
              </div>
            )}

            {(createMut.isSuccess || updateMut.isSuccess) && (
              <div className="p-2 text-sm text-green-700 bg-green-50 rounded">Guardado correctamente.</div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}