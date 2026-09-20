import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContentPackageSchema, packageKey, type ContentPackage } from '@olymp/schema'
import { computeChecksum } from './checksum.js'
import { CONTENT_DIR } from './paths.js'

/**
 * Guards the packages that actually ship. A hand edit to content/archive/ that
 * never went back through `import-archive` would otherwise reach a child as a
 * checksum mismatch in the app.
 */

const SHIPPED: { subject: 'math' | 'russian'; grade: 4 }[] = [
  { subject: 'math', grade: 4 },
  { subject: 'russian', grade: 4 },
]

const cache = new Map<string, Promise<ContentPackage>>()

/** Parsing a 600 KB package is the expensive part; do it once per file. */
function load(key: string): Promise<ContentPackage> {
  let pkg = cache.get(key)
  if (!pkg) {
    pkg = readFile(resolve(CONTENT_DIR, key), 'utf8').then((raw) =>
      ContentPackageSchema.parse(JSON.parse(raw)),
    )
    cache.set(key, pkg)
  }
  return pkg
}

describe.each(SHIPPED)('$subject grade $grade', ({ subject, grade }) => {
  const latestKey = packageKey(subject, grade, 'latest')

  it('parses, and its checksum matches its tasks', async () => {
    const pkg = await load(latestKey)
    expect(computeChecksum(pkg.tasks)).toBe(pkg.manifest.checksum)
    expect(pkg.tasks.length).toBe(pkg.manifest.task_count)
  })

  it('attributes every archive task, as Auteurswet art. 15a requires', async () => {
    const pkg = await load(latestKey)
    const archive = pkg.tasks.filter((t) => t.origin === 'archive')

    expect(archive.length).toBeGreaterThan(0)
    for (const task of archive) {
      expect(task.source_attribution).not.toBeNull()
      expect(task.source_attribution?.url).toMatch(/^https:\/\//)
    }
  })

  it('ships only tasks that passed verification', async () => {
    const pkg = await load(latestKey)
    expect(pkg.tasks.every((t) => t.verification.verdict === 'pass')).toBe(true)
  })

  it('keeps `latest` pointing at the pinned version it names', async () => {
    // The two writes live in one helper now, but they used to drift — publish
    // never wrote `latest` at all. The version comes from the file rather than
    // a literal, so bumping a package does not break this test.
    const latest = await load(latestKey)
    const pinned = await load(packageKey(subject, grade, latest.manifest.version))

    expect(pinned.manifest.checksum).toBe(latest.manifest.checksum)
    expect(pinned.manifest.task_count).toBe(latest.manifest.task_count)
  })
})
