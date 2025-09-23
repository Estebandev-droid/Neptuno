import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCourseById } from '../../lib/coursesService'
import { listCategories } from '../../lib/categoriesService'
import { listProfiles } from '../../lib/usersService'
import type { Category } from '../../types/categories'
import type { Profile } from '../../types/users'

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: course, isLoading, error } = useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourseById(id!),
    enabled: Boolean(id)
  })

  const { data: categoriesData } = useQuery({ queryKey: ['categories', { for: 'course-detail' }], queryFn: () => listCategories({ page: 1, pageSize: 100, onlyActive: false }) })
  const categories = useMemo(() => (categoriesData?.data ?? []) as Category[], [categoriesData])

  const { data: profiles } = useQuery({ queryKey: ['profiles', { for: 'course-detail' }], queryFn: listProfiles })
  const instructors = useMemo(() => (profiles ?? []) as Profile[], [profiles])

  const categoryName = useMemo(() => {
    if (!course?.category_id) return 'Sin categoría'
    return categories.find(c => c.id === course.category_id)?.name ?? course.category_id
  }, [course?.category_id, categories])

  const instructorName = useMemo(() => {
    if (!course?.instructor_id) return 'Sin instructor'
    return instructors.find(i => i.id === course.instructor_id)?.full_name ?? course.instructor_id
  }, [course?.instructor_id, instructors])

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="glass-card p-6 rounded-xl text-light/70">Cargando curso...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6">
        <div className="glass-card p-6 rounded-xl text-red-400">Error al cargar el curso</div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="py-6">
        <div className="glass-card p-6 rounded-xl">
          <p className="text-light/70">Curso no encontrado.</p>
          <div className="mt-4">
            <Link to="/courses" className="glass-button px-4 py-2 rounded-lg">Volver a Cursos</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm text-light/70">
        <Link to="/courses" className="hover:underline">Cursos</Link>
        <span>/</span>
        <span className="text-light">{course.title}</span>
      </div>

      {/* Portada */}
      <div className="glass-card rounded-xl overflow-hidden">
        {course.cover_image ? (
          <img src={course.cover_image} alt={course.title} className="w-full h-56 object-cover" />
        ) : (
          <div className="w-full h-56 grid place-items-center bg-gradient-to-br from-emerald-900/20 to-slate-900/20 text-light/60">
            Sin portada
          </div>
        )}

        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{course.title}</h1>
              <p className="text-light/70 mt-1">{course.description || 'Sin descripción'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs ${course.is_active ? 'bg-emerald-600/20 text-emerald-300' : 'bg-amber-600/20 text-amber-300'}`}>
                {course.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <div className="glass-nav-item rounded-lg p-4">
              <div className="text-xs text-light/60">Categoría</div>
              <div className="font-medium">{categoryName}</div>
            </div>
            <div className="glass-nav-item rounded-lg p-4">
              <div className="text-xs text-light/60">Instructor</div>
              <div className="font-medium">{instructorName}</div>
            </div>
            <div className="glass-nav-item rounded-lg p-4">
              <div className="text-xs text-light/60">Creado</div>
              <div className="font-medium">{course.created_at ? new Date(course.created_at).toLocaleString() : '—'}</div>
            </div>
          </div>

          <div className="mt-6">
            <Link to="/courses" className="glass-button px-4 py-2 rounded-lg">Volver</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
