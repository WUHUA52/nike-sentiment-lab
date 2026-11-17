import type { FormEvent, KeyboardEvent, RefObject } from 'react'
import { FICTIONAL_EXAMPLES, type FictionalExample } from '../data/examples.ts'
import { SENTIMENT_LABEL } from '../lib/types.ts'

export interface EntryErrors {
  text?: string
  link?: string
}

interface EntryFormProps {
  text: string
  link: string
  errors: EntryErrors
  textRef: RefObject<HTMLTextAreaElement | null>
  linkRef: RefObject<HTMLInputElement | null>
  onTextChange: (value: string) => void
  onLinkChange: (value: string) => void
  onAnalyze: () => void
  onPickExample: (example: FictionalExample) => void
}

export function EntryForm({
  text,
  link,
  errors,
  textRef,
  linkRef,
  onTextChange,
  onLinkChange,
  onAnalyze,
  onPickExample,
}: EntryFormProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onAnalyze()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      onAnalyze()
    }
  }

  return (
    <div className="entry">
      <form className="entry__form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="tweet-text">
            Tweet text
          </label>
          <textarea
            id="tweet-text"
            ref={textRef}
            className="field__input field__input--area"
            rows={6}
            value={text}
            placeholder="Paste the text of a Nike-related tweet"
            aria-invalid={errors.text ? true : undefined}
            aria-describedby={errors.text ? 'tweet-text-error tweet-text-hint' : 'tweet-text-hint'}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          {errors.text && (
            <p id="tweet-text-error" className="field__error" role="alert">
              {errors.text}
            </p>
          )}
          <p id="tweet-text-hint" className="field__hint">
            Ctrl or ⌘ + Enter also runs the analysis.
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="tweet-link">
            X link <span className="field__optional">optional</span>
          </label>
          <input
            id="tweet-link"
            ref={linkRef}
            className="field__input"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={link}
            placeholder="https://x.com/…"
            aria-invalid={errors.link ? true : undefined}
            aria-describedby={errors.link ? 'tweet-link-error tweet-link-hint' : 'tweet-link-hint'}
            onChange={(event) => onLinkChange(event.target.value)}
          />
          {errors.link && (
            <p id="tweet-link-error" className="field__error" role="alert">
              {errors.link}
            </p>
          )}
          <p id="tweet-link-hint" className="field__hint">
            Kept with the saved post for reference. This app never opens or reads the link.
          </p>
        </div>

        <button type="submit" className="button button--primary">
          Analyze
        </button>
      </form>

      <section className="examples" aria-labelledby="examples-title">
        <h2 id="examples-title" className="examples__title">
          Fictional examples
        </h2>
        <p className="examples__note">
          Six made-up posts written for this demo. They are not real tweets and have no source link.
        </p>
        <ul className="examples__list">
          {FICTIONAL_EXAMPLES.map((example) => (
            <li key={example.id}>
              <button type="button" className="example" onClick={() => onPickExample(example)}>
                <span className={`example__kind example__kind--${example.sentiment}`}>
                  Fictional, {SENTIMENT_LABEL[example.sentiment].toLowerCase()}
                </span>
                <span className="example__text">{example.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
