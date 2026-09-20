import { describe, expect, it } from 'vitest'
import { estimateCostUsd } from './anthropic.js'

describe('estimateCostUsd', () => {
  it('prices Opus 5 at $5/$25 per 1M tokens', () => {
    // 1M in, 1M out = 5 + 25
    expect(estimateCostUsd('claude-opus-5', { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(30)
  })

  it('prices Haiku 4.5 at $1/$5 per 1M tokens', () => {
    expect(estimateCostUsd('claude-haiku-4-5-20251001', { input_tokens: 1_000_000, output_tokens: 0 })).toBe(1)
  })

  it('returns null for an unknown model rather than guessing a price', () => {
    expect(estimateCostUsd('some-future-model', { input_tokens: 100, output_tokens: 100 })).toBeNull()
  })

  it('returns null when the response carried no usage block', () => {
    expect(estimateCostUsd('claude-opus-5', null)).toBeNull()
  })
})
