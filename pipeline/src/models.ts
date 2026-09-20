/**
 * Model roles, per docs/spec-v4.md section 7. Generation and verification are
 * deliberately the same model run independently, not a weaker checker: a cheap
 * verifier would rubber-stamp the generator's mistakes.
 */
import { MODEL_IDS } from '@olymp/schema'

export const MODELS = {
  /** Task generation, with extended thinking and few-shot from the archive. */
  generator: MODEL_IDS.opus,
  /** Independent solver run for self-consistency voting. */
  verifier: MODEL_IDS.opus,
  /** Contested cases and fine linguistic judgement in Russian. */
  adjudicator: MODEL_IDS.fable,
  /** Hint rephrasing, TTS copy, other bulk auxiliary work. */
  auxiliary: MODEL_IDS.haiku,
} as const

/**
 * Independent solver runs per task. A task passes only on unanimity — a single
 * run calling the wording ambiguous sends it to the adjudicator. There is no
 * separate threshold: a "2 of 3" knob that never changed anything is worse
 * than no knob.
 */
export const SELF_CONSISTENCY_RUNS = 3

/** Tasks verified at once. Each one fans out to SELF_CONSISTENCY_RUNS requests. */
export const VERIFY_CONCURRENCY = 4
