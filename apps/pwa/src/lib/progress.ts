import { db, type TaskProgress } from './db.js'

export type TaskState = 'solved' | 'attempted' | 'untouched'

/**
 * Progress for a whole topic at once. Reading it per task would mean one
 * IndexedDB round trip per row in a fifty-task list.
 */
export async function progressFor(taskIds: string[]): Promise<Map<string, TaskProgress>> {
  const rows = await db.progress.bulkGet(taskIds)
  const byId = new Map<string, TaskProgress>()
  rows.forEach((row) => {
    if (row) byId.set(row.taskId, row)
  })
  return byId
}

export function stateOf(progress: TaskProgress | undefined): TaskState {
  if (!progress) return 'untouched'
  return progress.solvedAt !== null ? 'solved' : 'attempted'
}

export const STATE_LABELS: Record<TaskState, string> = {
  solved: 'решена',
  attempted: 'начата',
  untouched: 'не решалась',
}

export const STATE_MARKS: Record<TaskState, string> = {
  solved: '✓',
  attempted: '…',
  untouched: '',
}
