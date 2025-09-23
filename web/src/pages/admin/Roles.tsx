import { useQuery } from '@tanstack/react-query'
import { listRoles } from '../../lib/rolesService'

export default function RolesPage() {
  const { data: roles, isLoading, error } = useQuery({ queryKey: ['roles'], queryFn: listRoles })



  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Roles del Sistema</h2>
          <p className="text-sm text-light/70 mt-1">
            Los roles están predefinidos en el sistema. Use la página de Memberships para asignar roles a usuarios.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <div className="text-light/70">Cargando roles...</div>}
        {error && <div className="text-red-400">Error al cargar roles</div>}
        {roles?.map((r) => (
          <div key={r.id} className="glass-card p-4 rounded-xl">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-lg">{r.name}</p>
                  <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-full">
                    Sistema
                  </span>
                </div>
                {r.description && (
                  <p className="text-sm text-light/70 leading-relaxed">{r.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {roles && roles.length === 0 && !isLoading && (
        <div className="text-center py-8 text-light/70">
          <p>No se encontraron roles disponibles.</p>
        </div>
      )}
    </div>
  )
}
