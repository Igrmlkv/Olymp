import { describe, expect, it } from 'vitest'
import { previews } from './preview.js'

describe('previews', () => {
  it('uses the first sentence when it already identifies the task', () => {
    expect(previews(['Сколько всего яблок? Объясни ответ.'])).toEqual(['Сколько всего яблок?'])
  })

  it('skips an opening the neighbours share', () => {
    const [a, b] = previews([
      'Прочитайте текст. Выпишите все существительные.',
      'Прочитайте текст. Найдите грамматическую основу.',
    ])

    expect(a).toBe('Выпишите все существительные.')
    expect(b).toBe('Найдите грамматическую основу.')
  })

  it('drops images and Markdown noise', () => {
    expect(previews(['**Жирный** текст ![схема](data:image/webp;base64,AAA) дальше.'])).toEqual([
      'Жирный текст дальше.',
    ])
  })

  it('falls back to the shared opening when nothing else differs', () => {
    // Two tasks that differ only by their picture: the text cannot separate
    // them, and an empty row would be worse than a repeated one.
    expect(previews(['Сколько здесь фигур?', 'Сколько здесь фигур?'])).toEqual([
      'Сколько здесь фигур?',
      'Сколько здесь фигур?',
    ])
  })
})
