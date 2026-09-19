import { describe, expect, it } from 'vitest'
import { GRADE_MAPPING } from './grade.js'
import { TaskSchema } from './task.js'
import { ContentPackageSchema } from './package-manifest.js'
import { findOlympiadFormat, olympiadMinutesForGrade } from './olympiad.js'

const validTask = {
  id: 'math-4-0001',
  subject: 'math',
  grade: 4,
  grade_mapping: GRADE_MAPPING[4],
  topic: 'word_problems',
  level: 2,
  origin: 'generated',
  source_attribution: null,
  statement_md: 'В корзине 24 яблока...',
  answer: { type: 'number', value: 8 },
  solution_md: '24 : 3 = 8',
  hints: ['Сколько всего частей?'],
  verification: { verdict: 'pass', method: 'self_consistency+python', model: 'claude-opus-5' },
  points: 3,
}

describe('TaskSchema', () => {
  it('accepts a generated task without attribution', () => {
    expect(TaskSchema.parse(validTask).id).toBe('math-4-0001')
  })

  it('rejects an archive task without attribution', () => {
    const result = TaskSchema.safeParse({ ...validTask, origin: 'archive' })
    expect(result.success).toBe(false)
  })

  it('rejects a topic that belongs to the other subject', () => {
    const result = TaskSchema.safeParse({ ...validTask, topic: 'orthography' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty hint ladder', () => {
    const result = TaskSchema.safeParse({ ...validTask, hints: [] })
    expect(result.success).toBe(false)
  })
})

describe('ContentPackageSchema', () => {
  const manifest = {
    package_id: 'math-4',
    version: '1.0.0',
    subject: 'math',
    grade: 4,
    created_at: '2026-09-19T00:00:00.000Z',
    prompt_version: 'gen-math-v1',
    task_count: 1,
    checksum: 'a'.repeat(64),
    verification_summary: { total: 1, passed: 1, failed: 0, needs_review: 0 },
  }

  it('accepts a consistent package', () => {
    expect(ContentPackageSchema.parse({ manifest, tasks: [validTask] }).tasks).toHaveLength(1)
  })

  it('rejects a task_count that disagrees with the task list', () => {
    const result = ContentPackageSchema.safeParse({ manifest: { ...manifest, task_count: 2 }, tasks: [validTask] })
    expect(result.success).toBe(false)
  })

  it('rejects a task from another subject', () => {
    const result = ContentPackageSchema.safeParse({
      manifest,
      tasks: [{ ...validTask, subject: 'russian', topic: 'orthography' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('olympiad formats', () => {
  it('defaults to the Moscow format, which is what the shipped packages contain', () => {
    const format = findOlympiadFormat('math', 4)
    expect(format).toMatchObject({ organizer: 'moscow', max_score: 8, scoring: 'binary' })
  })

  it('still exposes the Sirius format when asked for it', () => {
    expect(findOlympiadFormat('math', 4, 'sirius')).toMatchObject({ max_score: 56, scoring: 'partial' })
  })

  it('scores Russian grade 4 out of 52, per the 2025/26 answer key', () => {
    expect(findOlympiadFormat('russian', 4)).toMatchObject({ max_score: 52, season: '2025/26' })
  })

  it('follows the Sirius time ladder by grade', () => {
    expect(olympiadMinutesForGrade(4)).toBe(60)
    expect(olympiadMinutesForGrade(7)).toBe(90)
    expect(olympiadMinutesForGrade(10)).toBe(120)
  })
})

describe('answer options', () => {
  it('rejects a choice answer that is not among its own options', () => {
    const result = TaskSchema.safeParse({
      ...validTask,
      answer: { type: 'choice', value: 'жёлтый', options: ['красный', 'синий'] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a multi answer containing a value that is not an option', () => {
    const result = TaskSchema.safeParse({
      ...validTask,
      answer: { type: 'multi', value: ['а', 'я'], options: ['а', 'б', 'в'] },
    })
    expect(result.success).toBe(false)
  })

  it('accepts an archive task verified against an answer key, with no model', () => {
    const result = TaskSchema.safeParse({
      ...validTask,
      origin: 'archive',
      source_attribution: {
        name: 'Всероссийская олимпиада школьников, Москва',
        url: 'https://vos.olimpiada.ru/',
        year: 2025,
        stage: 'school',
      },
      verification: { verdict: 'pass', method: 'official_answer_key', model: null },
    })
    expect(result.success).toBe(true)
  })
})
