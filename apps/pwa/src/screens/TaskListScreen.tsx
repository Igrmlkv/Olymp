import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { SubjectSchema, TOPIC_LABELS_RU, type Task, type Topic } from '@olymp/schema'
import { tasksByTopic } from '../lib/content.js'
import { usePackage } from '../lib/usePackage.js'
import { progressFor, stateOf, STATE_LABELS, STATE_MARKS, type TaskState } from '../lib/progress.js'
import { previews } from '../lib/preview.js'
import { tasksWord } from '../lib/plural.js'

/**
 * Every task in the topic, in one list. Without it the only way to reach the
 * fiftieth task was to press "Следующая" forty-nine times, starting over on
 * every visit — the bank grew eightfold and the one-at-a-time screen did not.
 */
export function TaskListScreen() {
  const { subject: rawSubject, topic } = useParams()
  const parsed = SubjectSchema.safeParse(rawSubject)
  const subject = parsed.success ? parsed.data : null

  const state = usePackage(subject)
  const [states, setStates] = useState<Map<string, TaskState>>(new Map())

  const pkg = state.status === 'ready' ? state.pkg : null
  const tasks: Task[] = useMemo(() => (pkg && topic ? tasksByTopic(pkg, topic) : []), [pkg, topic])
  const titles = useMemo(() => previews(tasks.map((t) => t.statement_md)), [tasks])

  useEffect(() => {
    if (tasks.length === 0) return
    let cancelled = false
    void (async () => {
      const progress = await progressFor(tasks.map((t) => t.id))
      if (cancelled) return
      setStates(new Map(tasks.map((t) => [t.id, stateOf(progress.get(t.id))])))
    })()
    return () => {
      cancelled = true
    }
  }, [tasks])

  if (subject === null) return <p className="screen">Неизвестный предмет.</p>
  if (state.status === 'error') {
    return <p className="screen error">Не получилось загрузить задачи: {state.message}</p>
  }
  if (state.status !== 'ready') return <p className="screen muted">Загружаем задачи…</p>

  const solved = [...states.values()].filter((s) => s === 'solved').length

  return (
    <main className="screen">
      <Link className="back-link" to={`/${subject}`}>
        ← К темам
      </Link>
      <h1>{TOPIC_LABELS_RU[topic as Topic] ?? topic}</h1>

      {/* Reachable by a typed or shared link even when the topic card is not. */}
      {tasks.length === 0 ? (
        <p className="muted">
          В этой теме пока нет задач: в разобранных работах 4 класса их не было. Загляни позже.
        </p>
      ) : (
        <p className="muted">
          {tasks.length} {tasksWord(tasks.length)} · решено {solved}
        </p>
      )}

      <ol className="task-list">
        {tasks.map((task, i) => {
          const taskState = states.get(task.id) ?? 'untouched'
          return (
            <li key={task.id}>
              <Link className={`task-row task-row--${taskState}`} to={`/${subject}/${topic}/${task.id}`}>
                <span className="task-row-number">{i + 1}</span>
                <span className="task-row-title">{titles[i]}</span>
                <span className="task-row-meta">
                  <span className="task-row-level">ур. {task.level}</span>
                  <span className="task-row-mark" aria-label={STATE_LABELS[taskState]}>
                    {STATE_MARKS[taskState]}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </main>
  )
}

export default TaskListScreen
