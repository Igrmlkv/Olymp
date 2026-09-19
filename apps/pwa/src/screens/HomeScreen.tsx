import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getStreak } from '../lib/streak.js'
import { getProfile } from '../lib/profile.js'
import { daysWord } from '../lib/plural.js'
import { GRADE_MAPPING, type Grade } from '@olymp/schema'

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
        <Link className="world-card world-card--math" to="/math">
          <span className="world-emoji">🔢</span>
          <span>Математика</span>
        </Link>
        <Link className="world-card world-card--russian" to="/russian">
          <span className="world-emoji">📖</span>
          <span>Русский язык</span>
        </Link>
      </nav>

      <section className="home-actions">
        <Link className="link-button" to="/olympiad/math">
          Режим олимпиады
        </Link>
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
