import { INSTALLATION_ID_ROTATION_DAYS, type Grade } from '@olymp/schema'
import { db, onErase, type Profile } from './db.js'

const DAY_MS = 24 * 60 * 60 * 1000

function newInstallationId(): string {
  return crypto.randomUUID()
}

/**
 * The profile is one row that changes at most once a month, but it was read
 * from IndexedDB on every screen mount and on every single telemetry event.
 * Cached here; writers invalidate.
 */
let cached: Promise<Profile> | null = null

onErase(() => {
  cached = null
})

/**
 * Returns the local profile, creating it on first run and rotating the
 * installation id once it is older than the rotation window. Rotation is what
 * keeps telemetry from accumulating into a long-lived device fingerprint.
 */
export function getProfile(): Promise<Profile> {
  cached ??= loadProfile()
  return cached
}

async function loadProfile(): Promise<Profile> {
  const now = new Date()
  const existing = await db.profile.get('local')

  if (!existing) {
    const created: Profile = {
      id: 'local',
      grade: null,
      installationId: newInstallationId(),
      installationIdIssuedAt: now.toISOString(),
      createdAt: now.toISOString(),
    }
    await db.profile.put(created)
    return created
  }

  const ageMs = now.getTime() - new Date(existing.installationIdIssuedAt).getTime()
  if (ageMs > INSTALLATION_ID_ROTATION_DAYS * DAY_MS) {
    const rotated: Profile = {
      ...existing,
      installationId: newInstallationId(),
      installationIdIssuedAt: now.toISOString(),
    }
    await db.profile.put(rotated)
    return rotated
  }

  return existing
}

export async function setGrade(grade: Grade): Promise<void> {
  const profile = await getProfile()
  const next = { ...profile, grade }
  await db.profile.put(next)
  cached = Promise.resolve(next)
}
