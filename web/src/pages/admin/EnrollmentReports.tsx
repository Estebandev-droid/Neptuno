import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listEnrollments, type PagedResult } from '../../lib/enrollmentsService'
import { listCourses } from '../../lib/coursesService'
import { listProfiles } from '../../lib/usersService'
import type { Enrollment } from '../../types/enrollments'
import type { Course } from '../../types/courses'
import type { Profile } from '../../types/users'
import { TrendingUp, Users, BookOpen, Award, Calendar, BarChart3 } from 'lucide-react'

export default function EnrollmentReportsPage() {
  // Obtener todos los datos para análisis
  const { data: enrollmentsData } = useQuery<PagedResult<Enrollment>, Error, PagedResult<Enrollment>>({
    queryKey: ['all-enrollments-reports'],
    queryFn: () => listEnrollments({ page: 1, pageSize: 1000 }),
  })

  const { data: coursesData } = useQuery({ 
    queryKey: ['courses-reports'], 
    queryFn: () => listCourses({ page: 1, pageSize: 200 }) 
  })

  const { data: profiles } = useQuery({ 
    queryKey: ['profiles-reports'], 
    queryFn: listProfiles 
  })

  const enrollments = useMemo(() => enrollmentsData?.data ?? [], [enrollmentsData])
  const courses = useMemo(() => (coursesData?.data ?? []) as Course[], [coursesData])
  const students = useMemo(() => (profiles ?? []) as Profile[], [profiles])

  // Análisis de datos
  const analytics = useMemo(() => {
    if (!enrollments.length) return null

    // Estadísticas generales
    const totalEnrollments = enrollments.length
    const activeEnrollments = enrollments.filter(e => e.status === 'active').length
    const completedEnrollments = enrollments.filter(e => e.status === 'completed').length
    const droppedEnrollments = enrollments.filter(e => e.status === 'dropped').length
    
    const completionRate = totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0
    const dropoutRate = totalEnrollments > 0 ? (droppedEnrollments / totalEnrollments) * 100 : 0
    const activeRate = totalEnrollments > 0 ? (activeEnrollments / totalEnrollments) * 100 : 0

    // Análisis por curso
    const courseStats = courses.map(course => {
      const courseEnrollments = enrollments.filter(e => e.course_id === course.id)
      const courseActive = courseEnrollments.filter(e => e.status === 'active').length
      const courseCompleted = courseEnrollments.filter(e => e.status === 'completed').length
      const courseDropped = courseEnrollments.filter(e => e.status === 'dropped').length
      
      return {
        course,
        total: courseEnrollments.length,
        active: courseActive,
        completed: courseCompleted,
        dropped: courseDropped,
        completionRate: courseEnrollments.length > 0 ? (courseCompleted / courseEnrollments.length) * 100 : 0,
        dropoutRate: courseEnrollments.length > 0 ? (courseDropped / courseEnrollments.length) * 100 : 0
      }
    }).filter(stat => stat.total > 0).sort((a, b) => b.total - a.total)

    // Análisis temporal (últimos 30 días)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentEnrollments = enrollments.filter(e => 
      e.enrolled_at && new Date(e.enrolled_at) >= thirtyDaysAgo
    )

    // Top estudiantes por número de inscripciones
    const studentEnrollmentCounts = students.map(student => {
      const studentEnrollments = enrollments.filter(e => e.student_id === student.id)
      return {
        student,
        enrollmentCount: studentEnrollments.length,
        activeCount: studentEnrollments.filter(e => e.status === 'active').length,
        completedCount: studentEnrollments.filter(e => e.status === 'completed').length
      }
    }).filter(stat => stat.enrollmentCount > 0).sort((a, b) => b.enrollmentCount - a.enrollmentCount)

    return {
      general: {
        totalEnrollments,
        activeEnrollments,
        completedEnrollments,
        droppedEnrollments,
        completionRate,
        dropoutRate,
        activeRate,
        recentEnrollments: recentEnrollments.length
      },
      courseStats: courseStats.slice(0, 10), // Top 10 cursos
      studentStats: studentEnrollmentCounts.slice(0, 10), // Top 10 estudiantes
      trends: {
        monthlyGrowth: recentEnrollments.length
      }
    }
  }, [enrollments, courses, students])

  if (!analytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-light">Reportes de Inscripciones</h2>
            <p className="text-light/70 mt-1">Cargando datos analíticos...</p>
          </div>
        </div>
        <div className="glass-card p-8 rounded-xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-light/70">Procesando datos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-light">Reportes de Inscripciones</h2>
          <p className="text-light/70 mt-1">Análisis detallado del rendimiento de inscripciones</p>
        </div>
        <div className="flex gap-3">
          <button className="glass-button px-4 py-2 rounded-lg flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Exportar Reporte
          </button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-light">{analytics.general.totalEnrollments}</p>
              <p className="text-sm text-light/70">Total Inscripciones</p>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-light">{analytics.general.completionRate.toFixed(1)}%</p>
              <p className="text-sm text-light/70">Tasa de Finalización</p>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-light">{analytics.general.activeRate.toFixed(1)}%</p>
              <p className="text-sm text-light/70">Inscripciones Activas</p>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-secondary" />
            <div>
              <p className="text-2xl font-bold text-light">{analytics.general.recentEnrollments}</p>
              <p className="text-sm text-light/70">Últimos 30 días</p>
            </div>
          </div>
        </div>
      </div>

      {/* Análisis por Curso */}
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-lg font-semibold text-light mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Rendimiento por Curso (Top 10)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-light/70 border-b border-white/10">
                <th className="py-3 pr-4">Curso</th>
                <th className="py-3 pr-4">Total</th>
                <th className="py-3 pr-4">Activas</th>
                <th className="py-3 pr-4">Completadas</th>
                <th className="py-3 pr-4">Abandonadas</th>
                <th className="py-3 pr-4">Tasa Finalización</th>
                <th className="py-3 pr-4">Tasa Abandono</th>
              </tr>
            </thead>
            <tbody>
              {analytics.courseStats.map((stat) => (
                <tr key={stat.course.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="py-3 pr-4">
                    <div>
                      <div className="font-medium">{stat.course.title}</div>
                      <div className="text-xs text-light/60">{stat.course.description?.substring(0, 50)}...</div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-semibold">{stat.total}</td>
                  <td className="py-3 pr-4">
                    <span className="text-green-400">{stat.active}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-blue-400">{stat.completed}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-red-400">{stat.dropped}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-white/10 rounded-full h-2">
                        <div 
                          className="bg-green-400 h-2 rounded-full" 
                          style={{ width: `${Math.min(100, stat.completionRate)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs">{stat.completionRate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-white/10 rounded-full h-2">
                        <div 
                          className="bg-red-400 h-2 rounded-full" 
                          style={{ width: `${Math.min(100, stat.dropoutRate)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs">{stat.dropoutRate.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Estudiantes */}
      <div className="glass-card p-6 rounded-xl">
        <h3 className="text-lg font-semibold text-light mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Estudiantes Más Activos (Top 10)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analytics.studentStats.map((stat, idx) => (
            <div key={stat.student.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-medium">
                  {(stat.student.full_name ?? stat.student.id).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{stat.student.full_name ?? stat.student.id}</div>
                <div className="text-xs text-light/60">
                  {stat.enrollmentCount} inscripciones • {stat.activeCount} activas • {stat.completedCount} completadas
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary">#{idx + 1}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen de Tendencias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-6 rounded-xl">
          <h4 className="font-semibold text-light mb-2">Estado General</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-light/70">Activas:</span>
              <span className="text-green-400 font-medium">{analytics.general.activeEnrollments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-light/70">Completadas:</span>
              <span className="text-blue-400 font-medium">{analytics.general.completedEnrollments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-light/70">Abandonadas:</span>
              <span className="text-red-400 font-medium">{analytics.general.droppedEnrollments}</span>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-6 rounded-xl">
          <h4 className="font-semibold text-light mb-2">Rendimiento</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-light/70">Tasa Finalización:</span>
              <span className="text-green-400 font-medium">{analytics.general.completionRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-light/70">Tasa Abandono:</span>
              <span className="text-red-400 font-medium">{analytics.general.dropoutRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-light/70">Cursos Activos:</span>
              <span className="text-primary font-medium">{analytics.courseStats.length}</span>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-6 rounded-xl">
          <h4 className="font-semibold text-light mb-2">Actividad Reciente</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-light/70">Nuevas (30 días):</span>
              <span className="text-secondary font-medium">{analytics.general.recentEnrollments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-light/70">Estudiantes Activos:</span>
              <span className="text-primary font-medium">{analytics.studentStats.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-light/70">Promedio por Curso:</span>
              <span className="text-light font-medium">
                {analytics.courseStats.length > 0 
                  ? (analytics.general.totalEnrollments / analytics.courseStats.length).toFixed(1)
                  : '0'
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}