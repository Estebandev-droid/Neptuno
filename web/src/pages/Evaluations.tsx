import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Filter, Edit, Trash2, Eye, Users, BarChart3, Clock, CheckCircle, X } from 'lucide-react'
import { 
  listEvaluations, 
  deleteEvaluation,
  createEvaluation,
  createEvaluationQuestion,
  type Evaluation,
  type EvaluationWithInstructor
} from '../lib/evaluationsService'
import { useCourses } from '../hooks/useCourses'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../hooks/useTenant'
import QuestionForm, { type Question } from '../components/QuestionForm'

interface EvaluationWithStats extends EvaluationWithInstructor {
  student_count: number
  average_score: number
  completion_rate: number
}

export default function Evaluations() {
  const { user } = useAuth()
  const { courses } = useCourses()
  const { selectedTenant } = useTenant()
  const [evaluations, setEvaluations] = useState<EvaluationWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  
  // Form state for creating evaluation
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    course_id: '',
    evaluation_type: 'quiz' as 'quiz' | 'exam' | 'project' | 'assignment',
    duration_minutes: 60,
    instructions: '',
    start_date: '',
    end_date: '',
    attempts_allowed: 1,
    show_results: true,
    randomize_questions: false,
    passing_score: 70,
    max_score: 100,
    is_published: false
  })

  const loadEvaluations = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listEvaluations(selectedCourse || undefined)
      
      const evaluationsWithStats = data.map((evaluation: EvaluationWithInstructor) => ({
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

  const handleCreateEvaluation = async () => {
    const errors: string[] = []
    
    // Asegurar que el usuario esté autenticado (narrowing para TypeScript)
    if (!user) {
      setFormErrors(['Usuario no autenticado'])
      return
    }

    if (!formData.title.trim()) errors.push('El título es requerido')
    if (!formData.course_id) errors.push('Debe seleccionar un curso')
    // Validación de tenant se hace más abajo con selectedTenant
    if (questions.length === 0) errors.push('Debe agregar al menos una pregunta')
    
    // Validar preguntas
    questions.forEach((question, index) => {
      if (!question.question_text.trim()) {
        errors.push(`La pregunta ${index + 1} debe tener texto`)
      }
      if (question.question_type === 'multiple_choice') {
        if (!question.options?.some(opt => opt.trim())) {
          errors.push(`La pregunta ${index + 1} debe tener al menos una opción`)
        }
        if (!question.correct_answer?.trim()) {
          errors.push(`La pregunta ${index + 1} debe tener una respuesta correcta seleccionada`)
        }
      }
      if (question.question_type === 'true_false' && !question.correct_answer) {
        errors.push(`La pregunta ${index + 1} debe tener una respuesta correcta seleccionada`)
      }
    })
    
    if (errors.length > 0) {
      setFormErrors(errors)
      return
    }
    
    setFormErrors([])
    
    try {
      setIsCreating(true)
      // Verificar que hay un tenant seleccionado
      if (!selectedTenant) {
        setFormErrors(['Debe seleccionar un tenant para crear evaluaciones'])
        return
      }

      // Crear la evaluación
      const evaluation = await createEvaluation({
        ...formData,
        tenant_id: selectedTenant.tenant?.id || selectedTenant.tenant_id,
        instructor_id: user.id,
        description: formData.description || undefined,
        instructions: formData.instructions || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined
      })

      // Crear las preguntas
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i]
        const filteredOptions = question.options?.filter(opt => opt.trim())
        const formattedOptions = filteredOptions?.length ? 
          filteredOptions.map((text) => ({ id: crypto.randomUUID(), text })) : 
          undefined

        // Mapear la respuesta correcta al id de la opción en caso de multiple_choice
        let correctAnswer: string | undefined = undefined
        if (question.question_type === 'multiple_choice') {
          if (formattedOptions && filteredOptions && question.correct_answer) {
            const idx = filteredOptions.findIndex((t) => t === question.correct_answer)
            if (idx >= 0) {
              correctAnswer = formattedOptions[idx].id
            }
          }
        } else {
          correctAnswer = question.correct_answer || undefined
        }

        await createEvaluationQuestion({
          evaluation_id: evaluation.id,
          question_text: question.question_text,
          question_type: question.question_type,
          options: formattedOptions,
          correct_answer: correctAnswer,
          points: question.points,
          order_index: i,
          is_required: true
        })
      }

      await loadEvaluations()
      setShowCreateModal(false)
      setFormErrors([])
      // Reset form
      setFormData({
        title: '',
        description: '',
        course_id: '',
        evaluation_type: 'quiz',
        duration_minutes: 60,
        instructions: '',
        start_date: '',
        end_date: '',
        attempts_allowed: 1,
        show_results: true,
        randomize_questions: false,
        passing_score: 70,
        max_score: 100,
        is_published: false
      })
      setQuestions([])
    } catch (error) {
      console.error('Error creating evaluation:', error)
      setFormErrors(['Error al crear la evaluación. Por favor, intenta de nuevo.'])
    } finally {
      setIsCreating(false)
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
    <div className="min-h-screen liquid-gradient p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-light">Evaluaciones</h1>
            <p className="text-light/80">Gestiona exámenes, quizzes y proyectos</p>
          </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="glass-button px-4 py-2 rounded-lg flex items-center gap-2 text-light font-semibold"
        >
          <Plus className="h-4 w-4" />
          Nueva Evaluación
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-light/50 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar evaluaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light placeholder-light/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" className="bg-gray-800">Todos los cursos</option>
            {courses.map(course => (
              <option key={course.id} value={course.id} className="bg-gray-800">{course.title}</option>
            ))}
          </select>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" className="bg-gray-800">Todos los tipos</option>
            <option value="quiz" className="bg-gray-800">Quiz</option>
            <option value="exam" className="bg-gray-800">Examen</option>
            <option value="project" className="bg-gray-800">Proyecto</option>
            <option value="assignment" className="bg-gray-800">Tarea</option>
          </select>
          
          <button className="flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light hover:bg-white/20 transition-colors">
            <Filter className="h-4 w-4" />
            Más filtros
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light/70">Total Evaluaciones</p>
              <p className="text-2xl font-bold text-light">{evaluations.length}</p>
            </div>
            <div className="bg-blue-500/20 p-3 rounded-xl">
              <BarChart3 className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>
        
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light/70">Activas</p>
              <p className="text-2xl font-bold text-green-400">
                {evaluations.filter(e => e.is_published && getStatusText(e) === 'Activa').length}
              </p>
            </div>
            <div className="bg-green-500/20 p-3 rounded-xl">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>
        
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light/70">Borradores</p>
              <p className="text-2xl font-bold text-yellow-400">
                {evaluations.filter(e => !e.is_published).length}
              </p>
            </div>
            <div className="bg-yellow-500/20 p-3 rounded-xl">
              <Clock className="h-6 w-6 text-yellow-400" />
            </div>
          </div>
        </div>
        
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light/70">Promedio Intentos</p>
              <p className="text-2xl font-bold text-purple-400">
                {Math.round(
                  evaluations.reduce((sum, e) => sum + (e.student_count || 0), 0) / 
                  Math.max(evaluations.length, 1)
                )}
              </p>
            </div>
            <div className="bg-purple-500/20 p-3 rounded-xl">
              <Users className="h-6 w-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Evaluations List */}
      <div className="glass-card rounded-xl overflow-hidden">
        {filteredEvaluations.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="mx-auto h-12 w-12 text-light/40" />
            <h3 className="mt-2 text-sm font-medium text-light">No hay evaluaciones</h3>
            <p className="mt-1 text-sm text-light/70">
              {searchTerm || selectedCourse || selectedType 
                ? 'No se encontraron evaluaciones con los filtros aplicados.'
                : 'Comienza creando tu primera evaluación.'}
            </p>
            {!searchTerm && !selectedCourse && !selectedType && (
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="glass-button px-4 py-2 rounded-lg flex items-center gap-2 mx-auto text-light font-semibold"
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
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-light/70 uppercase tracking-wider">
                    Evaluación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-light/70 uppercase tracking-wider">
                    Curso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-light/70 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-light/70 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-light/70 uppercase tracking-wider">
                    Estadísticas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-light/70 uppercase tracking-wider">
                    Duración
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-light/70 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredEvaluations.map((evaluation) => (
                  <tr key={evaluation.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-light">
                          {evaluation.title}
                        </div>
                        {evaluation.description && (
                          <div className="text-sm text-light/70 truncate max-w-xs">
                            {evaluation.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-light">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-light/70">
                      <div>
                        <div>{evaluation.student_count} estudiantes</div>
                        <div className="text-xs">
                          {evaluation.average_score.toFixed(1)}% promedio
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-light/70">
                      {evaluation.duration_minutes} min
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="text-blue-400 hover:text-blue-300 p-1 rounded transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="text-green-400 hover:text-green-300 p-1 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEvaluation(evaluation)
                            setShowDeleteModal(true)
                          }}
                          className="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
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

      {/* Create Evaluation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-light">Nueva Evaluación</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setFormErrors([])
                  setQuestions([])
                }}
                className="text-light/60 hover:text-light transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {formErrors.length > 0 && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                <ul className="text-red-300 text-sm space-y-1">
                  {formErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <form onSubmit={(e) => { e.preventDefault(); handleCreateEvaluation(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-light mb-2">Título *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light placeholder-light/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Título de la evaluación"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-light mb-2">Curso *</label>
                  <select
                    value={formData.course_id}
                    onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccionar curso</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id} className="bg-gray-800">
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-light mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light placeholder-light/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción de la evaluación"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-light mb-2">Tipo</label>
                  <select
                    value={formData.evaluation_type}
                    onChange={(e) => setFormData({ ...formData, evaluation_type: e.target.value as 'quiz' | 'exam' | 'project' | 'assignment' })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="quiz" className="bg-gray-800">Quiz</option>
                    <option value="exam" className="bg-gray-800">Examen</option>
                    <option value="project" className="bg-gray-800">Proyecto</option>
                    <option value="assignment" className="bg-gray-800">Tarea</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-light mb-2">Duración (min)</label>
                  <input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-light mb-2">Intentos</label>
                  <input
                    type="number"
                    value={formData.attempts_allowed}
                    onChange={(e) => setFormData({ ...formData, attempts_allowed: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-light mb-2">Fecha de inicio</label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-light mb-2">Fecha de fin</label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-light mb-2">Puntuación mínima (%)</label>
                  <input
                    type="number"
                    value={formData.passing_score}
                    onChange={(e) => setFormData({ ...formData, passing_score: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-light mb-2">Puntuación máxima</label>
                  <input
                    type="number"
                    value={formData.max_score}
                    onChange={(e) => setFormData({ ...formData, max_score: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-light mb-2">Instrucciones</label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-light placeholder-light/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Instrucciones para los estudiantes"
                  rows={3}
                />
              </div>
              
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-light">
                  <input
                    type="checkbox"
                    checked={formData.show_results}
                    onChange={(e) => setFormData({ ...formData, show_results: e.target.checked })}
                    className="rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                  />
                  Mostrar resultados
                </label>
                
                <label className="flex items-center gap-2 text-light">
                  <input
                    type="checkbox"
                    checked={formData.randomize_questions}
                    onChange={(e) => setFormData({ ...formData, randomize_questions: e.target.checked })}
                    className="rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                  />
                  Aleatorizar preguntas
                </label>
                
                <label className="flex items-center gap-2 text-light">
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    className="rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500"
                  />
                  Publicar inmediatamente
                </label>
              </div>
              
              {/* Questions Section */}
              <div className="mt-6 pt-6 border-t border-white/20">
                <QuestionForm 
                  questions={questions} 
                  onQuestionsChange={setQuestions} 
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setQuestions([])
                  }}
                  className="px-4 py-2 text-light/60 hover:text-light transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !formData.title.trim() || !formData.course_id}
                  className="glass-button px-6 py-2 rounded-lg text-light font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creando...' : 'Crear Evaluación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedEvaluation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass-card rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-light">Confirmar Eliminación</h3>
            <p className="text-light/80 mb-6">
              ¿Estás seguro de que deseas eliminar la evaluación "{selectedEvaluation.title}"?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedEvaluation(null)
                }}
                className="px-4 py-2 text-light/60 hover:text-light transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteEvaluation}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}