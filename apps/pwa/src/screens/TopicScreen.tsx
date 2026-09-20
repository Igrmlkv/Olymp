import { Link, useParams } from 'react-router'
import { SubjectSchema, SUBJECT_LABELS_RU, TOPIC_LABELS_RU, TOPICS_BY_SUBJECT } from '@olymp/schema'
import { usePackage } from '../lib/usePackage.js'
import { tasksWord } from '../lib/plural.js'

export function TopicScreen() {
  const { subject: rawSubject } = useParams()
  const parsed = SubjectSchema.safeParse(rawSubject)
  const subject = parsed.success ? parsed.data : null
  const state = usePackage(subject)

  if (subject === null) return <p className="screen">Неизвестный предмет.</p>

  const tasks = state.status === 'ready' ? state.pkg.tasks : []

  return (
    <main className="screen">
      <Link className="back-link" to="/">
        ← Назад
      </Link>
      <h1>{SUBJECT_LABELS_RU[subject]}</h1>

      {state.status === 'error' && <p className="error">Не получилось загрузить задачи: {state.message}</p>}
      {state.status === 'loading' && <p className="muted">Загружаем задачи…</p>}

      <ul className="topic-list">
        {TOPICS_BY_SUBJECT[subject].map((topic) => {
          const count = tasks.filter((t) => t.topic === topic).length
          return (
            <li key={topic}>
              <Link className="topic-card" to={`/${subject}/${topic}`} aria-disabled={count === 0}>
                <span>{TOPIC_LABELS_RU[topic]}</span>
                <span className="muted">
                  {count} {tasksWord(count)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

export default TopicScreen
