import { supabase } from './supabaseClient'

/**
 * Servicio para manejar la subida de archivos de usuario (avatares y firmas)
 */

export interface UploadResult {
  url: string
  path: string
}

/**
 * Sube un avatar de usuario al bucket user-avatars
 */
export async function uploadUserAvatar(file: File, userId: string): Promise<UploadResult> {
  if (!file) throw new Error('Archivo de imagen requerido')
  if (!userId) throw new Error('ID de usuario requerido')
  
  // Validaciones específicas para avatares
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Formato de imagen no válido. Use JPG, PNG, GIF o WebP')
  }
  
  const maxSize = 3 * 1024 * 1024 // 3MB según configuración del bucket
  if (file.size > maxSize) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    throw new Error(`La imagen es demasiado grande (${sizeMB}MB). Máximo permitido: 3MB`)
  }

  const bucket = 'user-avatars'
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/avatar-${Date.now()}.${ext}`

  try {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      })
    
    if (uploadError) {
      console.error('Error al subir avatar:', uploadError)
      
      // Manejo de errores específicos de Supabase Storage
      if (uploadError.message.includes('not found')) {
        throw new Error('El bucket de almacenamiento no existe. Contacte al administrador.')
      } else if (uploadError.message.includes('unauthorized')) {
        throw new Error('No tiene permisos para subir imágenes. Contacte al administrador.')
      } else if (uploadError.message.includes('payload too large')) {
        throw new Error('El archivo es demasiado grande para el servidor.')
      } else {
        throw new Error(`Error al subir la imagen: ${uploadError.message}`)
      }
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    const publicUrl = data.publicUrl
    
    if (!publicUrl) {
      throw new Error('No se pudo obtener la URL pública de la imagen')
    }
    
    return { url: publicUrl, path }
  } catch (error) {
    console.error('Error en uploadUserAvatar:', error)
    throw error
  }
}

/**
 * Sube una firma digital al bucket user-signatures
 */
export async function uploadUserSignature(file: File, userId: string): Promise<UploadResult> {
  if (!file) throw new Error('Archivo de firma requerido')
  if (!userId) throw new Error('ID de usuario requerido')
  
  // Validaciones específicas para firmas
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Formato de imagen no válido. Use JPG, PNG, GIF o WebP')
  }
  
  const maxSize = 1 * 1024 * 1024 // 1MB según configuración del bucket
  if (file.size > maxSize) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    throw new Error(`La imagen es demasiado grande (${sizeMB}MB). Máximo permitido: 1MB`)
  }

  const bucket = 'user-signatures'
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/signature-${Date.now()}.${ext}`

  try {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      })
    
    if (uploadError) {
      console.error('Error al subir firma:', uploadError)
      
      // Manejo de errores específicos de Supabase Storage
      if (uploadError.message.includes('not found')) {
        throw new Error('El bucket de almacenamiento no existe. Contacte al administrador.')
      } else if (uploadError.message.includes('unauthorized')) {
        throw new Error('No tiene permisos para subir firmas. Contacte al administrador.')
      } else if (uploadError.message.includes('payload too large')) {
        throw new Error('El archivo es demasiado grande para el servidor.')
      } else {
        throw new Error(`Error al subir la firma: ${uploadError.message}`)
      }
    }

    // Para firmas, obtenemos la URL firmada (privada) en lugar de pública
    const { data, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 365) // URL válida por 1 año
    
    if (urlError || !data?.signedUrl) {
      throw new Error('No se pudo obtener la URL de la firma')
    }
    
    return { url: data.signedUrl, path }
  } catch (error) {
    console.error('Error en uploadUserSignature:', error)
    throw error
  }
}

/**
 * Elimina un archivo del storage
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path])
    
    if (error) {
      console.error(`Error al eliminar archivo de ${bucket}:`, error)
      throw new Error(`Error al eliminar archivo: ${error.message}`)
    }
  } catch (error) {
    console.error('Error en deleteFile:', error)
    throw error
  }
}

/**
 * Obtiene una URL firmada para un archivo privado
 */
export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)
    
    if (error || !data?.signedUrl) {
      throw new Error(`Error al obtener URL firmada: ${error?.message || 'URL no disponible'}`)
    }
    
    return data.signedUrl
  } catch (error) {
    console.error('Error en getSignedUrl:', error)
    throw error
  }
}

/**
 * Valida si un archivo es una imagen válida
 */
export function validateImageFile(file: File, maxSizeMB: number = 5): void {
  if (!file) {
    throw new Error('No se ha seleccionado ningún archivo')
  }
  
  // Validar tipo de archivo
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Formato de archivo no válido. Solo se permiten imágenes JPG, PNG, GIF o WebP')
  }
  
  // Validar tamaño
  const maxSize = maxSizeMB * 1024 * 1024
  if (file.size > maxSize) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    throw new Error(`El archivo es demasiado grande (${sizeMB}MB). Máximo permitido: ${maxSizeMB}MB`)
  }
  
  // Validar que no esté vacío
  if (file.size === 0) {
    throw new Error('El archivo está vacío')
  }
}