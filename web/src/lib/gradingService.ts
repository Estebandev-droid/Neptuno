import { supabase } from './supabaseClient'
import { 
  getStudentAnswers, 
  getEvaluationWithQuestions,
  type StudentAnswer,
  type EvaluationQuestion 
} from './evaluationsService'

export interface GradingResult {
  questionId: string
  isCorrect: boolean
  pointsEarned: number
  maxPoints: number
  feedback?: string
}

export interface EvaluationGradingResult {
  attemptId: string
  totalScore: number
  maxScore: number
  percentage: number
  gradingResults: GradingResult[]
  gradedAt: string
}

// =============================================
// AUTO-GRADING FUNCTIONS
// =============================================

export async function autoGradeMultipleChoice(
  question: EvaluationQuestion, 
  answer: StudentAnswer
): Promise<GradingResult> {
  let isCorrect = false
  let pointsEarned = 0
  let feedback = ''

  if (answer.answer_text && question.options) {
    // Find the selected option
    const selectedOption = question.options.find(opt => opt.text === answer.answer_text)
    
    if (selectedOption) {
      // Check if the selected option is correct
      isCorrect = selectedOption.id === question.correct_answer
      
      pointsEarned = isCorrect ? question.points : 0
      
      if (isCorrect) {
        feedback = '¡Correcto!'
      } else {
        const correctOption = question.options.find(opt => 
          opt.id === question.correct_answer
        )
        feedback = correctOption 
          ? `Incorrecto. La respuesta correcta es: ${correctOption.text}`
          : 'Incorrecto.'
      }
      
      if (question.explanation) {
        feedback += ` ${question.explanation}`
      }
    } else {
      feedback = 'Respuesta no válida.'
    }
  } else {
    feedback = 'No se proporcionó respuesta.'
  }

  return {
    questionId: question.id,
    isCorrect,
    pointsEarned,
    maxPoints: question.points,
    feedback
  }
}

export async function autoGradeTrueFalse(
  question: EvaluationQuestion, 
  answer: StudentAnswer
): Promise<GradingResult> {
  let isCorrect = false
  let pointsEarned = 0
  let feedback = ''

  if (answer.answer_text) {
    const studentAnswer = answer.answer_text.toLowerCase()
    const correctAnswer = question.correct_answer?.toLowerCase()
    
    isCorrect = studentAnswer === correctAnswer
    pointsEarned = isCorrect ? question.points : 0
    
    if (isCorrect) {
      feedback = '¡Correcto!'
    } else {
      feedback = `Incorrecto. La respuesta correcta es: ${correctAnswer === 'true' ? 'Verdadero' : 'Falso'}`
    }
    
    if (question.explanation) {
      feedback += ` ${question.explanation}`
    }
  } else {
    feedback = 'No se proporcionó respuesta.'
  }

  return {
    questionId: question.id,
    isCorrect,
    pointsEarned,
    maxPoints: question.points,
    feedback
  }
}

export async function autoGradeShortAnswer(
  question: EvaluationQuestion, 
  answer: StudentAnswer
): Promise<GradingResult> {
  // For short answers, we can only do basic validation
  // Manual grading will be required for proper evaluation
  
  let pointsEarned = 0
  let feedback = 'Respuesta registrada. Pendiente de calificación manual.'
  
  // Basic validation - check if answer is provided
  const hasAnswer = answer.answer_text && answer.answer_text.trim().length > 0
  
  if (!hasAnswer) {
    feedback = 'No se proporcionó respuesta.'
  } else {
    // If there's a correct answer provided, do basic string matching
    if (question.correct_answer) {
      const studentAnswer = answer.answer_text?.toLowerCase().trim() || ''
      const correctAnswer = question.correct_answer.toLowerCase().trim()
      
      // Exact match
      if (studentAnswer === correctAnswer) {
        pointsEarned = question.points
        feedback = '¡Correcto!'
      }
      // Partial match (contains correct answer)
      else if (studentAnswer.includes(correctAnswer) || correctAnswer.includes(studentAnswer)) {
        pointsEarned = Math.floor(question.points * 0.5) // 50% points for partial match
        feedback = 'Respuesta parcialmente correcta. Requiere revisión manual.'
      }
      else {
        feedback = 'Respuesta registrada. Requiere calificación manual.'
      }
    }
  }

  return {
    questionId: question.id,
    isCorrect: pointsEarned === question.points,
    pointsEarned,
    maxPoints: question.points,
    feedback
  }
}

export async function autoGradeEssay(
  question: EvaluationQuestion, 
  answer: StudentAnswer
): Promise<GradingResult> {
  // Essays require manual grading
  // We can only validate that an answer was provided
  
  let feedback = 'Ensayo registrado. Pendiente de calificación manual.'
  
  const hasAnswer = answer.answer_text && answer.answer_text.trim().length > 0
  
  if (!hasAnswer) {
    feedback = 'No se proporcionó respuesta.'
  } else {
    // Basic word count validation
    const wordCount = answer.answer_text?.trim().split(/\s+/).length || 0
    if (wordCount < 10) {
      feedback = 'Respuesta muy breve. Se recomienda una respuesta más detallada. Pendiente de calificación manual.'
    }
  }

  return {
    questionId: question.id,
    isCorrect: false, // Will be determined by manual grading
    pointsEarned: 0, // Will be assigned by manual grading
    maxPoints: question.points,
    feedback
  }
}

// =============================================
// MAIN GRADING FUNCTION
// =============================================

export async function autoGradeEvaluationAttempt(
  evaluationId: string, 
  studentId: string, 
  attemptId: string
): Promise<EvaluationGradingResult> {
  try {
    // Get evaluation with questions
    const evaluation = await getEvaluationWithQuestions(evaluationId)
    
    // Get student answers
    const studentAnswers = await getStudentAnswers(evaluationId, studentId)
    
    // Grade each question
    const gradingResults: GradingResult[] = []
    
    for (const question of evaluation.questions) {
      const answer = studentAnswers.find(a => a.question_id === question.id)
      
      if (!answer) {
        // No answer provided
        gradingResults.push({
          questionId: question.id,
          isCorrect: false,
          pointsEarned: 0,
          maxPoints: question.points,
          feedback: 'No se proporcionó respuesta.'
        })
        continue
      }
      
      let result: GradingResult
      
      switch (question.question_type) {
        case 'multiple_choice':
          result = await autoGradeMultipleChoice(question, answer)
          break
        case 'true_false':
          result = await autoGradeTrueFalse(question, answer)
          break
        case 'short_answer':
          result = await autoGradeShortAnswer(question, answer)
          break
        case 'essay':
          result = await autoGradeEssay(question, answer)
          break
        default:
          result = {
            questionId: question.id,
            isCorrect: false,
            pointsEarned: 0,
            maxPoints: question.points,
            feedback: 'Tipo de pregunta no soportado para calificación automática.'
          }
      }
      
      gradingResults.push(result)
      
      // Update the student answer with grading results
      await supabase
        .from('student_answers')
        .update({
          is_correct: result.isCorrect,
          points_earned: result.pointsEarned,
          feedback: result.feedback,
          graded_at: new Date().toISOString()
        })
        .eq('id', answer.id)
    }
    
    // Calculate total score
    const totalScore = gradingResults.reduce((sum, result) => sum + result.pointsEarned, 0)
    const maxScore = gradingResults.reduce((sum, result) => sum + result.maxPoints, 0)
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
    
    // Update evaluation attempt
    const gradedAt = new Date().toISOString()
    
    await supabase
      .from('evaluation_attempts')
      .update({
        total_score: totalScore,
        max_possible_score: maxScore,
        percentage: percentage,
        status: 'graded',
        submitted_at: gradedAt
      })
      .eq('id', attemptId)
    
    return {
      attemptId,
      totalScore,
      maxScore,
      percentage,
      gradingResults,
      gradedAt
    }
    
  } catch (error) {
    console.error('Error auto-grading evaluation:', error)
    throw error
  }
}

// =============================================
// MANUAL GRADING FUNCTIONS
// =============================================

export async function manualGradeAnswer(
  answerId: string,
  pointsEarned: number,
  feedback: string,
  gradedBy: string
): Promise<void> {
  try {
    await supabase
      .from('student_answers')
      .update({
        points_earned: pointsEarned,
        feedback,
        graded_by: gradedBy,
        graded_at: new Date().toISOString()
      })
      .eq('id', answerId)
  } catch (error) {
    console.error('Error manually grading answer:', error)
    throw error
  }
}

// Interface for the joined query result
interface AnswerWithQuestionPoints {
  points_earned: number | null;
  evaluation_questions: {
    points: number;
  }[];
}

export async function recalculateAttemptScore(attemptId: string): Promise<void> {
  try {
    // Get all answers for this attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('evaluation_attempts')
      .select('evaluation_id, student_id')
      .eq('id', attemptId)
      .single()
    
    if (attemptError) throw attemptError
    
    const { data: answers, error: answersError } = await supabase
      .from('student_answers')
      .select('points_earned, evaluation_questions!inner(points)')
      .eq('evaluation_id', attempt.evaluation_id)
      .eq('student_id', attempt.student_id)
    
    if (answersError) throw answersError
    
    // Calculate totals
    const totalScore = answers.reduce((sum, answer) => sum + (answer.points_earned || 0), 0)
    const maxScore = (answers as AnswerWithQuestionPoints[]).reduce((sum, answer) => {
      let questionPoints = 0;
      if (answer.evaluation_questions && answer.evaluation_questions.length > 0) {
        questionPoints = answer.evaluation_questions[0].points || 0;
      }
      return sum + questionPoints;
    }, 0)
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
    
    // Update attempt
    await supabase
      .from('evaluation_attempts')
      .update({
        total_score: totalScore,
        max_possible_score: maxScore,
        percentage: percentage
      })
      .eq('id', attemptId)
      
  } catch (error) {
    console.error('Error recalculating attempt score:', error)
    throw error
  }
}

// =============================================
// GRADING ANALYTICS
// =============================================

export async function getGradingStatistics(evaluationId: string) {
  try {
    const { data: attempts, error } = await supabase
      .from('evaluation_attempts')
      .select('total_score, max_possible_score, percentage, status')
      .eq('evaluation_id', evaluationId)
      .eq('status', 'graded')
    
    if (error) throw error
    
    const totalAttempts = attempts.length
    
    if (totalAttempts === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        averagePercentage: 0,
        highestScore: 0,
        lowestScore: 0,
        passRate: 0
      }
    }
    
    const scores = attempts.map(a => a.total_score)
    const percentages = attempts.map(a => a.percentage)
    
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / totalAttempts
    const averagePercentage = percentages.reduce((sum, pct) => sum + pct, 0) / totalAttempts
    const highestScore = Math.max(...scores)
    const lowestScore = Math.min(...scores)
    
    // Assuming 60% is passing grade
    const passedAttempts = attempts.filter(a => a.percentage >= 60).length
    const passRate = (passedAttempts / totalAttempts) * 100
    
    return {
      totalAttempts,
      averageScore: Math.round(averageScore * 100) / 100,
      averagePercentage: Math.round(averagePercentage * 100) / 100,
      highestScore,
      lowestScore,
      passRate: Math.round(passRate * 100) / 100
    }
    
  } catch (error) {
    console.error('Error getting grading statistics:', error)
    throw error
  }
}

export async function getQuestionAnalytics(questionId: string) {
  try {
    const { data: answers, error } = await supabase
      .from('student_answers')
      .select('is_correct, points_earned, answer_text')
      .eq('question_id', questionId)
      .not('points_earned', 'is', null)
    
    if (error) throw error
    
    const totalAnswers = answers.length
    
    if (totalAnswers === 0) {
      return {
        totalAnswers: 0,
        correctAnswers: 0,
        correctPercentage: 0,
        averagePoints: 0,
        difficulty: 'unknown' as const
      }
    }
    
    const correctAnswers = answers.filter(a => a.is_correct).length
    const correctPercentage = (correctAnswers / totalAnswers) * 100
    const averagePoints = answers.reduce((sum, a) => sum + (a.points_earned || 0), 0) / totalAnswers
    
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
      correctPercentage: Math.round(correctPercentage * 100) / 100,
      averagePoints: Math.round(averagePoints * 100) / 100,
      difficulty
    }
    
  } catch (error) {
    console.error('Error getting question analytics:', error)
    throw error
  }
}