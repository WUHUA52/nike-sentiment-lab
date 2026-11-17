import { SENTIMENTS, type SavedPost, type Sentiment } from './types.ts'

const STORAGE_KEY = 'sentiment-lab:collection:v1'

function isSentiment(value: unknown): value is Sentiment {
  return typeof value === 'string' && (SENTIMENTS as string[]).includes(value)
}

function isSavedPost(value: unknown): value is SavedPost {
  if (typeof value !== 'object' || value === null) return false
  const post = value as Record<string, unknown>
  return (
    typeof post.id === 'string' &&
    typeof post.text === 'string' &&
    typeof post.sourceLink === 'string' &&
    isSentiment(post.predicted) &&
    (post.corrected === null || isSentiment(post.corrected)) &&
    typeof post.needsReview === 'boolean' &&
    typeof post.fictional === 'boolean'
  )
}

/** Read the collection for this browser tab. Anything unreadable is ignored. */
export function loadCollection(): SavedPost[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSavedPost) : []
  } catch {
    return []
  }
}

/** Write the collection. Fails quietly when storage is blocked or full. */
export function saveCollection(posts: SavedPost[]): void {
  try {
    if (posts.length === 0) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  } catch {
    // The app keeps working from memory for the rest of the visit.
  }
}

/**
 * Accept only links to a post on x.com or twitter.com. Returns the cleaned
 * link, an empty string for blank input, or null when the link is not usable.
 */
export function normalizeSourceLink(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === '') return ''
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^(?:www|mobile)\./, '')
  if (url.protocol !== 'https:' || (host !== 'x.com' && host !== 'twitter.com')) return null
  return url.toString()
}
