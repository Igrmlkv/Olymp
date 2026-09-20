import {
  bucketToHour,
  TelemetryEventSchema,
  type TelemetryEvent,
  type TelemetryEventName,
  MAX_ATTEMPT_COUNT,
  MAX_DURATION_MS,
} from '@olymp/schema'
import { db } from './db.js'
import { getProfile } from './profile.js'

/**
 * Events are queued locally and flushed in batches, so the app stays usable
 * offline and the server never sees a real-time activity stream per device.
 * Nothing here may carry free text, IP, or anything the child typed.
 */

const MAX_QUEUE = 200

type EventPayload = Omit<TelemetryEvent, 'name' | 'installation_id' | 'occurred_at_hour'>

/**
 * Callers pass raw numbers; the schema's caps are applied here rather than
 * restated at every call site. Restating them meant a raised cap left a screen
 * silently failing validation — and a dropped event, not an error.
 */
function clamp(value: number | undefined, max: number): number | undefined {
  return value === undefined ? undefined : Math.min(Math.max(0, Math.trunc(value)), max)
}

export async function track(name: TelemetryEventName, payload: EventPayload = {}): Promise<void> {
  const profile = await getProfile()
  const candidate = {
    ...payload,
    attempt_count: clamp(payload.attempt_count, MAX_ATTEMPT_COUNT),
    duration_ms: clamp(payload.duration_ms, MAX_DURATION_MS),
    name,
    installation_id: profile.installationId,
    occurred_at_hour: bucketToHour(new Date()),
  }

  const parsed = TelemetryEventSchema.safeParse(candidate)
  if (!parsed.success) {
    // A malformed event is never worth breaking a child's session over.
    console.warn('telemetry event dropped', parsed.error.issues)
    return
  }

  // The auto-increment key is its own high-water mark, so trimming costs one
  // query instead of a count, a key scan and a bulk delete on every event.
  const id = await db.telemetryQueue.add({ event: parsed.data })
  if (typeof id === 'number' && id > MAX_QUEUE) {
    await db.telemetryQueue.where('id').below(id - MAX_QUEUE).delete()
  }
}

export async function flushTelemetry(): Promise<void> {
  if (!navigator.onLine) return

  const queued = await db.telemetryQueue.orderBy('id').limit(100).toArray()
  if (queued.length === 0) return

  const response = await fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events: queued.map((q) => q.event) }),
  })

  // Keep the queue on failure; it will be retried on the next flush.
  if (!response.ok) return

  await db.telemetryQueue.bulkDelete(queued.map((q) => q.id!).filter((id) => id !== undefined))
}
