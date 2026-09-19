import type { Env } from './types.js'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export interface ProxyUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export interface ProxyResult {
  status: number
  body: unknown
  usage: ProxyUsage | null
  latencyMs: number
}

/**
 * The only reason this proxy exists: the API key must never reach a child's
 * device. It also gives us one place to log token spend.
 *
 * Nothing personal about a child may be forwarded — only task text. Anthropic's
 * inference_geo does not offer EU residency, so the promise we make in the
 * privacy policy is "no personal data in prompts", and that has to hold here.
 */
export async function callAnthropic(env: Env, payload: Record<string, unknown>): Promise<ProxyResult> {
  const startedAt = Date.now()

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(payload),
  })

  const body = (await response.json()) as Record<string, unknown>
  const usage = (body.usage as ProxyUsage | undefined) ?? null

  return { status: response.status, body, usage, latencyMs: Date.now() - startedAt }
}

/** Prices in USD per 1M tokens, September 2026. Kept here so cost logging is self-contained. */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-fable-5-1': { input: 10, output: 50 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
}

export function estimateCostUsd(model: string, usage: ProxyUsage | null): number | null {
  const price = PRICING[model]
  if (!price || !usage) return null
  // Cached reads are billed at a discount; treated as full price here so the
  // logged figure is an upper bound, reconciled later against the Admin API.
  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000
}
