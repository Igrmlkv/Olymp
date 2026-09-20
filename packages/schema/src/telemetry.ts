import { z } from 'zod'
import { GradeSchema } from './grade.js'
import { SubjectSchema, TopicSchema, LevelSchema } from './task.js'

/**
 * Telemetry is treated conservatively as pseudonymous (not anonymous) data:
 * EDPB single-out / linkability / inference tests must all fail for true
 * anonymity, and a device-scoped id does not clear the single-out test.
 * Therefore: no IP, no geolocation, no free text, rotating installation_id,
 * short retention. See docs/legal/pre-dpia.md.
 */
export const TELEMETRY_RETENTION_DAYS = 90

/** Rotating the id every 30 days weakens linkability over time. */
export const INSTALLATION_ID_ROTATION_DAYS = 30

export const TelemetryEventNameSchema = z.enum([
  'app_open',
  'package_downloaded',
  /** A device picked up a newer bank than the one it had. */
  'package_updated',
  'task_attempted',
  'task_solved',
  'hint_used',
  'solution_viewed',
  'olympiad_started',
  'olympiad_finished',
])
export type TelemetryEventName = z.infer<typeof TelemetryEventNameSchema>

/** Caps that keep a counter from becoming a fingerprint. Applied by the client. */
export const MAX_ATTEMPT_COUNT = 50
export const MAX_DURATION_MS = 3_600_000

export const TelemetryEventSchema = z.object({
  name: TelemetryEventNameSchema,
  /** Random, client-generated, rotated; never derived from anything identifying. */
  installation_id: z.uuid(),
  /** Client clock, bucketed to the hour to reduce linkability. */
  occurred_at_hour: z.iso.datetime(),
  subject: SubjectSchema.optional(),
  grade: GradeSchema.optional(),
  topic: TopicSchema.optional(),
  level: LevelSchema.optional(),
  task_id: z.string().optional(),
  /** Attempts before the event; capped so it cannot become a fingerprint. */
  attempt_count: z.number().int().min(0).max(MAX_ATTEMPT_COUNT).optional(),
  duration_ms: z.number().int().min(0).max(MAX_DURATION_MS).optional(),
  correct: z.boolean().optional(),
})
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>

export const TelemetryBatchSchema = z.object({
  events: z.array(TelemetryEventSchema).min(1).max(100),
})
export type TelemetryBatch = z.infer<typeof TelemetryBatchSchema>

/** Truncates a timestamp to the hour, so events cannot be correlated by exact time. */
export function bucketToHour(date: Date): string {
  const d = new Date(date)
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}
