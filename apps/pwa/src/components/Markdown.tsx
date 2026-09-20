import { memo } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Figures travel inside the package as data URIs, which react-markdown strips by
 * default. Only base64 WebP images are let through — an image data URI cannot
 * execute, and narrowing it to one type keeps `data:text/html` and friends out.
 */
function urlTransform(url: string): string {
  return url.startsWith('data:image/webp;base64,') ? url : defaultUrlTransform(url)
}

/**
 * Task statements and solutions are Markdown: archive tasks carry blockquoted
 * source texts and comparison tables that are part of the wording.
 *
 * Raw HTML is deliberately NOT enabled. Packages arrive over the network, and
 * the checksum only proves the manifest agrees with itself — it is not a
 * signature, so package content is never trusted enough to inject as HTML.
 *
 * Memoised because react-markdown re-parses on every render: olympiad mode
 * re-renders once a second for the timer, and on every keystroke, with a dozen
 * statements on screen.
 */
export const Markdown = memo(function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform}>
        {children}
      </ReactMarkdown>
    </div>
  )
})
