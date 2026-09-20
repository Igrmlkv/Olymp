/**
 * Anthropic model ids, in one place. The pipeline picks models by role and the
 * Worker prices them by id; keeping the ids in both meant a model swap made
 * `estimateCostUsd` return null and the cost audit silently went to zero.
 */
export const MODEL_IDS = {
  opus: 'claude-opus-5',
  fable: 'claude-fable-5-1',
  haiku: 'claude-haiku-4-5-20251001',
} as const

export type ModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS]

/** USD per 1M tokens, September 2026. Reconciled against the Anthropic Admin API. */
export const MODEL_PRICING: Record<ModelId, { input: number; output: number }> = {
  [MODEL_IDS.opus]: { input: 5, output: 25 },
  [MODEL_IDS.fable]: { input: 10, output: 50 },
  [MODEL_IDS.haiku]: { input: 1, output: 5 },
}
