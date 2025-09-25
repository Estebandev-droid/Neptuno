import { supabase } from './supabaseClient'
import type { Resource, CreateResourceRequest, UpdateResourceRequest } from '../types/resources'

export interface ListResourcesParams {
  search?: string
  page?: number // 1-based
  pageSize?: number
  course_id?: string
  resource_type?: 'document' | 'video' | 'link' | 'image'
  is_public?: boolean
}

export interface PagedResult<T> {
  data: T[]
  count: number
}

export async function listResources({ 
  search = '', 
  page = 1, 
  pageSize = 10, 
  course_id, 
  resource_type, 
  is_public 
}: ListResourcesParams): Promise<PagedResult<Resource>> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('resources')
    .select('*', { count: 'exact' })

  if (search && search.trim().length > 0) {
    query = query.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`)
  }
  if (course_id) query = query.eq('course_id', course_id)
  if (resource_type) query = query.eq('resource_type', resource_type)
  if (is_public !== undefined) query = query.eq('is_public', is_public)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('Error al listar recursos:', error)
    throw error
  }

  return { data: (data as Resource[]) || [], count: count || 0 }
}

export async function createResource(payload: CreateResourceRequest): Promise<string> {
  const title = payload.title?.trim()
  if (!title || title.length < 3) throw new Error('El título es obligatorio (mínimo 3 caracteres)')
  if (!payload.course_id) throw new Error('El ID del curso es obligatorio')
  if (!payload.resource_type) throw new Error('El tipo de recurso es obligatorio')

  // Obtener tenant_id desde el curso para mantener consistencia
  const { data: courseRow, error: courseErr } = await supabase
    .from('courses')
    .select('tenant_id')
    .eq('id', payload.course_id)
    .single()
  if (courseErr) {
    console.error('Error al obtener tenant del curso:', courseErr)
    throw courseErr
  }

  const insertPayload = {
    tenant_id: (courseRow as { tenant_id: string | null }).tenant_id ?? null,
    course_id: payload.course_id,
    title,
    description: payload.description ?? null,
    resource_type: payload.resource_type,
    file_url: payload.file_url ?? null,
    is_public: payload.is_public ?? false,
  }

  const { data, error } = await supabase
    .from('resources')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) {
    console.error('Error al crear recurso:', error)
    throw error
  }

  return (data as { id: string }).id
}

export async function updateResource(id: string, changes: UpdateResourceRequest): Promise<void> {
  if (!id) throw new Error('ID requerido')
  
  const updatePayload: Record<string, unknown> = {}
  if (changes.title !== undefined) updatePayload.title = changes.title.trim()
  if (changes.description !== undefined) updatePayload.description = changes.description
  if (changes.resource_type !== undefined) updatePayload.resource_type = changes.resource_type
  if (changes.file_url !== undefined) updatePayload.file_url = changes.file_url
  if (changes.is_public !== undefined) updatePayload.is_public = changes.is_public

  if (Object.keys(updatePayload).length === 0) {
    throw new Error('No hay cambios para actualizar')
  }

  const { error } = await supabase
    .from('resources')
    .update(updatePayload)
    .eq('id', id)

  if (error) {
    console.error('Error al actualizar recurso:', error)
    throw error
  }
}

export async function deleteResource(id: string): Promise<void> {
  if (!id) throw new Error('ID requerido')
  
  // Obtener path del archivo (si existe) antes de eliminar el recurso
  const { data: resRow, error: resErr } = await supabase
    .from('resources')
    .select('file_url')
    .eq('id', id)
    .single()
  if (resErr) {
    console.error('Error al obtener recurso para eliminar archivo:', resErr)
    throw resErr
  }
  const fileUrl = (resRow as { file_url: string | null })?.file_url || null

  // Eliminar el registro del recurso
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error al eliminar recurso:', error)
    throw error
  }

  // Si el archivo es un path privado (no es http/https), intentar eliminarlo del bucket
  if (fileUrl && !/^https?:\/\//i.test(fileUrl)) {
    const { error: removeErr } = await supabase.storage
      .from('resource-files')
      .remove([fileUrl])
    if (removeErr) {
      // No interrumpimos el flujo si falla la eliminación del archivo, solo lo registramos
      console.warn('No se pudo eliminar el archivo del Storage:', removeErr)
    }
  }
}

export async function getResourceById(id: string): Promise<Resource | null> {
  if (!id) throw new Error('ID requerido')
  
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Error al obtener recurso:', error)
    throw error
  }

  return (data as Resource) ?? null
}

export async function getResourcesByCourse(courseId: string): Promise<Resource[]> {
  if (!courseId) throw new Error('ID del curso requerido')
  
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error al obtener recursos del curso:', error)
    throw error
  }

  return (data as Resource[]) || []
}

export async function uploadResourceFile(file: File, resourceId: string, resourceType: 'document' | 'video' | 'link' | 'image'): Promise<string> {
  if (!file) throw new Error('Archivo requerido')
  if (!resourceId) throw new Error('ID de recurso requerido')
  
  // Validaciones según el tipo de recurso
  // El bucket resource-files limita a 50MB; alineamos el límite aquí también
  const maxSize = 50 * 1024 * 1024 // 50MB para todos los tipos
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024)
    throw new Error(`El archivo excede ${maxSizeMB}MB`)
  }

  // Validar tipo MIME según el tipo de recurso
  const allowedTypes: Record<string, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm', 'video/ogg'],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ]
  }

  if (resourceType !== 'link' && !allowedTypes[resourceType]?.includes(file.type)) {
    throw new Error(`Tipo de archivo no válido para ${resourceType}`)
  }

  const bucket = 'resource-files'
  // Obtener usuario actual para usarlo como primer segmento del path (requerido por políticas de update/delete)
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) {
    console.error('Error al obtener usuario autenticado:', authError)
    throw authError
  }
  const userId = authData?.user?.id
  if (!userId) throw new Error('Usuario no autenticado')

  // Obtener course_id del recurso
  const { data: resRow, error: resErr } = await supabase
    .from('resources')
    .select('course_id')
    .eq('id', resourceId)
    .single()
  if (resErr) {
    console.error('Error al obtener resource para path:', resErr)
    throw resErr
  }
  const courseId = (resRow as { course_id: string }).course_id

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${userId}/${courseId}/${resourceId}/file-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    })

  if (uploadError) {
    console.error('Error al subir archivo de recurso:', uploadError)
    throw uploadError
  }

  // Retornar path privado almacenado; se debe usar Signed URL para acceder
  return path
}

// Generar Signed URL para un path privado en el bucket de recursos
export async function getSignedUrlForPath(path: string, expiresInSeconds = 3600): Promise<string> {
  if (!path) throw new Error('Path requerido')
  const { data, error } = await supabase.storage
    .from('resource-files')
    .createSignedUrl(path, expiresInSeconds)
  if (error) {
    console.error('Error al generar Signed URL:', error)
    throw error
  }
  return data?.signedUrl || ''
}