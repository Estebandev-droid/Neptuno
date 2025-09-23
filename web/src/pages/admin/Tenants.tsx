import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listTenants, createTenant, updateTenant, deleteTenant, listTenantAdmins, assignTenantAdmin, removeTenantAdmin, getAvailableUsers, uploadTenantLogo } from '../../lib/tenantsService'
import type { Tenant, CreateTenantRequest, UpdateTenantRequest } from '../../types/tenants'
import { PencilIcon, TrashIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function TenantsPage() {
  const qc = useQueryClient()
  const { data: tenants, isLoading, error } = useQuery({ queryKey: ['tenants'], queryFn: listTenants })
  const { data: availableUsers } = useQuery({ queryKey: ['available-users'], queryFn: getAvailableUsers })
  
  const [openCreate, setOpenCreate] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [showAdmins, setShowAdmins] = useState(false)
  
  // Form states
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [plan, setPlan] = useState<'free' | 'basic' | 'pro'>('basic')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0033CC')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  
  const [formErrors, setFormErrors] = useState<{ name?: string; domain?: string }>({})
  
  // Admin assignment states
  const [selectedUserId, setSelectedUserId] = useState('')
  
  const { data: tenantAdmins } = useQuery({
    queryKey: ['tenant-admins', selectedTenant?.id],
    queryFn: () => selectedTenant ? listTenantAdmins(selectedTenant.id) : Promise.resolve([]),
    enabled: !!selectedTenant
  })

  const validate = () => {
    const errs: { name?: string; domain?: string } = {}
    if (!name.trim()) {
      errs.name = 'El nombre es obligatorio'
    }
    if (domain && !/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/.test(domain)) {
      errs.domain = 'Ingresa un dominio válido'
    }
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const resetForm = () => {
    setName('')
    setDomain('')
    setPlan('basic')
    setLogoUrl('')
    setPrimaryColor('#0033CC')
    setLogoFile(null)
    setFormErrors({})
    setEditingTenant(null)
    setOpenCreate(false)
  }

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant)
    setName(tenant.name)
    setDomain(tenant.domain || '')
    setPlan(tenant.plan)
    setLogoUrl(tenant.branding?.logo_url || '')
    setPrimaryColor(tenant.branding?.primary_color || '#0033CC')
    setOpenCreate(true)
  }

  const createMut = useMutation({
    mutationFn: async (data: CreateTenantRequest) => {
      const tenant = await createTenant(data)
      
      // Si hay un archivo de logo, subirlo después de crear el tenant
      if (logoFile && tenant.id) {
        const logoUrl = await uploadTenantLogo(logoFile, tenant.id)
        // Actualizar el tenant con la nueva URL del logo
        await updateTenant(tenant.id, {
          branding: {
            ...tenant.branding,
            logo_url: logoUrl
          }
        })
      }
      
      return tenant
    },
    onSuccess: () => {
      resetForm()
      qc.invalidateQueries({ queryKey: ['tenants'] })
    }
  })

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTenantRequest }) => {
      // Si hay un archivo de logo nuevo, subirlo primero
      if (logoFile) {
        const logoUrl = await uploadTenantLogo(logoFile, id)
        data = {
          ...data,
          branding: {
            ...data.branding,
            logo_url: logoUrl
          }
        }
      }
      
      return updateTenant(id, data)
    },
    onSuccess: () => {
      resetForm()
      qc.invalidateQueries({ queryKey: ['tenants'] })
    }
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTenant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] })
  })

  const assignAdminMut = useMutation({
    mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) => 
      assignTenantAdmin({ tenant_id: tenantId, user_id: userId }),
    onSuccess: () => {
      setSelectedUserId('')
      qc.invalidateQueries({ queryKey: ['tenant-admins', selectedTenant?.id] })
      qc.invalidateQueries({ queryKey: ['available-users'] })
    }
  })

  const removeAdminMut = useMutation({
    mutationFn: ({ tenantId, userId }: { tenantId: string; userId: string }) => removeTenantAdmin(tenantId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-admins', selectedTenant?.id] })
      qc.invalidateQueries({ queryKey: ['available-users'] })
    }
  })

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo debe ser menor a 5MB')
        return
      }
      setLogoFile(file)
      // Crear preview URL
      const previewUrl = URL.createObjectURL(file)
      setLogoUrl(previewUrl)
    }
  }

  const handleSubmit = () => {
    if (!validate()) return

    const tenantData = {
      name,
      domain: domain || undefined,
      plan,
      branding: {
        logo_url: logoUrl || undefined,
        primary_color: primaryColor
      }
    }

    if (editingTenant) {
      updateMut.mutate({ id: editingTenant.id, data: tenantData })
    } else {
      createMut.mutate(tenantData)
    }
  }

  if (isLoading) return <div className="py-6"><p>Cargando tenants...</p></div>
  if (error) return <div className="py-6"><p className="text-red-400">Error: {error.message}</p></div>

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Gestión de Tenants</h2>
        <button 
          className="glass-button px-4 py-2 rounded-lg" 
          onClick={() => setOpenCreate(true)}
        >
          Crear Tenant
        </button>
      </div>

      {/* Formulario de creación/edición */}
      {openCreate && (
        <div className="glass-card p-6 rounded-xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingTenant ? 'Editar Tenant' : 'Crear nuevo Tenant'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-white">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input 
                className={`glass-input px-4 py-2 rounded-lg w-full ${formErrors.name ? 'ring-1 ring-red-400' : ''}`}
                placeholder="Nombre del tenant" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
              />
              {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Dominio</label>
              <input 
                className={`glass-input px-4 py-2 rounded-lg w-full ${formErrors.domain ? 'ring-1 ring-red-400' : ''}`}
                placeholder="ejemplo.com" 
                value={domain} 
                onChange={(e) => setDomain(e.target.value)} 
              />
              {formErrors.domain && <p className="text-red-400 text-xs mt-1">{formErrors.domain}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Plan</label>
              <select 
                className="glass-input px-4 py-2 rounded-lg w-full"
                value={plan} 
                onChange={(e) => setPlan(e.target.value as 'free' | 'basic' | 'pro')}
              >
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            
            <div className="col-span-1 sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium mb-1">Logo</label>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="glass-input px-4 py-2 rounded-lg flex-1"
                  />
                  <input 
                    className="glass-input px-4 py-2 rounded-lg flex-1"
                    placeholder="O ingresa URL del logo" 
                    value={logoFile ? '' : logoUrl} 
                    onChange={(e) => setLogoUrl(e.target.value)}
                    disabled={!!logoFile}
                  />
                </div>
                {logoUrl && (
                  <div className="flex items-center gap-2">
                    <img 
                      src={logoUrl} 
                      alt="Preview" 
                      className="h-12 w-12 object-cover rounded border border-gray-600"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        setLogoUrl('')
                        setLogoFile(null)
                      }}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Color Primario</label>
              <input 
                type="color"
                className="glass-input px-2 py-2 rounded-lg w-full h-10"
                value={primaryColor} 
                onChange={(e) => setPrimaryColor(e.target.value)} 
              />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            <button 
              className="glass-button px-4 py-2 rounded-lg flex-1 sm:flex-none"
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {editingTenant ? 'Actualizar' : 'Crear'}
            </button>
            <button 
              className="glass-button-secondary px-4 py-2 rounded-lg flex-1 sm:flex-none"
              onClick={resetForm}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de tenants */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tenant</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">Dominio</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Plan</th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">Creado</th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {tenants?.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-white/5">
                  <td className="px-3 sm:px-6 py-4">
                    <div className="flex items-center">
                      {tenant.branding?.logo_url && (
                        <img 
                          src={tenant.branding.logo_url} 
                          alt={tenant.name}
                          className="h-6 w-6 sm:h-8 sm:w-8 rounded-full mr-2 sm:mr-3 object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{tenant.name}</div>
                        <div className="sm:hidden text-xs text-gray-400 truncate">
                          {tenant.domain || 'Sin dominio'}
                        </div>
                        {tenant.branding?.primary_color && (
                          <div className="flex items-center mt-1">
                            <div 
                              className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                              style={{ backgroundColor: tenant.branding.primary_color }}
                            />
                            <span className="text-xs text-gray-400 hidden sm:inline">{tenant.branding.primary_color}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden sm:table-cell">
                    {tenant.domain || '-'}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      tenant.plan === 'pro' ? 'bg-green-100 text-green-800' :
                      tenant.plan === 'basic' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-300 hidden md:table-cell">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                      <button
                        onClick={() => {
                          setSelectedTenant(tenant)
                          setShowAdmins(true)
                        }}
                        className="text-blue-400 hover:text-blue-300 p-1"
                        title="Gestionar administradores"
                      >
                        <UserPlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(tenant)}
                        className="text-yellow-400 hover:text-yellow-300 p-1"
                        title="Editar"
                      >
                        <PencilIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('¿Estás seguro de eliminar este tenant?')) {
                            deleteMut.mutate(tenant.id)
                          }
                        }}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Eliminar"
                      >
                        <TrashIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de gestión de administradores */}
      {showAdmins && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-card p-6 rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Administradores de {selectedTenant.name}
              </h3>
              <button 
                onClick={() => {
                  setShowAdmins(false)
                  setSelectedTenant(null)
                }}
                className="text-gray-400 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Asignar nuevo administrador */}
            <div className="mb-6">
              <h4 className="text-md font-medium mb-2">Asignar nuevo administrador</h4>
              <div className="flex gap-2">
                <select 
                  className="glass-input px-4 py-2 rounded-lg flex-1"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Seleccionar usuario...</option>
                  {availableUsers?.filter(user => 
                    !tenantAdmins?.some(admin => admin.user_id === user.id)
                  ).map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (selectedUserId) {
                      assignAdminMut.mutate({ tenantId: selectedTenant.id, userId: selectedUserId })
                    }
                  }}
                  disabled={!selectedUserId || assignAdminMut.isPending}
                  className="glass-button px-4 py-2 rounded-lg"
                >
                  Asignar
                </button>
              </div>
            </div>

            {/* Lista de administradores actuales */}
            <div>
              <h4 className="text-md font-medium mb-2">Administradores actuales</h4>
              {tenantAdmins?.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay administradores asignados</p>
              ) : (
                <div className="space-y-2">
                  {tenantAdmins?.map(admin => (
                    <div key={admin.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center">
                        {admin.user?.avatar_url && (
                          <img 
                            src={admin.user.avatar_url} 
                            alt={admin.user?.full_name}
                            className="h-8 w-8 rounded-full mr-3 object-cover"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium">{admin.user?.full_name}</div>
                          <div className="text-xs text-gray-400">{admin.user?.email}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('¿Remover este administrador?') && selectedTenant) {
                            removeAdminMut.mutate({ tenantId: selectedTenant.id, userId: admin.user_id })
                          }
                        }}
                        className="text-red-400 hover:text-red-300"
                        title="Remover administrador"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
