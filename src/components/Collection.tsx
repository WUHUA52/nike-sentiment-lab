import { useEffect, useRef, useState, type RefObject } from 'react'
import { SENTIMENTS, SENTIMENT_LABEL, type SavedPost, type Sentiment } from '../lib/types.ts'

interface CollectionProps {
  posts: SavedPost[]
  titleRef: RefObject<HTMLHeadingElement | null>
  /** True when the form or the result panel has something a reset would clear. */
  hasDraft: boolean
  onRelabel: (id: string, label: Sentiment) => void
  onRemove: (id: string) => void
  onExport: () => void
  onReset: () => void
}

function finalLabel(post: SavedPost): Sentiment {
  return post.corrected ?? post.predicted
}

export function Collection({ posts, titleRef, hasDraft, onRelabel, onRemove, onExport, onReset }: CollectionProps) {
  const [confirming, setConfirming] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  const counts = Object.fromEntries(
    SENTIMENTS.map((sentiment) => [sentiment, posts.filter((post) => finalLabel(post) === sentiment).length]),
  ) as Record<Sentiment, number>

  function handleReset() {
    // Nothing saved means nothing to lose, so skip the confirmation step.
    if (posts.length === 0) onReset()
    else setConfirming(true)
  }

  function confirmReset() {
    setConfirming(false)
    onReset()
  }

  return (
    <section className="collection" aria-labelledby="collection-title">
      <div className="collection__head">
        <h2 id="collection-title" ref={titleRef} tabIndex={-1} className="section-title">
          Collection
        </h2>
        <div className="collection__actions">
          {confirming ? (
            <div className="confirm" role="group" aria-label="Confirm reset">
              <p className="confirm__text">
                Clear the form and {posts.length === 1 ? 'the 1 saved post' : `all ${posts.length} saved posts`}?
              </p>
              <button ref={confirmRef} type="button" className="button button--danger" onClick={confirmReset}>
                Yes, reset
              </button>
              <button type="button" className="button" onClick={() => setConfirming(false)}>
                Keep everything
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="button" onClick={onExport} disabled={posts.length === 0}>
                Export CSV
              </button>
              <button
                type="button"
                className="button"
                onClick={handleReset}
                disabled={posts.length === 0 && !hasDraft}
              >
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      <dl className="tally" aria-label="Saved posts by sentiment">
        {SENTIMENTS.map((sentiment) => (
          <div key={sentiment} className={`tally__cell tally__cell--${sentiment}`}>
            <dt className="tally__label">{SENTIMENT_LABEL[sentiment]}</dt>
            <dd className="tally__count">{counts[sentiment]}</dd>
          </div>
        ))}
      </dl>
      <p className="collection__note">
        {posts.length === 0
          ? 'Nothing saved yet. Analyze a post and save it to start a collection.'
          : 'Counts use your corrected label when there is one.'}{' '}
        Saved posts stay in this browser tab only and disappear when you close it.
      </p>

      {posts.length > 0 && (
        <ul className="saved">
          {posts.map((post) => {
            const label = finalLabel(post)
            return (
              <li key={post.id} className={`saved__row saved__row--${label}`}>
                <div className="saved__body">
                  <p className="saved__text">{post.text}</p>
                  <ul className="saved__meta">
                    <li>Predicted {SENTIMENT_LABEL[post.predicted].toLowerCase()}</li>
                    {post.corrected && (
                      <li className="saved__corrected">Corrected to {SENTIMENT_LABEL[post.corrected].toLowerCase()}</li>
                    )}
                    {post.needsReview && <li className="saved__flag">Needs human review</li>}
                    {post.fictional && <li>Fictional example</li>}
                    {post.sourceLink && (
                      <li>
                        <a href={post.sourceLink} target="_blank" rel="noopener noreferrer">
                          Open source link
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
                <div className="saved__controls">
                  <label className="saved__select">
                    <span>Label</span>
                    <select
                      aria-label={`Label for saved post: ${post.text.slice(0, 60)}`}
                      value={label}
                      onChange={(event) => onRelabel(post.id, event.target.value as Sentiment)}
                    >
                      {SENTIMENTS.map((option) => (
                        <option key={option} value={option}>
                          {SENTIMENT_LABEL[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => onRemove(post.id)}
                    aria-label={`Remove saved post: ${post.text.slice(0, 60)}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
