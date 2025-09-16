import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Filter, Edit, Trash2, Eye, Users, BarChart3, Clock, CheckCircle } from 'lucide-react'
import { 
  listEvaluations, 
  deleteEvaluation, 
  type Evaluation
} from '../lib/evaluationsService'
import { useCourses } from '../hooks/useCourses'

interface EvaluationWithStats extends Evaluation {
  student_count: number
  average_score: number
  completion_rate: number
}

export default function Evaluations() {
  // const { user } = useAuth() // TODO: Use for filtering user-specific evaluations
  const { courses } = useCourses()
  const [evaluations, setEvaluations] = useState<EvaluationWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  // const [showCreateModal, setShowCreateModal] = useState(false) // TODO: Implement create modal
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const loadEvaluations = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listEvaluations(selectedCourse || undefined)
      
      const evaluationsWithStats = data.map((evaluation: Evaluation) => ({
        ...evaluation,
        student_count: 0, // TODO: Implement actual statistics
        average_score: 0,
        completion_rate: 0
      }))
      
      setEvaluations(evaluationsWithStats)
    } catch (error) {
      console.error('Error loading evaluations:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedCourse])

  useEffect(() => {
    loadEvaluations()
  }, [selectedCourse, loadEvaluations])

  const handleDeleteEvaluation = async () => {
    if (!selectedEvaluation) return
    
    try {
      await deleteEvaluation(selectedEvaluation.id)
      await loadEvaluations()
      setShowDeleteModal(false)
      setSelectedEvaluation(null)
    } catch (error) {
      console.error('Error deleting evaluation:', error)
    }
  }

  const filteredEvaluations = evaluations.filter(evaluation => {
    const matchesSearch = evaluation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         evaluation.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = !selectedType || evaluation.evaluation_type === selectedType
    return matchesSearch && matchesType
  })

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quiz': return 'bg-blue-100 text-blue-800'
      case 'exam': return 'bg-red-100 text-red-800'
      case 'project': return 'bg-green-100 text-green-800'
      case 'assignment': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (evaluation: Evaluation) => {
    if (!evaluation.is_published) return 'bg-gray-100 text-gray-800'
    
    const now = new Date()
    const startDate = evaluation.start_date ? new Date(evaluation.start_date) : null
    const endDate = evaluation.end_date ? new Date(evaluation.end_date) : null
    
    if (startDate && now < startDate) return 'bg-yellow-100 text-yellow-800'
    if (endDate && now > endDate) return 'bg-red-100 text-red-800'
    return 'bg-green-100 text-green-800'
  }

  const getStatusText = (evaluation: Evaluation) => {
    if (!evaluation.is_published) return 'Borrador'
    
    const now = new Date()
    const startDate = evaluation.start_date ? new Date(evaluation.start_date) : null
    const endDate = evaluation.end_date ? new Date(evaluation.end_date) : null
    
    if (startDate && now < startDate) return 'Programada'
    if (endDate && now > endDate) return 'Finalizada'
    return 'Activa'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evaluaciones</h1>
          <p className="text-gray-600">Gestiona exámenes, quizzes y proyectos</p>
        </div>
        <button
          onClick={() => {/* TODO: Implement create modal */}}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nueva Evaluación
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar evaluaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los cursos</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.title}</option>
            ))}
          </select>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos los tipos</option>
            <option value="quiz">Quiz</option>
            <option value="exam">Examen</option>
            <option value="project">Proyecto</option>
            <option value="assignment">Tarea</option>
          </select>
          
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            Más filtros
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Evaluaciones</p>
              <p className="text-2xl font-bold text-gray-900">{evaluations.length}</p>
            </div>
            <div className="bg-blue-100 p-2 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Activas</p>
              <p className="text-2xl font-bold text-green-600">
                {evaluations.filter(e => e.is_published && getStatusText(e) === 'Activa').length}
              </p>
            </div>
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Borradores</p>
              <p className="text-2xl font-bold text-yellow-600">
                {evaluations.filter(e => !e.is_published).length}
              </p>
            </div>
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Promedio Intentos</p>
              <p className="text-2xl font-bold text-purple-600">
                {Math.round(
                  evaluations.reduce((sum, e) => sum + (e.student_count || 0), 0) / 
                  Math.max(evaluations.length, 1)
                )}
              </p>
            </div>
            <div className="bg-purple-100 p-2 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Evaluations List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {filteredEvaluations.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay evaluaciones</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || selectedCourse || selectedType 
                ? 'No se encontraron evaluaciones con los filtros aplicados.'
                : 'Comienza creando tu primera evaluación.'}
            </p>
            {!searchTerm && !selectedCourse && !selectedType && (
              <div className="mt-6">
                <button
                  onClick={() => {/* TODO: Implement create modal */}}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  Nueva Evaluación
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Evaluación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Curso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estadísticas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duración
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEvaluations.map((evaluation) => (
                  <tr key={evaluation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {evaluation.title}
                        </div>
                        {evaluation.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {evaluation.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {courses.find(c => c.id === evaluation.course_id)?.title || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(evaluation.evaluation_type)}`}>
                        {evaluation.evaluation_type === 'quiz' && 'Quiz'}
                        {evaluation.evaluation_type === 'exam' && 'Examen'}
                        {evaluation.evaluation_type === 'project' && 'Proyecto'}
                        {evaluation.evaluation_type === 'assignment' && 'Tarea'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(evaluation)}`}>
                        {getStatusText(evaluation)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <div>{evaluation.student_count} estudiantes</div>
                        <div className="text-xs">
                          {evaluation.average_score.toFixed(1)}% promedio
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {evaluation.duration_minutes} min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="text-green-600 hover:text-green-900 p-1 rounded"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEvaluation(evaluation)
                            setShowDeleteModal(true)
                          }}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedEvaluation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirmar eliminación
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              ¿Estás seguro de que deseas eliminar la evaluación "{selectedEvaluation.title}"? 
              Esta acción no se puede deshacer y se eliminarán todas las respuestas de los estudiantes.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedEvaluation(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteEvaluation}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}