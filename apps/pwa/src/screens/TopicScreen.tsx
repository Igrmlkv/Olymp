import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { SubjectSchema, TOPICS_BY_SUBJECT, type Subject, type Task } from '@olymp/schema'
import { ensurePackage } from '../lib/content.js'
import { getProfile } from '../lib/profile.js'

const TOPIC_LABELS: Record<string, string> = {
  multi_digit: 'Многозначные числа',
  fractions: 'Доли и дроби',
  word_problems: 'Текстовые задачи',
  logic: 'Логика',
  geometry: 'Геометрия',
  orthography: 'Орфография',
  vocabulary: 'Словарный запас',
  reading: 'Чтение и понимание',
  syntax: 'Синтаксис и пунктуация',
}

export function TopicScreen() {
  const { subject: rawSubject } = useParams()
  const subject = SubjectSchema.safeParse(rawSubject)
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!subject.success) return
    void (async () => {
      try {
        const profile = await getProfile()
        if (!profile.grade) return
        const pkg = await ensurePackage(subject.data, profile.grade)
        setTasks(pkg.payload.tasks)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'не удалось загрузить задачи')
      }
    })()
  }, [rawSubject])

  if (!subject.success) return <p className="screen">Неизвестный предмет.</p>

  return (
    <main className="screen">
      <Link className="back-link" to="/">
        ← Назад
      </Link>
      <h1>{subject.data === 'math' ? 'Математика' : 'Русский язык'}</h1>

      {error && <p className="error">Не получилось загрузить задачи: {error}</p>}
      {!tasks && !error && <p className="muted">Загружаем задачи…</p>}

      <ul className="topic-list">
        {TOPICS_BY_SUBJECT[subject.data as Subject].map((topic) => {
          const count = tasks?.filter((t) => t.topic === topic).length ?? 0
          return (
            <li key={topic}>
              <Link className="topic-card" to={`/${subject.data}/${topic}`} aria-disabled={count === 0}>
                <span>{TOPIC_LABELS[topic] ?? topic}</span>
                <span className="muted">{count} задач</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
