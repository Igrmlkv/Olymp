import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { findOlympiadFormat, SubjectSchema, type OlympiadFormat, type Task } from '@olymp/schema'
import { ensurePackage } from '../lib/content.js'
import { checkAnswer } from '../lib/answer.js'
import { getProfile } from '../lib/profile.js'
import { formatDuration } from '../lib/time.js'
import { track } from '../lib/telemetry.js'
import { Markdown } from '../components/Markdown.js'
import { AnswerInput } from '../components/AnswerInput.js'

/**
 * Timed run in the real school-stage format: duration, max score and scoring
 * mode all come from the package format, never hardcoded — Sirius and Moscow
 * change them between seasons.
 */
export function OlympiadScreen() {
  const { subject: rawSubject } = useParams()
  const subject = SubjectSchema.safeParse(rawSubject)

  const [format, setFormat] = useState<OlympiadFormat | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const startedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!subject.success) return
    void (async () => {
      const profile = await getProfile()
      if (!profile.grade) return
      const fmt = findOlympiadFormat(subject.data, profile.grade)
      if (!fmt) return
      setFormat(fmt)
      const pkg = await ensurePackage(subject.data, profile.grade)
      const count = fmt.task_count ?? 8
      setTasks(pkg.payload.tasks.slice(0, count))
    })()
  }, [rawSubject])

  useEffect(() => {
    if (remainingMs === null || finished) return
    const timer = setInterval(() => {
      setRemainingMs((ms) => {
        if (ms === null) return null
        if (ms <= 1000) {
          setFinished(true)
          return 0
        }
        return ms - 1000
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [remainingMs !== null, finished])

  function start() {
    if (!format) return
    startedAt.current = Date.now()
    setRemainingMs(format.time_limit_min * 60_000)
    void track('olympiad_started', { subject: format.subject, grade: format.grade })
  }

  function finish() {
    setFinished(true)
    if (format) {
      void track('olympiad_finished', {
        subject: format.subject,
        grade: format.grade,
        duration_ms: startedAt.current ? Math.min(Date.now() - startedAt.current, 3_600_000) : undefined,
      })
    }
  }

  const earned = tasks.reduce(
    (sum, t) => sum + (checkAnswer(t.answer, answers[t.id] ?? '') ? t.points : 0),
    0,
  )

  if (!subject.success) return <p className="screen">Неизвестный предмет.</p>
  if (!format) return <p className="screen">Для твоего класса режим олимпиады пока не настроен.</p>

  if (remainingMs === null) {
    return (
      <main className="screen">
        <Link className="back-link" to="/">
          ← Назад
        </Link>
        <h1>Режим олимпиады</h1>
        <p>
          {format.time_limit_min} минут · максимум {format.max_score} баллов · формат школьного этапа{' '}
          {format.season}.
        </p>
        <p className="muted">Таймер запустится сразу. Подсказок в этом режиме нет.</p>
        <button className="primary" onClick={start} disabled={tasks.length === 0}>
          Начать
        </button>
      </main>
    )
  }

  return (
    <main className="screen">
      <header className="olympiad-header">
        <span className={remainingMs < 5 * 60_000 ? 'timer timer--low' : 'timer'}>
          {formatDuration(remainingMs)}
        </span>
        {!finished && <button onClick={finish}>Завершить</button>}
      </header>

      {finished && (
        <p className="verdict verdict--ok">
          Готово: {earned} из {format.max_score} баллов.
        </p>
      )}

      <ol className="olympiad-tasks">
        {tasks.map((task, i) => (
          <li key={task.id}>
            <p className="muted">
              Задача {i + 1} · {task.points} б.
            </p>
            <Markdown className="statement">{task.statement_md}</Markdown>
            <AnswerInput
              answer={task.answer}
              value={answers[task.id] ?? ''}
              disabled={finished}
              onChange={(next) => setAnswers((prev) => ({ ...prev, [task.id]: next }))}
              label={`Ответ на задачу ${i + 1}`}
            />
            {finished && <Markdown className="solution">{task.solution_md}</Markdown>}
          </li>
        ))}
      </ol>
    </main>
  )
}
