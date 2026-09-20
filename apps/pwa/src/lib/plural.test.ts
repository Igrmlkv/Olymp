import { describe, expect, it } from 'vitest'
import { daysWord, pointsWord, tasksWord } from './plural.js'

describe('Russian numeral agreement', () => {
  it('uses the singular for 1 and the few-form for 2-4', () => {
    expect(`1 ${tasksWord(1)}`).toBe('1 задача')
    expect(`3 ${tasksWord(3)}`).toBe('3 задачи')
    expect(`7 ${tasksWord(7)}`).toBe('7 задач')
  })

  it('uses the many-form through the teens, where the last digit misleads', () => {
    expect(`11 ${pointsWord(11)}`).toBe('11 баллов')
    expect(`12 ${pointsWord(12)}`).toBe('12 баллов')
    expect(`14 ${pointsWord(14)}`).toBe('14 баллов')
  })

  it('goes back to the last digit above 20', () => {
    expect(`21 ${pointsWord(21)}`).toBe('21 балл')
    expect(`52 ${pointsWord(52)}`).toBe('52 балла')
    expect(`56 ${pointsWord(56)}`).toBe('56 баллов')
    expect(`8 ${pointsWord(8)}`).toBe('8 баллов')
  })

  it('handles zero and 100-boundaries', () => {
    expect(`0 ${daysWord(0)}`).toBe('0 дней')
    expect(`100 ${daysWord(100)}`).toBe('100 дней')
    expect(`101 ${daysWord(101)}`).toBe('101 день')
    expect(`111 ${daysWord(111)}`).toBe('111 дней')
  })
})
