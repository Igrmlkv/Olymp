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

  return (
    <main className="screen">
      <Link className="back-link" to="/">
        ← Назад
      </Link>
      <h1>{SUBJECT_LABELS_RU[subject]}</h1>

      {state.status === 'error' && <p className="error">Не получилось загрузить задачи: {state.message}</p>}
      {state.status !== 'ready' && <p className="muted">Загружаем задачи…</p>}

      {/*
        Counts wait for the package. Rendering the list early showed every
        topic as "0 задач", and those zeroes were links: a child tapping one
        during the download landed on an empty list.
      */}
      {state.status === 'ready' && (
        <ul className="topic-list">
          {TOPICS_BY_SUBJECT[subject].map((topic) => {
            const count = state.pkg.tasks.filter((t) => t.topic === topic).length
            const label = TOPIC_LABELS_RU[topic]

            // A topic we have no tasks for yet is not a door. Fractions are in
            // the schema, but no grade-4 archive paper has produced one.
            if (count === 0) {
              return (
                <li key={topic}>
                  <div className="topic-card topic-card--empty" aria-disabled="true">
                    <span>{label}</span>
                    <span className="badge">скоро</span>
                  </div>
                </li>
              )
            }

            return (
              <li key={topic}>
                <Link className="topic-card" to={`/${subject}/${topic}`}>
                  <span>{label}</span>
                  <span className="muted">
                    {count} {tasksWord(count)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

export default TopicScreen
