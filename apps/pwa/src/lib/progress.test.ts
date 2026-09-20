import { describe, expect, it } from 'vitest'
import { stateOf } from './progress.js'
import type { TaskProgress } from './db.js'

function row(overrides: Partial<TaskProgress>): TaskProgress {
  return {
    taskId: 'math-4-0001',
    subject: 'math',
    grade: 4,
    topic: 'logic',
    level: 3,
    attempts: 1,
    hintsUsed: 0,
    solvedAt: null,
    lastAttemptAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  }
}

describe('stateOf', () => {
  it('treats a task with no row as untouched', () => {
    expect(stateOf(undefined)).toBe('untouched')
  })

  it('marks a task attempted while it has no solve time', () => {
    expect(stateOf(row({ attempts: 3 }))).toBe('attempted')
  })

  it('marks a task solved once it has one', () => {
    expect(stateOf(row({ solvedAt: '2026-09-20T10:05:00.000Z' }))).toBe('solved')
  })

  it('keeps a task solved even after later wrong attempts', () => {
    // submit() preserves the original solvedAt, so a child revisiting a solved
    // task and slipping does not lose the tick.
    expect(stateOf(row({ attempts: 9, solvedAt: '2026-09-20T10:05:00.000Z' }))).toBe('solved')
  })
})
