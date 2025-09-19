import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '../hooks/useTenant'
import { listTenantMemberships, createMembership, updateMembership, deactivateMembership, type Membership } from '../lib/membershipsService'
import { listProfiles } from '../lib/usersService'
import { listRoles } from '../lib/rolesService'
import type { Profile } from '../types/users'
import type { Role } from '../types/roles'

export default function MembershipsPage() {
  const qc = useQueryClient()
  const { selectedTenant } = useTenant()
  const tenantId = selectedTenant?.tenant_id ?? selectedTenant?.tenant?.id ?? null

  // Datos principales
  const { data: memberships, isLoading, error, isFetching } = useQuery<Membership[], Error>({
    queryKey: ['tenant-memberships', tenantId],
    queryFn: () => listTenantMemberships(tenantId as string),
    enabled: !!tenantId,
  })

  // Datos auxiliares
  const { data: profiles } = useQuery<Profile[], Error>({ queryKey: ['profiles', { for: 'memberships' }], queryFn: listProfiles })
  const { data: roles } = useQuery<Role[], Error>({ queryKey: ['roles', { for: 'memberships' }], queryFn: listRoles })

  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState('student')
  const [formError, setFormError] = useState<string | null>(null)

  const memberIds = useMemo(() => new Set((memberships ?? []).map(m => m.user_id)), [memberships])
  const availableUsers = useMemo(() => {
    const items = profiles ?? []
    // Excluir los que ya son miembros activos del tenant actual
    return items.filter((p) => !memberIds.has(p.id))
  }, [profiles, memberIds])

  const createMut = useMutation({
    mutationFn: async () => {
      if (!tenantId || !newUserId || !newRole) throw new Error('Datos incompletos')
      await createMembership({ user_id: newUserId, tenant_id: tenantId, role: newRole as Membership['role'] })
    },
    onSuccess: () => {
      setNewUserId('')
      setNewRole('student')
      setFormError(null)
      qc.invalidateQueries({ queryKey: ['tenant-memberships', tenantId] })
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
    onError: (e: Error) => setFormError(e.message || 'No se pudo crear la membresía')
  })

  const updateRoleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Membership['role'] }) => updateMembership(id, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-memberships', tenantId] })
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateMembership(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-memberships', tenantId] })
  })

  if (!tenantId) {
    return (
      <div className="py-6">
        <h2 className="text-xl font-bold mb-2">Membresías</h2>
        <p className="text-light/70">Selecciona un tenant para gestionar sus membresías.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Membresías del Tenant</h2>
      </div>

      {/* Alta de membership */}
      <div className="glass-card p-4 rounded-xl">
        <h3 className="font-semibold mb-3 text-light/90">Nueva membresía</h3>
        {formError && <div className="text-red-400 text-sm mb-3">{formError}</div>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-2">Usuario</label>
            <select className="glass-input px-3 py-2 rounded-lg w-full" value={newUserId} onChange={(e) => setNewUserId(e.target.value)}>
              <option value="">Selecciona un usuario</option>
              {availableUsers.map((u: Profile) => (
                <option key={u.id} value={u.id}>{u.full_name ?? u.email ?? u.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Rol</label>
            <select className="glass-input px-3 py-2 rounded-lg w-full" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {roles?.map((r: Role) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="glass-button px-4 py-2 rounded-lg disabled:opacity-50" disabled={!newUserId || !newRole || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? 'Creando...' : 'Crear membresía'}
            </button>
          </div>
        </div>
      </div>

      {/* Listado */}
      <div className="glass-card p-4 rounded-xl">
        {isLoading && <div className="text-light/70">Cargando membresías...</div>}
        {error && <div className="text-red-400">{error.message || 'Error al cargar membresías'}</div>}

        <div className="overflow-x-auto scrollbar-styled">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-light/70">
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Desde</th>
                <th className="py-2 pr-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(memberships ?? []).map((m) => (
                <tr key={m.id} className="border-t border-white/5">
                  <td className="py-2 pr-4">{m.user?.full_name ?? m.user?.email ?? m.user_id}</td>
                  <td className="py-2 pr-4">
                    <select className="glass-input px-2 py-1 rounded" value={m.role} onChange={(e) => updateRoleMut.mutate({ id: m.id, role: e.target.value as Membership['role'] })}>
                      {roles?.map((r: Role) => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4">{m.joined_at ? new Date(m.joined_at).toLocaleString() : '-'}</td>
                  <td className="py-2 pr-4 text-right">
                    <button className="glass-nav-item px-3 py-1.5 rounded-lg" onClick={() => deactivateMut.mutate(m.id)} disabled={deactivateMut.isPending}>Desactivar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isFetching && <div className="text-light/60 text-xs mt-2">Actualizando...</div>}
      </div>
    </div>
  )
}