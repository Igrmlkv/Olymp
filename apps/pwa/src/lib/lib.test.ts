import { describe, expect, it } from 'vitest'
import type { Answer } from '@olymp/schema'
import { checkAnswer } from './answer.js'
import { previousDate } from './time.js'

describe('checkAnswer', () => {
  it('accepts a comma decimal', () => {
    expect(checkAnswer({ type: 'number', value: 2.5 }, '2,5')).toBe(true)
  })

  it('respects the tolerance window', () => {
    expect(checkAnswer({ type: 'number', value: 3.14, tolerance: 0.01 }, '3.15')).toBe(true)
    expect(checkAnswer({ type: 'number', value: 3.14, tolerance: 0.01 }, '3.2')).toBe(false)
  })

  it('treats ё and е as the same letter', () => {
    expect(checkAnswer({ type: 'string', value: 'ёжик', accept: [] }, 'ежик')).toBe(true)
  })

  it('accepts a listed alternative spelling', () => {
    expect(checkAnswer({ type: 'string', value: 'подлежащее', accept: ['подлежащие'] }, 'ПОДЛЕЖАЩИЕ')).toBe(true)
  })

  it('requires every option for a multi answer, in any order', () => {
    const answer: Answer = { type: 'multi', value: ['а', 'б'], options: ['а', 'б', 'в'] }
    expect(checkAnswer(answer, ['б', 'а'])).toBe(true)
    expect(checkAnswer(answer, ['а'])).toBe(false)
  })
})

describe('previousDate', () => {
  it('steps back across a month boundary', () => {
    expect(previousDate('2026-03-01')).toBe('2026-02-28')
  })

  it('steps back across a DST change in Amsterdam', () => {
    expect(previousDate('2026-03-29')).toBe('2026-03-28')
  })
})
