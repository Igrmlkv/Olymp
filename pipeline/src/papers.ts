import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { GradeSchema, StageSchema, SubjectSchema, type ContentPackage } from '@olymp/schema'
import { ARCHIVE_DIR } from './paths.js'

/**
 * What the organiser published, against what we took from it.
 *
 * The bank is transcribed by hand, and until now the only record of how far
 * that had got was a table written by hand in docs/content-bank.md. It drifted:
 * it claimed the school stage was complete while the 2025/26 paper — 8 tasks in
 * 4 variants each, 30 in total — had 26 of them in the bank, and it counted
 * that paper as 8 tasks. A gap nobody can measure is a gap nobody closes.
 *
 * So: this file holds only what the organiser published. How much of it we
 * took is computed from the bank itself, and the two can no longer disagree.
 */
const UnusableSchema = z.object({
  count: z.number().int().min(1),
  reason: z.string().min(1),
})

export const PaperSchema = z.object({
  id: z.string().min(1),
  subject: SubjectSchema,
  grade: GradeSchema,
  season: z.string().regex(/^\d{4}\/\d{2}$/),
  stage: StageSchema,
  /** Must match `source_attribution.url` of every task taken from this paper. */
  url: z.url(),
  /**
   * Answerable units in the paper, counted in the PDF — what a child fills in
   * and what the bank holds one task for.
   *
   * A variant is a unit: the invitational papers set the same question four
   * times with different numbers, and a child answers one of them. Several
   * numbered заданий are one unit when the organiser only scores them
   * together, which `structure` then says.
   *
   * Null means nobody has counted this paper yet — honest, and visible in the
   * report, rather than a number that looks checked.
   */
  task_count: z.number().int().min(1).nullable(),
  /**
   * What one child can score on this paper, as the organiser's key states it.
   * Our `points` must add up to no more than this — times the number of
   * variants, because a child answers one variant and we ship them all.
   */
  max_score: z.number().int().min(1).optional(),
  variants: z.number().int().min(1).default(1),
  structure: z.string().optional(),
  unusable: z.array(UnusableSchema).default([]),
})
export type Paper = z.infer<typeof PaperSchema>

const ManifestSchema = z.object({
  _comment: z.array(z.string()).optional(),
  papers: z.array(PaperSchema).min(1),
})

export function loadPapers(): Paper[] {
  const raw = readFileSync(resolve(ARCHIVE_DIR, 'papers.json'), 'utf8')
  return ManifestSchema.parse(JSON.parse(raw)).papers
}

export type Coverage = {
  paper: Paper
  /** Tasks in the bank that name this paper as their source. */
  taken: number
  /** Tasks that could still be transcribed, or null while the paper is uncounted. */
  remaining: number | null
  unusable: number
  /** Points our tasks from this paper add up to, against what it is worth. */
  points: number
  maxPoints: number | null
}

export function coverageFor(papers: Paper[], packages: ContentPackage[]): Coverage[] {
  const taken = new Map<string, number>()
  const points = new Map<string, number>()
  for (const pkg of packages) {
    for (const task of pkg.tasks) {
      const url = task.source_attribution?.url
      if (!url) continue
      taken.set(url, (taken.get(url) ?? 0) + 1)
      points.set(url, (points.get(url) ?? 0) + task.points)
    }
  }

  return papers.map((paper) => {
    const unusable = paper.unusable.reduce((sum, u) => sum + u.count, 0)
    const count = taken.get(paper.url) ?? 0
    return {
      paper,
      taken: count,
      unusable,
      remaining: paper.task_count === null ? null : paper.task_count - unusable - count,
      points: points.get(paper.url) ?? 0,
      maxPoints: paper.max_score === undefined ? null : paper.max_score * paper.variants,
    }
  })
}

/** Sources named by tasks in the bank that no paper in the manifest claims. */
export function unknownSources(papers: Paper[], packages: ContentPackage[]): string[] {
  const known = new Set(papers.map((p) => p.url))
  const seen = new Set<string>()
  for (const pkg of packages) {
    for (const task of pkg.tasks) {
      const url = task.source_attribution?.url
      if (url && !known.has(url)) seen.add(url)
    }
  }
  return [...seen].sort()
}
