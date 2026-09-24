/**
 * Wise exports.
 *
 * Wise's transfer history is not a statement and has no amount column. Every
 * row is a transfer with two sides — Source and Target — and the sign lives in
 * a Direction column. Handed to the generic importer it picked the ID column,
 * because stripping the letters out of "TRANSFER-2205480566" leaves something
 * that reads as a number, and a whole export came in at minus two billion.
 *
 * The fixture is synthetic: names and ids invented, shape copied exactly from a
 * real export. Real exports name real people, and this repository is public.
 *
 *   node test/wise.test.mjs
 */
import {chromium} from 'playwright';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const BASE = process.env.BASE || 'http://localhost:8899/build';
const here = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(here, 'fixtures', 'wise-sample.csv'), 'utf8');

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof isWiseCsv === 'function');

let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

/* --- the parser that used to be fooled --- */
console.log('AMOUNT DETECTION:');
const money = await p.evaluate(() => ({
  ids: ['CARD_TRANSACTION-3985259590', 'TRANSFER-2205480566', 'AMAZON.CLSEYQR6L'].map(v => parseAmount(v)),
  real: ['-89.99', '1,234.56', '673.48-', '(45.10)', '2.500.000', 'USD 38.06', '12.34 CR'].map(v => parseAmount(v)),
}));
check('a reference is not an amount', money.ids.every(v => v === null), JSON.stringify(money.ids));
check('real figures still parse', money.real.every(v => typeof v === 'number'), JSON.stringify(money.real));

/* --- the export --- */
console.log('\nTHE EXPORT:');
const got = await p.evaluate(text => {
  S.book = 'track';
  document.querySelector('#impText').value = text;
  document.querySelector('#impAcct').value = '';
  doParse();
  const {out} = buildRows();
  return {
    headers: PARSED.headers,
    mapped: ['date', 'desc', 'amount', 'cur'].map(k => PARSED.headers[PARSED.map[k]] || 'none'),
    rows: out.map(t => ({date: t.date, desc: t.desc, amt: t.amt, cur: t.cur, acct: t.acct, aud: enrich(t).aud})),
    note: document.querySelector('#pdfNote').innerText.replace(/\s+/g, ' '),
    acct: document.querySelector('#impAcct').value,
  };
}, csv);

check('recognised, and rewritten into readable columns',
  JSON.stringify(got.mapped) === JSON.stringify(['Date', 'Description', 'Amount', 'Currency']), got.mapped.join(', '));
check('7 rows in, 5 out — the two refunded are left behind', got.rows.length === 5, `${got.rows.length} rows`);
check('the note says why', /refunded/.test(got.note) && /2 refunded/.test(got.note), got.note.slice(0, 150));

const byDesc = d => got.rows.find(r => r.desc.includes(d));
const out1 = byDesc('Motorcycle');
check('OUT is negative, in the currency that left, with the fee added back',
  out1 && out1.amt === -(215.71 + 1.63) && out1.cur === 'USD',
  out1 ? `${out1.amt} ${out1.cur}` : 'missing');
const in1 = byDesc('Marketplace');
check('IN is positive, named after who sent it', in1 && in1.amt === 627.43 && in1.cur === 'USD',
  in1 ? `${in1.desc} ${in1.amt}` : 'missing');
const card = byDesc('Petrol');
check('a card spend keeps its own currency', card && card.amt === -200000 && card.cur === 'IDR',
  card ? `${card.amt} ${card.cur}` : 'missing');
const neutral = got.rows.find(r => /balance conversion/i.test(r.desc));
check('moving between your own balances is named as such, not guessed at',
  neutral && neutral.amt === -(64.78 + 0.52) && /AUD to USD/.test(neutral.desc),
  neutral ? neutral.desc : 'missing');
/* One export spans every balance held, so the currency belongs to the row, not
   to the file. */
check('currencies stay per row', [...new Set(got.rows.map(r => r.cur))].sort().join(',') === 'AUD,IDR,USD',
  [...new Set(got.rows.map(r => r.cur))].join(', '));
check('and the account is named for the mix', got.acct === 'Wise', got.acct);

/* --- the conversion, which is the whole point --- */
console.log('\nCONVERSION:');
check('every row converted', got.rows.every(r => r.aud != null));
const idr = card;
check('IDR is not read as dollars', Math.abs(idr.aud) > 15 && Math.abs(idr.aud) < 30,
  `IDR 200,000 -> ${idr.aud} AUD`);
const weekend = got.rows.find(r => r.date === '2025-08-03');   // a Sunday
const carried = await p.evaluate(() => {
  const t = B().tx && B().tx[0];
  return fxRate('USD', '2025-08-03');
});
check('a Sunday carries the last published rate forward', carried.status === 'carried' && carried.src === '2025-08-01',
  `${weekend ? weekend.date : '?'} used ${carried.src} (${carried.status})`);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nWise exports read correctly');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
