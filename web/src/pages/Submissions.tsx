import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import type { Submission } from '../types/submissions'
import { listSubmissions } from '../lib/submissionsService'
import { upsertTaskGrade } from '../lib/gradesService'
import { listTasks } from '../lib/tasksService'
import type { Task } from '../types/tasks'

export default function SubmissionsPage() {
  const [params, setParams] = useSearchParams()
  const initialTaskId = params.get('taskId') || ''
  const [taskId, setTaskId] = useState<string>(initialTaskId)
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Cargar lista de tareas para selección
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', { for: 'submissions-select' }],
    queryFn: () => listTasks({ page: 1, pageSize: 100 }),
  })
  const tasks = useMemo(() => (tasksData?.data ?? []) as Task[], [tasksData])

  // Cargar entregas de la tarea seleccionada
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['submissions', { taskId, search, page, pageSize }],
    queryFn: () => listSubmissions({ taskId, search, page, pageSize }),
    enabled: !!taskId
  })

  const submissions = useMemo(() => data?.data ?? [], [data]) as Submission[]
  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const [grading, setGrading] = useState<Record<string, { score: string; feedback: string }>>({})
  const [rowError, setRowError] = useState<Record<string, string | null>>({})

  const gradeMut = useMutation({
    mutationFn: async ({ studentId, score, feedback }: { studentId: string; score: number; feedback?: string }) => {
      await upsertTaskGrade({ student_id: studentId, task_id: taskId, score, feedback })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
    },
    onError: (err: Error) => {
      // El id se gestiona en el submit handler
      console.error(err)
    }
  })

  const handleGradeSubmit = (s: Submission) => {
    const g = grading[s.id] || { score: '', feedback: '' }
    const scoreNum = parseFloat(g.score)
    if (isNaN(scoreNum)) {
      setRowError(prev => ({ ...prev, [s.id]: 'Puntuación inválida' }))
      return
    }
    gradeMut.mutate(
      { studentId: s.student_id, score: scoreNum, feedback: g.feedback || undefined },
      {
        onError: (err: Error) => setRowError(prev => ({ ...prev, [s.id]: err.message })),
        onSuccess: () => setRowError(prev => ({ ...prev, [s.id]: null })),
      }
    )
  }

  // Sincronizar URL cuando cambia la tarea seleccionada
  useEffect(() => {
    if (taskId) {
      setParams({ taskId }, { replace: true })
    }
  }, [taskId, setParams])

  return (
    <div className="py-6">
      <div className="flex flex-col gap-4 mb-6">
        <h2 className="text-xl font-bold">Entregas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <select
            className="glass-input px-3 py-2 rounded-lg"
            value={taskId}
            onChange={(e) => { setTaskId(e.target.value); setPage(1); }}
          >
            <option value="">Selecciona una tarea</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <input
            className="glass-input px-3 py-2 rounded-lg"
            placeholder="Buscar por contenido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!taskId && (
          <p className="text-sm text-light/70">Elige una tarea para ver sus entregas.</p>
        )}
      </div>

      {!taskId ? null : isLoading ? (
        <div className="text-center py-8">Cargando entregas...</div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">Error: {(error as Error).message}</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto scrollbar-styled">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-3">Estudiante</th>
                  <th className="text-left p-3">Contenido</th>
                  <th className="text-left p-3">Archivo</th>
                  <th className="text-left p-3">Entregado</th>
                  <th className="text-left p-3">Calificado</th>
                  <th className="text-left p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-t border-white/10">
                    <td className="p-3 text-sm">{s.student_id}</td>
                    <td className="p-3 text-sm max-w-md">
                      {s.content ? <div className="line-clamp-3 whitespace-pre-wrap">{s.content}</div> : <span className="text-light/60">Sin contenido</span>}
                    </td>
                    <td className="p-3 text-sm">
                      {s.file_url ? (
                        <a href={s.file_url} target="_blank" rel="noreferrer" className="text-primary underline">Ver archivo</a>
                      ) : (
                        <span className="text-light/60">Sin archivo</span>
                      )}
                    </td>
                    <td className="p-3 text-sm">{s.submitted_at ? new Date(s.submitted_at).toLocaleString('es-ES') : '-'}</td>
                    <td className="p-3 text-sm">{s.graded_at ? new Date(s.graded_at).toLocaleString('es-ES') : <span className="text-light/60">Sin calificar</span>}</td>
                    <td className="p-3">
                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                        <input
                          type="number"
                          className="glass-input px-2 py-1 rounded w-24"
                          placeholder="Puntaje"
                          value={grading[s.id]?.score ?? ''}
                          onChange={(e) => setGrading(prev => ({ ...prev, [s.id]: { ...(prev[s.id] || { feedback: '' }), score: e.target.value } }))}
                          min="0"
                          step="0.01"
                        />
                        <input
                          type="text"
                          className="glass-input px-2 py-1 rounded flex-1 min-w-0"
                          placeholder="Feedback (opcional)"
                          value={grading[s.id]?.feedback ?? ''}
                          onChange={(e) => setGrading(prev => ({ ...prev, [s.id]: { ...(prev[s.id] || { score: '' }), feedback: e.target.value } }))}
                        />
                        <button
                          className="glass-button px-3 py-1 rounded"
                          onClick={() => handleGradeSubmit(s)}
                          disabled={gradeMut.isPending}
                        >
                          {gradeMut.isPending ? 'Guardando...' : 'Calificar'}
                        </button>
                      </div>
                      {rowError[s.id] && <p className="text-red-500 text-xs mt-1">{rowError[s.id]}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {taskId && totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            className="px-3 py-1 rounded glass-card disabled:opacity-50"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
          >
            Anterior
          </button>
          <span className="px-3 py-1">
            Página {page} de {totalPages} ({total} entregas)
          </span>
          <button
            className="px-3 py-1 rounded glass-card disabled:opacity-50"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}