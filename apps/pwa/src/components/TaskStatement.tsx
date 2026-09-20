import { STAGE_LABELS_RU, type Task } from '@olymp/schema'
import { Markdown } from './Markdown.js'

/**
 * A statement and, for archive tasks, its source — together, in one component,
 * so a screen physically cannot render the text without the attribution.
 * Attribution is the legal footing for using the archive at all (Auteurswet
 * art. 15a, docs/legal/attribution.md); olympiad mode was already showing
 * archive statements without it.
 */
export function TaskStatement({ task }: { task: Task }) {
  const source = task.source_attribution

  return (
    <>
      <Markdown className="statement">{task.statement_md}</Markdown>
      {source && (
        <p className="attribution">
          Источник: {source.name}, {STAGE_LABELS_RU[source.stage]}, {source.year} ·{' '}
          <a href={source.url} target="_blank" rel="noreferrer noopener">
            оригинал
          </a>
        </p>
      )}
    </>
  )
}
