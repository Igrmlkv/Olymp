import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContentPackageSchema } from '@olymp/schema'
import { computeChecksum } from './checksum.js'

/**
 * Guards the packages that actually ship. A hand edit to content/archive/ that
 * never went back through `import-archive` would otherwise reach a child as a
 * checksum mismatch in the app.
 */

const ROOT = resolve(import.meta.dirname, '..', '..')
const SHIPPED = [
  'content/packages/math/grade-4/latest.json',
  'content/packages/russian/grade-4/latest.json',
]

describe.each(SHIPPED)('%s', (path) => {
  it('parses, and its checksum matches its tasks', async () => {
    const raw: unknown = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
    const pkg = ContentPackageSchema.parse(raw)

    expect(computeChecksum(pkg.tasks)).toBe(pkg.manifest.checksum)
    expect(pkg.tasks.length).toBe(pkg.manifest.task_count)
  })

  it('attributes every archive task, as Auteurswet art. 15a requires', async () => {
    const raw: unknown = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
    const pkg = ContentPackageSchema.parse(raw)

    const archive = pkg.tasks.filter((t) => t.origin === 'archive')
    expect(archive.length).toBeGreaterThan(0)
    for (const task of archive) {
      expect(task.source_attribution).not.toBeNull()
      expect(task.source_attribution?.url).toMatch(/^https:\/\//)
    }
  })

  it('ships only tasks that passed verification', async () => {
    const raw: unknown = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
    const pkg = ContentPackageSchema.parse(raw)

    expect(pkg.tasks.every((t) => t.verification.verdict === 'pass')).toBe(true)
  })
})
