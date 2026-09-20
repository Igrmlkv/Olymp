/**
 * Streaks and olympiad sessions run on Dutch local time (CET/CEST), not UTC and
 * not the device zone, so a child travelling does not lose a streak.
 */
export const APP_TIME_ZONE = 'Europe/Amsterdam'

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Local calendar date in Europe/Amsterdam as `YYYY-MM-DD`. */
export function localDate(date: Date = new Date()): string {
  return dateFormatter.format(date)
}

export function previousDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
