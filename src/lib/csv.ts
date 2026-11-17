import type { SavedPost } from './types.ts'

export const CSV_HEADER = [
  'text',
  'source_link',
  'predicted_sentiment',
  'user_corrected_sentiment',
  'needs_human_review',
  'fictional_example',
]

/**
 * Quote one cell. A cell that starts with = + - or @ gets a leading apostrophe
 * so a spreadsheet shows it as text instead of running it as a formula.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(posts: SavedPost[]): string {
  const rows = posts.map((post) =>
    [
      post.text,
      post.sourceLink,
      post.predicted,
      post.corrected ?? '',
      post.needsReview ? 'yes' : 'no',
      post.fictional ? 'yes' : 'no',
    ]
      .map(csvCell)
      .join(','),
  )
  return [CSV_HEADER.join(','), ...rows].join('\r\n') + '\r\n'
}

/** Trigger a browser download of the saved posts. */
export function downloadCsv(posts: SavedPost[], filename = 'sentiment-lab-export.csv'): void {
  // The byte-order mark makes Excel read the file as UTF-8, which keeps emoji intact.
  const blob = new Blob(['\uFEFF', toCsv(posts)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
