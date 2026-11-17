import type { Sentiment } from '../lib/types.ts'

export interface FictionalExample {
  id: string
  /** The label this example is meant to demonstrate. */
  sentiment: Sentiment
  text: string
}

/**
 * Six made-up posts written for this demo. They are not real tweets, were not
 * posted by anyone, and deliberately have no source link.
 */
export const FICTIONAL_EXAMPLES: FictionalExample[] = [
  {
    id: 'positive-1',
    sentiment: 'positive',
    text: 'Six miles in the new Pegasus this morning and my knees feel great. Lightweight, bouncy, and worth every penny.',
  },
  {
    id: 'positive-2',
    sentiment: 'positive',
    text: 'Finally unboxed the Air Max 1s. The leather is so clean and the colorway is perfect. Best pickup of the year.',
  },
  {
    id: 'negative-1',
    sentiment: 'negative',
    text: 'Two weeks in and the sole on my Dunks is already peeling. For $130 that is unacceptable, Nike.',
  },
  {
    id: 'negative-2',
    sentiment: 'negative',
    text: 'The SNKRS app crashed at checkout again. Another L on a pair I really wanted. So frustrating.',
  },
  {
    id: 'mixed-1',
    sentiment: 'mixed',
    text: 'The Vomero looks amazing, but the toe box is narrow and my feet hurt after an hour.',
  },
  {
    id: 'neutral-1',
    sentiment: 'neutral',
    text: 'Picked up the Pegasus 41 in black from the Nike outlet today. Size 10.5, standard laces.',
  },
]
