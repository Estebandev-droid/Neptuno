import { supabase } from './supabaseClient'
import type { Relationship, CreateRelationshipRequest, UpdateRelationshipRequest, RelationshipWithDetails, ParentStudentOption } from '../types/relationships'

export async function listRelationships(): Promise<RelationshipWithDetails[]> {
  console.log('Consultando relaciones padre-estudiante...')
  
  const { data: { user } } = await supabase.auth.getUser()
  console.log('Usuario actual:', user?.email, 'ID:', user?.id)
  
  const { data, error } = await supabase
    .from('relationships')
    .select(`
      id,
      tenant_id,
      parent_id,
      student_id,
      relationship_type,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error al consultar relaciones:', error)
    throw error
  }

  if (!data || data.length === 0) {
    console.log('No se encontraron relaciones')
    return []
  }

  // Obtener los perfiles de padres y estudiantes por separado
  const parentIds = [...new Set(data.map(r => r.parent_id))]
  const studentIds = [...new Set(data.map(r => r.student_id))]
  
  const { data: parentProfiles, error: parentError } = await supabase
    .from('profiles_with_email')
    .select('id, email, full_name, avatar_url, role')
    .in('id', parentIds)

  const { data: studentProfiles, error: studentError } = await supabase
    .from('profiles_with_email')
    .select('id, email, full_name, avatar_url, role')
    .in('id', studentIds)

  if (parentError) {
    console.error('Error al consultar perfiles de padres:', parentError)
    throw parentError
  }

  if (studentError) {
    console.error('Error al consultar perfiles de estudiantes:', studentError)
    throw studentError
  }

  // Crear mapas para búsqueda rápida
  const parentMap = new Map(parentProfiles?.map(p => [p.id, p]) || [])
  const studentMap = new Map(studentProfiles?.map(p => [p.id, p]) || [])

  // Combinar los datos
  const relationshipsWithDetails = data.map(relationship => ({
    ...relationship,
    parent: parentMap.get(relationship.parent_id) || null,
    student: studentMap.get(relationship.student_id) || null
  }))

  console.log('Relaciones encontradas:', relationshipsWithDetails.length, relationshipsWithDetails)
  
  return relationshipsWithDetails as RelationshipWithDetails[]
}

export async function getRelationship(id: string): Promise<RelationshipWithDetails | null> {
  console.log('Consultando relación:', id)
  
  const { data, error } = await supabase
    .from('relationships')
    .select(`
      id,
      tenant_id,
      parent_id,
      student_id,
      relationship_type,
      created_at,
      parent:profiles!relationships_parent_id_fkey(
        id,
        email,
        full_name,
        avatar_url,
        role
      ),
      student:profiles!relationships_student_id_fkey(
        id,
        email,
        full_name,
        avatar_url,
        role
      )
    `)
    .eq('id', id)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error al consultar relación:', error)
    throw error
  }
  
  if (!data) return null
  
  // Transformar los datos para que parent y student sean objetos únicos
  const transformedData = {
    ...data,
    parent: Array.isArray(data.parent) ? data.parent[0] : data.parent,
    student: Array.isArray(data.student) ? data.student[0] : data.student
  }
  
  return transformedData as RelationshipWithDetails
}

export async function createRelationship(relationshipData: CreateRelationshipRequest): Promise<Relationship> {
  console.log('Creando relación padre-estudiante:', relationshipData)
  
  // Obtener el tenant_id del usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Usuario no autenticado')
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()
  
  if (!profile?.tenant_id) {
    throw new Error('Usuario sin tenant asignado')
  }
  
  // Verificar que no exista ya la relación
  const { data: existing } = await supabase
    .from('relationships')
    .select('id')
    .eq('parent_id', relationshipData.parent_id)
    .eq('student_id', relationshipData.student_id)
    .single()
  
  if (existing) {
    throw new Error('La relación ya existe entre este padre y estudiante')
  }
  
  // Verificar que ambos usuarios pertenezcan al mismo tenant
  const { data: users } = await supabase
    .from('profiles')
    .select('id, tenant_id, role')
    .in('id', [relationshipData.parent_id, relationshipData.student_id])
  
  if (!users || users.length !== 2) {
    throw new Error('No se encontraron los usuarios especificados')
  }
  
  const parent = users.find(u => u.id === relationshipData.parent_id)
  const student = users.find(u => u.id === relationshipData.student_id)
  
  if (!parent || !student) {
    throw new Error('No se encontraron los usuarios especificados')
  }
  
  if (parent.tenant_id !== profile.tenant_id || student.tenant_id !== profile.tenant_id) {
    throw new Error('Los usuarios deben pertenecer al mismo tenant')
  }
  
  if (parent.role !== 'parent') {
    throw new Error('El usuario padre debe tener rol de "parent"')
  }
  
  if (student.role !== 'student') {
    throw new Error('El usuario estudiante debe tener rol de "student"')
  }
  
  const { data, error } = await supabase
    .from('relationships')
    .insert({
      tenant_id: profile.tenant_id,
      parent_id: relationshipData.parent_id,
      student_id: relationshipData.student_id,
      relationship_type: relationshipData.relationship_type || 'guardian'
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error al crear relación:', error)
    throw error
  }
  
  console.log('Relación creada:', data)
  return data as Relationship
}

export async function updateRelationship(id: string, relationshipData: UpdateRelationshipRequest): Promise<Relationship> {
  console.log('Actualizando relación:', id, relationshipData)
  
  const { data, error } = await supabase
    .from('relationships')
    .update({
      relationship_type: relationshipData.relationship_type
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Error al actualizar relación:', error)
    throw error
  }
  
  console.log('Relación actualizada:', data)
  return data as Relationship
}

export async function deleteRelationship(id: string): Promise<void> {
  console.log('Eliminando relación:', id)
  
  const { error } = await supabase
    .from('relationships')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error al eliminar relación:', error)
    throw error
  }
  
  console.log('Relación eliminada:', id)
}

// Obtener padres disponibles para vincular
export async function getAvailableParents(): Promise<ParentStudentOption[]> {
  console.log('Consultando padres disponibles...')
  
  const { data, error } = await supabase
    .from('profiles_with_email')
    .select('id, email, full_name, avatar_url, role')
    .eq('role', 'parent')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
  
  if (error) {
    console.error('Error al consultar padres disponibles:', error)
    throw error
  }
  
  console.log('Padres disponibles:', data?.length || 0)
  return (data || []).map(user => ({
    ...user,
    role: 'parent' as const
  }))
}

// Obtener estudiantes disponibles para vincular
export async function getAvailableStudents(): Promise<ParentStudentOption[]> {
  console.log('Consultando estudiantes disponibles...')
  
  const { data, error } = await supabase
    .from('profiles_with_email')
    .select('id, email, full_name, avatar_url, role')
    .eq('role', 'student')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
  
  if (error) {
    console.error('Error al consultar estudiantes disponibles:', error)
    throw error
  }
  
  console.log('Estudiantes disponibles:', data?.length || 0)
  return (data || []).map(user => ({
    ...user,
    role: 'student' as const
  }))
}

// Obtener relaciones de un padre específico
export async function getParentRelationships(parentId: string): Promise<RelationshipWithDetails[]> {
  console.log('Consultando relaciones del padre:', parentId)
  
  const { data, error } = await supabase
    .from('relationships')
    .select(`
      id,
      tenant_id,
      parent_id,
      student_id,
      relationship_type,
      created_at,
      parent:profiles!relationships_parent_id_fkey(
        id,
        email,
        full_name,
        avatar_url,
        role
      ),
      student:profiles!relationships_student_id_fkey(
        id,
        email,
        full_name,
        avatar_url,
        role
      )
    `)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error al consultar relaciones del padre:', error)
    throw error
  }
  
  console.log('Relaciones del padre encontradas:', data?.length || 0)
  
  // Transformar los datos para que parent y student sean objetos únicos
  const transformedData = data?.map(item => ({
    ...item,
    parent: Array.isArray(item.parent) ? item.parent[0] : item.parent,
    student: Array.isArray(item.student) ? item.student[0] : item.student
  })) || []
  
  return transformedData as RelationshipWithDetails[]
}

// Obtener relaciones de un estudiante específico
export async function getStudentRelationships(studentId: string): Promise<RelationshipWithDetails[]> {
  console.log('Consultando relaciones del estudiante:', studentId)
  
  const { data, error } = await supabase
    .from('relationships')
    .select(`
      id,
      tenant_id,
      parent_id,
      student_id,
      relationship_type,
      created_at,
      parent:profiles!relationships_parent_id_fkey(
        id,
        email,
        full_name,
        avatar_url,
        role
      ),
      student:profiles!relationships_student_id_fkey(
        id,
        email,
        full_name,
        avatar_url,
        role
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error al consultar relaciones del estudiante:', error)
    throw error
  }
  
  console.log('Relaciones del estudiante encontradas:', data?.length || 0)
  
  // Transformar los datos para que parent y student sean objetos únicos
  const transformedData = data?.map(item => ({
    ...item,
    parent: Array.isArray(item.parent) ? item.parent[0] : item.parent,
    student: Array.isArray(item.student) ? item.student[0] : item.student
  })) || []
  
  return transformedData as RelationshipWithDetails[]
}