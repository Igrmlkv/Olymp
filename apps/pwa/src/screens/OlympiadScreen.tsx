import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { findOlympiadFormat, SubjectSchema, type OlympiadFormat, type Task } from '@olymp/schema'
import { checkAnswer } from '../lib/answer.js'
import { getProfile } from '../lib/profile.js'
import { formatDuration } from '../lib/time.js'
import { minutesWord, pointsWord, tasksWord } from '../lib/plural.js'
import { track } from '../lib/telemetry.js'
import { usePackage } from '../lib/usePackage.js'
import { Markdown } from '../components/Markdown.js'
import { TaskStatement } from '../components/TaskStatement.js'
import { AnswerInput } from '../components/AnswerInput.js'

/**
 * Timed run in the real school-stage format: duration and scoring mode come
 * from the package format, never hardcoded — Sirius and Moscow change them
 * between seasons.
 */
export function OlympiadScreen() {
  const { subject: rawSubject } = useParams()
  const parsed = SubjectSchema.safeParse(rawSubject)
  const subject = parsed.success ? parsed.data : null

  const state = usePackage(subject)
  const [format, setFormat] = useState<OlympiadFormat | null>(null)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (subject === null) return
    void getProfile().then((profile) => {
      if (profile.grade) setFormat(findOlympiadFormat(subject, profile.grade) ?? null)
    })
  }, [subject])

  const tasks: Task[] =
    state.status === 'ready' && format
      ? state.pkg.tasks.slice(0, Math.min(format.task_count ?? state.pkg.tasks.length, state.pkg.tasks.length))
      : []

  /**
   * Score against what this run actually contains, not the official paper's
   * maximum. The archive bank cannot include image-dependent tasks, so a real
   * paper worth 52 points may ship here as 20 — and telling a child they scored
   * "12 из 52" when 20 was the ceiling is simply wrong.
   */
  const availableScore = tasks.reduce((sum, t) => sum + t.points, 0)
  const isFullPaper = format !== null && availableScore === format.max_score

  function finish() {
    if (finished) return
    setFinished(true)
    if (format) {
      void track('olympiad_finished', {
        subject: format.subject,
        grade: format.grade,
        duration_ms: startedAt ? Date.now() - startedAt : undefined,
      })
    }
  }

  if (subject === null) return <p className="screen">Неизвестный предмет.</p>
  if (state.status === 'error') {
    return <p className="screen error">Не получилось загрузить задачи: {state.message}</p>
  }
  if (state.status !== 'ready' || !format) {
    return <p className="screen muted">Загружаем…</p>
  }

  if (startedAt === null) {
    return (
      <main className="screen">
        <Link className="back-link" to="/">
          ← Назад
        </Link>
        <h1>Режим олимпиады</h1>
        <p>
          {format.time_limit_min} {minutesWord(format.time_limit_min)} · {tasks.length}{' '}
          {tasksWord(tasks.length)} · максимум {availableScore} {pointsWord(availableScore)}.
        </p>
        <p className="muted">
          Формат школьного этапа {format.season}
          {isFullPaper
            ? '.'
            : `: полная работа — ${format.max_score} ${pointsWord(format.max_score)}, но часть заданий опирается на рисунки и в приложение пока не вошла.`}
        </p>
        <p className="muted">Таймер запустится сразу. Подсказок в этом режиме нет.</p>
        <button
          className="primary"
          disabled={tasks.length === 0}
          onClick={() => {
            setStartedAt(Date.now())
            void track('olympiad_started', { subject: format.subject, grade: format.grade })
          }}
        >
          Начать
        </button>
      </main>
    )
  }

  const earned = finished
    ? tasks.reduce((sum, t) => sum + (checkAnswer(t.answer, answers[t.id] ?? '') ? t.points : 0), 0)
    : 0

  return (
    <main className="screen">
      <header className="olympiad-header">
        <Countdown
          startedAt={startedAt}
          limitMs={format.time_limit_min * 60_000}
          stopped={finished}
          onExpire={finish}
        />
        {!finished && <button onClick={finish}>Завершить</button>}
      </header>

      {finished && (
        <p className="verdict verdict--ok">
          Готово: {earned} из {availableScore} {pointsWord(availableScore)}.
        </p>
      )}

      <ol className="olympiad-tasks">
        {tasks.map((task, i) => (
          <li key={task.id}>
            <p className="muted">
              Задача {i + 1} · {task.points} {pointsWord(task.points)}
            </p>
            <TaskStatement task={task} />
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

/**
 * Its own component so the per-second tick re-renders two digits instead of the
 * whole paper — re-rendering the list means re-parsing every statement's
 * Markdown, once a second, for an hour.
 *
 * Derived from a deadline rather than a decrementing counter, so a tab that
 * slept does not come back with a stale clock.
 */
function Countdown({
  startedAt,
  limitMs,
  stopped,
  onExpire,
}: {
  startedAt: number
  limitMs: number
  stopped: boolean
  onExpire: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const remainingMs = Math.max(0, startedAt + limitMs - now)

  useEffect(() => {
    if (stopped) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [stopped])

  useEffect(() => {
    if (!stopped && remainingMs === 0) onExpireRef.current()
  }, [stopped, remainingMs])

  return (
    <span className={remainingMs < 5 * 60_000 ? 'timer timer--low' : 'timer'}>
      {formatDuration(remainingMs)}
    </span>
  )
}

export default OlympiadScreen
