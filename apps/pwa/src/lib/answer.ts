import type { Answer } from '@olymp/schema'

/**
 * Normalises the way a 10-year-old actually types: stray spaces, ё/е, comma
 * decimals, and whichever dash their keyboard produced. Ordering answers like
 * "Маша–Катя–Оля–Вика" are otherwise marked wrong over an en dash.
 */
function normalise(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
}

function parseNumber(input: string): number | null {
  const value = Number(normalise(input).replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

export function checkAnswer(answer: Answer, submitted: string | string[]): boolean {
  switch (answer.type) {
    case 'number': {
      if (Array.isArray(submitted)) return false
      const value = parseNumber(submitted)
      if (value === null) return false
      return Math.abs(value - answer.value) <= (answer.tolerance ?? 0)
    }
    case 'string': {
      if (Array.isArray(submitted)) return false
      const candidate = normalise(submitted)
      return [answer.value, ...answer.accept].some((v) => normalise(v) === candidate)
    }
    case 'choice': {
      if (Array.isArray(submitted)) return false
      return normalise(submitted) === normalise(answer.value)
    }
    case 'multi': {
      const values = Array.isArray(submitted) ? submitted : [submitted]
      if (values.length !== answer.value.length) return false
      const expected = new Set(answer.value.map(normalise))
      return values.every((v) => expected.has(normalise(v)))
    }
  }
}
