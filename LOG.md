# Log

What was built, when, and what you'd need to know to change it. Newest first.

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
