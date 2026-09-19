import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { TELEMETRY_RETENTION_DAYS } from '@olymp/schema'
import { db, eraseAllLocalData } from '../lib/db.js'
import { getStreak } from '../lib/streak.js'
import { daysWord } from '../lib/plural.js'

interface Summary {
  solved: number
  attempted: number
  streakDays: number
}

/** Progress plus the plain-language privacy statement parents are entitled to. */
export function ParentScreen() {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    void (async () => {
      const all = await db.progress.toArray()
      const streak = await getStreak()
      setSummary({
        solved: all.filter((p) => p.solvedAt !== null).length,
        attempted: all.length,
        streakDays: streak.currentDays,
      })
    })()
  }, [])

  async function erase() {
    if (!confirm('Удалить весь прогресс с этого устройства? Действие необратимо.')) return
    await eraseAllLocalData()
    location.href = '/'
  }

  return (
    <main className="screen">
      <Link className="back-link" to="/">
        ← Назад
      </Link>
      <h1>Для родителей</h1>

      <section>
        <h2>Прогресс</h2>
        {summary ? (
          <ul className="summary">
            <li>Решено задач: {summary.solved}</li>
            <li>Всего попыток по задачам: {summary.attempted}</li>
            <li>
              Серия подряд: {summary.streakDays} {daysWord(summary.streakDays)}
            </li>
          </ul>
        ) : (
          <p className="muted">Считаем…</p>
        )}
      </section>

      <section>
        <h2>Уровень заданий</h2>
        <p>
          Сложность ориентирована на школьный этап Всероссийской олимпиады школьников (ВсОШ). Участие в самой
          олимпиаде не требуется — это только эталон уровня. Российский 4 класс примерно соответствует groep 6
          нидерландской basisschool.
        </p>
      </section>

      <section>
        <h2>Данные</h2>
        <p>
          Регистрации нет. Прогресс ребёнка хранится только на этом устройстве и никуда не отправляется.
          Обезличенная статистика использования (без IP и без геолокации) хранится не дольше{' '}
          {TELEMETRY_RETENTION_DAYS} дней на серверах в ЕС.
        </p>
        <p>
          <a href="/privacy.html">Политика конфиденциальности</a>
        </p>
        <button onClick={() => void erase()}>Удалить все данные с устройства</button>
      </section>
    </main>
  )
}
