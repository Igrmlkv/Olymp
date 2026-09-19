import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { SubjectSchema, type Task } from '@olymp/schema'
import { ensurePackage, tasksByTopic } from '../lib/content.js'
import { checkAnswer } from '../lib/answer.js'
import { getProfile } from '../lib/profile.js'
import { db } from '../lib/db.js'
import { recordActivity } from '../lib/streak.js'
import { track } from '../lib/telemetry.js'

type Phase = 'solving' | 'correct' | 'wrong'

/**
 * The core loop: statement → attempt → hint ladder → solution → next task.
 * Hints are revealed one at a time and never jump straight to the answer.
 */
export function TaskScreen() {
  const { subject: rawSubject, topic } = useParams()
  const subject = SubjectSchema.safeParse(rawSubject)

  const [tasks, setTasks] = useState<Task[]>([])
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [hintsShown, setHintsShown] = useState(0)
  const [phase, setPhase] = useState<Phase>('solving')
  const [showSolution, setShowSolution] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())

  const task = tasks[index]

  useEffect(() => {
    if (!subject.success || !topic) return
    void (async () => {
      const profile = await getProfile()
      if (!profile.grade) return
      const pkg = await ensurePackage(subject.data, profile.grade)
      setTasks(tasksByTopic(pkg.payload, topic))
    })()
  }, [rawSubject, topic])

  const attribution = useMemo(() => task?.source_attribution ?? null, [task])

  async function submit() {
    if (!task) return
    const correct = checkAnswer(task.answer, input)
    setPhase(correct ? 'correct' : 'wrong')

    const existing = await db.progress.get(task.id)
    await db.progress.put({
      taskId: task.id,
      subject: task.subject,
      grade: task.grade,
      topic: task.topic,
      level: task.level,
      attempts: (existing?.attempts ?? 0) + 1,
      hintsUsed: Math.max(existing?.hintsUsed ?? 0, hintsShown),
      solvedAt: correct ? new Date().toISOString() : (existing?.solvedAt ?? null),
      lastAttemptAt: new Date().toISOString(),
    })

    await track(correct ? 'task_solved' : 'task_attempted', {
      subject: task.subject,
      grade: task.grade,
      topic: task.topic,
      level: task.level,
      task_id: task.id,
      attempt_count: Math.min((existing?.attempts ?? 0) + 1, 50),
      duration_ms: Math.min(Date.now() - startedAt, 3_600_000),
      correct,
    })

    if (correct) await recordActivity()
  }

  function revealHint() {
    if (!task) return
    setHintsShown((n) => Math.min(n + 1, task.hints.length))
    void track('hint_used', { subject: task.subject, grade: task.grade, topic: task.topic, task_id: task.id })
  }

  function next() {
    setIndex((i) => Math.min(i + 1, tasks.length - 1))
    setInput('')
    setHintsShown(0)
    setPhase('solving')
    setShowSolution(false)
    setStartedAt(Date.now())
  }

  if (!subject.success) return <p className="screen">Неизвестный предмет.</p>
  if (tasks.length === 0) return <p className="screen">Задачи ещё не загружены.</p>
  if (!task) return <p className="screen">Задачи в этой теме закончились.</p>

  return (
    <main className="screen">
      <Link className="back-link" to={`/${subject.data}`}>
        ← К темам
      </Link>

      <p className="muted">
        Уровень {task.level} · задача {index + 1} из {tasks.length}
      </p>

      <article className="statement">{task.statement_md}</article>

      {hintsShown > 0 && (
        <ol className="hints">
          {task.hints.slice(0, hintsShown).map((hint, i) => (
            <li key={i}>{hint}</li>
          ))}
        </ol>
      )}

      <div className="answer-row">
        <label className="visually-hidden" htmlFor="answer">
          Твой ответ
        </label>
        <input
          id="answer"
          className="answer-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Твой ответ"
          inputMode={task.answer.type === 'number' ? 'decimal' : 'text'}
          autoComplete="off"
        />
        <button className="primary" onClick={() => void submit()} disabled={input.trim() === ''}>
          Проверить
        </button>
      </div>

      {phase === 'correct' && <p className="verdict verdict--ok">Верно! +{task.points}</p>}
      {phase === 'wrong' && <p className="verdict verdict--no">Пока не сходится. Попробуй подсказку.</p>}

      <div className="task-actions">
        {hintsShown < task.hints.length && (
          <button onClick={revealHint}>Подсказка ({task.hints.length - hintsShown})</button>
        )}
        <button
          onClick={() => {
            setShowSolution(true)
            void track('solution_viewed', { subject: task.subject, grade: task.grade, task_id: task.id })
          }}
        >
          Показать разбор
        </button>
        {index < tasks.length - 1 && (
          <button className="primary" onClick={next}>
            Следующая
          </button>
        )}
      </div>

      {showSolution && <article className="solution">{task.solution_md}</article>}

      {attribution && (
        <footer className="attribution">
          Источник: {attribution.name}, {attribution.year}, школьный этап ·{' '}
          <a href={attribution.url} target="_blank" rel="noreferrer noopener">
            оригинал
          </a>
        </footer>
      )}
    </main>
  )
}
