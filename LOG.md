# Log

What was built, when, and what you'd need to know to change it. Newest first.

---

## 23 September 2026 — A colour per block

Daniel, sorting his first real statement: "selecting from the lists is really
slow and hard going because they all look the same." Forty near-identical rows,
each with a small grey note on the right, is slow to read and easy to mis-click.

The list is now drawn in blocks, each with a sticky heading carrying the block
name and how many lines it holds, and each row carrying a 3px rail in that
block's colour. The note on the right changed from the block name (now redundant,
it's the heading) to the **ATO schedule label**, which is the thing you actually
want to see beside a category. The menu is taller too — 360px instead of 246 —
so his personal list is nearly one screenful rather than three.

The same colour follows the block everywhere: the chips on a sorted row, and the
group rows in the monthly grid. So a scanned list shows shape before it shows
words.

**On the colours themselves — do not re-pick these by eye.** They are eight hues
with separate steps for dark mode, and both sets were run through a
colour-blindness validator against this page's own surfaces (`--raise`, #FBFCFC
light and #1B2429 dark):

| | light | dark |
|---|---|---|
| worst adjacent pair, colour-blind ΔE | 9.1 | 8.4 |
| worst adjacent pair, normal vision ΔE | 19.6 | 19.3 |

Both clear their floors (8 and 15). **The order matters as much as the values**:
only *adjacent* pairs were validated, because adjacent is what a list puts next
to each other. `rebuildGroupSlots` in `part_c2b.js` hands out slots in the order
blocks appear on screen, which is what keeps that true. A semantic re-order was
tried first — income green, travel orange and so on — and failed both modes
outright (magenta beside orange came out at ΔE 11.6 for normal vision, 1.6 for
deuteranopia). Legibility won.

Three light-mode hues sit under 3:1 contrast on the surface, which the method
allows only with "relief" — the identity must also be carried by something that
isn't colour. It is: every block prints its name in the heading above the row,
and the chosen category prints its name on the chip. Colour is the shortcut, not
the code.

Blocks the app doesn't know fall back to neutral grey rather than borrowing a
colour, and `rollup.test.mjs` asserts the slots are distinct, in range, and in
sequence for all three lists.

---

## 23 September 2026 — Statements, read from the PDF

Daniel: NetBank's CSV export is capped at a row count, so it drops transactions
and can't be trusted for a year. The PDF statement per month is what he actually
has. So the importer now reads them.

**pdf.js is vendored** in `vendor/pdfjs/` (Apache 2.0, LICENSE alongside) rather
than pulled from a CDN. Three reasons: GitHub Pages only serves what is in the
repo, the reader then works with no third-party script and no CDN outage, and
the tests can run offline. `part_c2c.js` lazy-loads it on the first PDF, so the
1.5 MB is never fetched by someone who only ever pastes CSV. Published as a
Claude artifact there is no vendor folder, and the import says "convert to CSV
first" rather than half-working.

**How it reads.** pdf.js returns positioned fragments, not rows, so `pdfLines`
groups them by baseline and reads left to right. Every page of a CommBank
statement carries a rotated print code down the left margin which otherwise
lands in the middle of a row — items with a non-zero skew in their transform are
dropped, which is what removes it.

**Three traps in the format**, each one silent if you get it wrong:

- dates carry no year (`11 Jun`), so the year comes from the statement period,
  which for a December statement spans two;
- credits use a **trailing** minus (`673.48-`). Miss it and every payment you
  made is counted as a charge;
- the foreign amount is a continuation line (`##0000 148010.00RUPIAH`) belonging
  to the row above. Not every `##` line is one — `## USA MERCHANT` also appears.

The last pages list regular payments as `Name | amount | date`, which is a
reminder and not transactions. Parsing stops at that heading; the row pattern
also requires the date at the *start*, so it is belt and braces.

**It reconciles before it offers.** The statement prints its own arithmetic, so
the import checks that the rows read reproduce it: opening + charges − payments
= closing balance. That is the whole reason to trust a PDF parse. The result is
shown on the import screen per statement, and says DOES NOT BALANCE in red
rather than quietly loading a wrong year. Several months can be dropped in at
once. Zero-dollar rows (waived fees, $0.00 international fees) are dropped
*after* the check — 57 of 125 on the June–July statement, none of them worth a
decision.

**Foreign charges keep the bank's AUD figure.** CommBank has already converted,
and that is the amount that actually left the account, so re-converting at an
ECB rate would be both more work and less defensible. The original rides along
in an "Original charge" column, deliberately named so the column mapper does not
mistake it for a currency column and re-convert. The ECB path still applies to
accounts genuinely *held* in foreign currency — Wise IDR/USD, the Indonesian
bank.

**The fixture is a real statement, so it is git-ignored** — this repo is public.
`pdf.test.mjs` skips with instructions when it is absent; `test/fixtures/README.md`
says what to put back and what it should produce. With it present the test runs
the whole path, UI included, and checks 125 rows, the $59.70 Tokopedia refund
landing as a credit rather than a charge, 56 foreign amounts, and that importing
the same statement twice adds nothing.

The vendored files keep a `.js` extension although they are ES modules. Some
static hosts serve `.mjs` as a download rather than as JavaScript, which breaks
`import()` — and that is not something you can test from anywhere but the live
site, so it is avoided rather than discovered.

`tools/cba_card_pdf.py` does the same job from the command line, for a bulk
convert without a browser.

**To teach it another bank**, write a reader that takes the lines and returns
`{acct, rows, rec}`, and add it to `STATEMENT_READERS` in `part_c2c.js`. The
reconciliation block is the part worth copying: without a check against the
statement's own totals, a PDF parse is a guess.

---

## 23 September 2026 — The output sheet

Daniel asked to see the output file with the existing figures in it before
feeding it anything new. So: **Ledger to Return — Monthly Actuals 2026** now
sits in his Drive, built from the 2026 actuals already in both workbooks.

The shape is one row per tracker line — all 83, empty ones included, in sheet
order — and the columns are:

    Key, Sheet, Block, Type, Line, Scope, Rolls into, Jan..Dec, Year

`Key` is first on purpose: `gia:give-it-all:expense:venue` is stable, so the two
workbooks can `VLOOKUP` against it over `IMPORTRANGE` without depending on row
positions, which move. `Rolls into` names the Budget Tracker line a GIA line
also posts to, so the double-posting is visible rather than implied.

The app regenerates exactly this file: **Report → Sheets → Download both
sheets**, which is `actualsCsv(year)` in `part_c5.js`. It reuses `gridData` per
sheet and then walks `TRACKS`, so a line with nothing against it still gets a
row — the sheet keeps its shape year to year. `rollup.test.mjs` asserts the
header, that there is one row per line, and that every key is distinct.

Two things worth knowing about the numbers:

- The GIA sheet carries December figures on VENUE, EDITING, ADMIN / ASSISTANT
  and LOGISTICS (1,303.11 in total) with nothing in July–November. They really
  are in the DEC ACT column of his sheet — checked against the live file, not
  assumed. April is the other way round: the Budget Tracker has GIA expense
  2,215.23 but the GIA sheet's April ACT cells are empty. Both are his data
  disagreeing with itself, left as found.
- Content can't be written back to a Google Sheet through the Drive tools here
  — only metadata. Refreshing the sheet means File → Import → Replace with the
  downloaded CSV, or the Sheets API from the app once it's enabled in the
  `ledger-to-return` Cloud project.

Sheet: https://docs.google.com/spreadsheets/d/193Q5cH5Y6lfxnVgWiFay5cUVBJSlznj5LTCqcmhNIEw

---

## 23 September 2026 — Both sheets from one pass

Daniel: "the GIA sheet and the personal finances needs to happen at the same
time." His May 2026 column says why. The same money sits on both sheets — GIA
Finance Tracking holds the detail, the Budget Tracker holds it as roll-up lines —
and it reconciles to the cent:

| GIA Finance Tracking, May | | Budget Tracker, May |
|---|---|---|
| Tickets 1,401.16 + Speakers 1,238.49 | → | GIA income 2,639.65 |
| VENUE 492.62 + EDITING 1,299.00 + LOGISTICS 424.59 | → | GIA expense 2,216.21 |
| ADMIN / ASSISTANT 108.43 | → | **VA Admin** 108.43 |
| Reconnected Man 453.83 | → | Reconnected Man 453.83 |
| Founders Breakfast 296.93 in / 47.28 out | → | same lines |

So a line now carries `rollsTo`: the line on the other sheet it also posts to.
`gridData` adds the amount to its own cell and, where one is set, to the target's.
One hop only, and a line never rolls into itself. `ROLLUP_SEED` holds the mapping
above; the middle column of the tracker-line editor changes any of it.
`test/rollup.test.mjs` reproduces May and checks both grids against these figures.

**A bug this exposed.** Line keys were `sheet:block:name` and ignored direction,
so a block holding an income *and* an expense line of the same name collapsed them
into one. Three lines were unreachable: GIA and Founders Breakfast in
TRANSFORMATIONS, Founders Breakfast in CIRCLES — exactly the lines the roll-up
needs. Keys are now `sheet:block:direction:name`. `resolveLine` upgrades a stored
old key using the transaction's sign, and `normRule` does the same using the tax
category's direction, so nothing coded earlier is lost.

Software sits on both sheets by name but belongs to the Budget Tracker only, so
GIA's software lines roll nowhere.

---

## 23 September 2026 — Transfers in one press

Wise to CommBank, an account to the Mastercard: common, meaningless, and it was
taking two steps. **Transfer** is now its own button and finishes the row on the
spot — no dropdown, since there is nothing else to say about it. **Other** holds
what is left of the non-business events (drawings, tax, GST, loan principal,
capital in).

Marked transfers drop out of *To sort*, *By rule* and *Sorted* so the working list
is only money that matters. They live behind a **Transfers** filter, show under
**All**, and stay in the transaction CSV — the trail survives even though nothing
is tracked.

With the rule box ticked, one press clears every lookalike in the statement and
every one that arrives next month.

`kind` now has four values: `personal | business | transfer | exclude`. A transfer
is settled the moment it is chosen (`settled()` returns true with no line and no
category to pick). Rows stored earlier as `exclude` with `x_transfer` migrate to
`transfer` in `normTx`, and rules the same way in `normRule`.

Considered and rejected: matching opposite amounts across accounts to spot
transfer pairs automatically. Two genuine transactions that happen to offset
would be wrongly marked, and the button is fast enough that the risk buys little.

---

## 23 September 2026 — Personal / Business sorting

**The change.** Sorting no longer opens with 82 tracker lines. Each transaction
now asks one question first — **Personal**, **Business** or **Neither** — and the
dropdown that follows is only the list that answer needs.

| Answer | Dropdown | What it sets |
|---|---|---|
| Personal | the 18 personal lines from Budget Tracker (LIVING, SELF-CARE, LIFESTYLE, PERSONAL, MISC PAYMENTS) | sheet line; tax category is fixed at Personal spending and never reaches the return |
| Business | ATO categories, filtered to income or expense by which way the money went | tax category, then the sheet line — asked once per category, remembered after |
| Neither | transfers, drawings, tax and GST payments, loan principal | tax category only; feeds no sheet |

*(Neither was split into Transfer and Other later the same day — see above.)*

**Rules are now opt-in.** The *Make a rule* box on each card names the pattern it
will match and says how many loaded rows it will also answer. Ticked by default,
untick to answer just this one. Before, every choice silently became a rule.

**What a business answer learns.** Picking an ATO category for the first time
asks which line it lands on, and stores that in `S.lineFor`. From then on the
category fills the line by itself. Reopen a transaction and hit **Change** to
point a category at a different line.

**Keyboard.** `P` `B` `N` answer; type to narrow, `Enter` takes the top match,
`1`–`9` take one directly; `↑` `↓` move between rows; `R` toggles the rule box;
`Backspace` clears a row.

**Data model.** A tracking transaction now carries three fields instead of two:

```
kind  personal | business | exclude
line  sheet line key  (null on excluded rows)
tax   ATO category key (x_personal on personal rows)
```

Older rows carried `cat` (the sheet line) and `tax`, with the kind implied. They
migrate on load in `normTx` — the line decides, because a personal row carries an
"exclude" tax category and would otherwise be misread as a transfer. Saved rules
migrate the same way in `normRule`.

**Also.** Rate table refreshed to 14 September 2026. GIA Finance Tracking kept —
both sheets still fed.

**To change the sorting flow**, everything is in `part_c4.js` equivalent section
of `ledger-to-return.html`: `pickPool` decides what each answer offers,
`choose` applies it, `applyRule` carries it forward.

---

## 1 September 2026 — Hosted, with Drive

Moved off Claude to GitHub Pages, data saved to Google Drive. Storage became
pluggable so one source runs in both places — `artifactStore`, `driveStore`,
`localStore` behind one interface. `SETUP.md` records the GitHub and Google
Cloud configuration.

---

## 1 September 2026 — Tracking book

Added a second book alongside the tax return: transactions coded for the two
Google Sheets and for the return in one pass, with a monthly actuals grid per
sheet and per-block copy runs for pasting into the ACT columns.

---

## 1 September 2026 — First build

Import with column auto-detection, ECB daily rates to AUD at each transaction's
own date, keyboard categorising with merchant learning, and a report rolling up
to the ATO business schedule.
