/**
 * CommBank bank-account statements (NetBank Saver, transaction accounts).
 *
 * Not the card layout: Debit / Credit / Balance columns, descriptions that run
 * onto a second line, periods of up to six months. Once pdf.js text is joined
 * into lines, a debit and a credit are both just a figure — so the reader takes
 * each row's amount from how far the running balance moved, checks it against
 * the printed figure, and checks the whole statement against its own
 * "Opening − Total debits + Total credits = Closing" line.
 *
 * The lines below are shaped exactly as pdfLines() returns them from a real
 * statement. Every name, number and reference in them is invented.
 *
 *   node test/account.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

const LINES = [
  'Your Statement', 'Statement 9 (Page 1 of 2)', 'Account Number 06 0000 12345678', 'Statement',
  'Period 1 Feb 2025 - 31 Jul 2025', 'MR T EXAMPLE', 'Closing Balance $1,060.00 CR', 'Enquiries 13 2221',
  'NetBank Saver', 'A NetBank Saver is an online savings account linked to your transaction account.',
  'Date Transaction Debit Credit Balance',
  '01 Feb 2025 OPENING BALANCE $1,000.00 CR',
  '01 Feb Credit Interest $ 2.00 $1,002.00 CR',
  '10 Feb Direct Credit 999999 AMAZON COMMERCIA',
  'DASTESTREFAAAA1 $ 400.00 $1,402.00 CR',
  '24 Feb Direct Credit 999999 AMAZON COMMERCIA',
  'DASTESTREFBBBBB $ 300.00 $1,702.00 CR',                 // a reference with no digits in it
  'Statement 9 (Page 2 of 2)', 'Account Number 06 0000 12345678', 'Date Transaction Debit Credit Balance',
  '01 Jul CREDIT INTEREST EARNED on this account',          // a note, not a transaction
  'to June 30, 2025 is $2.00 $',
  '05 Jul Transfer to xx0000 CommBank app',
  'Coaching 1,000.00 $ $702.00 CR',
  '06 Jul Transfer from xx1111 CommBank app',
  'Shopify $ 358.00 $1,060.00 CR',
  '31 Jul 2025 CLOSING BALANCE $1,060.00 CR',
  'Opening balance - Total debits + Total credits = Closing balance',
  '$1,000.00 CR $1,000.00 $1,060.00 $1,060.00 CR',
  'Your Credit Interest Rate Summary',
];

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof readCbaAccount === 'function');

let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const r = await p.evaluate(lines => {
  const g = readCbaAccount(lines);
  const tampered = readCbaAccount(lines.map(l => l === 'Shopify $ 358.00 $1,060.00 CR' ? 'Shopify $ 358.00 $1,066.00 CR' : l));
  const card = readCbaAccount(['Statement Period 11 Jun 2025 - 9 Jul 2025', '11 Jun Crossfit Badung 14.03']);
  const viaReaders = STATEMENT_READERS.map(x => x.id);
  return {acct: g.acct, rec: g.rec, rows: g.rows.map(x => ({date: x.date, aud: x.aud, desc: x.desc})),
          mks: [...new Set(g.rows.map(x => merchantKey(x.desc)))], tamperedOk: tampered && tampered.rec.ok, card, viaReaders};
}, LINES);

console.log('READING IT:');
check('named for the product and the last four digits of the account', r.acct === 'CommBank NetBank Saver 5678', r.acct);
check('five transactions — the interest note and the repeated headers are not rows', r.rows.length === 5, `${r.rows.length}`);
check('a year is given to every date, from the statement period', r.rows.every(x => x.date.startsWith('2025-')));
const out = r.rows.find(x => /Coaching/.test(x.desc)), inn = r.rows.find(x => /Shopify/.test(x.desc));
check('a debit is negative — read from the balance going down', out && out.aud === -1000, out && String(out.aud));
check('a credit is positive', inn && inn.aud === 358, inn && String(inn.aud));
check('a description on two lines is joined', out && out.desc === 'Transfer to xx0000 CommBank app Coaching', out && out.desc);
check('a payer reference is dropped, so every Amazon payout is one merchant',
  r.rows.filter(x => /AMAZON/.test(x.desc)).every(x => x.desc === 'Direct Credit 999999 AMAZON COMMERCIA') && r.mks.includes('AMAZON COMMERCIA'),
  r.mks.join(' | '));

console.log('\nCHECKING IT:');
check('money out and in match the statement\'s own totals', r.rec.gotCh === 1000 && r.rec.gotPay === 1060, `${r.rec.gotCh} / ${r.rec.gotPay}`);
check('and it balances', r.rec.ok === true && r.rec.mismatch === 0);
check('a balance that does not follow is caught', r.tamperedOk === false);
check('a card statement is not taken for an account one', r.card === null);
check('the card reader is still tried first', r.viaReaders[0] === 'cba-card' && r.viaReaders[1] === 'cba-account');

/* ---------------- the 2026 card layout ---------------- */
/* From early 2026 CommBank's print engine maps the decimal point to a space in
   the text layer — "27 82" for 27.82 — and prints interest in the summary with
   no date. Shaped exactly as pdfLines() returns his March 2026 card statement;
   every figure and name here is invented. */
const CARD26 = [
  'Your Statement', 'Ultimate Awards Credit Card', 'Page 1 of 4',
  'Statement Period 11 Feb 2026 - 11 Mar 2026',
  'Opening balance at 11 Feb $1,000 00', 'New transactions and charges $1,302 42',
  'Payments/refunds -$500 00', 'Closing balance at 11 Mar $1,802 42',
  'Transactions', '11 Feb 2026- 11 Mar 2026', 'Page 2 of 4',
  'Date Transaction details Amount (A$)',
  '11 Feb Bar Example Bansko 27 82', '##0000 16 50EURO NATL CURR U',
  '11 Feb Intnl Transaction Fee 0 00', '$ 0 97 FEE SAVED',
  '12 Feb Wix Com 1224025755 Luxembourg 1,200 00', '##0000 700 00EURO NATL CURR U',
  '24 Feb Payment Received, Thank You 500 00-',
  'Interest charged on purchases Purchase Rate 20 990%p a 74 60',
  'Interest charged on cash advances Cash Advance Rate 21 990%p a 0 00',
  'Helping you identify your regular payments',
];
const c = await p.evaluate(lines => {
  const g = readCbaCard(lines);
  return g && {rec: g.rec, rows: g.rows.map(x => ({date: x.date, aud: x.aud, desc: x.desc, cur: x.cur, orig: x.orig}))};
}, CARD26);
console.log('\nTHE 2026 CARD LAYOUT:');
check('read at all — the decimal point that comes out as a space', !!c);
check('"27 82" is 27.82, and "1,200 00" is 1,200.00',
  c && c.rows.some(x => x.aud === -27.82) && c.rows.some(x => x.aud === -1200), c && c.rows.map(x => x.aud).join(', '));
check('a merchant name ending in a number keeps it', c && c.rows.some(x => x.desc === 'Wix Com 1224025755 Luxembourg'));
check('the foreign amount and its currency, from "16 50EURO NATL CURR U"',
  c && c.rows.some(x => x.cur === 'EUR' && x.orig === 16.5));
check('interest in the summary becomes a row on the last day', c && c.rows.some(x => x.desc === 'Interest charged on purchases' && x.aud === -74.6 && x.date === '2026-03-11'));
check('a payment is money back', c && c.rows.some(x => x.aud === 500));
check('and it balances against its own totals', c && c.rec.ok === true, c && JSON.stringify(c.rec));
const spaced = await p.evaluate(lines => {
  /* The same print engine on a Saver statement: every "1,402.00" becomes "1,402 00". */
  const g = readCbaAccount(lines.map(l => l.replace(/(\d)\.(\d{2})\b/g, '$1 $2')));
  return g && {ok: g.rec.ok, rows: g.rows.length, out: g.rec.gotCh, inn: g.rec.gotPay};
}, LINES);
check('a Saver statement from the new engine reads the same', spaced && spaced.ok && spaced.rows === 5 && spaced.out === 1000 && spaced.inn === 1060,
  JSON.stringify(spaced));

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nAccount statements read correctly');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
