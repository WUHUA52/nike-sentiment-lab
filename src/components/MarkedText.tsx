import type { CSSProperties, ReactNode } from 'react'
import type { Highlight } from '../lib/types.ts'

interface MarkedTextProps {
  text: string
  highlights: Highlight[]
}

/** The post with every cue the rules used marked in place. */
export function MarkedText({ text, highlights }: MarkedTextProps) {
  const parts: ReactNode[] = []
  let cursor = 0

  highlights.forEach((highlight, index) => {
    if (highlight.start < cursor) return
    if (highlight.start > cursor) parts.push(text.slice(cursor, highlight.start))
    parts.push(
      <mark key={index} className={`cue cue--${highlight.kind}${highlight.flagged ? ' cue--flagged' : ''}`} style={{ '--order': index } as CSSProperties}>
        {text.slice(highlight.start, highlight.end)}
      </mark>,
    )
    cursor = highlight.end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))

  return (
    <>
      <blockquote className="marked">{parts}</blockquote>
      {highlights.length > 0 && (
        <p className="marked__key">
          Lime marks a positive cue and orange a negative one. Amber marks a phrase flagged as possible sarcasm.
        </p>
      )}
    </>
  )
}
