/**
 * Model roles, per docs/spec-v4.md section 7. Generation and verification are
 * deliberately the same model run independently, not a weaker checker: a cheap
 * verifier would rubber-stamp the generator's mistakes.
 */
export const MODELS = {
  /** Task generation, with extended thinking and few-shot from the archive. */
  generator: 'claude-opus-5',
  /** Independent solver run for self-consistency voting. */
  verifier: 'claude-opus-5',
  /** Contested cases and fine linguistic judgement in Russian. */
  adjudicator: 'claude-fable-5-1',
  /** Hint rephrasing, TTS copy, other bulk auxiliary work. */
  auxiliary: 'claude-haiku-4-5-20251001',
} as const

/** Independent solver runs per task; a task passes on a strict majority. */
export const SELF_CONSISTENCY_RUNS = 3
export const SELF_CONSISTENCY_THRESHOLD = 2
