import { db, type StreakState } from './db.js'
import { localDate, previousDate } from './time.js'

const EMPTY: StreakState = { id: 'streak', lastActiveDate: null, currentDays: 0, longestDays: 0 }

export async function getStreak(): Promise<StreakState> {
  return (await db.streak.get('streak')) ?? EMPTY
}

/**
 * Records activity for today. Returns the updated streak.
 * Pure day arithmetic in Europe/Amsterdam: same day is a no-op, yesterday
 * extends, anything older restarts at 1.
 */
export async function recordActivity(now: Date = new Date()): Promise<StreakState> {
  const today = localDate(now)
  const current = await getStreak()

  if (current.lastActiveDate === today) return current

  const extended = current.lastActiveDate === previousDate(today)
  const currentDays = extended ? current.currentDays + 1 : 1

  const next: StreakState = {
    id: 'streak',
    lastActiveDate: today,
    currentDays,
    longestDays: Math.max(current.longestDays, currentDays),
  }
  await db.streak.put(next)
  return next
}
