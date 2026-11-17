/**
 * Link-only mode: get a post's text from its link.
 *
 * This uses X's public oEmbed endpoint, the same one websites use to embed a
 * post. It needs no API key and no login, and it only works for public posts.
 * Nothing is scraped from x.com pages.
 */

export const EMBED_ENDPOINT = 'https://publish.x.com/oembed'

const FETCH_TIMEOUT_MS = 10_000

export type FetchFailure = 'not-found' | 'network' | 'empty'

export type FetchResult = { ok: true; text: string } | { ok: false; reason: FetchFailure }

/** True when the link points at one post, e.g. https://x.com/name/status/123. */
export function isPostLink(link: string): boolean {
  try {
    return /\/status(?:es)?\/\d+/.test(new URL(link).pathname)
  } catch {
    return false
  }
}

export function embedRequestUrl(link: string): string {
  const params = new URLSearchParams({ url: link, omit_script: 'true', dnt: 'true' })
  return `${EMBED_ENDPOINT}?${params.toString()}`
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

/**
 * Pull the post text out of the embed markup, which looks like
 * <blockquote><p>the text<br>more text <a>link</a></p>&mdash; Name (@handle) ...</blockquote>.
 * The result is plain text. No markup from the response is ever rendered.
 */
export function textFromEmbedHtml(html: string): string {
  const paragraph = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(html)
  if (!paragraph) return ''
  const withBreaks = paragraph[1].replace(/<br\s*\/?>/gi, '\n')
  const withoutTags = withBreaks.replace(/<[^>]+>/g, '')
  return decodeEntities(withoutTags).trim()
}

/** Ask X's embed endpoint for the text of one public post. */
export async function fetchPostText(link: string, fetchImpl: typeof fetch = fetch): Promise<FetchResult> {
  let response: Response
  try {
    response = await fetchImpl(embedRequestUrl(link), {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    return { ok: false, reason: 'network' }
  }

  // X answers 404 for a missing post and 403 for a private or restricted one.
  if (response.status === 404 || response.status === 403) return { ok: false, reason: 'not-found' }
  if (!response.ok) return { ok: false, reason: 'network' }

  let html: unknown
  try {
    html = ((await response.json()) as { html?: unknown }).html
  } catch {
    return { ok: false, reason: 'network' }
  }

  const text = typeof html === 'string' ? textFromEmbedHtml(html) : ''
  return text === '' ? { ok: false, reason: 'empty' } : { ok: true, text }
}
