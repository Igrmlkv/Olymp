import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ContentPackageSchema, type Answer, type ContentPackage } from '@olymp/schema'
import { checkAnswer } from './answer.js'

/**
 * Every shipped task, checked against its own answer the way the app submits
 * it. A task whose key the checker rejects is unsolvable in the app: the child
 * types the organiser's answer and is told they are wrong. Nothing else in the
 * suite would notice — the unit tests use fixtures, and the e2e tour opens a
 * handful of tasks, not two hundred.
 */
const SUBJECTS = ['math', 'russian'] as const

function load(subject: string): ContentPackage {
  const url = new URL(`../../../../content/packages/${subject}/grade-4/latest.json`, import.meta.url)
  return ContentPackageSchema.parse(JSON.parse(readFileSync(fileURLToPath(url), 'utf8')))
}

/** Exactly what AnswerInput hands to checkAnswer for a correct attempt. */
function asTyped(answer: Answer): string | string[] {
  switch (answer.type) {
    case 'number':
      return String(answer.value)
    case 'multi':
    case 'parts':
      return answer.value
    default:
      return answer.value
  }
}

describe.each(SUBJECTS)('%s grade 4', (subject) => {
  const pkg = load(subject)

  it('accepts every task’s own answer', () => {
    const rejected = pkg.tasks
      .filter((task) => !checkAnswer(task.answer, asTyped(task.answer)))
      .map((task) => `${task.id} (${task.answer.type})`)

    expect(rejected).toEqual([])
  })

  it('gives every task a non-empty answer to type', () => {
    const empty = pkg.tasks
      .filter((task) => {
        const typed = asTyped(task.answer)
        return Array.isArray(typed)
          ? typed.some((v) => v.trim() === '')
          : String(typed).trim() === ''
      })
      .map((task) => task.id)

    expect(empty).toEqual([])
  })
})
