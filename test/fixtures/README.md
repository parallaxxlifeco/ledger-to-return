# Test statements

`pdf.test.mjs` reads a real CommBank credit card statement and checks the rows
it gets back against the totals the statement prints for itself. That only works
against a real file, and a real file is a bank statement — card number, address,
every transaction. **This repository is public.** So the statements live here and
are git-ignored, and the test skips politely when the folder is empty.

To run the full test, put a CommBank card statement PDF here as:

    cba-card-2025-07-09.pdf

The one the expectations were written against covers **11 Jun – 9 Jul 2025** and
should give:

| | |
|---|---|
| rows in the file | 125 |
| rows left after zero-dollar lines are dropped | 68 |
| charges | $9,832.23 |
| payments and refunds | $8,985.18 |
| opening → closing | $673.48 → $1,520.53 |
| rows carrying a foreign amount | 56 |

Any other statement will have different figures, so change `SAYS` at the top of
`pdf.test.mjs` to whatever page 1 of yours says, and the reconciliation checks
still mean something: they compare the parse against the bank's own arithmetic,
not against numbers anyone typed in twice.
