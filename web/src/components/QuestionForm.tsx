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
    const q = { ...newQuestions[questionIndex] }
    const options = [...(q.options || [])]
    const prevValue = options[optionIndex] || ''
    options[optionIndex] = value

    // Mantener sincronizada la respuesta correcta cuando se edita una opción
    let correct_answer = q.correct_answer
    if (q.question_type === 'multiple_choice') {
      if (correct_answer === prevValue) {
        correct_answer = value.trim() ? value : ''
      }
      // Si la respuesta correcta ya no existe entre las opciones válidas, limpiarla
      if (correct_answer && !options.some(opt => (opt || '').trim() === correct_answer)) {
        correct_answer = ''
      }
    }

    newQuestions[questionIndex] = { ...q, options, correct_answer }
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
        <h3 className="text-lg font-semibold text-light">Preguntas de la Evaluación</h3>
        <button
          type="button"
          onClick={addQuestion}
          className="glass-button inline-flex items-center gap-2 px-4 py-2 rounded-lg text-light font-semibold"
        >
          <Plus className="h-4 w-4" />
          Agregar Pregunta
        </button>
      </div>

      {questions.length === 0 && (
        <div className="text-center py-8 text-light/70">
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
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-2">
                <GripVertical className="h-5 w-5 text-light/50 cursor-move" />
              </div>
              
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-light/80">Pregunta {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="glass-button-danger p-2 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Texto de la pregunta
                    </label>
                    <textarea
                      value={question.question_text}
                      onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-light placeholder-light/50 focus:outline-none"
                      rows={3}
                      placeholder="Escribe tu pregunta aquí..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Tipo de pregunta
                    </label>
                    <select
                      value={question.question_type}
                      onChange={(e) => updateQuestion(index, 'question_type', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-light focus:outline-none"
                    >
                      <option value="multiple_choice" className="bg-gray-800">Opción múltiple</option>
                      <option value="true_false" className="bg-gray-800">Verdadero/Falso</option>
                      <option value="short_answer" className="bg-gray-800">Respuesta corta</option>
                      <option value="essay" className="bg-gray-800">Ensayo</option>
                    </select>
                  </div>
                </div>

                {question.question_type === 'multiple_choice' && (
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
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
                            className="accent-[#1DB954]"
                            disabled={!option.trim()}
                            title={!option.trim() ? 'Completa la opción para poder seleccionarla como correcta' : ''}
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                            className="glass-input flex-1 px-3 py-2 rounded-lg text-light placeholder-light/50 focus:outline-none"
                            placeholder={`Opción ${optionIndex + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {question.question_type === 'true_false' && (
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Respuesta correcta
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-light">
                        <input
                          type="radio"
                          name={`tf-${question.id}`}
                          value="true"
                          checked={question.correct_answer === 'true'}
                          onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                          className="accent-[#1DB954]"
                        />
                        Verdadero
                      </label>
                      <label className="flex items-center gap-2 text-light">
                        <input
                          type="radio"
                          name={`tf-${question.id}`}
                          value="false"
                          checked={question.correct_answer === 'false'}
                          onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                          className="accent-[#1DB954]"
                        />
                        Falso
                      </label>
                    </div>
                  </div>
                )}

                {(question.question_type === 'short_answer' || question.question_type === 'essay') && (
                  <div>
                    <label className="block text-sm font-medium text-light/80 mb-2">
                      Respuesta modelo (opcional)
                    </label>
                    <textarea
                      value={question.correct_answer || ''}
                      onChange={(e) => updateQuestion(index, 'correct_answer', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-light placeholder-light/50 focus:outline-none"
                      rows={question.question_type === 'essay' ? 4 : 2}
                      placeholder="Respuesta modelo o criterios de evaluación..."
                    />
                  </div>
                )}

                <div className="w-32">
                  <label className="block text-sm font-medium text-light/80 mb-2">
                    Puntos
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={question.points}
                    onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 1)}
                    className="glass-input w-full px-3 py-2 rounded-lg text-light focus:outline-none"
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