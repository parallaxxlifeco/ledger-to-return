# Log

What was built, when, and what you'd need to know to change it. Newest first.

---

## 24 September 2026 — Facebook is not a subscription

"All of these are subscriptions that can be folded into regular subscriptions.
Apart from Facebook - that is will be its own."

Facebook came back as its own line on the Budget Tracker, and had to be taken
out of `RETIRED_LINES` as well as put back in the seed — otherwise
`pruneRetired` would have deleted it again on the next load, which is exactly
the kind of half-revert that looks like the change never saved.

The reasoning is worth keeping: the other eight are tools you subscribe to, and
what any one of them costs in a month is not a decision — Regular Subcriptions
is the answer for all of them. Facebook is ad spend. It moves, it is worth
seeing on its own, and it is the line you would look at to ask whether it earned
anything. Folding it away would have lost that.

Still off the GIA sheet: subscriptions and ads are a Budget Tracker matter.

`direction.test.mjs` asserts both halves — Facebook survives the prune on the
Budget Tracker, and does not come back on GIA.

**Third time a change looked missing because the browser was serving a cached
page.** GitHub Pages sets long cache headers, so an ordinary reload after a
deploy often shows the old build. Worth adding a visible build stamp so it can
be told apart at a glance rather than by counting list items.

---

## 24 September 2026 — The keyboard legend goes

"This line can be removed - its not necessary." It was the row under the filter
chips listing P, B, T, O, Enter, 1–9, arrows, R and Backspace.

Every shortcut it named is already printed on the thing it operates: the letter
sits on each of the four answer buttons, the number beside each option in the
list, `r` on the rule box. A permanent line restating them taught nothing after
the first minute, and it pushed the first transaction further down the screen on
every single view.

Removed from the markup, the stylesheet and `renderShell`.

---

## 23 September 2026 — The year a transaction belongs to

Daniel, sorting a June 2025 row: "It stopped asking me the tax line because we
are outside of the tax view."

**The diagnosis was wrong but it found a real hole.** Nothing in the sort flow
looks at the financial year — `inFY` only touches the note on the card and what
the report counts. A personal answer asks for the Budget Tracker line and no ATO
category, by design, because personal spending is not on the return; that is
what looks like "it stopped asking".

The hole is underneath. `FY_LIST` was three hand-written years starting at
FY 2025-26, and his first real statement runs **11 June to 8 July 2025**. The
June rows belong to FY 2024-25, which was not on the list at all — so they could
not be filed in any year, and the app said only "Outside FY 2026-27" without
mentioning that the year they wanted did not exist.

**Years are generated now**, three back from the current one to one ahead, so
the list moves with time instead of going stale:

    FY 2023–24 · FY 2024–25 · FY 2025–26 · FY 2026–27 · FY 2027–28

The ids keep their old shape (`fy2526`) so a saved file still resolves. A fresh
install opens on the year we are actually in rather than a hardcoded guess.

**The note stopped being a warning.** A transaction outside the year you are
reading is completely normal, and sorting does not care — a row is coded once
and every year's report reads the same answers. So instead of amber "Outside
FY 2026-27", it says which year the row counts in and offers a button to go
there:

> Counts in **FY 2024–25**, not the FY 2026–27 report you have open. [Read FY 2024–25]

**And the year moved into the header**, as a dropdown rather than a caption. It
decides what the tax report reads, and keeping it on the report screen is how a
whole statement gets sorted against the wrong year without a word being said.

`fy.test.mjs` covers the boundary both ways (30 June and 1 July), that a date
outside the window returns nothing rather than guessing, that sorting works
unchanged with the "wrong" year open, and that the button and the header stay in
step.

---

## 23 September 2026 — Twenty lines that were never going to be used

Sorting for real is what exposes a seeded list. Daniel, on the GIA sheet's
expense block: "All of these options can be removed - not relevant here." Then
on the Budget Tracker's copies of the same names: "All of these can be folded
into the one heading of Regular Subscriptions."

Both sheets print a per-product software list — Teachable, Twilio / Skype,
Facebook, Zoom/Video, Klaviyo, Misc Subcriptions, Typeform, Adobe, Microsoft —
and neither has ever carried a figure in one. Nine near-identical rows to scroll
past on every single answer, for a decision that was only ever "subscriptions".

Removed, from the seed:

| | before | after |
|---|---|---|
| GIVE IT ALL expense | 15 | **4** — VENUE, EDITING, ADMIN / ASSISTANT, LOGISTICS |
| TRANSFORMATIONS expense | 19 | **10** |
| all tracker lines | 83 | **63** |

GIVE IT ALL keeps exactly the four that carry figures in his sheet, which are
also the four the Budget Tracker roll-up is built on. Events and Design went
from the GIA sheet too — empty there, and duplicated under TRANSFORMATIONS,
where they stay. CIRCLES was left alone: its Founders Breakfast line does carry
figures ($47.28 in May, $55.42 in June) and feeds the roll-up.

**Changing the seed is not enough**, because a saved file carries its own copy
of the line list — the seed is only what a fresh start gets. `RETIRED_LINES` and
`pruneRetired()` drop them on load, clear any `lineFor` pairing that pointed at
one, and null any `rollsTo` aimed at one.

**It only drops a line nothing is coded to.** Losing an answer is worse than
carrying a line you don't want, so a retired line with a transaction on it stays
until that transaction moves. Checked before making the change: on his live
data, nothing was coded to any of them.

One test broke, and it broke honestly: `migration.test.mjs` had a fixture whose
old-shape rule pointed at `budget:transformations:adobe`. The app handled it
correctly — no line, row unsettled — but the test then read `.label` off
nothing. Repointed at Regular Subcriptions, which is where those lines folded.

**And the rule checkbox moved up**, to sit directly under the four answer
buttons instead of below the list. It is a decision about the answer being made,
and at the bottom of forty options it was out of sight at the moment it
mattered — which is part of how the Gojek rule got made without being noticed.
`rules.test.mjs` now asserts its position, because a layout that only reads
right by accident drifts back.

---

## 23 September 2026 — Lift the row being answered

An outline was not enough. On a dark background `.txcard.cur` was a faint
rectangle: same fill as every other card, distinguished only by a border, which
is a weak signal for the one thing you most need to be sure of — which
transaction the next keystroke is about to code.

It now sits on an accent wash (`--tintCur`, 11% light / 22% dark), with a 5px
accent edge and a wider ring, and everything else in the list drops to 72%
opacity and comes back on hover. The controls inside keep the plain surface
colour so they stand on the wash rather than dissolving into it.

**Two contrast failures came out of it**, both real, both invisible by eye:

- `.line2 .acct` — the "CommBank card 4345" line — and `.fx`, the rate note.
  Both `--ink3`, which scrapes past on the plain surface and falls to **3.24:1
  light / 2.96:1 dark** on the wash. `--ink2` on the current card now.
- `.kindbtn span`, the hint under each of the four buttons, at **3.81:1**.
  `--ink2` everywhere, not just here — it was under the floor on the plain
  surface too, and had been since the buttons were built.

`colour.test.mjs` now measures every piece of text on the active card as well as
the pick lists.

**And it got the measurement wrong first, in a way worth recording.** The check
compared each label against the *card's* background, so the white text on the
selected blue button scored 1.18:1 — a failure in the ruler, not the page. Text
sits on the nearest ancestor that actually paints a background, so the test
walks up the tree to find it. That is the second time in this project a contrast
check has produced a confident wrong number (the first was parsing `oklab()`
with a regex). A contrast test needs testing.

---

## 23 September 2026 — Money out is not ticket sales

Daniel: "a business expense shouldn't show ticket sales as an option to log
against." He was right, though not where he thought.

The **ATO category** list was already filtered by direction — `pickPool` has
done that since the sort screen was rebuilt. The **sheet line** list that
follows it was not. So you picked an expense category, and were then offered
every business line on both sheets: Tickets, Speakers, Partners and Reconnected
Man sitting among the expense lines. 64 options where 42 were possible.

`dirOf(t)` now decides which way the money went, and every list is filtered by
it. It reads the chosen category first and falls back to the sign, because once
a category is picked that is the decision actually made — the sign is only what
we have before one exists.

| list | was | now |
|---|---|---|
| business expense categories | filtered | filtered (36) |
| sheet lines after an expense | **all 64** | **42** |
| sheet lines after income | **all 64** | **22** |
| tax-book categories | **unfiltered** | by direction, plus the excluded ones |

The excluded categories — drawings, tax, GST, loan principal — stay available
in both directions, because they genuinely go either way.

**Two quieter holes closed at the same time**, both of which could have put an
expense on an income line without anyone picking it:

- the learned category→line pairing (`S.lineFor`) is ignored when the line runs
  the opposite way to the category, rather than filled in;
- a rule now has a direction of its own (`ruleDir`), and skips rows going the
  other way instead of coding them. A refund from a merchant you normally pay
  arrives **unsorted**, which is the honest outcome — it is a different
  transaction and wants its own answer. The toast says how many were left.

The personal list is the one exception: his personal blocks are all expense
lines, so a personal refund would filter down to nothing. Better the whole list
than an empty one, so it falls back.

`direction.test.mjs` covers the lot, including the learned pairing deliberately
set the wrong way round and a refund that must not be swept up by its merchant's
rule.

---

## 23 September 2026 — Rules stop being automatic

Daniel, part way through his first real sort: "Gojek is marked as a rule - but I
realised that sometimes its not food but rather taxi. And it can be business and
personal expense."

That is the whole argument against the old default. The **Make a rule** box was
ticked unless you noticed and unticked it, so one answer about one Gojek ride —
food, that day — silently became every Gojek after it. A merchant that means one
thing is the exception, not the rule; Gojek is food, a taxi, a delivery, and
sometimes business.

**The box now starts unticked.** `resetPick` sets `ruleOn=false`. Nothing is
carried forward unless it is asked for, which is what he said he wanted back
when the mapping was first built: manual first, learn from there.

**There is a rules panel now** — the *Rules* button beside the filter chips in
Sort. Every rule, what it fills in (with the block colours), how many rows it
filled versus how many you answered yourself, and two ways out:

- **Remove** — stop it happening again, leave what it already did.
- **Remove & reopen** — also send back everything *the rule* filled, so those
  come round again one at a time.

The distinction is the point. Reopening only undoes rows where `auto` is true.
A row you sat and decided keeps its answer, because the rule was wrong, not
your judgement. After a reopen the list switches to **To sort** so the rows that
came back are in front of you.

**Backspace changed meaning.** It used to clear the row *and* delete the rule
behind it, which conflated two very different intentions and was the only way to
remove a rule at all. It now clears the row only. Rules are removed in the panel,
where you can see what one has actually done before killing it.

`rules.test.mjs` walks the Gojek case exactly: answering one row makes no rule
and fills nothing else; ticking the box makes one and carries it; Backspace
leaves it alone; Remove keeps the filled rows; Remove & reopen returns the two
the rule filled and leaves the two answered by hand.

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

**Then, same day: a rail was not enough.** Daniel wanted the colour across the
whole row, not a line down the side. Every row now carries a wash of its block's
hue, mixed against the menu surface, with the heading heavier and the row the
keyboard is on heaviest plus a 2px ring in the same hue — a ring rather than
more strength alone, because "stronger" reads differently hue to hue and the
cursor has to be unmistakable against seven other washes.

The mix percentages are per-theme (`--tintRow`, `--tintHover`, `--tintSel`,
`--tintHead`, `--tintEdge`): the dark steps sit lighter on a dark surface and
need a heavier mix to read as the same wash.

**That wash is what makes the text contrast worth measuring**, and it caught a
real problem: the note beside each category was `--ink3`, which over the tint
came out at **2.6:1** — well under the 4.5:1 floor for body text, in both
themes. It is `--ink2` now, and `--ink` on the selected row. Worst case after
the fix: 6.69:1 light, 5.77:1 dark.

`colour.test.mjs` measures this on every row of both pick lists in both themes,
and it does it by painting each colour onto a 1×1 canvas and reading the pixel
back — `color-mix()` serialises as `oklab()`, so parsing the computed value with
a regex silently returns nonsense. The first attempt did exactly that and
reported a label contrast of 1.24:1, which was not true. If a tint percentage is
ever nudged, this test is what notices.

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
