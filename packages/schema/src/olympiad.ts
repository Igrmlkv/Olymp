import { z } from 'zod'
import { GradeSchema, type Grade } from './grade.js'
import { SubjectSchema, type Subject } from './task.js'

export const ScoringSchema = z.enum(['binary', 'partial'])
export type Scoring = z.infer<typeof ScoringSchema>

/**
 * Olympiad-mode parameters. Deliberately data, not hardcoded logic: Sirius moved
 * maths grade 4 from max 8 to max 56 points between seasons, and the Moscow
 * Russian-language format moved from 36 to 41 points. See docs/spec-v4.md section 4.
 */
export const OlympiadFormatSchema = z.object({
  subject: SubjectSchema,
  grade: GradeSchema,
  /** Season the format was taken from, e.g. "2025". */
  season: z.string().min(1),
  time_limit_min: z.number().int().min(1),
  max_score: z.number().int().min(1),
  task_count: z.number().int().min(1).nullable(),
  scoring: ScoringSchema,
  source_url: z.url(),
})
export type OlympiadFormat = z.infer<typeof OlympiadFormatSchema>

/** Time limits by grade, per the Sirius regulations. */
export function olympiadMinutesForGrade(grade: Grade): number {
  if (grade <= 5) return 60
  if (grade <= 8) return 90
  return 120
}

/** Shipped MVP formats. Extend as new grades are added. */
export const OLYMPIAD_FORMATS: OlympiadFormat[] = [
  {
    subject: 'math',
    grade: 4,
    season: '2025',
    time_limit_min: 60,
    max_score: 56,
    task_count: null,
    scoring: 'partial',
    source_url: 'https://siriusolymp.ru/',
  },
  {
    subject: 'russian',
    grade: 4,
    season: '2023/24',
    time_limit_min: 60,
    max_score: 36,
    task_count: 8,
    scoring: 'partial',
    source_url: 'https://vos.olimpiada.ru/',
  },
]

export function findOlympiadFormat(subject: Subject, grade: Grade): OlympiadFormat | undefined {
  return OLYMPIAD_FORMATS.find((f) => f.subject === subject && f.grade === grade)
}
