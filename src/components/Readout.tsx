import type { RefObject } from 'react'
import { SENTIMENTS, SENTIMENT_LABEL, type Analysis, type Sentiment } from '../lib/types.ts'
import { MarkedText } from './MarkedText.tsx'

export interface Reading {
  /** Changes on every run so the reveal animation replays. */
  run: number
  text: string
  sourceLink: string
  fictional: boolean
  /** True when the text was fetched from the link instead of pasted. */
  fetched: boolean
  analysis: Analysis
  /** The label the user wants saved. Starts as the prediction. */
  label: Sentiment
  saved: boolean
}

interface ReadoutProps {
  reading: Reading | null
  panelRef: RefObject<HTMLElement | null>
  onLabelChange: (label: Sentiment) => void
  onSave: () => void
}

export function Readout({ reading, panelRef, onLabelChange, onSave }: ReadoutProps) {
  if (!reading) {
    return (
      <section ref={panelRef} className="readout readout--empty" aria-labelledby="readout-title">
        <h2 id="readout-title" className="readout__empty-title">
          No read yet
        </h2>
        <p className="readout__empty-text">
          Paste a tweet or an X link and choose Analyze, or pick a fictional example. The label and the words behind it show up here.
        </p>
      </section>
    )
  }

  const { analysis, label, saved } = reading
  const predicted = analysis.sentiment
  const needsReview = analysis.reviewReasons.length > 0

  return (
    <section
      ref={panelRef}
      key={reading.run}
      className={`readout readout--${predicted}`}
      aria-labelledby="readout-title"
    >
      <header className="readout__head">
        <p className="readout__caption">Predicted sentiment</p>
        <p className="demo-tag">Rule-based demo</p>
      </header>

      <h2 id="readout-title" className={`verdict verdict--${predicted}`}>
        {SENTIMENT_LABEL[predicted]}
      </h2>

      {needsReview ? (
        <div className="review">
          <h3 className="review__title">Needs human review</h3>
          <ul className="review__list">
            {analysis.reviewReasons.map((reason) => (
              <li key={reason.message}>{reason.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="review-clear">No review flags raised by the rules.</p>
      )}

      {reading.fictional && (
        <p className="readout__fictional">Fictional example, written for this demo. Not a real tweet.</p>
      )}
      {reading.fetched && (
        <p className="readout__fictional">
          Text fetched from X’s public embed service. Long posts can come back shortened, so check it against the
          original.
        </p>
      )}
      <MarkedText text={reading.text} highlights={analysis.highlights} />
      {reading.sourceLink && (
        <p className="readout__source">
          Source link:{' '}
          <a href={reading.sourceLink} target="_blank" rel="noopener noreferrer">
            {reading.sourceLink}
          </a>
        </p>
      )}

      <div className="readout__block">
        <h3 className="readout__subtitle">Why</h3>
        <p className="readout__explanation">{analysis.explanation}</p>
      </div>

      <div className="readout__block">
        <h3 className="readout__subtitle">Words that counted</h3>
        {analysis.signals.length === 0 ? (
          <p className="readout__muted">No words matched the positive or negative lists.</p>
        ) : (
          <>
            <ul className="signals">
              {analysis.signals.map((signal) => (
                <li key={signal.start} className={`signal signal--${signal.polarity}`}>
                  <span className="signal__text">{signal.text}</span>
                  <span className="signal__note">
                    {signal.polarity === 'positive' ? 'Positive' : 'Negative'}
                    {signal.negatedBy && `, flipped by “${signal.negatedBy}”`}
                    {signal.intensifiedBy && `, boosted by “${signal.intensifiedBy}”`}
                  </span>
                  <span className="signal__points">
                    {signal.polarity === 'positive' ? '+' : '−'}
                    {signal.weight}
                  </span>
                </li>
              ))}
            </ul>
            <p className="readout__muted">
              Positive {analysis.positivePoints}, negative {analysis.negativePoints}. These are points added up by the
              rules, not a confidence score.
            </p>
          </>
        )}
      </div>

      <fieldset className="correct" disabled={saved}>
        <legend className="readout__subtitle">Your label</legend>
        <p className="correct__hint">
          {saved
            ? 'Saved. You can still change the label in the collection below.'
            : 'Keep the prediction, or pick the label you think is right before saving.'}
        </p>
        <div className="correct__options">
          {SENTIMENTS.map((option) => (
            <label key={option} className="correct__option">
              <input
                type="radio"
                name="corrected-label"
                value={option}
                checked={label === option}
                onChange={() => onLabelChange(option)}
              />
              <span>{SENTIMENT_LABEL[option]}</span>
            </label>
          ))}
        </div>
        {label !== predicted && (
          <p className="correct__changed">
            Corrected from {SENTIMENT_LABEL[predicted].toLowerCase()} to {SENTIMENT_LABEL[label].toLowerCase()}.
          </p>
        )}
      </fieldset>

      <button type="button" className="button button--primary" onClick={onSave} disabled={saved}>
        {saved ? 'Saved to collection' : 'Save to collection'}
      </button>
    </section>
  )
}
