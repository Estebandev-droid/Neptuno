import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listCourses } from '../lib/coursesService'
import type { Course } from '../types/courses'
import { listProfiles } from '../lib/usersService'
import type { Profile } from '../types/users'
import type { Enrollment, EnrollmentStatus } from '../types/enrollments'
import { listEnrollments, enrollStudent, unenrollStudent, updateEnrollmentStatus, type PagedResult } from '../lib/enrollmentsService'

export default function EnrollmentsPage() {
  const qc = useQueryClient()

  // Filtros de listado
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [filterCourse, setFilterCourse] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<'all' | EnrollmentStatus>('all')

  const { data, isLoading, isFetching, error } = useQuery<PagedResult<Enrollment>, Error, PagedResult<Enrollment>>({
    queryKey: ['enrollments', { page, pageSize, filterCourse, filterStatus }],
    queryFn: () => listEnrollments({ page, pageSize, courseId: filterCourse || null, status: filterStatus }),
  })

  const enrollments = useMemo(() => data?.data ?? [], [data])
  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Datos auxiliares
  const { data: coursesData } = useQuery({ queryKey: ['courses', { for: 'enrollments' }], queryFn: () => listCourses({ page: 1, pageSize: 100, onlyActive: true }) })
  const courses = useMemo(() => (coursesData?.data ?? []) as Course[], [coursesData])

  const { data: profiles } = useQuery({ queryKey: ['profiles', { for: 'enrollments' }], queryFn: listProfiles })
  const students = useMemo(() => (profiles ?? []) as Profile[], [profiles])

  // Alta de inscripción
  const [newCourseId, setNewCourseId] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const createMut = useMutation({
    mutationFn: () => enrollStudent(newCourseId, newStudentId),
    onSuccess: () => {
      setNewCourseId('')
      setNewStudentId('')
      setFormError(null)
      qc.invalidateQueries({ queryKey: ['enrollments'] })
    },
    onError: (e: Error) => {
      setFormError(e?.message ?? 'No se pudo inscribir al estudiante')
    },
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => unenrollStudent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollments'] }),
  })

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnrollmentStatus }) => updateEnrollmentStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollments'] }),
  })

  const canCreate = newCourseId && newStudentId

  return (
    <div className="space-y-4">
      {/* Encabezado y filtros */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Inscripciones</h2>
      </div>

      <div className="glass-card p-4 rounded-xl">
        <h3 className="font-semibold mb-3 text-light/90">Filtros</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-2">Curso</label>
            <select className="glass-input px-3 py-2 rounded-lg w-full" value={filterCourse} onChange={(e) => { setFilterCourse(e.target.value); setPage(1) }}>
              <option value="">Todos</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Estado</label>
            <select className="glass-input px-3 py-2 rounded-lg w-full" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as EnrollmentStatus | 'all'); setPage(1) }}>
              <option value="all">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="active">Activa</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Formulario de alta */}
      <div className="glass-card p-4 rounded-xl">
        <h3 className="font-semibold mb-3 text-light/90">Nueva inscripción</h3>
        {formError && <div className="text-red-400 text-sm mb-3">{formError}</div>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-2">Curso</label>
            <select className="glass-input px-3 py-2 rounded-lg w-full" value={newCourseId} onChange={(e) => setNewCourseId(e.target.value)}>
              <option value="">Selecciona un curso</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Estudiante</label>
            <select className="glass-input px-3 py-2 rounded-lg w-full" value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)}>
              <option value="">Selecciona un estudiante</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button className="glass-button px-4 py-2 rounded-lg disabled:opacity-50" disabled={!canCreate || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? 'Creando...' : 'Crear inscripción'}
            </button>
          </div>
        </div>
      </div>

      {/* Listado */}
      <div className="glass-card p-4 rounded-xl">
        {isLoading && <div className="text-light/70">Cargando inscripciones...</div>}
        {error && <div className="text-red-400">Error al cargar inscripciones</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-light/70">
                <th className="py-2 pr-4">Estudiante</th>
                <th className="py-2 pr-4">Curso</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Inscrito</th>
                <th className="py-2 pr-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map(en => {
                const student = students.find(s => s.id === en.student_id)
                const course = courses.find(c => c.id === en.course_id)
                return (
                  <tr key={en.id} className="border-t border-white/5">
                    <td className="py-2 pr-4">{student?.full_name ?? en.student_id}</td>
                    <td className="py-2 pr-4">{course?.title ?? en.course_id}</td>
                    <td className="py-2 pr-4">
                      <select className="glass-input px-2 py-1 rounded" value={en.status} onChange={(e) => updateStatusMut.mutate({ id: en.id, status: e.target.value as EnrollmentStatus })}>
                        <option value="active">Activa</option>
                        <option value="completed">Completada</option>
                        <option value="dropped">Baja</option>
                      </select>
                    </td>
                    <td className="py-2 pr-4">{en.enrolled_at ? new Date(en.enrolled_at).toLocaleString() : '-'}</td>
                    <td className="py-2 pr-4 text-right">
                      <button className="glass-nav-item px-3 py-1.5 rounded-lg" onClick={() => removeMut.mutate(en.id)} disabled={removeMut.isPending}>Eliminar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-light/70">Mostrando {enrollments.length} de {total} registros</div>
          <div className="flex items-center gap-2">
            <button className="glass-nav-item px-3 py-1.5 rounded-lg disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              <span className="hidden sm:inline">Anterior</span>
              <span className="sm:hidden">‹</span>
            </button>
            <div className="text-xs text-light/70">{page} / {totalPages}</div>
            <button className="glass-nav-item px-3 py-1.5 rounded-lg disabled:opacity-50" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <span className="hidden sm:inline">Siguiente</span>
              <span className="sm:hidden">›</span>
            </button>
          </div>
        </div>
      </div>

      {isFetching && <div className="text-light/60 text-xs">Actualizando...</div>}
    </div>
  )
}