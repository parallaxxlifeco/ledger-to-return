# Log

What was built, when, and what you'd need to know to change it. Newest first.

---

## 30 September 2026 — The sort screen as two fixed panes

"Now put the full transaction list I am working through listed under here so it
doesn't need to keep switching the page layout." And: "give the one I am
currently looking at a highlight to draw the eye to it."

On screens 900px wide and up, Sort is two panes, both the height of the screen
under the sticky filters (`#rowList.splitmode`, `renderSplit` in `part_c4.js`):

- **Left (380px):** the card being answered — date, amount, description, chips,
  the four answers 2×2, Make a rule — and under it the whole queue as slim
  one-line rows (`queueRow`), scrolling on its own. Chips show only once a row
  has an answer. The current row is highlighted in the card's blue (`.qcur`);
  the queue keeps its scroll position between answers and scrolls just enough
  to keep the highlight in view. Clicking any row opens it.
- **Right:** the ATO / sheets pick list, filling the pane. Before an answer, or
  on a transfer or a sorted row, the pane holds a short prompt (`pickIdle`)
  instead — so the list always opens in the same place and nothing moves.

Under 900px the single column (card inside the list, list below the card) is
unchanged; a resize across the line re-renders. `activeCard` is now built from
`activeParts`, which both layouts use.

`test/layout.test.mjs` checks both layouts, the highlight, that the pane doesn't
move when the list opens, and that the list gets most of the screen.

---

## 30 September 2026 — Two columns while picking

"What if we design two columns so that the transaction detail is on the left
side and then I have the full page height for the scroller categories."

While a pick list is open, the card is two columns (`.txcard.cur.split`): the
transaction, its chips, the four answers (2×2) and Make a rule on the left in
330px; the ATO / sheets pick list on the right, `max-height` of
`calc(100vh - 235px)` — most of the screen. On a 900px-tall screen that is
about twenty rows at once instead of eight. When there is nothing to pick (a
transfer, a settled row) the card stays one column.

Under 860px wide it stacks again, list below. The sort pane is 1180px wide now
(was 920) to give the list room. `activeCard` builds `head` + `body` (left) and
`right` (the pick box) separately.

`rules.test.mjs`: the rule box must be beside the list (left column) or above
it — never below.

---

## 30 September 2026 — A compact answer card

"This whole part takes up too much space on the screen, leaving too little
space for the selector below."

Everything above the pick list was about 380px tall; it is now about 200, and
the list uses the rest of the screen.

- The four answers (Personal / Business / Transfer / Other) are one slim row;
  their hints are tooltips.
- Make a rule is one line — "every “X” gets this answer +N loaded" — with the
  merchant caution moved to its tooltip.
- The "Counts in FY …, not the … report you have open" row became a small chip
  on the account line, "in FY 2025–26 ›", which still switches the year when
  clicked (`.fychip`, `data-fy`).
- The pick box header is one line: the ATO RETURN / YOUR SHEETS tag, the
  question, and "step 1 of 2" at the right.
- `.pickmenu` height is `max(300px, calc(100vh - 330px))` instead of a fixed
  360px.

`fy.test.mjs` now looks for the chip rather than the old note row.

---

## 30 September 2026 — The 2026 CommBank print engine

"I am still getting this error while trying to upload statements from Commbank"
— Statement20260610.pdf and Statement20260311.pdf: "not a statement this can
read yet".

From early 2026 CommBank's statements come out of a new print engine (the PDF
says OpenText Output Transformation Engine 25.2). Its font maps the decimal
point to a space in the text layer, so every figure reads "27 82" for 27.82 and
"$5,321 09" for $5,321.09 — in pdf.js, and in pdftotext too, so it is the file
and not the reader. No figure matched, and the statement was refused.

- `CBA_AMT` in `part_c2c.js`: digits, then a point **or a space**, then exactly
  two digits. It can't swallow a merchant name ending in a number — the cents
  are always two digits and last, and a whole-dollar part is always printed.
  Used for rows, FX lines and the summary totals. `cbaNum` / `cbaFig` turn
  either form into a number.
- The same tolerance in the bank-account reader, for when the Saver statements
  come out of the new engine too.
- The FX line runs the currency name on: "16 50EURO NATL CURR U". Matched by
  prefix against `CBA_CUR`.
- **Interest.** The March statement charged $67.04 interest on purchases. It is
  printed in the summary with no date ("Interest charged on purchases Purchase
  Rate 20 990%p a 67 04") and it is in the charges total, so without it the
  statement was $67.04 short. `CBA_INT` reads both interest lines as rows dated
  the last day of the period; $0.00 ones drop out with the zeros.

His March 2026 statement: 67 rows, charges $9,052.31 and payments $5,350.00
matching the printed totals, $5,321.09 → $9,023.40. The July 2025 statement
still balances; it has two $0.00 interest lines, so `pdf.test.mjs` now expects
127 rows in the file (68 after zeros, unchanged).

`account.test.mjs` has a "2026 card layout" section and a spaced Saver check,
both synthetic.

---

## 30 September 2026 — Which book a pick list is for

"I am getting a bit confused in which log I am listing for … Can you make it
more obvious - for ATO maybe colour the box the blue ATO colour. And for my own
personal selection it can be Green."

A business row is asked twice — the ATO category, then the sheet line — and the
only difference on screen was the wording of one line. The pick box now says
which book it answers for:

- **Blue, "ATO RETURN"** — the tax category. Business rows show "Step 1 of 2 ·
  the category on the tax return"; Other shows "kept off the return"; the tax
  book is always blue.
- **Green, "YOUR SHEETS"** — a line on GIA Finance Tracking / Budget Tracker.
  Business rows show "Step 2 of 2"; personal rows show "Budget Tracker ·
  personal".

`pickFor(t)` in `part_c4.js` decides it (it follows `lineMode`, so a Stripe sale
that arrives needing only its line is green). Colours are tokens in
`part_a.html`: `--ato` / `--sheet` with their dark-theme values; `.pickbox.for-ato`
and `.for-sheet` set `--pf`, which the border, wash, tag, prompt and focus ring
all use. Change the two tokens to change the colours.

---

## 30 September 2026 — CommBank account statements

"I am trying to import this for the Parallaxx apparel income but now its not a
statement it could read. Its the same export as my credit card statement."

It is the same export, but not the same layout. His NetBank Saver statement
(where the Amazon payouts land) is a bank-account statement: Debit, Credit and
Balance columns, descriptions that run onto a second line, a six-month period,
and no year on the dates. The card reader looks for "Statement Period" and one
line per charge, found neither, and said so.

`readCbaAccount` in `part_c2c.js`, tried after the card reader
(`STATEMENT_READERS`):

- Recognised by the "Date Transaction Debit Credit Balance" header and
  "Period d Mon yyyy - d Mon yyyy".
- A row starts at a dated line and ends at the line carrying its balance
  ("$6,004.64 CR"); anything between is description.
- **The sign comes from the running balance**, not the columns: once joined into
  text, a debit and a credit are both just a figure. Each amount is the balance
  movement, and it must equal the printed figure (`mismatch` counts misses).
- The statement's own line — Opening − Total debits + Total credits = Closing —
  is checked too. If anything is off, the report says DOES NOT BALANCE and Add
  stays disabled (`PARSED.block`, now set for any PDF that fails its check).
- The "CREDIT INTEREST EARNED … is $69.77" note has no balance, so it is never
  a row. Repeated page headers are skipped.
- A second-line payer reference in capitals ("DASMOLV6T7OKUB3") is dropped, so
  every Amazon payout keys as `AMAZON COMMERCIA` and one rule covers them.
- Account named from the product and the last four digits:
  "CommBank NetBank Saver 1986".

His statement, 1 Feb – 31 Jul 2025: 21 rows, money out $5,682.00 and in
$3,499.15, both matching the printed totals, opening $5,588.94 to closing
$3,406.09. Most of it is FY 2024-25 — only July falls in FY 2025-26.

Also: statements from different accounts dropped in together are refused with
a message (one import is one account), and the statement report now has an
Account column and reads Money out / Money in.

`test/account.test.mjs` — synthetic lines in the exact shape pdfLines returns,
no real statement needed.

---

## 27 September 2026 — CIRCLES is one line

"Okay lets keep Circles which combines both the reconnected Man and the
reconnected woman as one."

The Reconnected Woman line added earlier today is gone again. Both circles'
income goes on **CIRCLES · Reconnected Man** (GIA sheet), which rolls into
Reconnected Man on the Budget Tracker as before — no new rows needed in either
Google Sheet. The line keeps its name and key so nothing already coded or
pasted by key moves.

- `STRIPE_LINES`: one pattern, `reconnected (man|men|woman|women)`, to the
  Reconnected Man line.
- `SHEET_SEED`, `ROLLUP_SEED`: the Woman lines removed. `ADDED_LINES` is empty
  (the mechanism stays for next time).
- `MERGED_LINES` + `mergeLines()` in `part_c2b.js`, run from `pruneRetired`:
  anyone who opened the build with the Woman line has rows, rules and the
  learned category→line map moved to Reconnected Man; the Woman keys are in
  `RETIRED_LINES`, so the now-unused lines drop out. Use the same two
  structures to fold any line into another later.

Tests: `stripe.test.mjs` checks both circles land on the one line and that a
saved Woman line folds across with its rows and rules; `direction.test.mjs` is
back to three CIRCLES lines.

---

## 27 September 2026 — His products, answered

"I would like the rules applied to these … GIVE IT ALL (Tickets), Speaker,
Founders Breakfast, The Reconnected Man, The Reconnected Woman … subscription
only shows Subscription so I will need to mark these manually once … Where
Founders Breakfast and GIVE IT ALL is on the same line - we split it 50/50."

**Standing answers.** `STRIPE_LINES` in `part_c2c.js` maps what he sells to a
GIA sheet line (each rolls into its Budget Tracker line):

    GIVE IT ALL …          -> GIVE IT ALL · Tickets
    Speaker …              -> GIVE IT ALL · Speakers
    Founders Breakfast …   -> CIRCLES · Founders Breakfast
    … Reconnected Man …    -> CIRCLES · Reconnected Man
    … Reconnected Woman …  -> CIRCLES · Reconnected Woman

The first time a product turns up in an import, `addParsed` writes a real rule
for it (`from:"stripe"`, kept through `normRule`), so it is listed in Rules and
can be removed like any other. Removing one records it in `bk.ruleOff`, and the
next import does not put it back. Removing with reopen sends a Stripe sale back
for its line only — it stays "income the ATO already has".

**Subscriptions** are keyed on the subscriber (`STRIPE SUBSCRIPTION · email`),
not on the word "Subscription", so pressing R once per person files their
renewals and nobody else's. "Payment for Invoice" and blank descriptions are
keyed on the customer as before.

**Split checkouts.** `stripeParts` / `stripeSaleRows`: a description joined with
" + " naming more than one product becomes one row per product, the amount split
evenly (the last share takes the rounding, so the pieces add to the cent), each
keyed and filed on its own product. Same product twice is not split. Refunds of
a split checkout split the same way. The fee stays one row.

**New line: Reconnected Woman**, on the GIA sheet under CIRCLES and on the
Budget Tracker under TRANSFORMATIONS, rolling GIA → Budget like Reconnected
Man. A saved line list replaces the seed on load, so `ADDED_LINES` /
`addNewLines()` (called from `pruneRetired`) slots it in after Reconnected Man
for anyone who already has one. **Both Google Sheets need a matching row** for
the actuals to land.

His year, run through it (not stored): 592 sale rows — 457 Tickets, 48
Speakers, 38 Founders Breakfast (20 checkouts split into 40 halves) filed
automatically; 49 left, which is 19 answers with R: 10 subscribers (37
payments), 3 invoices, 8 without a description.

`stripe.test.mjs` 60 checks; `direction.test.mjs` now expects four CIRCLES
income/expense lines.

---

## 27 September 2026 — Stripe's Payments export, and rules per product

Daniel sent a real export to check against: **Payments → Export**
(`unified_payments`), not the balance report the reader was built for. It
would not have been recognised — no `Net`, no `Type`. It is now, by
`isStripePayments` / `stripePaymentRows` in `part_c2c.js`.

What that export is: one row per payment attempt. `Amount`/`Currency` is what
the customer was charged (mostly USD); `Converted Amount`/`Converted Currency`
is what reached his Stripe balance (AUD). The reader uses the converted figure —
the AUD he actually got. `Fee` excludes GST; `Taxes On Fee` is the GST, and the
two together come to exactly 3.5% + 30c on his international charges, so the
fee row is both. `Failed` or `Captured=false` rows moved no money and are left
out. A refund becomes its own row on `Refunded date (UTC)` at
`Converted Amount Refunded` (his one refund went back as 532.70 against 521.18
taken); Stripe keeps its fee. `Transfer` holds the payout id, so the note can
say how many bank deposits to mark Transfer. Dates are UTC — the file has no
local column.

This export has no Stripe billing fees (Invoicing, Radar…) and nothing to
reconcile against; the balance report has both.

**Rules are now per product, not per customer.** His year: 571 sales, 368
customers, but a handful of products. `stripeProduct` strips the bracketed
price — "GIVE IT ALL - Bali ($23)", "(AU$23)", "(Early Bird $21 - Save $4)" all
become "GIVE IT ALL - Bali" — and folds "Subscription creation/update" into
"Subscription". A payment with no description falls back to the customer. Both
Stripe readers use it (`stripeKey`). Combined baskets ("Founders Breakfast +
GIVE IT ALL - Bali") keep their own key, so they are asked once each.

His file read as: 571 sales $39,505.69, fees $1,767.05, one refund $532.70,
51 failed left out, 143 payouts, 10 rows dated 30 Jun 2025 (last year). About
eight answers with R sort all 571.

`stripe.test.mjs` now has a payments-export section with the real header names
and invented values. The real file was checked in the cloud session only and is
not in the repo.

---

## 27 September 2026 — Stripe, split in two

"reading the income for business income for personal records not for ATO as
they already log this. And second reading the fees a business expense as part
of my tax filings because ATO doesn't take this."

Built before the first export arrives, so it reads both shapes Stripe hands
out: **Reports → Balance → Download → Itemised** (`reporting_category`, `gross`,
`fee`, `net`, `created`) and the older **Balance → All transactions** export
(`Type`, `Amount`, `Fee`, `Net`, `Created (UTC)`). `isStripeCsv` in
`part_c2c.js` knows it by those columns — and, where the column names alone
would also fit PayPal, by Stripe's own ids (`txn_…`, `ch_…`, `po_…`).

**One Stripe row becomes up to two here.** `stripeRows`:

| Stripe says | Becomes | Sorted |
|---|---|---|
| charge / payment | the sale (gross) **and** its fee (−fee) | sale: Business · *Income the ATO already has — sheets only*, line asked. Fee: Business · Bank, merchant & payment fees · **return only** |
| refund, dispute | the sale going back, plus any dispute fee | same as a sale, negative — comes off the same income line |
| fee, stripe_fee, tax, network_cost | Stripe's own charges and the GST on them | fee, return only |
| payout | his money moving to the bank | Transfer |
| anything else (contribution, adjustment…) | one row | asked like any other |

The sheet line is the only question left, and a rule is per **customer**: the
key is `STRIPE <customer name or email>`, set by the reader rather than by
`merchantKey`, which keeps only three words and would have run "Jo Example" and
"Jo Other" together. The MK_VERSION migration leaves those keys alone. A
customer rule also covers their refunds (`ruleDir` returns no direction for the
`biz` category), since a refund comes off the line the sale went on.

What was added to make that possible:

- `x_income_reported` in `CATS`: listed under Business income, but
  `kind:"exclude"`, so it is in no return total — the report lists it under
  "kept off". `biz:true` lets a Business row use it and still be asked for a
  line; `dir:"income"` makes a refund ask for an *income* line, not an expense.
- `t.noSheet` on a fee row: `settled()` accepts a Business row with a category
  and no line when it is set, the chips say **Return only**, and re-answering one
  never asks for a line.
- `t.ref`: Stripe's id. `txId` uses it when present, so two identical $50
  tickets bought the same day stay two rows. Every other reader is unchanged.
- `PARSED.pre`: per-row answers a reader already knows, carried through
  `buildRows` into `addParsed` → `stripePreset`.
- `lineMode(t)` in `part_c4.js`: a row that arrives with its category known and
  only the line missing goes straight to "Which income line?". Before, it showed
  the category list again, and picking a line from it did nothing.

**The check.** Sales − fees has to come to Stripe's own `net`, per currency. If
it doesn't, the note says DOES NOT ADD UP and Add stays disabled — a column was
read wrong. Dates use Stripe's local `created` column over `created_utc` where
both exist, so a sale at 6 am on the 1st isn't filed on the 31st.

**The other half is on the bank side.** The payout that lands in CommBank or Wise
is the same money again; it has to be marked Transfer there too (R then T makes
it a rule), or the sheets count the income twice. The import note says so every
time.

Not decided here: whether the ATO's figure is gross or net of refunds. Refunds
are kept off the return with the sales; worth confirming with the accountant.
GST on Stripe's fees is counted as part of the fee.

`test/stripe.test.mjs`, 38 checks, against `test/fixtures/stripe-sample.csv` —
synthetic (example.com customers, `_TEST` ids) and let through the hook and
`.gitignore` by name. Replace it with a real export and the hook will refuse it.

---

## 24 September 2026 — Two key shapes in one file

"I am still seeing them all there - please delete them from the list."

He was right and I had been wrong twice, blaming the browser cache. The build
was current. Looking at the live app rather than guessing:

    saved tracker lines   gia:give-it-all:teachable            (old shape)
    RETIRED_LINES         gia:give-it-all:expense:teachable    (current shape)
    his coded rows        budget:transformations:expense:...   (current shape)

`pruneRetired` matched on the key string, so it matched nothing and removed
nothing, every time, in silence.

**The same mismatch was doing quieter damage.** His saved lines were the old
shape but his transactions were the new one, so `TRK[t.line]` missed on all
eleven lines he had coded to. `gridData` skips a row whose line it cannot find —
so his monthly actuals grid was empty, and nothing said why. That is the worse
bug of the two, and it would not have been noticed until the numbers were needed.

`normaliseTrackKeys()` brings a saved list to the current shape before anything
tries to match on it, and carries every reference across: transactions, rules,
learned category→line pairings, and roll-up targets. Where an old key was
ambiguous — TRANSFORMATIONS has a GIA income line and a GIA expense line, both
`budget:transformations:gia` — the amount's sign decides, the same rule
`resolveLine` already used. It runs on both load paths, local and remote, before
`pruneRetired`.

`keyshape.test.mjs` rebuilds the exact broken state and asserts the repair:
every key ends up current, the software lines go, Facebook survives on the
Budget Tracker, a coded line resolves again, the ambiguous key splits by sign,
the grid gets its figures back, a second run is a no-op, and a retired line with
a transaction on it is still kept.

**The lesson is the cheap one: look at the running thing.** Two turns were spent
telling him to hard-refresh, on the confident assumption that a correct build
meant correct behaviour. One read of the live app's own state found it in a
minute.

---

## 24 September 2026 — A category is not a line

Two reports inside a minute, same cause:

- "I marked Ivan contractor and it placed it under GIA — this is a Parallaxx
  Transformations contractor."
- "I sent Amazon income to Other, but it didn't give me an option … not all
  other income will be for Amazon."

The sheet line was filled **silently** from `S.lineFor[category]` — the first
line ever used with that category. That is one line per category, and a
category is not a line: Contractors & freelancers is the video editor on the GIA
sheet *and* Ivan on TRANSFORMATIONS; Other business income is Amazon *and*
everything else. So Ivan landed on EDITING and the next odd receipt would have
landed on Amazon, with nothing on screen to say so.

**The line is now always asked**, with a best guess already selected, so it is
one extra Enter rather than a silent misfile. The guess prefers **who** over
**what**: the line this merchant went to last time, and only then the line last
used for the category. Ivan's second invoice suggests Ivan - Socials; the
editor's suggests EDITING. The suggestion sits at the top under SUGGESTED with
the reason beside it. A merchant rule still skips the question entirely,
because a rule is about who.

The same silent fill ran at import for a rule that carried a category but no
line — also removed. Such a row now arrives asking for its line.

**Rows already filed this way are not marked** — a silent fill set `auto:false`
like a real answer — so they cannot be found automatically; they have to be
checked by eye (Sorted, filter by the category's usual merchants).

**Also this turn: a rule for Transfer.** T finishes a row in one press, so a
rule box that only appeared *after* an answer could never be ticked for one. It
now shows before an answer, too: **R**, then **T**. Also on a transfer already
answered — tick it and press T again.

`rules.test.mjs`: R-then-T makes the rule and carries it to the other card
payments; T alone makes none; the line is asked every time; Ivan's guess is Ivan
and the editor's is EDITING; the guess is preselected.

---

## 24 September 2026 — Personal money in, not recorded

"I need an income line that doesn't need to be recorded on personal — this is
not required for personal income."

Money arriving on the personal side — a friend sending money, a gift — usually
belongs on neither sheet and not on the return. Transfer would have kept it out,
but it means "my own money moving", and a list of those should stay honest.

**Personal money in — not recorded** (`x_personal_in`) is a new excluded
category, offered as key **1** at the top of the personal list whenever the
amount is positive, and not at all when it is negative. Choosing it settles the
row as excluded with no sheet line: off both grids, off the return.

It carries `dir:"income"`, which `ruleDir` now reads first. Excluded categories
normally go either way, but this one only describes money coming in, so a rule
made with it — "everything from Richard is not recorded" — never touches a
payment going *to* him.

`direction.test.mjs` covers it: offered first on money in, settles with no line,
nothing in the grid, a rule catches his next transfer in, a payment to him is
left alone, and it is not offered on spending.

---

## 24 September 2026 — Money back comes off, not on

"This is coming in as personal income but wants a line in the personal
expenses?" — $50 USD in from a friend, marked Personal.

That part is by design: every block in his Budget Tracker's personal side is a
spending line, so money coming in on the personal side can only be something
coming back — a split bill, a repayment, a refund — and belongs on the line of
whatever it repaid. The prompt now says so for a positive personal amount:
*"Money in — which spending line does it come off?"*

**But checking what that would do found a real bug.** `gridData` added
`Math.abs(e.aud)` to every cell, so a $60 repayment on a $120 dinner showed
**$180** of restaurant spending, not $60. The $59.70 Tokopedia refund would have
done the same on whatever line it went to. Cells are now signed by the line's
direction — spending positive on an expense line, so money back subtracts; the
reverse on an income line. Ordinary rows are unchanged, which is why the roll-up
test against his May figures still passes to the cent.

Also fixed in passing: the block headings in the pick list piled up at the top
as you scrolled (SELF-CARE and LIFESTYLE both pinned at once). Each block now
sits in its own box, so its heading sticks only while its rows are on screen and
the next one pushes it off.

`direction.test.mjs`: a $60 repayment on a $120 dinner leaves $60 in September.

---

## 24 September 2026 — One merchant, not twenty

An Amazon payout, coded as business income: "should align to Amazon on the
sheet — but I can't see it as an option." It was there, one step later — the
ATO category comes first, the sheet line second. But looking at it turned up two
real problems that would have hit every payout after it.

**There was no category for selling goods.** Parallaxx sells on Amazon and
Shopify, and the income list had coaching, events, courses, speaking,
affiliates, sponsorship — and Other. Amazon had to go under Other business
income, and then the learned category→line pairing would have put *every*
future miscellaneous receipt on the Amazon line. **Product sales** is added; on
the ATO schedule it is business income like the rest.

**Every Amazon payout has its own code.** Twenty of them in the Wise export —
`AMAZON.CSVZTKNY0`, `AMAZON.CLSEYQR6L`, `AMAZON.CZZUSCOGM` — and `merchantKey`
kept the code, so they were twenty different merchants and a rule on one would
never have caught the next. Upwork was the same (`Upwork -818382738ref`).

`merchantKey` now drops a code hanging off a dot at the end of a name, and any
word that mixes letters with digits:

    AMAZON.CSVZTKNY0          -> AMAZON
    AMAZON.CZZUSCOGM          -> AMAZON       (no digits in that one — the dot rule catches it)
    AMAZON.RC5XR74G4 London   -> AMAZON LONDON  (a purchase; stays separate)
    Upwork -818382738ref ...  -> UPWORK DUBLIN
    WWW.FACEBOOK.COM          -> FACEBOOK     (dot followed by more text is a name)

Direction still separates the payouts from purchases, so a Product sales rule on
Amazon never touches an Amazon order.

**Stored keys had to move too.** `mk` is written onto each row at import, so a
better function only helps later imports. `migrate()` recomputes every stored
key once (`mkv` versions it) and moves each rule to wherever its rows now land —
via the rows, not by re-keying the old key string, because a code with no digits
in it can only be recognised while the dot is still there. None of his nine
existing rules contained a code, so none of them moved. It is idempotent, which
matters because a Drive copy without `mkv` will run it again.

`merchant.test.mjs` covers the keys, the category, the migration and its second
run, and that one rule on one payout fills the others — category and line —
while leaving an Amazon purchase alone.

---

## 24 September 2026 — Wise has no amount column

The first Wise import came in at minus two and a half billion dollars.

**Two faults, one behind the other.**

`parseAmount` stripped every letter before reading the number, so
`CARD_TRANSACTION-3985259590` became −3,985,259,590 and `TRANSFER-2205480566`
became −2,205,480,566. The ID column then scored as the most numeric column in
the file and was chosen as the amount. Money carries at most a currency mark and
a CR/DR suffix, so `looksLikeMoney` now rejects anything else with letters in
it, before the stripping happens. That fault was general — any export with an
alphanumeric reference would have hit it.

Underneath: **a Wise export is not a statement.** There is no column you can read
as the amount. Every row is a transfer with two sides —

    Direction   OUT / IN / NEUTRAL
    Source ...  what left    (for OUT, his balance)
    Target ...  what arrived (for IN, his balance)

so the sign comes from `Direction`, the figure from whichever side is his, and
the fee is its own column that has to be added back: "Source amount (after
fees)" is what remained *after* the fee was taken, and the fee is money spent
too. `wiseRows()` rewrites the export into columns the importer already reads.

Decisions worth keeping:

- **Refunded transfers are left out.** Six in his file, five of them failed
  USD→IDR conversions. They were undone; counting them spends the money twice.
  The import says how many and why.
- **NEUTRAL rows are balance conversions between his own balances.** Named
  "Wise balance conversion AUD to USD" so he can press T, rather than the app
  guessing — which he ruled out for transfer pairs already.
- **Currency stays per row.** One export spans every balance held: his had IDR,
  USD, AUD, EUR and THB in a single file, 70 rows of which changed currency
  mid-transfer. A single currency for the file would have been wrong.

**The conversion itself was verified against the source, not just tested.** The
127 rows were re-converted independently from the ECB reference file, and every
one of the **102 distinct date+currency pairs matched to the cent** — including
the weekend carry-forward (3 Aug 2025, a Sunday, correctly using Friday 1 Aug).
14 rows fell on a non-publishing day. That is the first real evidence the FX
path works, and it is the reason the whole tool exists.

The fixture is synthetic — invented names and ids, shape copied exactly. Real
exports name real people and this repository is public, so `.gitignore` blocks
`test/fixtures/*.csv` with one explicit exception for it.

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
