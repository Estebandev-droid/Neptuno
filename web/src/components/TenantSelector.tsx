import { useState } from 'react'
import { ChevronDown, Building2, AlertCircle } from 'lucide-react'
import { useTenant } from '../hooks/useTenant'

export default function TenantSelector() {
  const { memberships, selectedTenant, setSelectedTenant, isLoading, error } = useTenant()
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">Cargando tenants...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-red-100 rounded-lg">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <span className="text-sm text-red-600">Error: {error}</span>
      </div>
    )
  }

  if (memberships.length === 0) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-100 rounded-lg">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-700">
          No tienes acceso a ningún tenant. Contacta al administrador.
        </span>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          {selectedTenant ? `${selectedTenant.tenant?.name || 'Sin nombre'} (${selectedTenant.role})` : 'Seleccionar tenant'}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {memberships.map((membership) => (
              <button
                key={membership.id}
                onClick={() => {
                  setSelectedTenant(membership)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                  selectedTenant?.id === membership.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <div>
                  <div className="font-medium">{membership.tenant?.name || 'Sin nombre'}</div>
                  <div className="text-xs text-gray-500 capitalize">{membership.role}</div>
                </div>
                {selectedTenant?.id === membership.id && (
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}