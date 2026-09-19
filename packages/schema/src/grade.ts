import { z } from 'zod'

/** Russian school grades the app can ever cover. MVP ships grade 4 only. */
export const GradeSchema = z.union([
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
  z.literal(11),
])
export type Grade = z.infer<typeof GradeSchema>

/** Grades with content in the current release. See docs/roadmap.md. */
export const SHIPPED_GRADES = [4] as const

export const NlStageSchema = z.enum(['basisschool', 'vo'])
export type NlStage = z.infer<typeof NlStageSchema>

export const GradeMappingSchema = z.object({
  nl_stage: NlStageSchema,
  /** basisschool group 1-8, null for VO grades. */
  groep: z.number().int().min(1).max(8).nullable(),
  /** VO year 1-6, null for basisschool grades. */
  klas: z.number().int().min(1).max(6).nullable(),
})
export type GradeMapping = z.infer<typeof GradeMappingSchema>

/**
 * Age-based correspondence between Russian grades and the Dutch system,
 * used on the grade-picker screen ("4 класс ≈ groep 6").
 * Source: docs/spec-v4.md section 3.
 */
export const GRADE_MAPPING: Record<Grade, GradeMapping & { hint_ru: string }> = {
  3: { nl_stage: 'basisschool', groep: 5, klas: null, hint_ru: '3 класс ≈ groep 5' },
  4: { nl_stage: 'basisschool', groep: 6, klas: null, hint_ru: '4 класс ≈ groep 6' },
  5: { nl_stage: 'basisschool', groep: 7, klas: null, hint_ru: '5 класс ≈ groep 7' },
  6: { nl_stage: 'basisschool', groep: 8, klas: null, hint_ru: '6 класс ≈ groep 8 / brugklas' },
  7: { nl_stage: 'vo', groep: null, klas: 1, hint_ru: '7 класс ≈ VO klas 1' },
  8: { nl_stage: 'vo', groep: null, klas: 2, hint_ru: '8 класс ≈ VO klas 2' },
  9: { nl_stage: 'vo', groep: null, klas: 3, hint_ru: '9 класс ≈ VO klas 3' },
  10: { nl_stage: 'vo', groep: null, klas: 4, hint_ru: '10 класс ≈ havo/vwo klas 4' },
  11: { nl_stage: 'vo', groep: null, klas: 5, hint_ru: '11 класс ≈ havo/vwo klas 5' },
}
