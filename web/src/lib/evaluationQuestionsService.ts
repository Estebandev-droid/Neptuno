import { supabase } from './supabaseClient'
import type { EvaluationQuestion } from './evaluationsService'

export interface QuestionOption {
  id: string
  text: string
  isCorrect?: boolean
}

export interface CreateQuestionData {
  evaluation_id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'essay' | 'short_answer'
  options?: QuestionOption[]
  correct_answer?: string
  points: number
  explanation?: string
  order_index: number
  is_required: boolean
}

export interface UpdateQuestionData {
  question_text?: string
  question_type?: 'multiple_choice' | 'true_false' | 'essay' | 'short_answer'
  options?: QuestionOption[]
  correct_answer?: string
  points?: number
  explanation?: string
  order_index?: number
  is_required?: boolean
}

export interface QuestionTemplate {
  id: string
  title: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'essay' | 'short_answer'
  options?: QuestionOption[]
  correct_answer?: string
  points: number
  explanation?: string
  category: string
  tags: string[]
  created_by: string
  created_at: string
}

// =============================================
// QUESTION MANAGEMENT
// =============================================

export async function createQuestion(questionData: CreateQuestionData): Promise<EvaluationQuestion> {
  const { data, error } = await supabase
    .from('evaluation_questions')
    .insert([{
      ...questionData,
      options: questionData.options ? JSON.stringify(questionData.options) : null
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating question:', error)
    throw error
  }

  return {
    ...data,
    options: data.options ? JSON.parse(data.options) : undefined
  } as EvaluationQuestion
}

export async function updateQuestion(questionId: string, updates: UpdateQuestionData): Promise<EvaluationQuestion> {
  const updateData = {
    ...updates,
    options: updates.options ? JSON.stringify(updates.options) : undefined
  }

  const { data, error } = await supabase
    .from('evaluation_questions')
    .update(updateData)
    .eq('id', questionId)
    .select()
    .single()

  if (error) {
    console.error('Error updating question:', error)
    throw error
  }

  return {
    ...data,
    options: data.options ? JSON.parse(data.options) : undefined
  } as EvaluationQuestion
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await supabase
    .from('evaluation_questions')
    .delete()
    .eq('id', questionId)

  if (error) {
    console.error('Error deleting question:', error)
    throw error
  }
}

export async function getQuestion(questionId: string): Promise<EvaluationQuestion> {
  const { data, error } = await supabase
    .from('evaluation_questions')
    .select('*')
    .eq('id', questionId)
    .single()

  if (error) {
    console.error('Error fetching question:', error)
    throw error
  }

  return {
    ...data,
    options: data.options ? JSON.parse(data.options) : undefined
  } as EvaluationQuestion
}

export async function getQuestionsByEvaluation(evaluationId: string): Promise<EvaluationQuestion[]> {
  const { data, error } = await supabase
    .from('evaluation_questions')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching questions:', error)
    throw error
  }

  return data.map(question => ({
    ...question,
    options: question.options ? JSON.parse(question.options) : undefined
  })) as EvaluationQuestion[]
}

// =============================================
// QUESTION ORDERING
// =============================================

export async function reorderQuestions(_evaluationId: string, questionIds: string[]): Promise<void> {
  const updates = questionIds.map((questionId, index) => ({
    id: questionId,
    order_index: index + 1
  }))

  for (const update of updates) {
    const { error } = await supabase
      .from('evaluation_questions')
      .update({ order_index: update.order_index })
      .eq('id', update.id)

    if (error) {
      console.error('Error reordering questions:', error)
      throw error
    }
  }
}

// =============================================
// QUESTION TEMPLATES
// =============================================

export async function createQuestionTemplate(template: Omit<QuestionTemplate, 'id' | 'created_at'>): Promise<QuestionTemplate> {
  const { data, error } = await supabase
    .from('question_templates')
    .insert([{
      ...template,
      options: template.options ? JSON.stringify(template.options) : null,
      tags: JSON.stringify(template.tags)
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating question template:', error)
    throw error
  }

  return {
    ...data,
    options: data.options ? JSON.parse(data.options) : undefined,
    tags: JSON.parse(data.tags)
  } as QuestionTemplate
}

export async function getQuestionTemplates(category?: string, tags?: string[]): Promise<QuestionTemplate[]> {
  let query = supabase
    .from('question_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching question templates:', error)
    throw error
  }

  let templates = data.map(template => ({
    ...template,
    options: template.options ? JSON.parse(template.options) : undefined,
    tags: JSON.parse(template.tags)
  })) as QuestionTemplate[]

  // Filter by tags if provided
  if (tags && tags.length > 0) {
    templates = templates.filter(template => 
      tags.some(tag => template.tags.includes(tag))
    )
  }

  return templates
}

export async function createQuestionFromTemplate(templateId: string, evaluationId: string, orderIndex: number): Promise<EvaluationQuestion> {
  const template = await getQuestionTemplate(templateId)
  
  const questionData: CreateQuestionData = {
    evaluation_id: evaluationId,
    question_text: template.question_text,
    question_type: template.question_type,
    options: template.options,
    correct_answer: template.correct_answer,
    points: template.points,
    explanation: template.explanation,
    order_index: orderIndex,
    is_required: true
  }

  return await createQuestion(questionData)
}

export async function getQuestionTemplate(templateId: string): Promise<QuestionTemplate> {
  const { data, error } = await supabase
    .from('question_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (error) {
    console.error('Error fetching question template:', error)
    throw error
  }

  return {
    ...data,
    options: data.options ? JSON.parse(data.options) : undefined,
    tags: JSON.parse(data.tags)
  } as QuestionTemplate
}

// =============================================
// QUESTION VALIDATION
// =============================================

export function validateQuestion(question: CreateQuestionData | UpdateQuestionData): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if ('question_text' in question && (!question.question_text || question.question_text.trim().length < 5)) {
    errors.push('La pregunta debe tener al menos 5 caracteres')
  }

  if ('points' in question && (question.points === undefined || question.points < 0)) {
    errors.push('Los puntos deben ser un número positivo')
  }

  if ('question_type' in question && question.question_type === 'multiple_choice') {
    if (!question.options || question.options.length < 2) {
      errors.push('Las preguntas de opción múltiple deben tener al menos 2 opciones')
    }
    
    if (question.options && !question.correct_answer) {
      errors.push('Debe especificar la respuesta correcta')
    }
  }

  if ('question_type' in question && question.question_type === 'true_false') {
    if (!question.correct_answer || !['true', 'false'].includes(question.correct_answer)) {
      errors.push('Las preguntas verdadero/falso deben tener una respuesta correcta válida')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// =============================================
// BULK OPERATIONS
// =============================================

export async function bulkCreateQuestions(questions: CreateQuestionData[]): Promise<EvaluationQuestion[]> {
  const questionsToInsert = questions.map(question => ({
    ...question,
    options: question.options ? JSON.stringify(question.options) : null
  }))

  const { data, error } = await supabase
    .from('evaluation_questions')
    .insert(questionsToInsert)
    .select()

  if (error) {
    console.error('Error bulk creating questions:', error)
    throw error
  }

  return data.map(question => ({
    ...question,
    options: question.options ? JSON.parse(question.options) : undefined
  })) as EvaluationQuestion[]
}

export async function bulkDeleteQuestions(questionIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('evaluation_questions')
    .delete()
    .in('id', questionIds)

  if (error) {
    console.error('Error bulk deleting questions:', error)
    throw error
  }
}

// =============================================
// QUESTION STATISTICS
// =============================================

export async function getQuestionStatistics(questionId: string): Promise<{
  totalAnswers: number
  correctAnswers: number
  averageScore: number
  difficulty: 'easy' | 'medium' | 'hard'
}> {
  const { data, error } = await supabase
    .from('student_answers')
    .select('is_correct, points_earned')
    .eq('question_id', questionId)
    .not('is_correct', 'is', null)

  if (error) {
    console.error('Error fetching question statistics:', error)
    throw error
  }

  const totalAnswers = data.length
  const correctAnswers = data.filter(answer => answer.is_correct).length
  const averageScore = totalAnswers > 0 
    ? data.reduce((sum, answer) => sum + (answer.points_earned || 0), 0) / totalAnswers
    : 0

  const correctPercentage = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0
  
  let difficulty: 'easy' | 'medium' | 'hard'
  if (correctPercentage >= 80) {
    difficulty = 'easy'
  } else if (correctPercentage >= 50) {
    difficulty = 'medium'
  } else {
    difficulty = 'hard'
  }

  return {
    totalAnswers,
    correctAnswers,
    averageScore: Math.round(averageScore * 100) / 100,
    difficulty
  }
}