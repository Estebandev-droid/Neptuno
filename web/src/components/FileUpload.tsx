import React, { useState, useRef, useCallback } from 'react'
import { CloudArrowUpIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { validateImageFile } from '../lib/uploadService'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onFileRemove?: () => void
  accept?: string
  maxSizeMB?: number
  currentImageUrl?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  type?: 'avatar' | 'signature' | 'image'
}

export default function FileUpload({
  onFileSelect,
  onFileRemove,
  accept = 'image/*',
  maxSizeMB = 5,
  currentImageUrl,
  placeholder,
  className = '',
  disabled = false,
  type = 'image'
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    try {
      validateImageFile(file, maxSizeMB)
      
      // Crear preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      
      setError(null)
      onFileSelect(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo')
      setPreview(null)
    }
  }, [maxSizeMB, onFileSelect])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (disabled) return
    
    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }, [disabled, handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (disabled) return
    
    const files = e.target.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }, [disabled, handleFile])

  const handleClick = useCallback(() => {
    if (disabled) return
    fileInputRef.current?.click()
  }, [disabled])

  const handleRemove = useCallback(() => {
    setPreview(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onFileRemove?.()
  }, [onFileRemove])

  const getPlaceholderText = () => {
    if (placeholder) return placeholder
    
    switch (type) {
      case 'avatar':
        return 'Subir foto de perfil'
      case 'signature':
        return 'Subir firma digital'
      default:
        return 'Subir imagen'
    }
  }

  const getIconSize = () => {
    switch (type) {
      case 'avatar':
        return 'h-12 w-12'
      case 'signature':
        return 'h-8 w-8'
      default:
        return 'h-10 w-10'
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      
      {preview ? (
        <div className="relative group">
          <div className={`relative overflow-hidden rounded-lg border-2 border-primary/20 ${
            type === 'avatar' ? 'w-24 h-24 rounded-full' : 
            type === 'signature' ? 'w-full h-20' : 
            'w-full h-32'
          }`}>
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            {!disabled && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={handleRemove}
                  className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Eliminar imagen"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${dragActive ? 'border-primary bg-primary/10' : 'border-light/30 hover:border-primary/50'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-light/5'}
            ${type === 'signature' ? 'p-4' : 'p-6'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <div className="flex flex-col items-center gap-2">
            {type === 'avatar' ? (
              <div className="w-16 h-16 rounded-full bg-light/10 flex items-center justify-center">
                <PhotoIcon className="h-8 w-8 text-light/60" />
              </div>
            ) : (
              <CloudArrowUpIcon className={`${getIconSize()} text-light/60`} />
            )}
            
            <div>
              <p className="text-sm font-medium text-light">
                {getPlaceholderText()}
              </p>
              <p className="text-xs text-light/60 mt-1">
                Arrastra y suelta o haz clic para seleccionar
              </p>
              <p className="text-xs text-light/40 mt-1">
                Máximo {maxSizeMB}MB • JPG, PNG, GIF, WebP
              </p>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}