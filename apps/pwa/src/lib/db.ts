import Dexie, { type EntityTable } from 'dexie'
import type { ContentPackage, Grade, Subject, TelemetryEvent } from '@olymp/schema'

/**
 * Everything about the child lives here, on the device, and never leaves it.
 * No accounts, no sync, no server-side profile — that is what keeps GDPR art. 8
 * parental consent off the critical path. See docs/legal/pre-dpia.md.
 */

export interface Profile {
  id: 'local'
  grade: Grade | null
  /** Rotating, random; the only id ever sent to the server. */
  installationId: string
  installationIdIssuedAt: string
  createdAt: string
}

export interface StoredPackage {
  packageId: string
  version: string
  subject: Subject
  grade: Grade
  downloadedAt: string
  payload: ContentPackage
}

export interface TaskProgress {
  /** `${taskId}` — progress is per task, per device. */
  taskId: string
  subject: Subject
  grade: Grade
  topic: string
  level: number
  attempts: number
  hintsUsed: number
  solvedAt: string | null
  lastAttemptAt: string
}

export interface StreakState {
  id: 'streak'
  /** Local date in Europe/Amsterdam, `YYYY-MM-DD`. */
  lastActiveDate: string | null
  currentDays: number
  longestDays: number
}

export interface QueuedTelemetry {
  id?: number
  event: TelemetryEvent
}

export class OlympDatabase extends Dexie {
  profile!: EntityTable<Profile, 'id'>
  packages!: EntityTable<StoredPackage, 'packageId'>
  progress!: EntityTable<TaskProgress, 'taskId'>
  streak!: EntityTable<StreakState, 'id'>
  telemetryQueue!: EntityTable<QueuedTelemetry, 'id'>

  constructor() {
    super('olymp')
    this.version(1).stores({
      profile: 'id',
      packages: 'packageId, [subject+grade]',
      progress: 'taskId, [subject+grade], solvedAt',
      streak: 'id',
      telemetryQueue: '++id',
    })
  }
}

export const db = new OlympDatabase()

/** Wipes every trace of the child from the device. Exposed on the parent screen. */
export async function eraseAllLocalData(): Promise<void> {
  await db.delete()
  await db.open()
}
