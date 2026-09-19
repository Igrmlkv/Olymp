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
export const OrganizerSchema = z.enum(['moscow', 'sirius'])
export type Organizer = z.infer<typeof OrganizerSchema>

export const OlympiadFormatSchema = z.object({
  subject: SubjectSchema,
  grade: GradeSchema,
  /** Who set this format. School-stage rules differ by organiser. */
  organizer: OrganizerSchema,
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

/**
 * Shipped MVP formats, Moscow first because the shipped archive packages are
 * Moscow school-stage tasks — pairing them with the Sirius 56-point scale would
 * show a child a score out of a maximum their tasks cannot reach.
 *
 * Max scores below are read off the organiser's own answer keys, not secondary
 * sources. See docs/spec-v4.md section 4 for the discrepancy this corrected.
 */
export const OLYMPIAD_FORMATS: OlympiadFormat[] = [
  {
    subject: 'math',
    grade: 4,
    organizer: 'moscow',
    season: '2025/26',
    time_limit_min: 60,
    max_score: 8,
    task_count: 8,
    scoring: 'binary',
    source_url:
      'https://vos.olimpiada.ru/upload/files/Arhive_tasks/2025-26/school/math/sol-math-4-sch-msk-25-26.pdf',
  },
  {
    subject: 'russian',
    grade: 4,
    organizer: 'moscow',
    season: '2025/26',
    time_limit_min: 60,
    max_score: 52,
    task_count: 13,
    scoring: 'partial',
    source_url:
      'https://vos.olimpiada.ru/upload/files/Arhive_tasks/2025-26/school/russ/ans-russ-4-sch-msk-25-26.pdf',
  },
  {
    subject: 'math',
    grade: 4,
    organizer: 'sirius',
    season: '2025',
    time_limit_min: 60,
    max_score: 56,
    task_count: null,
    scoring: 'partial',
    source_url: 'https://siriusolymp.ru/',
  },
]

/** Defaults to the organiser whose tasks ship in the content packages. */
export function findOlympiadFormat(
  subject: Subject,
  grade: Grade,
  organizer: Organizer = 'moscow',
): OlympiadFormat | undefined {
  return OLYMPIAD_FORMATS.find(
    (f) => f.subject === subject && f.grade === grade && f.organizer === organizer,
  )
}
