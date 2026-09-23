# Ledger to Return

Turns mixed-currency bank statements into figures you can actually use: a
categorised, AUD-converted summary for the accountant, and monthly actuals for
the two Google Sheets.

**Hosted:** https://parallaxxlifeco.github.io/ledger-to-return/ — data saved to
your Google Drive. This is the one to use. [SETUP.md](SETUP.md) records how the
GitHub Pages site and the Google Cloud OAuth client were set up.

**Claude artifact:** https://claude.ai/code/artifact/782afdb2-de89-4d8f-8080-9f67ca2b5802
— the original, kept as a fallback until the hosted version has done a real
statement. Same app, storage handled by Claude.

Built 1 September 2026.

---

## Where it runs and where the data goes

One source file, two hosts. The app works out at load time where it is and where
to save:

| Running as | Data lives in | Backed up by |
|---|---|---|
| GitHub Pages | Google Drive (`ledger-to-return-data.json`) | Drive version history, plus dated snapshots on demand |
| Claude artifact | the artifact's own store | Claude |
| anywhere, not connected | that browser only | you, via the backup file |

Every change is written to browser storage first and pushed to the remote a
moment later, so nothing is lost if Drive is unreachable — the chip at the top
right says which state you are in, and clicking it opens the storage panel.

The Drive permission is `drive.file`, which only covers files the app itself
created. It cannot read the rest of your Drive, your sheets included.

## Two books

The app holds two separate sets of transactions. They share the import engine and
the exchange rate table and nothing else — switch between them top-left.

**Tax return — FY 2025–26.** One code per transaction: a business tax category.
This is the year just gone, sorted once and handed over.

**Tracking — ongoing.** Each transaction is marked personal, business or neither,
and carries a sheet line and, where it belongs on the return, an ATO category.
The year gets tracked as it happens and the tax return falls out of the same work
at the end of it.

## Sorting: one question, then a short list

Every transaction asks the same first question — **Personal**, **Business**,
**Transfer** or **Other** — and only then offers a dropdown, which is why the
dropdown stays short.

**Personal** offers the 18 lines from your Budget Tracker's LIVING, SELF-CARE,
LIFESTYLE, PERSONAL and MISC PAYMENTS blocks. That is the whole answer: personal
spending feeds the monthly grid and never touches the return.

**Business** offers ATO categories, filtered to income or expense by which way
the money went. The first time you use a category it asks which line in your
sheets it lands on, and remembers — every later transaction in that category
fills the line by itself. Reopen one and hit **Change** to point it somewhere else.

**Transfer** is one press and done — no dropdown. Wise to CommBank, an account to
the Mastercard: your own money moving, nothing to record. Marked transfers drop
out of *To sort*, *By rule* and *Sorted*, so the working list holds only money
that matters; they live behind the **Transfers** filter, appear under **All**, and
stay in the full CSV so a balance can still be reconciled.

**Other** covers the rest of the non-business money events — drawings, income tax
and GST payments, loan principal, capital in. They count for nothing in either
output, which is the point: a tax instalment filed as personal spending would
inflate your living costs.

### Rules

Each card carries a **Make a rule** box that names the pattern it will match and
says how many already-loaded rows it will answer too. Ticked by default; untick
to answer just this one. A rule saves the whole answer — kind, category and line
— so a matching row in next month's statement arrives already done, marked with a
dot and listed under the **By rule** filter so you can spot-check.

Descriptions collapse to a key with the digits stripped, so `INVOICE 4501` and
`INVOICE 4502` match each other.

### Keyboard

`P` personal · `B` business · `T` transfer, which finishes the row on its own ·
`O` other · then type to narrow, `Enter` takes the top match, `1`–`9` take one
directly · `↑` `↓` move between rows · `R` toggles the rule box · `Backspace`
clears a row.

## Import

Paste rows or drop a CSV. It sniffs the delimiter, guesses which columns are
date / description / amount / currency — including Indonesian headers like
*Tanggal*, *Keterangan*, *Debet*, *Kredit*, *Mata Uang* — works out whether dates
are day-first, and handles both decimal conventions, so `2.500.000` on an IDR
statement reads as 2.5 million rather than 2.5. Nothing is stored until you have
seen the preview. Statements stack up under account names; re-importing the same
rows is skipped.

Imports land in whichever book is active. Check the switcher before you paste.

## Output

**Sheet actuals** (Tracking only). A tracker-line × month grid of AUD totals, one
per sheet, expenses as positive numbers to match the sheets. Click a month to
copy that column **one block at a time** — the sheets put a heading above each
block and a Total formula below it, so a single long column would land on both. A
copied run always covers every line in its block, hidden empty ones included, so
it lines up. There is a CSV per sheet as well.

**Tax view.** Income and expense totals by category, rolled up to the ATO
business and professional items schedule labels, plus a currency mix and flags
for the things that bite: anything unsorted, meals and entertainment, purchases
of $300 or more that belong in the asset register. Exports a summary CSV and a
full transaction CSV carrying the rate applied and the date it was published.

In the Tracking book the tax view has a financial-year picker; the tracker lines
run on calendar months, the return runs July to June, and one set of transactions
serves both.

## Exchange rates

Every foreign line is translated at the rate for its own transaction date — the
general translation rule for income and deductions. Rates are European Central
Bank daily euro reference rates, crossed through EUR to give AUD per unit.

Weekends and public holidays have no published rate, so those dates carry the
last one before them, and every such row is counted in the report and marked in
the export.

The table has an end date. Anything past it converts at the last published rate
and is flagged, in the app and in the exports, until the table is refreshed.

**A scheduled task rebuilds it on the 8th of each month** and republishes the app
to the same URL. That date is chosen to sit just after the upstream ECB package
is typically rebuilt; the data usually trails today's date by two to four weeks,
which is fine for statements you import after the fact. It reports what it did,
and does nothing if upstream has not moved.

## Folder layout

```
Ledger to Return/
├── ledger-to-return.html    the app — one self-contained file, and the source of truth
├── index.html               BUILT from it; this is what GitHub Pages serves
├── SETUP.md                 the GitHub and Google Cloud configuration
├── LOG.md                   what changed when, and how to change it again
├── build/
│   ├── make-index.py        ledger-to-return.html -> index.html
│   ├── make-test-pages.py   builds the two local test pages
│   ├── build-rates.py       regenerates the FX table from ECB history
│   └── rates.json           the current table (also embedded in the html)
└── test/
    ├── flow.test.mjs        parsing, FX, categorising, tax report, CSV output
    ├── hosts.test.mjs       both hosts, and moving data from one to the other
    ├── migration.test.mjs   v1 to v2 store migration, book separation, line editor
    ├── persistence.test.mjs chunked storage and reload-from-store
    └── screenshots.mjs      all three stages, light and dark
```

**Edit `ledger-to-return.html`, never `index.html`** — the latter is generated and
gets overwritten. It carries no `<!doctype>`, `<html>` or `<body>`, because the
Claude artifact host supplies those; `make-index.py` adds them along with the
Google sign-in script for the hosted copy.

`build/local*.html` and `screenshots/` are generated and not committed.

## Working on it

Everything lives in `ledger-to-return.html`, in this order:

| Where | What |
|---|---|
| `<style>` | design tokens, then components. Light palette on bare `:root`, redefined for dark twice (media query and `[data-theme]`) |
| `const RATES` | the embedded FX table — regenerate with `build/build-rates.py` |
| `const CATS` | business tax categories and their ATO schedule labels |
| `SHEET_SEED` / `seedTracks` | the tracker lines, mirroring the two sheets; `PERSONAL_BLOCKS` decides which are personal |
| `normTx` / `normRule` | how older stored shapes migrate to `kind` + `line` + `tax` |
| `pickPool` / `choose` / `applyRule` | what each answer offers, what it sets, and how a rule carries forward |
| `parseAmount` / `parseDate` | decimal styles, day-first dates, DR/CR suffixes, bracketed negatives |
| `merchantKey` | how descriptions collapse for the learning ("SQ \*CANVA PTY LTD SYDNEY" → "CANVA SYDNEY") |
| `artifactStore` / `driveStore` / `localStore` | the three storage backends behind one interface |
| `getToken` / `connectDrive` / `renderStorage` | Google sign-in and the storage panel |
| `migrate` / `persist` / `boot` | the two-book state; the artifact store chunks 120 transactions per document |
| `gridData` / `gridTable` / `gridColumnBlocks` | the monthly actuals grid and its copy runs |
| `reportData` / `renderTaxReport` | totals, flags, schedule roll-up |
| `txCsv` / `summaryCsv` / `gridCsv` | the exports |

### Running it locally

```bash
python3 build/make-index.py && python3 build/make-test-pages.py
python3 -m http.server 8899
                            # /build/local.html     standalone, as Pages serves it
                            # /build/local-db.html  the artifact shape
node test/flow.test.mjs
node test/tracking.test.mjs
node test/hosts.test.mjs
node test/migration.test.mjs
node test/persistence.test.mjs
node test/screenshots.mjs
```

Serve over http rather than opening the file directly — Chromium restricts
localStorage on `file://` origins. Tests need `playwright`.

To exercise Drive locally, add `http://localhost:8899` as an authorised
JavaScript origin on the OAuth client.

### Rolling to a new financial year

The scheduled task keeps rates current, so this is only about the year labels:
`FY_LIST` near the top of the state section holds them, `FY` pins the Tax return
book, and `S.taxFy` is the year the Tracking book's tax view reports on.

### Shipping a change

```bash
python3 build/make-index.py
git add -A && git commit -m "what changed" && git push
```

Pages redeploys in about a minute. To update the Claude artifact too, ask Claude
and give it the artifact URL at the top of this file — publishing without that URL
creates a second artifact instead of updating this one.

## Notes and limits

- Each transaction gets **one** tracker line. Where GIA money also rolls into the
  Budget Tracker's "GIA" row, that stays a formula in the sheet — the app does not
  post the same money to two lines.
- Tracker lines are editable in Import → Tracker lines: rename, add, remove.
  The seed mirrors both sheets as they read on 1 September 2026, and the client
  rows in particular get renamed every year. A line in use can't be removed;
  renaming one keeps everything coded to it.
- De-duplication matches on date + currency + amount + account + description.
  Genuinely identical same-day transactions on one account are treated as one.
- Merchant learning strips digits, so `INVOICE 4501` and `INVOICE 4502` collapse to
  one key. The apply-to-matching box names the key before it acts, and only ever
  touches rows that are still unsorted.
- Storage chunks 120 transactions per document, per book. Fine well past any
  plausible year.
- The Google client ID lives in the page and in browser storage. It is not a
  secret — it only works from the origins registered against it, and the app never
  stores a token or password anywhere but the tab's own session.
- Sign-in lasts about an hour and renews silently. If it lapses, work keeps saving
  locally and syncs on reconnect.
- This produces a working summary for an accountant. It is not tax advice, and the
  entertainment and capital flags are prompts for a conversation, not determinations.
