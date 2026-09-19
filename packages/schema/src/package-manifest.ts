import { z } from 'zod'
import { GradeSchema } from './grade.js'
import { SubjectSchema, TaskSchema } from './task.js'

export const VerificationSummarySchema = z.object({
  total: z.number().int().min(0),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  needs_review: z.number().int().min(0),
})
export type VerificationSummary = z.infer<typeof VerificationSummarySchema>

/** Semver, so the client can decide whether a cached package is stale. */
const SemverSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'expected semver, e.g. 1.0.0')

export const PackageManifestSchema = z.object({
  package_id: z.string().min(1),
  version: SemverSchema,
  subject: SubjectSchema,
  grade: GradeSchema,
  created_at: z.iso.datetime(),
  /** Which prompt revision produced the generated tasks; ties into D1 prompt_versions. */
  prompt_version: z.string().min(1),
  task_count: z.number().int().min(1),
  /** SHA-256 over the canonical JSON of `tasks`. */
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  verification_summary: VerificationSummarySchema,
})
export type PackageManifest = z.infer<typeof PackageManifestSchema>

export const ContentPackageSchema = z
  .object({
    manifest: PackageManifestSchema,
    tasks: z.array(TaskSchema).min(1),
  })
  .refine((p) => p.manifest.task_count === p.tasks.length, {
    message: 'manifest.task_count does not match tasks.length',
    path: ['manifest', 'task_count'],
  })
  .refine((p) => p.tasks.every((t) => t.subject === p.manifest.subject && t.grade === p.manifest.grade), {
    message: 'every task must match the manifest subject and grade',
    path: ['tasks'],
  })
export type ContentPackage = z.infer<typeof ContentPackageSchema>

/** R2 object key for a published package. */
export function packageKey(subject: string, grade: number, version: string): string {
  return `packages/${subject}/grade-${grade}/${version}.json`
}
