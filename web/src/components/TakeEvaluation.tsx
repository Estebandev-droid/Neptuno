import { useState, useEffect, useCallback } from 'react'
import { Clock, AlertCircle, CheckCircle, ArrowRight, ArrowLeft, Flag } from 'lucide-react'
import {
  getEvaluationWithQuestions,
  startEvaluationAttempt,
  submitStudentAnswer,
  autoGradeEvaluation,
  type EvaluationWithQuestions,
  type EvaluationQuestion
} from '../lib/evaluationsService'
import { useAuth } from '../hooks/useAuth'

interface TakeEvaluationProps {
  evaluationId: string
  onComplete: (score: number, maxScore: number) => void
}

interface Answer {
  questionId: string
  answerText: string
  selectedOptions?: string[]
}

export default function TakeEvaluation({ evaluationId, onComplete }: TakeEvaluationProps) {
  const { user } = useAuth()
  const [evaluation, setEvaluation] = useState<EvaluationWithQuestions | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set())

  // Load evaluation and start attempt
  useEffect(() => {
    const initializeEvaluation = async () => {
      if (!user) return
      
      try {
        setLoading(true)
        
        // Load evaluation with questions
        const evalData = await getEvaluationWithQuestions(evaluationId, user.id)
        setEvaluation(evalData)
        
        // Start attempt
        const newAttemptId = await startEvaluationAttempt(evaluationId, user.id)
        setAttemptId(newAttemptId)
        
        // Set timer
        setTimeRemaining(evalData.duration_minutes * 60)
        
      } catch (error) {
        console.error('Error initializing evaluation:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeEvaluation()
  }, [evaluationId, user])

  const handleSubmitAnswer = useCallback(async (questionId: string) => {
    if (!user || !attemptId) return
    
    const answer = answers[questionId]
    if (!answer) return

    try {
      await submitStudentAnswer({
        evaluation_id: evaluationId,
        question_id: questionId,
        student_id: user.id,
        answer_text: answer.answerText,
        points_earned: 0 // Will be calculated by auto-grading
      })
    } catch (error) {
      console.error('Error submitting answer:', error)
    }
  }, [user, attemptId, answers, evaluationId])

  const handleSubmitEvaluation = useCallback(async () => {
    if (!attemptId || submitting) return
    
    try {
      setSubmitting(true)
      
      // Submit all answers
      const submitPromises = Object.values(answers).map(answer => 
        handleSubmitAnswer(answer.questionId)
      )
      await Promise.all(submitPromises)
      
      // Auto-grade evaluation
      const result = await autoGradeEvaluation(attemptId)
      
      onComplete(result.total_score, result.max_score)
    } catch (error) {
      console.error('Error submitting evaluation:', error)
    } finally {
      setSubmitting(false)
    }
  }, [attemptId, submitting, answers, handleSubmitAnswer, onComplete])

  const handleAutoSubmit = useCallback(async () => {
    if (!attemptId || submitting) return
    await handleSubmitEvaluation()
  }, [attemptId, submitting, handleSubmitEvaluation])

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0 || !evaluation) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleAutoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, evaluation, handleAutoSubmit])

  const handleAnswerChange = (questionId: string, answerData: Partial<Answer>) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        questionId,
        ...answerData
      }
    }))
  }

  const toggleQuestionFlag = (questionId: string) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getAnsweredCount = () => {
    return Object.keys(answers).filter(questionId => {
      const answer = answers[questionId]
      return answer && (answer.answerText?.trim() || answer.selectedOptions?.length)
    }).length
  }

  const renderQuestion = (question: EvaluationQuestion) => {
    const answer = answers[question.id] || { questionId: question.id, answerText: '', selectedOptions: [] }

    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <label key={option.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={answer.selectedOptions?.includes(option.id)}
                  onChange={(e) => {
                    handleAnswerChange(question.id, {
                      selectedOptions: [e.target.value],
                      answerText: option.text
                    })
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">{option.text}</span>
              </label>
            ))}
          </div>
        )

      case 'true_false':
        return (
          <div className="space-y-3">
            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name={`question-${question.id}`}
                value="true"
                checked={answer.answerText === 'true'}
                onChange={() => handleAnswerChange(question.id, { answerText: 'true' })}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">Verdadero</span>
            </label>
            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name={`question-${question.id}`}
                value="false"
                checked={answer.answerText === 'false'}
                onChange={() => handleAnswerChange(question.id, { answerText: 'false' })}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">Falso</span>
            </label>
          </div>
        )

      case 'short_answer':
        return (
          <textarea
            value={answer.answerText || ''}
            onChange={(e) => handleAnswerChange(question.id, { answerText: e.target.value })}
            placeholder="Escribe tu respuesta aquí..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        )

      case 'essay':
        return (
          <textarea
            value={answer.answerText || ''}
            onChange={(e) => handleAnswerChange(question.id, { answerText: e.target.value })}
            placeholder="Desarrolla tu respuesta de forma detallada..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={8}
          />
        )

      default:
        return <div className="text-gray-500">Tipo de pregunta no soportado</div>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Error al cargar la evaluación</h3>
        <p className="mt-1 text-sm text-gray-500">No se pudo cargar la evaluación. Inténtalo de nuevo.</p>
      </div>
    )
  }

  const currentQuestion = evaluation.questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === evaluation.questions.length - 1
  const isFirstQuestion = currentQuestionIndex === 0

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{evaluation.title}</h1>
            {evaluation.description && (
              <p className="text-gray-600 mt-1">{evaluation.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className={`text-lg font-mono ${timeRemaining < 300 ? 'text-red-600' : 'text-gray-900'}`}>
              <Clock className="inline h-5 w-5 mr-1" />
              {formatTime(timeRemaining)}
            </div>
            <div className="text-sm text-gray-500">
              {getAnsweredCount()} de {evaluation.questions.length} respondidas
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / evaluation.questions.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-500">
                Pregunta {currentQuestionIndex + 1} de {evaluation.questions.length}
              </span>
              {currentQuestion.is_required && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">Obligatoria</span>
              )}
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {currentQuestion.points} {currentQuestion.points === 1 ? 'punto' : 'puntos'}
              </span>
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {currentQuestion.question_text}
            </h2>
          </div>
          <button
            onClick={() => toggleQuestionFlag(currentQuestion.id)}
            className={`p-2 rounded-lg ${flaggedQuestions.has(currentQuestion.id) 
              ? 'bg-yellow-100 text-yellow-600' 
              : 'bg-gray-100 text-gray-400 hover:text-gray-600'
            }`}
            title="Marcar para revisar"
          >
            <Flag className="h-4 w-4" />
          </button>
        </div>
        
        {renderQuestion(currentQuestion)}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={isFirstQuestion}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </button>

        <div className="flex gap-2">
          {evaluation.questions.map((_, index) => {
            const questionId = evaluation.questions[index].id
            const isAnswered = answers[questionId] && (answers[questionId].answerText?.trim() || answers[questionId].selectedOptions?.length)
            const isFlagged = flaggedQuestions.has(questionId)
            
            return (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-8 h-8 rounded-full text-xs font-medium relative ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : isAnswered
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {index + 1}
                {isFlagged && (
                  <Flag className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500" />
                )}
              </button>
            )
          })}
        </div>

        {isLastQuestion ? (
          <button
            onClick={() => setShowConfirmSubmit(true)}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            Finalizar
          </button>
        ) : (
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.min(evaluation.questions.length - 1, prev + 1))}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Siguiente
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Confirm Submit Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirmar entrega
            </h3>
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-600">
                ¿Estás seguro de que deseas entregar la evaluación?
              </p>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span>Preguntas respondidas:</span>
                    <span className="font-medium">{getAnsweredCount()} de {evaluation.questions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tiempo restante:</span>
                    <span className="font-medium">{formatTime(timeRemaining)}</span>
                  </div>
                  {flaggedQuestions.size > 0 && (
                    <div className="flex justify-between text-yellow-600">
                      <span>Preguntas marcadas:</span>
                      <span className="font-medium">{flaggedQuestions.size}</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Una vez entregada, no podrás modificar tus respuestas.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitEvaluation}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Entregando...' : 'Entregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}