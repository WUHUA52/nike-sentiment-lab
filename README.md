# Sentiment Lab

A one-page web app that reads a Nike-related tweet, pasted in as text or given as a link, and labels it positive, negative, neutral or mixed. It shows which words drove the label, explains the result in plain English, and flags posts a person should double-check.

**Live site: https://wuhua52.github.io/nike-sentiment-lab/**

**This is an independent student portfolio project.** It is not affiliated with, sponsored by or endorsed by Nike, Inc. or X Corp. Product names appear only to describe what the posts are about.

## Two things to know first

- **The analysis is rule-based, not AI.** The classifier is a set of word lists and five rules written by hand. There is no machine-learning model, no training data and no API call. The app labels itself "Rule-based demo" for that reason.
- **The sample tweets are fictional.** The six built-in examples were written for this demo. They are not real tweets, nobody posted them, and they have no source links.

## Features

- Paste a tweet, optionally add its x.com link, and analyze it.
- Or give only the link. The app fetches the text of a public post for you (see [Link-only mode](#link-only-mode)).
- A label of positive, negative, neutral or mixed.
- The words and phrases that counted, marked in the text and listed with their points.
- A short plain-English explanation of the result.
- A "Needs human review" flag for possible sarcasm, conflicting opinions or missing context.
- Manual correction: change the label before saving, or later from the collection.
- A collection saved in `sessionStorage`, with a count for each sentiment.
- CSV export and a reset button.
- Six labeled fictional examples: two positive, two negative, one mixed, one neutral.
- Works on phones, with the keyboard alone, and with reduced-motion settings.

## How the classifier works

All of the logic is in [`src/lib/classifier.ts`](src/lib/classifier.ts), and all of the words are in [`src/lib/lexicon.ts`](src/lib/lexicon.ts).

1. Split the post into words, short phrases and emoji.
2. Look each one up in a positive list and a negative list. Strong words such as "love" or "unacceptable" count for 2 points, ordinary ones for 1. An intensifier such as "so" or "very" adds 1.
3. Flip a word when "not", "no", "never" or a word ending in "n't" comes just before it. "Not comfortable" counts as negative. A flipped word always counts for 1 point.
4. Add up each side:
   - points on one side only: positive or negative
   - points on both sides, with the weaker side at least half the stronger: mixed
   - points on both sides, with one clearly stronger: the stronger side wins
   - no matches: neutral
5. Flag the post for human review when it contains phrases that are often sarcastic ("oh great", "thanks, Nike", a positive word in quotation marks), opinions that conflict, or signs of missing context (very short, a reply, a link, a bare question, no Nike-related term).

The review flag never changes the label. The app shows the points each side scored, and does not show a confidence percentage, because the rules have no way to produce an honest one.

## Tech stack

- React 19 and TypeScript
- Vite for the dev server and build
- Vitest for unit tests
- Oxlint for linting
- Plain CSS, with self-hosted Big Shoulders Display and Archivo fonts from Fontsource (both under the SIL Open Font License)

There is no backend, database, login, paid service or scraping. The only network request the app ever makes is the one described in [Link-only mode](#link-only-mode).

## Setup

You need Node.js 20.19 or newer.

```bash
git clone https://github.com/WUHUA52/nike-sentiment-lab.git
cd nike-sentiment-lab
npm install
npm run dev
```

Then open the address Vite prints, usually http://localhost:5173.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks and builds the site into `dist/` |
| `npm run preview` | Serves the built site locally |
| `npm test` | Runs the unit tests for the classifier, CSV export, link check and link-only fetching |
| `npm run lint` | Lints the source |

No environment variables or API keys are needed.

`http://localhost:5173` only works while `npm run dev` is running on your own computer. The live site above is always available.

## Deployment

The site is hosted on GitHub Pages. Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which lints, tests and builds the app and then publishes the `dist/` folder. Nothing needs to be deployed by hand.

## Link-only mode

Leave the text box empty, enter a link to a single post (`https://x.com/name/status/123…`), and choose Analyze. The app then:

1. Sends the link to X's public oEmbed endpoint, `https://publish.x.com/oembed`. This is the official service websites use to embed a post. It needs no API key or login.
2. Takes the post text out of the reply as plain text, puts it in the text box so you can read and edit it, and analyzes it.

Things to know:

- It only works for public posts. Deleted, private and age-restricted posts come back as "not found", and the app asks you to paste the text instead.
- Long posts can come back shortened, and images and videos are not included. The result panel reminds you to check the text against the original.
- In this mode the link leaves your browser and goes to X. When you paste the text yourself, the link is only stored with the saved post and nothing is sent anywhere.
- X can change, limit or switch off this endpoint at any time. If that happens, pasting the text still works.

## CSV export

The export has one row per saved post and these columns:

| Column | Contents |
| --- | --- |
| `text` | The post text |
| `source_link` | The x.com or twitter.com link, or blank |
| `predicted_sentiment` | The label the rules gave |
| `user_corrected_sentiment` | Your label if you changed it, otherwise blank |
| `needs_human_review` | `yes` or `no` |
| `fictional_example` | `yes` for the built-in examples, otherwise `no` |

A cell that starts with `=`, `+`, `-` or `@` gets a leading apostrophe so a spreadsheet treats it as text and not as a formula. This means a reply that starts with `@name` is exported as `'@name`.

## Limitations

- **It does not understand meaning.** It only matches words on its lists. A word it does not know is invisible to it, and it cannot tell "sick" the compliment from "sick" the complaint.
- **It cannot detect sarcasm.** It flags a small set of phrases that are often sarcastic. Sarcasm without those phrases goes unflagged.
- **It has not been evaluated.** The rules were not tested against a labeled dataset, so there is no accuracy figure. Treat every label as a first guess.
- **English only**, one post at a time. It cannot see threads, images, videos or linked pages.
- **Link-only mode depends on X.** It needs an internet connection and X's public embed endpoint, works for public posts only, and may return long posts shortened.
- **Negation is shallow.** A negator only reaches the next three words and stops at punctuation, so longer constructions are missed.
- **"Neutral" means no list words matched.** It does not prove the author has no opinion.
- **Saved posts are temporary.** They live in `sessionStorage`, so they stay in one browser tab and are gone when it closes.
- **Source links are not verified against pasted text.** When you paste the text yourself, the app only checks that the link is an `https://x.com/` or `https://twitter.com/` address. It does not check that the post exists or matches the text.

## Project structure

```
src/
  App.tsx                 page layout and state
  styles.css              all styling
  components/
    EntryForm.tsx         tweet and link inputs, fictional examples
    Readout.tsx           result panel, review flag, manual correction
    MarkedText.tsx        the post with cues marked
    Collection.tsx        saved posts, counts, export, reset
  data/examples.ts        the six fictional examples
  lib/
    classifier.ts         the rules
    lexicon.ts            word lists and sarcasm patterns
    csv.ts                CSV export
    storage.ts            sessionStorage and link check
    fetchPost.ts          link-only mode: fetch post text from X's embed endpoint
    types.ts              shared types
    classifier.test.ts    unit tests
```
