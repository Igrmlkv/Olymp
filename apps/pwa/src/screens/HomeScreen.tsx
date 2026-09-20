import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getStreak } from '../lib/streak.js'
import { getProfile } from '../lib/profile.js'
import { daysWord } from '../lib/plural.js'
import {
  GRADE_MAPPING,
  SUBJECT_EMOJI,
  SUBJECT_LABELS_RU,
  SubjectSchema,
  type Grade,
} from '@olymp/schema'

/** Map of worlds. For now: two subjects, the streak, and the olympiad entrance. */
export function HomeScreen() {
  const [grade, setGradeState] = useState<Grade | null>(null)
  const [streakDays, setStreakDays] = useState(0)

  useEffect(() => {
    void (async () => {
      setGradeState((await getProfile()).grade)
      setStreakDays((await getStreak()).currentDays)
    })()
  }, [])

  return (
    <main className="screen">
      <header className="home-header">
        <h1>Олимп</h1>
        {grade && <p className="muted">{GRADE_MAPPING[grade].hint_ru}</p>}
        <p className="streak">
          🔥 {streakDays} {daysWord(streakDays)} подряд
        </p>
      </header>

      <nav className="world-grid">
        {SubjectSchema.options.map((subject) => (
          <Link key={subject} className={`world-card world-card--${subject}`} to={`/${subject}`}>
            <span className="world-emoji">{SUBJECT_EMOJI[subject]}</span>
            <span>{SUBJECT_LABELS_RU[subject]}</span>
          </Link>
        ))}
      </nav>

      <section className="home-actions">
        {/* Both subjects have a format; only maths had a link before. */}
        {SubjectSchema.options.map((subject) => (
          <Link key={subject} className="link-button" to={`/olympiad/${subject}`}>
            Олимпиада: {SUBJECT_LABELS_RU[subject].toLowerCase()}
          </Link>
        ))}
        <Link className="link-button link-button--quiet" to="/parents">
          Для родителей
        </Link>
        <Link className="link-button link-button--quiet" to="/grade">
          Сменить класс
        </Link>
      </section>
    </main>
  )
}

export default HomeScreen
