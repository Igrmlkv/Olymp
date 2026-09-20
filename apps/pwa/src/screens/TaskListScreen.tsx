import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { SubjectSchema, TOPIC_LABELS_RU, type Task, type Topic } from '@olymp/schema'
import { tasksByTopic } from '../lib/content.js'
import { usePackage } from '../lib/usePackage.js'
import { progressFor, stateOf, STATE_LABELS, STATE_MARKS, type TaskState } from '../lib/progress.js'
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

  const tasks: Task[] = state.status === 'ready' && topic ? tasksByTopic(state.pkg, topic) : []

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
  }, [tasks.length, tasks[0]?.id])

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
      <p className="muted">
        {tasks.length} {tasksWord(tasks.length)} · решено {solved}
      </p>

      <ol className="task-list">
        {tasks.map((task, i) => {
          const taskState = states.get(task.id) ?? 'untouched'
          return (
            <li key={task.id}>
              <Link className={`task-row task-row--${taskState}`} to={`/${subject}/${topic}/${task.id}`}>
                <span className="task-row-number">{i + 1}</span>
                <span className="task-row-title">{preview(task)}</span>
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

/**
 * First sentence of the statement, with Markdown noise stripped — enough to
 * recognise a task you have already seen without giving the whole thing away.
 */
function preview(task: Task): string {
  const plain = task.statement_md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[>*_`#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const sentence = plain.split(/(?<=[.?!])\s/)[0] ?? plain
  return sentence.length > 90 ? `${sentence.slice(0, 90)}…` : sentence
}

export default TaskListScreen
