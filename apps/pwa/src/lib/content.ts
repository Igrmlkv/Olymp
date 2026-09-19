import { ContentPackageSchema, type ContentPackage, type Grade, type Subject, type Task } from '@olymp/schema'
import { db, type StoredPackage } from './db.js'

/**
 * Packages are fetched once, validated, and kept in IndexedDB. From then on the
 * app is fully offline: nothing here needs the network on a repeat visit.
 */

export class ContentError extends Error {}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Must mirror the pipeline's checksum computation exactly. */
export async function computeChecksum(tasks: ContentPackage['tasks']): Promise<string> {
  return sha256Hex(JSON.stringify(tasks))
}

export async function downloadPackage(subject: Subject, grade: Grade): Promise<StoredPackage> {
  // A download only happens on first run or after an erase, and the result is
  // then kept offline for a long time — so revalidate rather than accept a
  // stale `latest` pointer from the HTTP cache.
  const response = await fetch(`/api/packages/${subject}/${grade}/latest.json`, {
    cache: 'no-cache',
  })
  if (!response.ok) {
    throw new ContentError(`не удалось загрузить пакет: HTTP ${response.status}`)
  }

  const parsed = ContentPackageSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new ContentError(`пакет не прошёл проверку схемы: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  }

  const payload = parsed.data
  const checksum = await computeChecksum(payload.tasks)
  if (checksum !== payload.manifest.checksum) {
    throw new ContentError('контрольная сумма пакета не совпала')
  }

  const stored: StoredPackage = {
    packageId: payload.manifest.package_id,
    version: payload.manifest.version,
    subject: payload.manifest.subject,
    grade: payload.manifest.grade,
    downloadedAt: new Date().toISOString(),
    payload,
  }
  await db.packages.put(stored)
  return stored
}

export async function getStoredPackage(subject: Subject, grade: Grade): Promise<StoredPackage | undefined> {
  return db.packages.where({ subject, grade }).first()
}

/** Cached package if present, otherwise a download. Throws offline with nothing cached. */
export async function ensurePackage(subject: Subject, grade: Grade): Promise<StoredPackage> {
  const cached = await getStoredPackage(subject, grade)
  if (cached) return cached
  return downloadPackage(subject, grade)
}

export function tasksByTopic(pkg: ContentPackage, topic: string): Task[] {
  return pkg.tasks.filter((t) => t.topic === topic).sort((a, b) => a.level - b.level)
}
