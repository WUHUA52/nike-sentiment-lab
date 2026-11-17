export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed'

export const SENTIMENTS: Sentiment[] = ['positive', 'negative', 'neutral', 'mixed']

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
  mixed: 'Mixed',
}

/** A word or phrase that pushed the label one way. */
export interface Signal {
  /** The text as it appears in the post, including any negator in front. */
  text: string
  start: number
  end: number
  polarity: 'positive' | 'negative'
  weight: number
  /** The lexicon entry that matched, e.g. "comfortable" for "not comfortable". */
  term: string
  negatedBy?: string
  intensifiedBy?: string
}

export type ReviewKind = 'sarcasm' | 'conflict' | 'context'

export interface ReviewReason {
  kind: ReviewKind
  message: string
}

/** A span to mark in the post. Signals plus any sarcasm cues that do not overlap them. */
export interface Highlight {
  start: number
  end: number
  kind: 'positive' | 'negative' | 'sarcasm'
  /** True for a cue that sits inside a phrase flagged as possible sarcasm. */
  flagged?: boolean
}

export interface Analysis {
  sentiment: Sentiment
  signals: Signal[]
  /** Sum of matched cue weights. These are rule points, not probabilities. */
  positivePoints: number
  negativePoints: number
  explanation: string
  reviewReasons: ReviewReason[]
  highlights: Highlight[]
}

export interface SavedPost {
  id: string
  text: string
  /** Validated x.com or twitter.com link, or an empty string. */
  sourceLink: string
  predicted: Sentiment
  /** Set only when the user chose a label different from the prediction. */
  corrected: Sentiment | null
  needsReview: boolean
  /** True when the text is one of the built-in fictional examples. */
  fictional: boolean
}
