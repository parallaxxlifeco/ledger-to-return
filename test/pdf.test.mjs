/**
 * Reading a CommBank card statement straight from the PDF, in the browser.
 *
 * The fixture is a real statement (11 Jun - 9 Jul 2025). The point of the test
 * is not that some rows come out, but that they reproduce the bank's own
 * arithmetic: opening + charges - payments = the closing balance the statement
 * prints for itself. If that holds, nothing was missed and nothing counted twice.
 *
 *   node test/pdf.test.mjs
 */
import {chromium} from 'playwright';
import {existsSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const BASE = process.env.BASE || 'http://localhost:8899/build';
const here = dirname(fileURLToPath(import.meta.url));
const PDF = join(here, 'fixtures', 'cba-card-2025-07-09.pdf');

/* what the statement says about itself, read off page 1 by eye */
const SAYS = {opening: 673.48, charges: 9832.23, payments: 8985.18, closing: 1520.53,
              rowsInFile: 125, rowsWorthSorting: 68};

/* The fixture is a real statement, so it is git-ignored and never published.
   See test/fixtures/README.md for how to put one back. */
if (!existsSync(PDF)) {
  console.log('SKIPPED — no statement at test/fixtures/cba-card-2025-07-09.pdf');
  console.log('See test/fixtures/README.md. The figures below are what it should produce.');
  console.log(JSON.stringify(SAYS, null, 1));
  process.exit(0);
}

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
/* Google Identity Services is fetched by the page wrapper and is blocked in
   the sandbox this runs in. It has nothing to do with reading a PDF. */
const EXTERNAL = /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|accounts\.google\.com/;
p.on('console', m => { if (m.type() === 'error' && !EXTERNAL.test(m.text())) errs.push('CONSOLE: ' + m.text()); });

await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof readStatement === 'function');

/* --- straight at the reader, no UI --- */
const got = await p.evaluate(async path => {
  const buf = await (await fetch(path)).arrayBuffer();
  const file = new File([buf], 'statement.pdf', {type: 'application/pdf'});
  const r = await readStatement(file);
  return r && {acct: r.acct, n: r.rows.length, rec: r.rec,
               first: r.rows[0], withFx: r.rows.filter(x => x.cur).length,
               payments: r.rows.filter(x => x.aud > 0).map(x => x.aud)};
}, '/test/fixtures/cba-card-2025-07-09.pdf');

let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

if (!got) { console.log('BAD  the reader did not recognise the statement'); bad++; }
else {
  console.log('\nREADER:');
  check('recognised as a CommBank card', got.acct.startsWith('CommBank card'), got.acct);
  check('period', got.rec.period === '2025-06-11 to 2025-07-09', got.rec.period);
  check(`${SAYS.rowsInFile} rows found in the file`, got.rec.n === SAYS.rowsInFile, String(got.rec.n));
  check(`${SAYS.rowsWorthSorting} worth sorting after zeros dropped`, got.n === SAYS.rowsWorthSorting, String(got.n));

  console.log('\nAGAINST THE STATEMENT\'S OWN TOTALS:');
  check('charges', Math.abs(got.rec.gotCh - SAYS.charges) < 0.005, `read ${got.rec.gotCh.toFixed(2)}, statement says ${SAYS.charges.toFixed(2)}`);
  check('payments', Math.abs(got.rec.gotPay - SAYS.payments) < 0.005, `read ${got.rec.gotPay.toFixed(2)}, statement says ${SAYS.payments.toFixed(2)}`);
  const closes = SAYS.opening + got.rec.gotCh - got.rec.gotPay;
  check('closing balance', Math.abs(closes - SAYS.closing) < 0.005, `${SAYS.opening} + ${got.rec.gotCh.toFixed(2)} - ${got.rec.gotPay.toFixed(2)} = ${closes.toFixed(2)}`);
  check('reader agrees it balances', got.rec.ok === true);

  console.log('\nDETAIL:');
  check('charges are negative', got.first.aud < 0, `${got.first.date} ${got.first.desc} ${got.first.aud}`);
  /* Three card payments and one Tokopedia refund. The refund is the one that
     catches a lazy parser: it is a credit on a merchant line, not a payment. */
  check('trailing-minus credits came back positive', got.payments.length === 4 && got.payments.every(v => v > 0), got.payments.join(', '));
  check('the $59.70 refund is a credit, not a charge', got.payments.includes(59.7));
  check('foreign amounts picked up off the continuation line', got.withFx === 56, String(got.withFx));
}

/* --- and through the UI, the way he'll actually do it --- */
console.log('\nTHROUGH THE IMPORT SCREEN:');
await p.setInputFiles('#impFile', PDF);
await p.waitForSelector('#pdfNote', {state: 'visible'});
await p.waitForFunction(() => document.querySelector('#mapCard').style.display !== 'none', null, {timeout: 20000});

const ui = await p.evaluate(() => ({
  note: document.querySelector('#pdfNote').innerText.replace(/\s+/g, ' ').trim(),
  acct: document.querySelector('#impAcct').value,
  cur: document.querySelector('#impCur').value,
  dup: document.querySelector('#dupNote').innerText,
  mapped: [...document.querySelectorAll('#mapFields select')].map(s => s.dataset.map + '=' + s.selectedOptions[0].text),
}));
check('account filled in from the card number', /CommBank card 4345/.test(ui.acct), ui.acct);
check('currency set to AUD', ui.cur === 'AUD', ui.cur);
check('the note says it balances', /balances/.test(ui.note) && !/DOES NOT/.test(ui.note));
check('amount column mapped to the AUD column', ui.mapped.some(m => /^amount=Amount \(AUD\)/.test(m)), ui.mapped.join(' | '));
check('"Original charge" not taken as a currency column', ui.mapped.some(m => /^cur=— none —/.test(m)), ui.mapped.join(' | '));
console.log('  note:', ui.note.slice(0, 190));
console.log('  preview:', ui.dup);

await p.click('#btnAdd');
await p.waitForTimeout(400);
const loaded = await p.evaluate(() => ({
  n: B().tx.length,
  aud: Math.round(B().tx.reduce((s, t) => s + enrich(t).aud, 0) * 100) / 100,
  noRate: B().tx.filter(t => enrich(t).aud == null).length,
}));
check(`${SAYS.rowsWorthSorting} transactions loaded`, loaded.n === SAYS.rowsWorthSorting, String(loaded.n));
check('every row converted', loaded.noRate === 0, `${loaded.noRate} without a rate`);
check('net matches charges minus payments',
  Math.abs(loaded.aud - (SAYS.payments - SAYS.charges)) < 0.02,
  `${loaded.aud.toFixed(2)} vs ${(SAYS.payments - SAYS.charges).toFixed(2)}`);

/* importing the same statement twice must not double it */
await p.evaluate(() => go('import'));            // adding sends you to Sort
await p.setInputFiles('#impFile', PDF);
await p.waitForFunction(() => document.querySelector('#mapCard').style.display !== 'none', null, {timeout: 20000});
await p.click('#btnAdd');
await p.waitForTimeout(400);
const again = await p.evaluate(() => B().tx.length);
check('re-importing the same statement adds nothing', again === SAYS.rowsWorthSorting, String(again));

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\neverything checks out');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
