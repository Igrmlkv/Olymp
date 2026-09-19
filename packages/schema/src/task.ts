import { z } from 'zod'
import { GradeSchema, GradeMappingSchema } from './grade.js'

export const SubjectSchema = z.enum(['math', 'russian'])
export type Subject = z.infer<typeof SubjectSchema>

export const MathTopicSchema = z.enum(['multi_digit', 'fractions', 'word_problems', 'logic', 'geometry'])
export const RussianTopicSchema = z.enum(['orthography', 'vocabulary', 'reading', 'syntax'])

/**
 * Russian-language topics are chosen for heritage speakers: explicit rules over
 * native intuition. See docs/spec-v4.md section 5.
 */
export const TopicSchema = z.union([MathTopicSchema, RussianTopicSchema])
export type Topic = z.infer<typeof TopicSchema>

export const TOPICS_BY_SUBJECT: Record<Subject, readonly Topic[]> = {
  math: MathTopicSchema.options,
  russian: RussianTopicSchema.options,
}

/** Difficulty ladder inside a world; 5 is boss-task territory. */
export const LevelSchema = z.number().int().min(1).max(5)
export type Level = z.infer<typeof LevelSchema>

export const OriginSchema = z.enum(['generated', 'archive'])
export type Origin = z.infer<typeof OriginSchema>

/**
 * Mandatory for every archive task: Auteurswet art. 15a quotation relies on
 * full attribution. See docs/legal/attribution.md.
 */
export const SourceAttributionSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
  year: z.number().int().min(2000).max(2100),
  stage: z.enum(['school', 'municipal', 'regional', 'final']),
  author: z.string().optional(),
})
export type SourceAttribution = z.infer<typeof SourceAttributionSchema>

export const AnswerSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('number'), value: z.number(), tolerance: z.number().min(0).optional() }),
    z.object({ type: z.literal('string'), value: z.string().min(1), accept: z.array(z.string()).default([]) }),
    z.object({ type: z.literal('choice'), value: z.string().min(1), options: z.array(z.string()).min(2) }),
    z.object({ type: z.literal('multi'), value: z.array(z.string()).min(1), options: z.array(z.string()).min(2) }),
  ])
  // A correct answer that is not on the list is unanswerable: worth catching at
  // import time rather than in front of a child.
  .refine((a) => a.type !== 'choice' || a.options.includes(a.value), {
    message: 'choice answer value must be one of the options',
    path: ['value'],
  })
  .refine((a) => a.type !== 'multi' || a.value.every((v) => a.options.includes(v)), {
    message: 'every multi answer value must be one of the options',
    path: ['value'],
  })
export type Answer = z.infer<typeof AnswerSchema>

export const VerificationSchema = z.object({
  verdict: z.enum(['pass', 'fail', 'needs_review']),
  method: z.string().min(1),
  /** Null for archive tasks, whose answers come from the organiser's own key. */
  model: z.string().min(1).nullable(),
  checked_at: z.iso.datetime().optional(),
  notes: z.string().optional(),
})
export type Verification = z.infer<typeof VerificationSchema>

export const TaskSchema = z
  .object({
    id: z.string().min(1),
    subject: SubjectSchema,
    grade: GradeSchema,
    grade_mapping: GradeMappingSchema,
    topic: TopicSchema,
    level: LevelSchema,
    origin: OriginSchema,
    source_attribution: SourceAttributionSchema.nullable().default(null),
    statement_md: z.string().min(1),
    answer: AnswerSchema,
    solution_md: z.string().min(1),
    /** Progressive hint ladder, ordered from vaguest to most concrete. */
    hints: z.array(z.string().min(1)).min(1).max(5),
    verification: VerificationSchema,
    /** Points this task contributes in olympiad mode. */
    points: z.number().int().min(1).default(1),
  })
  .refine((t) => t.origin !== 'archive' || t.source_attribution !== null, {
    message: 'archive tasks must carry source_attribution (Auteurswet art. 15a)',
    path: ['source_attribution'],
  })
  .refine((t) => TOPICS_BY_SUBJECT[t.subject].includes(t.topic), {
    message: 'topic does not belong to subject',
    path: ['topic'],
  })
export type Task = z.infer<typeof TaskSchema>
