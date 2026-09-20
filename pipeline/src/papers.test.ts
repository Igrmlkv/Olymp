import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContentPackageSchema, packageKey, type ContentPackage } from '@olymp/schema'
import { coverageFor, loadPapers, unknownSources } from './papers.js'
import { CONTENT_DIR } from './paths.js'

/**
 * Keeps the record of what is published and the bank itself from drifting.
 * The hand-written table in docs/content-bank.md drifted exactly this way: it
 * counted a paper of 30 tasks as 8 and called the stage complete.
 */
const SHIPPED = [
  { subject: 'math', grade: 4 },
  { subject: 'russian', grade: 4 },
] as const

async function load(subject: 'math' | 'russian', grade: 4): Promise<ContentPackage> {
  const raw = await readFile(resolve(CONTENT_DIR, packageKey(subject, grade, 'latest')), 'utf8')
  return ContentPackageSchema.parse(JSON.parse(raw))
}

const papers = loadPapers()
const packages = await Promise.all(SHIPPED.map(({ subject, grade }) => load(subject, grade)))

describe('манифест работ', () => {
  it('не содержит двух работ с одним id или одним файлом', () => {
    expect(new Set(papers.map((p) => p.id)).size).toBe(papers.length)
    expect(new Set(papers.map((p) => p.url)).size).toBe(papers.length)
  })

  it('описывает каждый источник, на который ссылаются задачи', () => {
    // A task whose source is not in the manifest means a paper nobody counted,
    // and coverage silently stops meaning anything.
    expect(unknownSources(papers, packages)).toEqual([])
  })

  it('не заявляет больше взятого, чем есть в работе', () => {
    const impossible = coverageFor(papers, packages)
      .filter((c) => c.remaining !== null && c.remaining < 0)
      .map((c) => `${c.paper.id}: в работе ${c.paper.task_count}, взято ${c.taken}, непригодно ${c.unusable}`)

    expect(impossible).toEqual([])
  })

  it('не начисляет за работу больше баллов, чем она стоит', () => {
    // The check that catches a task transcribed twice: the bank once held the
    // same 2024/25 task under two ids, and the only visible symptom was that
    // the paper was suddenly worth 32 points instead of 29.
    const over = coverageFor(papers, packages)
      .filter((c) => c.maxPoints !== null && c.points > c.maxPoints)
      .map((c) => `${c.paper.id}: ${c.points} баллов в банке при максимуме ${c.maxPoints}`)

    expect(over).toEqual([])
  })

  it('объясняет каждое непригодное задание', () => {
    for (const paper of papers) {
      for (const reason of paper.unusable) {
        expect(reason.reason.length, `${paper.id}`).toBeGreaterThan(10)
      }
    }
  })
})
