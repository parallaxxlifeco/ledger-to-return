/**
 * CommBank transaction listings ("Transaction Summary" PDFs): what NetBank
 * gives for any date range, so several months come in as one file. Rows carry
 * the full date, a signed amount and the balance; a reference or a card's
 * foreign amount can sit on the next line. No printed totals — the check is
 * the running balance. The lines are shaped as pdfLines() returns them from a
 * real listing; every name, number and reference is invented.
 *
 *   node test/listing.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const head = (type, num) => ['Account Number 060000 1234' + num, 'Page 1 of 2', 'MR T EXAMPLE', '1 EXAMPLE ST', '10 November 2026', 'Dear MR T EXAMPLE,',
  'Here’s your account information and a list of transactions from 01/07/26-31/10/26.', 'Account name MR T EXAMPLE', 'BSB 060000',
  'Account number 1234' + num, 'Account type ' + type, 'Date opened 24/01/2024', 'Date Transaction details Amount Balance'];
const foot = ['Any pending transactions haven’t been included in this list. Proceeds of cheques aren’t available until', 'cleared.',
  'Kind regards,', 'The CommBank Team.', 'Created 10/11/26 07:09am (Sydney/Melbourne time)', 'While this letter is accurate at the time it’s produced,',
  'we’re not responsible for any reliance on this information. Transaction Summary v1.0.5'];

const SAVER = [...head('NetBank Saver', '9999'),
  '19 Oct 2026 Direct Credit 111111 AMAZON COMMERCIA $23.32 $23.32', 'DASTESTREFAAAA1', ...foot];
/* A card, newest first, running onto a second page, with a foreign charge,
   a payment, and a description that wraps before its figures. */
const CARD = [...head('Low Rate Mastercard', '4321'),
  '30 Oct 2026 PAYMENT RECEIVED, THANK YOU $500.00 -$200.00',
  '28 Oct 2026 CAFE EXAMPLE CANGGU IDN -$14.03 -$700.00',
  '##1026 150,000.00 RUPIAH',
  'Created 10/11/26 07:09am (Sydney/Melbourne time)', 'While this letter is accurate at the time it’s produced,',
  'we’re not responsible for any reliance on this information. Transaction Summary v1.0.5',
  'Account Number 060000 12344321', 'Page 2 of 2', 'Date Transaction details Amount Balance',
  '03 Jul 2026 A VERY LONG MERCHANT NAME THAT WRAPS',
  'SYDNEY NSW -$85.97 -$685.97',
  '01 Jul 2026 APPLE.COM/BILL SYDNEY NSW -$600.00 -$600.00', ...foot];

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof readCbaListing === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const r = await p.evaluate(([saver, card]) => {
  const s = readCbaListing(saver), c = readCbaListing(card);
  const broken = readCbaListing(card.map(l => l.startsWith('28 Oct') ? '28 Oct 2026 CAFE EXAMPLE CANGGU IDN -$14.03 -$714.03' : l));
  const others = {card: readCbaListing(['Statement Period 11 Jun 2025 - 9 Jul 2025', '11 Jun Crossfit 14.03']), acct: readCbaListing(['Date Transaction Debit Credit Balance'])};
  return {s: {acct: s.acct, rec: s.rec, rows: s.rows}, c: {acct: c.acct, rec: c.rec, rows: c.rows}, brokenOk: broken.rec.ok, others,
    readers: STATEMENT_READERS.map(x => x.id)};
}, [SAVER, CARD]);

check('the Saver listing is the same account as its statements', r.s.acct === 'CommBank NetBank Saver 9999', r.s.acct);
check('one row: 19 Oct, +23.32, the reference dropped', r.s.rows.length === 1 && r.s.rows[0].date === '2026-10-19' && r.s.rows[0].aud === 23.32
  && r.s.rows[0].desc === 'Direct Credit 111111 AMAZON COMMERCIA', JSON.stringify(r.s.rows));
check('it balances, period from the letter', r.s.rec.ok && r.s.rec.period === '2026-07-01 to 2026-10-31', JSON.stringify(r.s.rec));
check('a card listing is filed as the card', r.c.acct === 'CommBank card 4321', r.c.acct);
check('rows come out oldest first, across both pages', JSON.stringify(r.c.rows.map(x => x.date)) === JSON.stringify(['2026-07-01', '2026-07-03', '2026-10-28', '2026-10-30']), JSON.stringify(r.c.rows.map(x => x.date)));
check('charges negative, the payment positive', JSON.stringify(r.c.rows.map(x => x.aud)) === JSON.stringify([-600, -85.97, -14.03, 500]), JSON.stringify(r.c.rows.map(x => x.aud)));
check('a wrapped description is joined', r.c.rows[1].desc === 'A VERY LONG MERCHANT NAME THAT WRAPS SYDNEY NSW', r.c.rows[1].desc);
check('the foreign amount is kept with its row', r.c.rows[2].cur === 'IDR' && r.c.rows[2].orig === 150000 && r.c.rows[2].desc === 'CAFE EXAMPLE CANGGU IDN', JSON.stringify(r.c.rows[2]));
check('page footers and headers do not leak into a row', !r.c.rows.some(x => /Created|letter|Page|Account/.test(x.desc)));
check('the card balances, money out 700, in 500', r.c.rec.ok && r.c.rec.charges === 700 && r.c.rec.payments === 500, JSON.stringify(r.c.rec));
check('a row that breaks the running balance fails the check', r.brokenOk === false);
check('card statements and account statements are not taken for listings', r.others.card === null && r.others.acct === null);
check('it is one of the statement readers', r.readers.includes('cba-listing'));
// A credit card's listing: no Balance column, and waived international fees as rows with no amount
const NOBAL = ['Account Number xxxxxxxxxxxx4321', 'Page 1 of 1', 'Here’s your account information and a list of transactions from 10/10/26-31/10/26.',
  'Account number xxxxxxxxxxxx4321', 'Account type Mastercard Example', 'Date Transaction details Amount',
  '11 Oct 2026 SHOP EXAMPLE RAZLOG BGR -$21.22', '##1026 13.16 EURO NATL CURR UNI', '11 Oct 2026 INTNL TRANSACTION FEE', '$ 0.74 FEE SAVED',
  '14 Oct 2026 TAQUERIA EXAMPLE TULUM -$55.43', '##1026 701.40 MEXICAN PESO', '14 Oct 2026 INTNL TRANSACTION FEE', '$ 1.94 FEE SAVED',
  '20 Oct 2026 PAYMENT RECEIVED, THANK YOU $2,400.00', '30 Oct 2026 SOFTWARE EXAMPLE AUSTIN TX $24.46', '##1126 850.00 TURKISH LIRA', ...foot];
const nb = await p.evaluate(lines => { const g = readCbaListing(lines); return {acct: g.acct, rec: g.rec, rows: g.rows}; }, NOBAL);
check('a card listing with no Balance column is read', nb.acct === 'CommBank card 4321' && nb.rows.length === 4, JSON.stringify(nb.rows));
check('waived fees ("FEE SAVED") are left out, signs as printed', JSON.stringify(nb.rows.map(x => x.aud)) === JSON.stringify([-21.22, -55.43, 2400, 24.46]), JSON.stringify(nb.rows.map(x => x.aud)));
check('pesos and lira are named', nb.rows[1].cur === 'MXN' && nb.rows[3].cur === 'TRY', JSON.stringify(nb.rows.map(x => x.cur)));
check('marked as read without a check, not as failing one', nb.rec.ok && nb.rec.unchecked, JSON.stringify(nb.rec));

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
