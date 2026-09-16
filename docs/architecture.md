# Next Chapter architecture

## Product boundary

Next Chapter answers “What should I read next?” from books already on a
reader's Goodreads to-read shelf. It is a decision companion, not a second
reading tracker.

The app does not write to Goodreads, own reviews, reproduce social activity, or
maintain a separate canonical bookshelf.

## Local-first shape

The app is one responsive Next.js application with four primary areas:

- **Next read** — contextual filters, three ranked choices, and one-tap surprise
  modes;
- **To read** — a searchable, read-only view of the imported candidate pool;
- **Insights** — reader story profile, annual reading totals, and a reorderable
  personal book ranking behind one compact secondary menu;
- **Data** — import provenance, privacy, backup, restore, and local reset.

IndexedDB stores the normalized library, import provenance, and optional Open
Library metadata cache. There is no server database or account. The static
export can run on GitHub Pages and the service worker keeps the shell available
offline.

## Goodreads boundary

The current public Goodreads developer API no longer issues keys and was marked
for retirement. The product therefore accepts the user-created Goodreads CSV
export. It does not scrape pages or ask for Goodreads credentials.

The importer validates `Title`, `Author`, and `Exclusive Shelf`, handles quoted
fields and spreadsheet-wrapped ISBN values, normalizes shelf names, and retains
a stable Goodreads Book Id when available. A fresh CSV replaces the previous
snapshot atomically so removed or reshelved books do not linger.

## Catalog metadata boundary

The CSV has no covers, synopsis field, or formal genre taxonomy. At the reader's
request, the app batches ISBNs to the official Open Library search index,
eight per query, requesting only the fields used in the product and staying
within the default one-request-per-second limit. This runs in the browser from
the Data page and can be stopped; entries are saved as they arrive, so a later
run resumes from where it left off. The same helper backs the command-line
script that writes a merge-only catalog file for offline import.

The /api/books endpoint this once used began answering 404 for every request,
including known-good ISBNs, which marked whole batches as errors. The search
index carries the same fields and is what both paths now query.

Ratings, reviews, shelves, dates, and the taste profile are not included in
these requests. Manual corrections can supply missing cover, synopsis, subject,
publication, or series fields. They take precedence over later catalog imports.
A fresh Goodreads snapshot preserves metadata only for stable book ids that
remain in the new export, so removed books cannot linger.

## Recommendation model

Rated books produce confidence-shrunk signals for story types, authors, catalog
genres, publication decades, and page-count bands. Restrained mappings turn
Open Library subjects into stable story and genre labels. Goodreads custom
shelves remain a fallback when they carry recognizable genre names.

Candidate scoring is intentionally interpretable:

- **Familiar** emphasizes proven author and genre preferences;
- **Balanced** combines taste, genre, Goodreads average, and shelf age;
- **Stretch** favors neutral or underexplored taste territory while retaining a
  Goodreads quality signal.

Selected genres and length ranges are hard filters. Missing page counts are
excluded only when a length constraint is active. Older to-read books receive a
small backlog nudge. A tiny stable variation can reorder near ties across
subsequent runs without overwhelming a meaningful score gap.

Series order is another hard gate. Parsed or manually corrected series
positions are compared with finished books in the same series. Volume one is
eligible when no prior volume is finished; after that, only the next unread
position can enter the candidate pool. Prequels below volume one remain
eligible.

The visible explanation comes from actual score contributions. A repeated
favorite author or genre can be cited; a missing signal cannot.

## Known limits

- Open Library coverage is not complete. Unmatched books retain deliberate
  typographic covers and an honest “no synopsis” state.
- Short Open Library descriptions are shown when provided; the app does not
  invent summaries for unmatched books.
- IndexedDB is origin-scoped and can be cleared by the browser; local backup is
  part of the product, not an optional technical extra.
- The recommendation weights are a transparent baseline. Meaningful validation
  needs a real export fixture and offline holdout evaluation before stronger
  claims about recommendation quality.
