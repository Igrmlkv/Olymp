import { describe, expect, it } from 'vitest'
import { computeChecksum } from './checksum.js'
import { GRADE_MAPPING, type Task } from '@olymp/schema'

const task: Task = {
  id: 'math-4-0001',
  subject: 'math',
  grade: 4,
  grade_mapping: GRADE_MAPPING[4],
  topic: 'word_problems',
  level: 1,
  origin: 'generated',
  source_attribution: null,
  statement_md: 'test',
  answer: { type: 'number', value: 1 },
  solution_md: 'test',
  hints: ['hint'],
  verification: { verdict: 'pass', method: 'self_consistency_3', model: 'claude-opus-5' },
  points: 1,
}

describe('computeChecksum', () => {
  it('is stable for the same input', () => {
    expect(computeChecksum([task])).toBe(computeChecksum([task]))
  })

  it('changes when a statement changes', () => {
    expect(computeChecksum([task])).not.toBe(computeChecksum([{ ...task, statement_md: 'other' }]))
  })

  it('returns a 64-char hex digest, as the manifest schema requires', () => {
    expect(computeChecksum([task])).toMatch(/^[0-9a-f]{64}$/)
  })
})
