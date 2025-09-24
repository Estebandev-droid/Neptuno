import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  listCourses, 
  createCourse, 
  updateCourse, 
  setCourseActive, 
  deleteCourse, 
  uploadCourseCover,
  getCourseById
} from '../lib/coursesService'
import type { Course } from '../types/courses'
import type { PagedResult } from '../lib/coursesService'

interface UseCoursesOptions {
  search?: string
  page?: number
  pageSize?: number
  onlyActive?: boolean
  categoryId?: string | null
  instructorId?: string | null
  enabled?: boolean
}

/**
 * Hook optimizado para la gestión de cursos con paginación
 */
export function useCourses(options: UseCoursesOptions = {}) {
  const {
    search = '',
    page = 1,
    pageSize = 10,
    onlyActive = false,
    categoryId = null,
    instructorId = null,
    enabled = true
  } = options

  const queryClient = useQueryClient()

  // Query principal de cursos con paginación
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch
  } = useQuery<PagedResult<Course>, Error, PagedResult<Course>>({
    queryKey: ['courses', { search, page, pageSize, onlyActive, categoryId, instructorId }],
    queryFn: () => listCourses({ 
      search, 
      page, 
      pageSize, 
      onlyActive, 
      categoryId, 
      instructorId 
    }),
    enabled,
    staleTime: 30 * 1000, // 30 segundos para actualizaciones más frecuentes
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: true, // Refrescar al enfocar la ventana
  })

  // Mutación para crear curso
  const createCourseMutation = useMutation({
    mutationFn: async ({
      courseData,
      coverFile
    }: {
      courseData: {
        title: string
        description?: string | null
        category_id?: string | null
        instructor_id?: string | null
        cover_image?: string | null
      }
      coverFile?: File | null
    }) => {
      const courseId = await createCourse(courseData)
      
      if (coverFile) {
        const coverUrl = await uploadCourseCover(coverFile, courseId)
        await updateCourse(courseId, { cover_image: coverUrl })
      }
      
      return courseId
    },
    onSuccess: () => {
      // Invalidar todas las queries de cursos para actualizaciones inmediatas
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['course'] })
      // Refrescar inmediatamente
      queryClient.refetchQueries({ queryKey: ['courses'] })
    },
    onError: (error) => {
      console.error('Error creating course:', error)
    }
  })

  // Mutación para actualizar curso
  const updateCourseMutation = useMutation({
    mutationFn: async ({
      courseId,
      updates,
      coverFile
    }: {
      courseId: string
      updates: Partial<Course>
      coverFile?: File | null
    }) => {
      const finalUpdates = { ...updates }
      
      if (coverFile) {
        const coverUrl = await uploadCourseCover(coverFile, courseId)
        finalUpdates.cover_image = coverUrl
      }
      
      return updateCourse(courseId, finalUpdates)
    },
    onSuccess: (_, variables) => {
      // Invalidar todas las queries de cursos para actualizaciones inmediatas
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['course'] })
      queryClient.invalidateQueries({ queryKey: ['course', variables.courseId] })
      // Refrescar inmediatamente para mostrar cambios
      queryClient.refetchQueries({ queryKey: ['courses'] })
    },
    onError: (error) => {
      console.error('Error updating course:', error)
    }
  })

  // Mutación para cambiar estado activo
  const toggleActiveMutation = useMutation({
    mutationFn: ({ courseId, active }: { courseId: string; active: boolean }) =>
      setCourseActive(courseId, active),
    onSuccess: (_, variables) => {
      // Invalidar y refrescar para actualizaciones inmediatas
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['course', variables.courseId] })
      queryClient.refetchQueries({ queryKey: ['courses'] })
    },
    onError: (error) => {
      console.error('Error toggling course active state:', error)
    }
  })

  // Mutación para eliminar curso
  const deleteCourseMutation = useMutation({
    mutationFn: (courseId: string) => deleteCourse(courseId),
    onSuccess: () => {
      // Invalidar y refrescar para actualizaciones inmediatas
      queryClient.invalidateQueries({ queryKey: ['courses'] })
      queryClient.invalidateQueries({ queryKey: ['course'] })
      queryClient.refetchQueries({ queryKey: ['courses'] })
    },
    onError: (error) => {
      console.error('Error deleting course:', error)
    }
  })

  return {
    // Datos
    courses: data?.data ?? [],
    total: data?.count ?? 0,
    totalPages: Math.max(1, Math.ceil((data?.count ?? 0) / pageSize)),
    
    // Estados
    isLoading,
    isFetching,
    error,
    
    // Mutaciones
    createCourse: createCourseMutation,
    updateCourse: updateCourseMutation,
    toggleActive: toggleActiveMutation,
    deleteCourse: deleteCourseMutation,
    
    // Utilidades
    refetch,
    
    // Estados de mutaciones
    isCreating: createCourseMutation.isPending,
    isUpdating: updateCourseMutation.isPending,
    isTogglingActive: toggleActiveMutation.isPending,
    isDeleting: deleteCourseMutation.isPending,
  }
}

/**
 * Hook para obtener un curso específico
 */
export function useCourse(courseId: string) {
  const {
    data: course,
    isLoading,
    error
  } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourseById(courseId),
    enabled: !!courseId,
    staleTime: 3 * 60 * 1000, // 3 minutos
  })

  return {
    course,
    isLoading,
    error,
  }
}

/**
 * Hook para obtener cursos activos (para selects y filtros)
 */
export function useActiveCourses() {
  const { courses, isLoading, error } = useCourses({ 
    onlyActive: true, 
    pageSize: 100 // Obtener todos los activos
  })

  return {
    courses,
    isLoading,
    error,
  }
}

/**
 * Hook para obtener cursos de un instructor específico
 */
export function useInstructorCourses(instructorId: string) {
  const { courses, isLoading, error, total } = useCourses({ 
    instructorId,
    pageSize: 100 // Obtener todos los cursos del instructor
  })

  return {
    courses,
    total,
    isLoading,
    error,
  }
}