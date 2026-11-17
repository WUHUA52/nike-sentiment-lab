import {
  CONTRAST_WORDS,
  INTENSIFIERS,
  NEGATIVE_TERMS,
  NEGATORS,
  NIKE_PHRASES,
  NIKE_WORDS,
  POSITIVE_TERMS,
  SARCASM_PATTERNS,
} from './lexicon.ts'
import type { Analysis, Highlight, ReviewReason, Sentiment, Signal } from './types.ts'

/**
 * Rule-based sentiment classifier. No model, no training data, no network.
 *
 * 1. Split the post into words, punctuation and emoji, remembering positions.
 * 2. Match words and short phrases against the positive and negative lists.
 * 3. Flip a cue when a negator ("not", "never", "isn't") sits just before it.
 * 4. Add up the points on each side and pick a label.
 * 5. Raise "Needs human review" for possible sarcasm, conflicting opinions
 *    or missing context. The flag never changes the label.
 */

interface Token {
  norm: string
  start: number
  end: number
  kind: 'word' | 'punct' | 'emoji' | 'url'
}

const TOKEN_RE =
  /https?:\/\/\S+|[@#]?[\p{L}\p{N}_]+(?:['’][\p{L}]+)*|[.!?;:,…—–()"“”]|\p{Extended_Pictographic}\uFE0F?/gu

const MAX_PHRASE_WORDS = 3
const NEGATION_REACH = 3
const BARE_NEGATORS = /^(?:dont|doesnt|didnt|isnt|wasnt|arent|werent|wont|cant|couldnt|wouldnt|shouldnt)$/

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  for (const match of text.matchAll(TOKEN_RE)) {
    const raw = match[0]
    const start = match.index
    const end = start + raw.length
    if (/^https?:\/\//i.test(raw)) {
      tokens.push({ norm: raw, start, end, kind: 'url' })
    } else if (/^\p{Extended_Pictographic}/u.test(raw)) {
      tokens.push({ norm: raw.replace(/\uFE0F/g, ''), start, end, kind: 'emoji' })
    } else if (/^[\p{L}\p{N}_@#]/u.test(raw)) {
      const norm = raw.toLowerCase().replace(/’/g, "'").replace(/^[@#]/, '')
      tokens.push({ norm, start, end, kind: 'word' })
    } else {
      tokens.push({ norm: raw, start, end, kind: 'punct' })
    }
  }
  return tokens
}

function isNegator(norm: string): boolean {
  return NEGATORS.has(norm) || norm.endsWith("n't") || BARE_NEGATORS.test(norm)
}

function isLexical(token: Token | undefined): token is Token {
  return token !== undefined && (token.kind === 'word' || token.kind === 'emoji')
}

function findSignals(text: string, tokens: Token[]): Signal[] {
  const signals: Signal[] = []
  const used = new Array<boolean>(tokens.length).fill(false)

  for (let i = 0; i < tokens.length; i++) {
    if (!isLexical(tokens[i])) continue

    // Longest phrase first, so "can't wait" wins over the negator "can't".
    let matched: { term: string; length: number; polarity: 'positive' | 'negative'; weight: number } | null = null
    for (let length = MAX_PHRASE_WORDS; length >= 1 && !matched; length--) {
      const slice = tokens.slice(i, i + length)
      if (slice.length < length || !slice.every(isLexical)) continue
      const term = slice.map((t) => t.norm).join(' ')
      if (term in POSITIVE_TERMS) {
        matched = { term, length, polarity: 'positive', weight: POSITIVE_TERMS[term] }
      } else if (term in NEGATIVE_TERMS) {
        matched = { term, length, polarity: 'negative', weight: NEGATIVE_TERMS[term] }
      }
    }
    if (!matched) continue

    // Look back a few words for a negator. Punctuation, a contrast word or an
    // earlier cue ends the search.
    let negatorIndex = -1
    for (let j = i - 1; j >= 0 && j >= i - NEGATION_REACH; j--) {
      const previous = tokens[j]
      if (previous.kind !== 'word' || used[j] || CONTRAST_WORDS.has(previous.norm)) break
      if (isNegator(previous.norm)) {
        negatorIndex = j
        break
      }
    }

    const before = tokens[i - 1]
    const intensified = i > 0 && before.kind === 'word' && !used[i - 1] && INTENSIFIERS.has(before.norm)

    const firstIndex = negatorIndex >= 0 ? negatorIndex : intensified ? i - 1 : i
    const lastIndex = i + matched.length - 1
    const start = tokens[firstIndex].start
    const end = tokens[lastIndex].end

    const signal: Signal = {
      text: text.slice(start, end),
      start,
      end,
      term: matched.term,
      polarity: matched.polarity,
      weight: matched.weight,
    }

    if (negatorIndex >= 0) {
      // "not amazing" is a mild complaint, not a strong one, so a flipped cue
      // always counts as one point.
      signal.polarity = matched.polarity === 'positive' ? 'negative' : 'positive'
      signal.weight = 1
      signal.negatedBy = text.slice(tokens[negatorIndex].start, tokens[negatorIndex].end)
    } else if (intensified) {
      signal.weight += 1
      signal.intensifiedBy = text.slice(before.start, before.end)
    }

    for (let j = firstIndex; j <= lastIndex; j++) used[j] = true
    signals.push(signal)
    i = lastIndex
  }

  return signals
}

interface Cue {
  start: number
  end: number
  text: string
}

function findSarcasmCues(text: string): Cue[] {
  const cues: Cue[] = []
  for (const pattern of SARCASM_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[0]
      const trimmed = raw.trim()
      const start = match.index + raw.indexOf(trimmed)
      cues.push({ start, end: start + trimmed.length, text: trimmed })
    }
  }
  // A positive word inside quotation marks is often meant ironically: the "premium" leather.
  for (const match of text.matchAll(/["“]([^"“”]{1,24})["”]/g)) {
    const inner = match[1].toLowerCase().trim()
    if (inner.split(/\s+/).some((word) => word in POSITIVE_TERMS)) {
      cues.push({ start: match.index, end: match.index + match[0].length, text: match[0] })
    }
  }
  return cues.sort((a, b) => a.start - b.start)
}

function quoteList(items: string[]): string {
  const unique = [...new Set(items.map((item) => item.toLowerCase()))]
  const shown = unique.slice(0, 4).map((item) => `“${item}”`)
  const extra = unique.length - shown.length
  return extra > 0 ? `${shown.join(', ')} and ${extra} more` : shown.join(', ')
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function explain(sentiment: Sentiment, signals: Signal[], contrastWord: string | null): string {
  const positives = signals.filter((s) => s.polarity === 'positive')
  const negatives = signals.filter((s) => s.polarity === 'negative')
  const parts: string[] = []

  if (sentiment === 'neutral') {
    parts.push(
      'None of the words in this post are on the positive or negative lists, so it reads as neutral. That means no opinion words were matched. It does not prove the author has no opinion.',
    )
  } else if (sentiment === 'mixed') {
    parts.push(
      `This post has praise (${quoteList(positives.map((s) => s.text))}) and complaints (${quoteList(negatives.map((s) => s.text))}) of similar strength, so it reads as mixed.`,
    )
  } else {
    const winners = sentiment === 'positive' ? positives : negatives
    const losers = sentiment === 'positive' ? negatives : positives
    const other = sentiment === 'positive' ? 'negative' : 'positive'
    if (losers.length === 0) {
      parts.push(
        `Found ${plural(winners.length, `${sentiment} cue`)} (${quoteList(winners.map((s) => s.text))}) and no ${other} ones, so this reads as ${sentiment}.`,
      )
    } else {
      parts.push(
        `The ${sentiment} cues (${quoteList(winners.map((s) => s.text))}) clearly outweigh the ${other} ones (${quoteList(losers.map((s) => s.text))}), so this reads as ${sentiment} overall.`,
      )
    }
  }

  const flipped = signals.find((s) => s.negatedBy)
  if (flipped) {
    parts.push(
      `“${flipped.text}” counts as ${flipped.polarity} because “${flipped.negatedBy}” flips “${flipped.term}”.`,
    )
  }
  if (contrastWord && positives.length > 0 && negatives.length > 0) {
    parts.push(`The word “${contrastWord}” also signals a change of direction.`)
  }

  return parts.join(' ')
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

/** Classify one post. Returns null when there is nothing to analyze. */
export function analyze(input: string): Analysis | null {
  const text = input.trim()
  if (text === '') return null

  const tokens = tokenize(text)
  const signals = findSignals(text, tokens)
  const sarcasmCues = findSarcasmCues(text)

  const positivePoints = signals.filter((s) => s.polarity === 'positive').reduce((sum, s) => sum + s.weight, 0)
  const negativePoints = signals.filter((s) => s.polarity === 'negative').reduce((sum, s) => sum + s.weight, 0)

  let sentiment: Sentiment
  if (positivePoints === 0 && negativePoints === 0) {
    sentiment = 'neutral'
  } else if (positivePoints > 0 && negativePoints > 0) {
    // Both sides present. If the weaker side has at least half the points of
    // the stronger side, call it mixed. Otherwise the stronger side wins.
    const weaker = Math.min(positivePoints, negativePoints)
    const stronger = Math.max(positivePoints, negativePoints)
    sentiment = weaker / stronger >= 0.5 ? 'mixed' : positivePoints > negativePoints ? 'positive' : 'negative'
  } else {
    sentiment = positivePoints > 0 ? 'positive' : 'negative'
  }

  const words = tokens.filter((t) => t.kind === 'word')
  const contrastToken = words.find((t) => CONTRAST_WORDS.has(t.norm))
  const contrastWord = contrastToken ? text.slice(contrastToken.start, contrastToken.end).toLowerCase() : null

  const reviewReasons: ReviewReason[] = []

  if (sarcasmCues.length > 0) {
    reviewReasons.push({
      kind: 'sarcasm',
      message: `Possible sarcasm: ${quoteList(sarcasmCues.map((c) => c.text))} is often used ironically. A word list cannot tell, so the label may be the opposite of what the author meant.`,
    })
  }

  if (sentiment === 'mixed') {
    reviewReasons.push({
      kind: 'conflict',
      message: 'Conflicting opinions: praise and complaints both appear, and the rules cannot tell which one matters more to the author.',
    })
  } else if (positivePoints > 0 && negativePoints > 0) {
    reviewReasons.push({
      kind: 'conflict',
      message: 'Conflicting opinions: a few cues point the other way from the label.',
    })
  }

  const lowerText = text.toLowerCase()
  const mentionsNike = words.some((t) => NIKE_WORDS.has(t.norm)) || NIKE_PHRASES.some((phrase) => lowerText.includes(phrase))
  if (words.length < 4) {
    reviewReasons.push({ kind: 'context', message: 'Missing context: the post is very short, so there is little to go on.' })
  }
  if (/^@\w/.test(text)) {
    reviewReasons.push({
      kind: 'context',
      message: 'Missing context: this looks like a reply, and the post it answers is not included.',
    })
  }
  if (tokens.some((t) => t.kind === 'url')) {
    reviewReasons.push({
      kind: 'context',
      message: 'Missing context: the post includes a link, and this tool cannot see what it points to.',
    })
  }
  if (signals.length === 0 && text.includes('?')) {
    reviewReasons.push({
      kind: 'context',
      message: 'Missing context: this is a question with no opinion words, so its tone depends on the conversation around it.',
    })
  }
  if (!mentionsNike) {
    reviewReasons.push({
      kind: 'context',
      message: 'Missing context: no Nike-related term was found, so the post may be off topic or about something named elsewhere.',
    })
  }

  const highlights: Highlight[] = signals.map((s) => ({
    start: s.start,
    end: s.end,
    kind: s.polarity,
    flagged: sarcasmCues.some((cue) => overlaps(s, cue)),
  }))
  for (const cue of sarcasmCues) {
    if (!highlights.some((h) => overlaps(h, cue))) {
      highlights.push({ start: cue.start, end: cue.end, kind: 'sarcasm' })
    }
  }
  highlights.sort((a, b) => a.start - b.start)

  return {
    sentiment,
    signals,
    positivePoints,
    negativePoints,
    explanation: explain(sentiment, signals, contrastWord),
    reviewReasons,
    highlights,
  }
}
