import { describe, expect, it } from 'vitest'
import { FICTIONAL_EXAMPLES } from '../data/examples.ts'
import { analyze } from './classifier.ts'
import { csvCell, toCsv } from './csv.ts'
import { embedRequestUrl, fetchPostText, isPostLink, textFromEmbedHtml } from './fetchPost.ts'
import { normalizeSourceLink } from './storage.ts'
import type { SavedPost } from './types.ts'

function run(text: string) {
  const result = analyze(text)
  if (!result) throw new Error('expected an analysis')
  return result
}

describe('analyze', () => {
  it('returns null for empty or whitespace-only input', () => {
    expect(analyze('')).toBeNull()
    expect(analyze('   \n ')).toBeNull()
  })

  it('labels every fictional example with its intended sentiment', () => {
    for (const example of FICTIONAL_EXAMPLES) {
      expect(run(example.text).sentiment, example.id).toBe(example.sentiment)
    }
  })

  it('includes two positive, two negative, one mixed and one neutral example', () => {
    const count = (sentiment: string) => FICTIONAL_EXAMPLES.filter((e) => e.sentiment === sentiment).length
    expect(FICTIONAL_EXAMPLES).toHaveLength(6)
    expect(count('positive')).toBe(2)
    expect(count('negative')).toBe(2)
    expect(count('mixed')).toBe(1)
    expect(count('neutral')).toBe(1)
  })

  it('does not flag the clear-cut examples for review', () => {
    for (const example of FICTIONAL_EXAMPLES.filter((e) => e.sentiment !== 'mixed')) {
      expect(run(example.text).reviewReasons, example.id).toEqual([])
    }
  })

  it('flags the mixed example for conflicting opinions', () => {
    const mixed = FICTIONAL_EXAMPLES.find((e) => e.sentiment === 'mixed')!
    expect(run(mixed.text).reviewReasons.map((r) => r.kind)).toEqual(['conflict'])
  })

  it('flips a positive cue after a negator', () => {
    const result = run('These Nike Dunks are not comfortable at all.')
    expect(result.sentiment).toBe('negative')
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]).toMatchObject({ text: 'not comfortable', polarity: 'negative', negatedBy: 'not' })
    expect(result.explanation).toContain('flips')
  })

  it('flips a negative cue after a negator', () => {
    expect(run('Wore my Jordans all day, no problems.').sentiment).toBe('positive')
    expect(run("The Pegasus isn't bad for the price.").sentiment).toBe('positive')
  })

  it('does not carry negation across punctuation', () => {
    const result = run('No, I love these Nike runners.')
    expect(result.sentiment).toBe('positive')
    expect(result.signals[0].negatedBy).toBeUndefined()
  })

  it("treats “can't wait” as a positive phrase, not a negation", () => {
    const result = run("Can't wait for the new Jordans to drop.")
    expect(result.sentiment).toBe('positive')
    expect(result.signals[0].term).toBe("can't wait")
  })

  it('records exact character positions for each signal', () => {
    const text = 'My Nike order arrived late and the box was damaged.'
    for (const signal of run(text).signals) {
      expect(text.slice(signal.start, signal.end)).toBe(signal.text)
    }
  })

  it('lets a clearly stronger side win but still asks for review', () => {
    const result = run('Love the Air Max. Best shoe I own, perfect fit, a bit pricey.')
    expect(result.sentiment).toBe('positive')
    expect(result.reviewReasons.map((r) => r.kind)).toContain('conflict')
  })

  it('flags possible sarcasm without claiming to detect it', () => {
    const result = run('Oh great, another SNKRS draw I lost. Thanks, Nike.')
    const sarcasm = result.reviewReasons.find((r) => r.kind === 'sarcasm')
    expect(sarcasm?.message).toMatch(/^Possible sarcasm/)
    expect(result.highlights.some((h) => h.kind === 'sarcasm' || h.flagged)).toBe(true)
    expect(result.highlights.find((h) => h.kind === 'positive')?.flagged).toBe(true)
  })

  it('flags a positive word in quotation marks', () => {
    const result = run('The “premium” leather on these Nike Dunks cracked in a week.')
    expect(result.reviewReasons.map((r) => r.kind)).toContain('sarcasm')
  })

  it('flags missing context for short posts, replies, links and off-topic text', () => {
    expect(run('Nike. Wow.').reviewReasons.map((r) => r.kind)).toContain('context')
    expect(run('@someone the Nike ones were better in person').reviewReasons.some((r) => r.message.includes('reply'))).toBe(true)
    expect(run('Look at these Nike Dunks https://example.com/a').reviewReasons.some((r) => r.message.includes('link'))).toBe(true)
    expect(run('The weather is lovely and the coffee is hot today.').reviewReasons.some((r) => r.message.includes('Nike'))).toBe(true)
  })

  it('keeps highlights sorted and non-overlapping', () => {
    const result = run('Love how my Nike Dunks creased after one wear. So "premium". 🙄')
    for (let i = 1; i < result.highlights.length; i++) {
      expect(result.highlights[i].start).toBeGreaterThanOrEqual(result.highlights[i - 1].end)
    }
  })
})

describe('csv export', () => {
  const post: SavedPost = {
    id: '1',
    text: 'He said "wow", then left\nthe Nike store',
    sourceLink: 'https://x.com/someone/status/1',
    predicted: 'neutral',
    corrected: 'positive',
    needsReview: false,
    fictional: false,
  }

  it('writes a header and one quoted row per post', () => {
    const lines = toCsv([post, { ...post, id: '2', text: 'plain', corrected: null }]).trim().split('\r\n')
    expect(lines[0]).toBe('text,source_link,predicted_sentiment,user_corrected_sentiment,needs_human_review,fictional_example')
    expect(toCsv([post])).toContain('"He said ""wow"", then left\nthe Nike store","https://x.com/someone/status/1","neutral","positive","no","no"')
    expect(lines.at(-1)).toBe('"plain","https://x.com/someone/status/1","neutral","","no","no"')
  })

  it('neutralizes cells a spreadsheet would run as a formula', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"')
    expect(csvCell('@nike nice')).toBe('"\'@nike nice"')
    expect(csvCell('nice')).toBe('"nice"')
  })
})

describe('normalizeSourceLink', () => {
  it('accepts blank input and https links to x.com or twitter.com', () => {
    expect(normalizeSourceLink('  ')).toBe('')
    expect(normalizeSourceLink('https://x.com/someone/status/123')).toBe('https://x.com/someone/status/123')
    expect(normalizeSourceLink('https://www.twitter.com/someone/status/123')).toBe('https://www.twitter.com/someone/status/123')
  })

  it('rejects other sites, other protocols and non-links', () => {
    expect(normalizeSourceLink('https://example.com/x.com')).toBeNull()
    expect(normalizeSourceLink('http://x.com/someone/status/1')).toBeNull()
    expect(normalizeSourceLink('javascript:alert(1)')).toBeNull()
    expect(normalizeSourceLink('x.com/someone')).toBeNull()
  })
})

describe('link-only text fetching', () => {
  const embedHtml =
    '<blockquote class="twitter-tweet" data-dnt="true"><p lang="en" dir="ltr">Love the new Dunks &amp; the box.<br>Not a &quot;premium&quot; price though &#39;25 <a href="https://t.co/abc">https://t.co/abc</a></p>&mdash; Someone (@someone) <a href="https://x.com/someone/status/1">May 1, 2025</a></blockquote>\n'

  function respond(status: number, body: unknown): typeof fetch {
    return (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as typeof fetch
  }

  it('recognizes links to a single post', () => {
    expect(isPostLink('https://x.com/someone/status/123')).toBe(true)
    expect(isPostLink('https://twitter.com/someone/statuses/123?s=20')).toBe(true)
    expect(isPostLink('https://x.com/someone')).toBe(false)
    expect(isPostLink('not a link')).toBe(false)
  })

  it('builds a request to the public embed endpoint with the link encoded', () => {
    const url = new URL(embedRequestUrl('https://x.com/someone/status/123?s=20&t=a'))
    expect(url.origin + url.pathname).toBe('https://publish.x.com/oembed')
    expect(url.searchParams.get('url')).toBe('https://x.com/someone/status/123?s=20&t=a')
    expect(url.searchParams.get('omit_script')).toBe('true')
  })

  it('extracts plain text from the embed markup', () => {
    expect(textFromEmbedHtml(embedHtml)).toBe(
      'Love the new Dunks & the box.\nNot a "premium" price though \'25 https://t.co/abc',
    )
    expect(textFromEmbedHtml('<blockquote>no paragraph</blockquote>')).toBe('')
  })

  it('returns the text for a public post', async () => {
    const result = await fetchPostText('https://x.com/someone/status/1', respond(200, { html: embedHtml }))
    expect(result).toEqual({ ok: true, text: textFromEmbedHtml(embedHtml) })
  })

  it('reports missing posts, empty posts and network trouble separately', async () => {
    const link = 'https://x.com/someone/status/1'
    expect(await fetchPostText(link, respond(404, '<html>'))).toEqual({ ok: false, reason: 'not-found' })
    expect(await fetchPostText(link, respond(200, { html: '<blockquote><p></p></blockquote>' }))).toEqual({ ok: false, reason: 'empty' })
    expect(await fetchPostText(link, respond(500, 'oops'))).toEqual({ ok: false, reason: 'network' })
    expect(await fetchPostText(link, respond(200, 'not json'))).toEqual({ ok: false, reason: 'network' })
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await fetchPostText(link, offline)).toEqual({ ok: false, reason: 'network' })
  })
})
