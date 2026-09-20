import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { SUBJECT_LABELS_RU, TELEMETRY_RETENTION_DAYS } from '@olymp/schema'
import { db, eraseAllLocalData, type StoredPackage } from '../lib/db.js'
import { checkForNewPackage, listStoredPackages } from '../lib/content.js'
import { getProfile } from '../lib/profile.js'
import { getStreak } from '../lib/streak.js'
import { daysWord, tasksWord } from '../lib/plural.js'

interface Summary {
  solved: number
  attempted: number
  streakDays: number
}

type CheckState = 'idle' | 'checking' | 'current' | 'updated' | 'failed'

/** Progress plus the plain-language privacy statement parents are entitled to. */
export function ParentScreen() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [packages, setPackages] = useState<StoredPackage[] | null>(null)
  const [check, setCheck] = useState<CheckState>('idle')

  useEffect(() => {
    void (async () => {
      const all = await db.progress.toArray()
      const streak = await getStreak()
      setSummary({
        solved: all.filter((p) => p.solvedAt !== null).length,
        attempted: all.length,
        streakDays: streak.currentDays,
      })
      setPackages(await listStoredPackages())
    })()
  }, [])

  /**
   * Downloads the current bank if the device is behind. A device keeps the
   * package it downloaded, so a bank from the first week can sit here for
   * months while the app looks perfectly healthy — with no way to tell from
   * the inside which of the two it is.
   */
  async function updateTasks() {
    setCheck('checking')
    try {
      const grade = (await getProfile()).grade
      if (!grade) return setCheck('failed')

      const results = await Promise.all(
        (['math', 'russian'] as const).map((subject) => checkForNewPackage(subject, grade)),
      )

      if (results.some((r) => r.updated)) {
        setCheck('updated')
        location.reload()
      } else {
        setCheck('current')
        setPackages(await listStoredPackages())
      }
    } catch {
      setCheck('failed')
    }
  }

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
        <h2>Задания на этом устройстве</h2>
        {packages === null ? (
          <p className="muted">Смотрим…</p>
        ) : packages.length === 0 ? (
          <p className="muted">Задания ещё не загружены — откройте любой предмет.</p>
        ) : (
          <ul className="summary">
            {packages.map((pkg) => (
              <li key={pkg.packageId}>
                {SUBJECT_LABELS_RU[pkg.subject]}: {pkg.payload.tasks.length}{' '}
                {tasksWord(pkg.payload.tasks.length)}, версия {pkg.version}
              </li>
            ))}
          </ul>
        )}
        <p className="muted">
          Новые задания приходят сами, но не сразу — приложение проверяет их раз в полдня и показывает
          со следующего запуска. Эта кнопка загружает их немедленно.
        </p>
        <button disabled={check === 'checking'} onClick={() => void updateTasks()}>
          {check === 'checking' ? 'Проверяем…' : 'Проверить обновления'}
        </button>
        {check === 'current' && <p className="muted">У вас уже последняя версия заданий.</p>}
        {check === 'updated' && <p className="muted">Загружены новые задания, обновляем экран…</p>}
        {check === 'failed' && <p className="error">Не получилось проверить: нет связи с сервером.</p>}
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

export default ParentScreen
