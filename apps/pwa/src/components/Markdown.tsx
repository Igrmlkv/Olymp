import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Task statements and solutions are Markdown: archive tasks carry blockquoted
 * source texts and comparison tables that are part of the wording.
 *
 * Raw HTML is deliberately NOT enabled. Packages arrive over the network, and
 * the checksum only proves the manifest agrees with itself — it is not a
 * signature, so package content is never trusted enough to inject as HTML.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
