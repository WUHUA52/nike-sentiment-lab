import { useEffect, useRef, useState } from 'react'
import { Collection } from './components/Collection.tsx'
import { EntryForm, type EntryErrors } from './components/EntryForm.tsx'
import { Readout, type Reading } from './components/Readout.tsx'
import { FICTIONAL_EXAMPLES, type FictionalExample } from './data/examples.ts'
import { analyze } from './lib/classifier.ts'
import { downloadCsv } from './lib/csv.ts'
import { loadCollection, normalizeSourceLink, saveCollection } from './lib/storage.ts'
import { SENTIMENT_LABEL, type SavedPost, type Sentiment } from './lib/types.ts'

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function App() {
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [errors, setErrors] = useState<EntryErrors>({})
  const [reading, setReading] = useState<Reading | null>(null)
  const [posts, setPosts] = useState<SavedPost[]>(loadCollection)
  const [status, setStatus] = useState('')

  const textRef = useRef<HTMLTextAreaElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const collectionTitleRef = useRef<HTMLHeadingElement>(null)
  const runCount = useRef(0)

  useEffect(() => {
    saveCollection(posts)
  }, [posts])

  // On a phone the result sits below the form, so bring it into view after each run.
  const run = reading?.run
  useEffect(() => {
    if (run === undefined) return
    const panel = panelRef.current
    if (!panel) return
    const top = panel.getBoundingClientRect().top
    if (top < 0 || top > window.innerHeight * 0.6) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    }
  }, [run])

  function runAnalysis(rawText: string, rawLink: string) {
    const analysis = analyze(rawText)
    const fictional = FICTIONAL_EXAMPLES.some((example) => example.text === rawText.trim())
    // A fictional example never gets a source link, whatever is in the field.
    const sourceLink = fictional ? '' : normalizeSourceLink(rawLink)

    const nextErrors: EntryErrors = {}
    if (!analysis) nextErrors.text = 'Paste or type a tweet first. There is nothing to analyze yet.'
    if (sourceLink === null) {
      nextErrors.link = 'Use a link that starts with https://x.com/ or https://twitter.com/, or leave this blank.'
    }
    setErrors(nextErrors)

    if (!analysis) {
      textRef.current?.focus()
      return
    }
    if (sourceLink === null) {
      linkRef.current?.focus()
      return
    }

    if (fictional) setLink('')
    runCount.current += 1
    setReading({
      run: runCount.current,
      text: rawText.trim(),
      sourceLink,
      fictional,
      analysis,
      label: analysis.sentiment,
      saved: false,
    })
    setStatus(
      `Result: ${SENTIMENT_LABEL[analysis.sentiment]}.${analysis.reviewReasons.length > 0 ? ' Needs human review.' : ''}`,
    )
  }

  function handlePickExample(example: FictionalExample) {
    setText(example.text)
    setLink('')
    runAnalysis(example.text, '')
  }

  function handleSave() {
    if (!reading || reading.saved) return
    const predicted = reading.analysis.sentiment
    const post: SavedPost = {
      id: newId(),
      text: reading.text,
      sourceLink: reading.sourceLink,
      predicted,
      corrected: reading.label === predicted ? null : reading.label,
      needsReview: reading.analysis.reviewReasons.length > 0,
      fictional: reading.fictional,
    }
    setPosts((current) => [post, ...current])
    setReading({ ...reading, saved: true })
    setStatus('Saved to collection.')
  }

  function handleRelabel(id: string, label: Sentiment) {
    setPosts((current) =>
      current.map((post) => (post.id === id ? { ...post, corrected: label === post.predicted ? null : label } : post)),
    )
    setStatus(`Label changed to ${SENTIMENT_LABEL[label].toLowerCase()}.`)
  }

  function handleRemove(id: string) {
    setPosts((current) => current.filter((post) => post.id !== id))
    setStatus('Removed from collection.')
    collectionTitleRef.current?.focus()
  }

  function handleExport() {
    downloadCsv(posts)
    setStatus(`Exported ${posts.length === 1 ? '1 post' : `${posts.length} posts`} to CSV.`)
  }

  function handleReset() {
    setPosts([])
    setText('')
    setLink('')
    setErrors({})
    setReading(null)
    setStatus('Reset. The form and the collection are empty.')
    textRef.current?.focus()
  }

  return (
    <div className="page">
      <header className="topbar">
        <p className="topbar__note">
          Independent student project. Not affiliated with, sponsored by or endorsed by Nike or X.
        </p>
      </header>

      <main>
        <section className="hero">
          <h1 className="hero__title">
            <span>Sentiment</span> <span>Lab</span>
          </h1>
          <div className="hero__row">
            <p className="hero__lede">
              Paste a Nike-related tweet and see how a short set of rules reads it, with every word that tipped the
              call marked in place.
            </p>
            <div className="hero__demo">
              <p className="demo-tag">Rule-based demo</p>
              <p className="hero__demo-note">Word lists and five rules you can read. No AI model.</p>
            </div>
          </div>
        </section>

        <div className="bench">
          <EntryForm
            text={text}
            link={link}
            errors={errors}
            textRef={textRef}
            linkRef={linkRef}
            onTextChange={(value) => {
              setText(value)
              if (errors.text) setErrors((current) => ({ ...current, text: undefined }))
            }}
            onLinkChange={(value) => {
              setLink(value)
              if (errors.link) setErrors((current) => ({ ...current, link: undefined }))
            }}
            onAnalyze={() => runAnalysis(text, link)}
            onPickExample={handlePickExample}
          />
          <Readout
            reading={reading}
            panelRef={panelRef}
            onLabelChange={(label) => setReading((current) => (current ? { ...current, label } : current))}
            onSave={handleSave}
          />
        </div>

        <Collection
          posts={posts}
          titleRef={collectionTitleRef}
          hasDraft={text !== '' || link !== '' || reading !== null}
          onRelabel={handleRelabel}
          onRemove={handleRemove}
          onExport={handleExport}
          onReset={handleReset}
        />

        <section className="method" aria-labelledby="method-title">
          <h2 id="method-title" className="section-title">
            How the rules decide
          </h2>
          <div className="method__columns">
            <ol className="method__steps">
              <li>Split the post into words, short phrases and emoji.</li>
              <li>
                Look each one up in a positive list and a negative list. Strong words such as “love” or “unacceptable”
                count for 2 points, ordinary ones for 1.
              </li>
              <li>
                Flip a word when “not”, “no”, “never” or a word ending in “n't” comes just before it, so “not
                comfortable” counts as negative.
              </li>
              <li>
                Add up each side. Points on one side only give positive or negative. Points on both sides give mixed
                when the weaker side has at least half the points of the stronger one. No matches give neutral.
              </li>
              <li>
                Flag the post for human review when it has phrases that are often sarcastic, opinions that conflict, or
                signs of missing context.
              </li>
            </ol>
            <div className="method__limits">
              <h3 className="method__limits-title">What it cannot do</h3>
              <ul>
                <li>Understand meaning. A word that is not on the lists is invisible to it.</li>
                <li>Detect sarcasm. It only flags phrases that are often used sarcastically.</li>
                <li>Read anything but English text. Images, threads and linked pages are out of reach.</li>
                <li>Report accuracy. It has not been tested against labeled data, so no score is shown.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Sentiment Lab is an independent student portfolio project. It is not affiliated with, sponsored by or endorsed
          by Nike, Inc. or X Corp. Product names appear only to describe what the posts are about. The six example
          posts are fictional.
        </p>
      </footer>

      <div className="visually-hidden" role="status" aria-live="polite">
        {status}
      </div>
    </div>
  )
}
