import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { SubjectSchema, type Task } from '@olymp/schema'
import { tasksByTopic } from '../lib/content.js'
import { checkAnswer } from '../lib/answer.js'
import { db } from '../lib/db.js'
import { recordActivity } from '../lib/streak.js'
import { track } from '../lib/telemetry.js'
import { usePackage } from '../lib/usePackage.js'
import { pointsWord } from '../lib/plural.js'
import { Markdown } from '../components/Markdown.js'
import { TaskStatement } from '../components/TaskStatement.js'
import { AnswerInput, hasAnswer } from '../components/AnswerInput.js'

type Phase = 'solving' | 'correct' | 'wrong'

/**
 * One task, addressed by its id. The id lives in the URL rather than in
 * component state, so leaving and coming back lands on the same task and the
 * browser's own back button works between tasks.
 */
export function TaskScreen() {
  const { subject: rawSubject, topic, taskId } = useParams()
  const parsed = SubjectSchema.safeParse(rawSubject)
  const subject = parsed.success ? parsed.data : null
  const state = usePackage(subject)

  if (subject === null) return <p className="screen">Неизвестный предмет.</p>
  if (state.status === 'error') {
    return <p className="screen error">Не получилось загрузить задачи: {state.message}</p>
  }
  if (state.status !== 'ready') return <p className="screen muted">Загружаем задачи…</p>

  const tasks = topic ? tasksByTopic(state.pkg, topic) : []
  const index = tasks.findIndex((t) => t.id === taskId)
  const task = tasks[index]

  if (!task) {
    return (
      <main className="screen">
        <Link className="back-link" to={`/${subject}/${topic}`}>
          ← К списку задач
        </Link>
        <p>Такой задачи в этой теме нет.</p>
      </main>
    )
  }

  const to = (i: number) => `/${subject}/${topic}/${tasks[i]!.id}`

  return (
    <main className="screen">
      <Link className="back-link" to={`/${subject}/${topic}`}>
        ← К списку задач
      </Link>

      <p className="muted">
        Уровень {task.level} · задача {index + 1} из {tasks.length}
      </p>

      {/* Keyed on the task so every per-task state resets itself. */}
      <TaskAttempt
        key={task.id}
        task={task}
        prev={index > 0 ? to(index - 1) : null}
        next={index < tasks.length - 1 ? to(index + 1) : null}
      />
    </main>
  )
}

function TaskAttempt({ task, prev, next }: { task: Task; prev: string | null; next: string | null }) {
  const navigate = useNavigate()
  const [input, setInput] = useState<string | string[]>('')
  const [hintsShown, setHintsShown] = useState(0)
  const [phase, setPhase] = useState<Phase>('solving')
  const [showSolution, setShowSolution] = useState(false)
  const [startedAt] = useState(() => Date.now())

  async function submit() {
    const correct = checkAnswer(task.answer, input)
    setPhase(correct ? 'correct' : 'wrong')

    const existing = await db.progress.get(task.id)
    const attempts = (existing?.attempts ?? 0) + 1

    await Promise.all([
      db.progress.put({
        taskId: task.id,
        subject: task.subject,
        grade: task.grade,
        topic: task.topic,
        level: task.level,
        attempts,
        hintsUsed: Math.max(existing?.hintsUsed ?? 0, hintsShown),
        solvedAt: correct ? new Date().toISOString() : (existing?.solvedAt ?? null),
        lastAttemptAt: new Date().toISOString(),
      }),
      track(correct ? 'task_solved' : 'task_attempted', {
        subject: task.subject,
        grade: task.grade,
        topic: task.topic,
        level: task.level,
        task_id: task.id,
        attempt_count: attempts,
        duration_ms: Date.now() - startedAt,
        correct,
      }),
      correct ? recordActivity() : Promise.resolve(),
    ])
  }

  function revealHint() {
    setHintsShown((n) => Math.min(n + 1, task.hints.length))
    void track('hint_used', {
      subject: task.subject,
      grade: task.grade,
      topic: task.topic,
      task_id: task.id,
    })
  }

  return (
    <>
      <TaskStatement task={task} />

      {hintsShown > 0 && (
        <ol className="hints">
          {task.hints.slice(0, hintsShown).map((hint, i) => (
            <li key={i}>
              <Markdown>{hint}</Markdown>
            </li>
          ))}
        </ol>
      )}

      <div className="answer-row">
        <AnswerInput answer={task.answer} value={input} onChange={setInput} />
        <button className="primary" onClick={() => void submit()} disabled={!hasAnswer(input)}>
          Проверить
        </button>
      </div>

      {phase === 'correct' && (
        <p className="verdict verdict--ok">
          Верно! +{task.points} {pointsWord(task.points)}
        </p>
      )}
      {phase === 'wrong' && <p className="verdict verdict--no">Пока не сходится. Попробуй подсказку.</p>}

      <div className="task-actions">
        {hintsShown < task.hints.length && (
          <button onClick={revealHint}>Подсказка ({task.hints.length - hintsShown})</button>
        )}
        <button
          onClick={() => {
            setShowSolution(true)
            void track('solution_viewed', {
              subject: task.subject,
              grade: task.grade,
              task_id: task.id,
            })
          }}
        >
          Показать разбор
        </button>
      </div>

      {showSolution && <Markdown className="solution">{task.solution_md}</Markdown>}

      <nav className="task-nav">
        <button disabled={prev === null} onClick={() => prev && navigate(prev)}>
          ← Предыдущая
        </button>
        <button className="primary" disabled={next === null} onClick={() => next && navigate(next)}>
          Следующая →
        </button>
      </nav>
    </>
  )
}

export default TaskScreen
