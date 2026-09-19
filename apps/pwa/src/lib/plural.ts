/**
 * Russian numeral agreement. An app that teaches Russian cannot print
 * "52 баллов" or "1 задач", so counts always go through here.
 *
 * Rule: 11–14 take the many-form; otherwise the last digit decides —
 * 1 takes the singular, 2–4 the few-form, the rest the many-form.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.trunc(count))
  if (n % 100 >= 11 && n % 100 <= 14) return many
  const last = n % 10
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

export function tasksWord(count: number): string {
  return plural(count, 'задача', 'задачи', 'задач')
}

export function pointsWord(count: number): string {
  return plural(count, 'балл', 'балла', 'баллов')
}

export function daysWord(count: number): string {
  return plural(count, 'день', 'дня', 'дней')
}

export function minutesWord(count: number): string {
  return plural(count, 'минута', 'минуты', 'минут')
}
