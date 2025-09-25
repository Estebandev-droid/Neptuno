import { useParams, useNavigate } from 'react-router-dom'
import TakeEvaluation from '../../components/TakeEvaluation'

export default function EvaluationTakePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) return null

  return (
    <div className="max-w-5xl mx-auto p-4">
      <TakeEvaluation
        evaluationId={id}
        onComplete={(score, maxScore) => {
          // Redirigir a Submissions (o dashboard) al terminar
          navigate('/submissions', { replace: true, state: { message: `Tu evaluación ha sido enviada. Puntaje: ${score}/${maxScore}` } })
        }}
      />
    </div>
  )
}