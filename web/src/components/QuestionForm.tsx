import { useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'

export interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay'
  options?: string[]
  correct_answer?: string
  points: number
}

interface QuestionFormProps {
  questions: Question[]
  onQuestionsChange: (questions: Question[]) => void
}

export default function QuestionForm({ questions, onQuestionsChange }: QuestionFormProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const addQuestion = () => {
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
      points: 1
    }
    onQuestionsChange([...questions, newQuestion])
  }

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index)
    onQuestionsChange(newQuestions)
  }

  const updateQuestion = (index: number, field: keyof Question, value: string | string[] | number) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], [field]: value }
    onQuestionsChange(newQuestions)
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions]
    const options = [...(newQuestions[questionIndex].options || [])]
    options[optionIndex] = value
    newQuestions[questionIndex] = { ...newQuestions[questionIndex], options }
    onQuestionsChange(newQuestions)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null) return

    const newQuestions = [...questions]
    const draggedQuestion = newQuestions[draggedIndex]
    newQuestions.splice(draggedIndex, 1)
    newQuestions.splice(dropIndex, 0, draggedQuestion)
    
    onQuestionsChange(newQuestions)
    setDraggedIndex(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Preguntas de la Evaluación</h3>
        <button
          type="button"
          onClick={addQuestion}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar Pregunta
        </button>
      </div>

      {questions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No hay preguntas agregadas. Haz clic en "Agregar Pregunta" para comenzar.</p>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div
            key={question.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-2">
                <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
              </div>
              
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Pregunta {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Texto de la pregunta
                    </label>
                    <textarea
                      value={question.question_text}
                      onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Escribe tu pregunta aquí..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de pregunta
                    </label>
                    <select
                      value={question.question_type}
                      onChange={(e) => updateQuestion(index, 'question_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="multiple_choice">Opción múltiple</option>
                      <option value="true_false">Verdadero/Falso</option>
                      <option value="short_answer">Respuesta corta</option>
                      <option value="essay">Ensayo</option>
                    </select>
                  </div>
                </div>

                {question.question_type === 'multiple_choice' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opciones de respuesta
                    </label>
                    <div className="space-y-2">
                      {question.options?.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={question.correct_answer === option}
                            onChange={() => updateQuestion(index, 'correct_answer', option)}
                            className="text-blue-600"
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`Opción ${optionIndex + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {question.question_type === 'true_false' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Respuesta correcta
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`tf-${question.id}`}
                          value="true"
                          checked={question.correct_answer === 'true'}
                          onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                          className="mr-2 text-blue-600"
                        />
                        Verdadero
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`tf-${question.id}`}
                          value="false"
                          checked={question.correct_answer === 'false'}
                          onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                          className="mr-2 text-blue-600"
                        />
                        Falso
                      </label>
                    </div>
                  </div>
                )}

                {(question.question_type === 'short_answer' || question.question_type === 'essay') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Respuesta modelo (opcional)
                    </label>
                    <textarea
                      value={question.correct_answer || ''}
                      onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={question.question_type === 'essay' ? 4 : 2}
                      placeholder="Respuesta modelo o criterios de evaluación..."
                    />
                  </div>
                )}

                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Puntos
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={question.points}
                    onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}