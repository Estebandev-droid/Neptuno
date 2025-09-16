import { supabase } from './supabaseClient'

export interface Evaluation {
  id: string
  tenant_id: string
  course_id: string
  instructor_id?: string
  title: string
  description?: string
  evaluation_type: 'quiz' | 'exam' | 'project' | 'assignment'
  duration_minutes: number
  instructions?: string
  start_date?: string
  end_date?: string
  attempts_allowed: number
  show_results: boolean
  randomize_questions: boolean
  passing_score: number
  max_score: number
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface EvaluationQuestion {
  id: string
  evaluation_id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'essay' | 'short_answer'
  options?: Array<{ id: string; text: string }>
  correct_answer?: string
  points: number
  explanation?: string
  order_index: number
  is_required: boolean
  created_at: string
  updated_at: string
}

export interface StudentAnswer {
  id: string
  evaluation_id: string
  question_id: string
  student_id: string
  answer_text?: string
  is_correct?: boolean
  points_earned: number
  feedback?: string
  answered_at: string
  graded_at?: string
  graded_by?: string
}

export interface EvaluationAttempt {
  id: string
  evaluation_id: string
  student_id: string
  attempt_number: number
  started_at: string
  submitted_at?: string
  total_score: number
  max_possible_score: number
  percentage: number
  status: 'in_progress' | 'submitted' | 'graded' | 'expired'
  time_spent_minutes: number
}

export interface EvaluationWithQuestions extends Evaluation {
  questions: EvaluationQuestion[]
}

export interface EvaluationWithInstructor extends Evaluation {
  instructor_name: string | null
}

// =============================================
// CRUD OPERATIONS FOR EVALUATIONS
// =============================================

export async function listEvaluations(courseId?: string): Promise<EvaluationWithInstructor[]> {
  let query = supabase
    .from('evaluations')
    .select(`
      *,
      courses(title)
    `)
    .order('created_at', { ascending: false })

  if (courseId) {
    query = query.eq('course_id', courseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching evaluations:', error)
    throw error
  }

  // Obtener información de los instructores por separado
  if (data && data.length > 0) {
    const instructorIds = data
      .filter(evaluation => evaluation.instructor_id)
      .map(evaluation => evaluation.instructor_id)
    
    if (instructorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', instructorIds)
      
      // Agregar información del instructor a cada evaluación
      const evaluationsWithInstructors = data.map(evaluation => ({
        ...evaluation,
        instructor_name: profiles?.find(p => p.user_id === evaluation.instructor_id)?.full_name || null
      }))
      
      return evaluationsWithInstructors as EvaluationWithInstructor[]
     }
   }
 
    return data.map(evaluation => ({ ...evaluation, instructor_name: null })) as EvaluationWithInstructor[]
}

export async function getEvaluation(id: string) {
  const { data, error } = await supabase
    .from('evaluations')
    .select(`
      *,
      courses(title),
      profiles!evaluations_instructor_id_fkey(full_name)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching evaluation:', error)
    throw error
  }

  return data as Evaluation
}

export async function getEvaluationWithQuestions(id: string, studentId?: string) {
  const { data, error } = await supabase
    .rpc('get_evaluation_with_questions', {
      p_evaluation_id: id,
      p_student_id: studentId
    })

  if (error) {
    console.error('Error fetching evaluation with questions:', error)
    throw error
  }

  return data as EvaluationWithQuestions
}

export async function createEvaluation(evaluation: Omit<Evaluation, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('evaluations')
    .insert([evaluation])
    .select()
    .single()

  if (error) {
    console.error('Error creating evaluation:', error)
    throw error
  }

  return data as Evaluation
}

export async function updateEvaluation(id: string, updates: Partial<Evaluation>) {
  const { data, error } = await supabase
    .from('evaluations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating evaluation:', error)
    throw error
  }

  return data as Evaluation
}

export async function deleteEvaluation(id: string) {
  const { error } = await supabase
    .from('evaluations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting evaluation:', error)
    throw error
  }
}

// =============================================
// CRUD OPERATIONS FOR QUESTIONS
// =============================================

export async function listEvaluationQuestions(evaluationId: string) {
  const { data, error } = await supabase
    .from('evaluation_questions')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching evaluation questions:', error)
    throw error
  }

  return data as EvaluationQuestion[]
}

export async function createEvaluationQuestion(question: Omit<EvaluationQuestion, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('evaluation_questions')
    .insert([question])
    .select()
    .single()

  if (error) {
    console.error('Error creating evaluation question:', error)
    throw error
  }

  return data as EvaluationQuestion
}

export async function updateEvaluationQuestion(id: string, updates: Partial<EvaluationQuestion>) {
  const { data, error } = await supabase
    .from('evaluation_questions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating evaluation question:', error)
    throw error
  }

  return data as EvaluationQuestion
}

export async function deleteEvaluationQuestion(id: string) {
  const { error } = await supabase
    .from('evaluation_questions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting evaluation question:', error)
    throw error
  }
}

// =============================================
// STUDENT EVALUATION OPERATIONS
// =============================================

export async function startEvaluationAttempt(evaluationId: string, studentId: string) {
  const { data, error } = await supabase
    .rpc('start_evaluation_attempt', {
      p_evaluation_id: evaluationId,
      p_student_id: studentId
    })

  if (error) {
    console.error('Error starting evaluation attempt:', error)
    throw error
  }

  return data as string // attempt_id
}

export async function submitStudentAnswer(answer: Omit<StudentAnswer, 'id' | 'answered_at' | 'graded_at' | 'graded_by'>) {
  const { data, error } = await supabase
    .from('student_answers')
    .upsert([answer], {
      onConflict: 'evaluation_id,question_id,student_id'
    })
    .select()
    .single()

  if (error) {
    console.error('Error submitting student answer:', error)
    throw error
  }

  return data as StudentAnswer
}

export async function getStudentAnswers(evaluationId: string, studentId: string) {
  const { data, error } = await supabase
    .from('student_answers')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .eq('student_id', studentId)

  if (error) {
    console.error('Error fetching student answers:', error)
    throw error
  }

  return data as StudentAnswer[]
}

export async function autoGradeEvaluation(attemptId: string) {
  const { data, error } = await supabase
    .rpc('auto_grade_evaluation', {
      p_attempt_id: attemptId
    })

  if (error) {
    console.error('Error auto-grading evaluation:', error)
    throw error
  }

  return data as { total_score: number; max_score: number; percentage: number }
}

export async function getEvaluationAttempts(evaluationId: string, studentId?: string) {
  let query = supabase
    .from('evaluation_attempts')
    .select(`
      *,
      profiles!evaluation_attempts_student_id_fkey(full_name, email)
    `)
    .eq('evaluation_id', evaluationId)
    .order('attempt_number', { ascending: false })

  if (studentId) {
    query = query.eq('student_id', studentId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching evaluation attempts:', error)
    throw error
  }

  return data as EvaluationAttempt[]
}

// =============================================
// GRADING OPERATIONS
// =============================================

export async function gradeStudentAnswer(answerId: string, pointsEarned: number, feedback?: string, gradedBy?: string) {
  const { data, error } = await supabase
    .from('student_answers')
    .update({
      points_earned: pointsEarned,
      feedback,
      graded_by: gradedBy,
      graded_at: new Date().toISOString()
    })
    .eq('id', answerId)
    .select()
    .single()

  if (error) {
    console.error('Error grading student answer:', error)
    throw error
  }

  return data as StudentAnswer
}

export async function getEvaluationResults(evaluationId: string) {
  const { data, error } = await supabase
    .from('evaluation_attempts')
    .select(`
      *,
      profiles!evaluation_attempts_student_id_fkey(full_name, email),
      evaluations(title, max_score, passing_score)
    `)
    .eq('evaluation_id', evaluationId)
    .eq('status', 'graded')
    .order('percentage', { ascending: false })

  if (error) {
    console.error('Error fetching evaluation results:', error)
    throw error
  }

  return data
}

// =============================================
// STATISTICS AND ANALYTICS
// =============================================

export async function getEvaluationStatistics(evaluationId: string) {
  const { data, error } = await supabase
    .from('evaluation_attempts')
    .select('percentage, status')
    .eq('evaluation_id', evaluationId)
    .eq('status', 'graded')

  if (error) {
    console.error('Error fetching evaluation statistics:', error)
    throw error
  }

  const attempts = data || []
  const totalAttempts = attempts.length
  const averageScore = totalAttempts > 0 
    ? attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / totalAttempts 
    : 0
  
  const passedAttempts = attempts.filter(attempt => {
    // Assuming passing score is 60% - this should come from evaluation data
    return attempt.percentage >= 60
  }).length
  
  const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0

  return {
    totalAttempts,
    averageScore: Math.round(averageScore * 100) / 100,
    passRate: Math.round(passRate * 100) / 100,
    passedAttempts
  }
}