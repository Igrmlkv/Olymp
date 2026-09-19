import { bucketToHour, TelemetryEventSchema, type TelemetryEvent, type TelemetryEventName } from '@olymp/schema'
import { db } from './db.js'
import { getProfile } from './profile.js'

/**
 * Events are queued locally and flushed in batches, so the app stays usable
 * offline and the server never sees a real-time activity stream per device.
 * Nothing here may carry free text, IP, or anything the child typed.
 */

const MAX_QUEUE = 200

type EventPayload = Omit<TelemetryEvent, 'name' | 'installation_id' | 'occurred_at_hour'>

export async function track(name: TelemetryEventName, payload: EventPayload = {}): Promise<void> {
  const profile = await getProfile()
  const candidate = {
    ...payload,
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

  await db.telemetryQueue.add({ event: parsed.data })

  const size = await db.telemetryQueue.count()
  if (size > MAX_QUEUE) {
    const overflow = await db.telemetryQueue.orderBy('id').limit(size - MAX_QUEUE).primaryKeys()
    await db.telemetryQueue.bulkDelete(overflow)
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
