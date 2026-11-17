import { describe, expect, it } from 'vitest'
import { FICTIONAL_EXAMPLES } from '../data/examples.ts'
import { analyze } from './classifier.ts'
import { csvCell, toCsv } from './csv.ts'
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
