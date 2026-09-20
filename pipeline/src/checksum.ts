import { createHash } from 'node:crypto'
import type { Task } from '@olymp/schema'

/**
 * Must produce the same digest as the client's computeChecksum in
 * apps/pwa/src/lib/content.ts — a mismatch there rejects the package.
 */
export function computeChecksum(tasks: Task[]): string {
  return createHash('sha256').update(JSON.stringify(tasks)).digest('hex')
}
