import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listCourses } from '../../lib/coursesService'
import type { Course } from '../../types/courses'
import { listProfiles } from '../../lib/usersService'
import type { Profile } from '../../types/users'
import type { Enrollment, EnrollmentStatus } from '../../types/enrollments'
import { listEnrollments, enrollStudent, unenrollStudent, updateEnrollmentStatus, type PagedResult } from '../../lib/enrollmentsService'
import { Download, Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

export default function AdminEnrollmentsPage() {
  const qc = useQueryClient()

  // Filtros de listado
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [filterCourse, setFilterCourse] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<'all' | EnrollmentStatus>('all')
  const [filterStudent, setFilterStudent] = useState<string>('')

  const { data, isLoading, isFetching, error } = useQuery<PagedResult<Enrollment>, Error, PagedResult<Enrollment>>({
    queryKey: ['admin-enrollments', { page, pageSize, filterCourse, filterStatus, filterStudent }],
    queryFn: () => listEnrollments({ 
      page, 
      pageSize, 
      courseId: filterCourse || null, 
      status: filterStatus,
      studentId: filterStudent || null
    }),
  })

  const enrollments = useMemo(() => data?.data ?? [], [data])
  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Datos auxiliares
  const { data: coursesData } = useQuery({ 
    queryKey: ['courses', { for: 'admin-enrollments' }], 
    queryFn: () => listCourses({ page: 1, pageSize: 200, onlyActive: true }) 
  })
  const courses = useMemo(() => (coursesData?.data ?? []) as Course[], [coursesData])

  const { data: profiles } = useQuery({ 
    queryKey: ['profiles', { for: 'admin-enrollments' }], 
    queryFn: listProfiles 
  })
  const students = useMemo(() => (profiles ?? []) as Profile[], [profiles])

  // Inscripción masiva
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [selectedCourseForBulk, setSelectedCourseForBulk] = useState('')
  const [selectedStudentsForBulk, setSelectedStudentsForBulk] = useState<string[]>([])
  const [bulkError, setBulkError] = useState<string | null>(null)

  // Estadísticas
  const stats = useMemo(() => {
    const activeCount = enrollments.filter(e => e.status === 'active').length
    const completedCount = enrollments.filter(e => e.status === 'completed').length
    const droppedCount = enrollments.filter(e => e.status === 'dropped').length
    
    return {
      total: enrollments.length,
      active: activeCount,
      completed: completedCount,
      dropped: droppedCount,
      completionRate: total > 0 ? Math.round((completedCount / total) * 100) : 0
    }
  }, [enrollments, total])

  // Mutaciones
  const bulkEnrollMut = useMutation({
    mutationFn: async () => {
      const promises = selectedStudentsForBulk.map(studentId => 
        enrollStudent(selectedCourseForBulk, studentId)
      )
      await Promise.all(promises)
    },
    onSuccess: () => {
      setShowBulkModal(false)
      setSelectedCourseForBulk('')
      setSelectedStudentsForBulk([])
      setBulkError(null)
      qc.invalidateQueries({ queryKey: ['admin-enrollments'] })
    },
    onError: (e: Error) => {
      setBulkError(e?.message ?? 'Error en inscripción masiva')
    },
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => unenrollStudent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-enrollments'] }),
  })

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnrollmentStatus }) => updateEnrollmentStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-enrollments'] }),
  })

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentsForBulk(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const canBulkEnroll = selectedCourseForBulk && selectedStudentsForBulk.length > 0

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-light">Gestión de Inscripciones</h2>
          <p className="text-light/70 mt-1">Administra inscripciones de estudiantes de forma masiva</p>
        </div>
        <div className="flex gap-3">
          <button 
            className="glass-button px-4 py-2 rounded-lg flex items-center gap-2"
            onClick={() => setShowBulkModal(true)}
          >
            <Users className="w-4 h-4" />
            Inscripción Masiva
          </button>
          <button className="glass-button px-4 py-2 rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-light">{stats.total}</p>
              <p className="text-sm text-light/70">Total Inscripciones</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-light">{stats.active}</p>
              <p className="text-sm text-light/70">Activas</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-light">{stats.completed}</p>
              <p className="text-sm text-light/70">Completadas</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-light">{stats.dropped}</p>
              <p className="text-sm text-light/70">Dadas de Baja</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-secondary" />
            <div>
              <p className="text-2xl font-bold text-light">{stats.completionRate}%</p>
              <p className="text-sm text-light/70">Tasa Finalización</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card p-4 rounded-xl">
        <h3 className="font-semibold mb-3 text-light/90">Filtros</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-2">Curso</label>
            <select 
              className="glass-input px-3 py-2 rounded-lg w-full" 
              value={filterCourse} 
              onChange={(e) => { setFilterCourse(e.target.value); setPage(1) }}
            >
              <option value="">Todos los cursos</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Estado</label>
            <select 
              className="glass-input px-3 py-2 rounded-lg w-full" 
              value={filterStatus} 
              onChange={(e) => { setFilterStatus(e.target.value as EnrollmentStatus | 'all'); setPage(1) }}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activa</option>
              <option value="completed">Completada</option>
              <option value="dropped">Dada de baja</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Estudiante</label>
            <select 
              className="glass-input px-3 py-2 rounded-lg w-full" 
              value={filterStudent} 
              onChange={(e) => { setFilterStudent(e.target.value); setPage(1) }}
            >
              <option value="">Todos los estudiantes</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name ?? s.id}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Listado */}
      <div className="glass-card p-4 rounded-xl">
        {isLoading && <div className="text-light/70">Cargando inscripciones...</div>}
        {error && <div className="text-red-400">Error al cargar inscripciones</div>}

        <div className="overflow-x-auto scrollbar-styled">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-light/70 border-b border-white/10">
                <th className="py-3 pr-4">Estudiante</th>
                <th className="py-3 pr-4">Curso</th>
                <th className="py-3 pr-4">Estado</th>
                <th className="py-3 pr-4">Fecha Inscripción</th>
                <th className="py-3 pr-4">Progreso</th>
                <th className="py-3 pr-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map(en => {
                const student = students.find(s => s.id === en.student_id)
                const course = courses.find(c => c.id === en.course_id)
                return (
                  <tr key={en.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {(student?.full_name ?? en.student_id).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span>{student?.full_name ?? en.student_id}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div>
                        <div className="font-medium">{course?.title ?? en.course_id}</div>
                        <div className="text-xs text-light/60">{course?.description?.substring(0, 50)}...</div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <select 
                        className="glass-input px-2 py-1 rounded text-xs" 
                        value={en.status} 
                        onChange={(e) => updateStatusMut.mutate({ id: en.id, status: e.target.value as EnrollmentStatus })}
                        disabled={updateStatusMut.isPending}
                      >
                        <option value="active">Activa</option>
                        <option value="completed">Completada</option>
                        <option value="dropped">Dada de baja</option>
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      {en.enrolled_at ? new Date(en.enrolled_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: '65%' }}
                        ></div>
                      </div>
                      <span className="text-xs text-light/60 mt-1">65%</span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button 
                        className="glass-nav-item px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/20" 
                        onClick={() => removeMut.mutate(en.id)} 
                        disabled={removeMut.isPending}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-light/70">
            Mostrando {enrollments.length} de {total} inscripciones
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="glass-nav-item px-3 py-1.5 rounded-lg disabled:opacity-50" 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page <= 1}
            >
              Anterior
            </button>
            <div className="text-sm text-light/70">{page} / {totalPages}</div>
            <button 
              className="glass-nav-item px-3 py-1.5 rounded-lg disabled:opacity-50" 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={page >= totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Inscripción Masiva */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-card p-6 rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-light">Inscripción Masiva</h3>
              <button 
                className="text-light/60 hover:text-light" 
                onClick={() => setShowBulkModal(false)}
              >
                ✕
              </button>
            </div>

            {bulkError && (
              <div className="text-red-400 text-sm mb-4 p-3 bg-red-500/10 rounded-lg">
                {bulkError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Seleccionar Curso</label>
                <select 
                  className="glass-input px-3 py-2 rounded-lg w-full" 
                  value={selectedCourseForBulk} 
                  onChange={(e) => setSelectedCourseForBulk(e.target.value)}
                >
                  <option value="">Selecciona un curso</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Seleccionar Estudiantes ({selectedStudentsForBulk.length} seleccionados)
                </label>
                <div className="max-h-60 overflow-y-auto border border-white/10 rounded-lg p-3">
                  {students.map(student => (
                    <label key={student.id} className="flex items-center gap-2 py-2 hover:bg-white/5 rounded px-2">
                      <input
                        type="checkbox"
                        checked={selectedStudentsForBulk.includes(student.id)}
                        onChange={() => handleStudentToggle(student.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{student.full_name ?? student.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                className="glass-nav-item px-4 py-2 rounded-lg" 
                onClick={() => setShowBulkModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="glass-button px-4 py-2 rounded-lg disabled:opacity-50" 
                disabled={!canBulkEnroll || bulkEnrollMut.isPending}
                onClick={() => bulkEnrollMut.mutate()}
              >
                {bulkEnrollMut.isPending ? 'Inscribiendo...' : `Inscribir ${selectedStudentsForBulk.length} estudiantes`}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFetching && <div className="text-light/60 text-xs">Actualizando...</div>}
    </div>
  )
}