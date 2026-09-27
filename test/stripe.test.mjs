/**
 * Stripe exports.
 *
 * The split Daniel asked for:
 *   - a sale goes on the monthly sheets, NOT the return (the ATO already has the
 *     total from Stripe)
 *   - Stripe's fee goes on the return as a deduction, NOT the sheets
 *   - a payout is his own money moving to the bank — a transfer
 *
 * So each sale arrives as two rows, fees and payouts arrive already answered,
 * and only the sheet line for a sale is left to ask — with a rule per product
 * (his real export: 368 customers over 571 sales, but a handful of products).
 *
 * The fixture is synthetic (example.com customers, _TEST ids). Real exports
 * carry customer names and emails, and this repository is public.
 *
 *   node test/stripe.test.mjs
 */
import {chromium} from 'playwright';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const BASE = process.env.BASE || 'http://localhost:8899/build';
const here = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(here, 'fixtures', 'stripe-sample.csv'), 'utf8');

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof isStripeCsv === 'function');

let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };
const near = (a, b) => Math.abs(a - b) < 0.005;

/* ---------------- reading it ---------------- */
console.log('READING THE EXPORT:');
const got = await p.evaluate(text => {
  S.book = 'track'; B().tx = []; B().rules = {}; S.lineFor = {};
  document.querySelector('#impText').value = text;
  document.querySelector('#impAcct').value = '';
  doParse();
  const {out} = buildRows();
  return {
    mapped: ['date', 'desc', 'amount', 'cur'].map(k => PARSED.headers[PARSED.map[k]] || 'none'),
    rows: out.map(t => ({date: t.date, desc: t.desc, amt: t.amt, cur: t.cur, role: t.role, ref: t.ref, mk: t.mk})),
    note: document.querySelector('#pdfNote').innerText.replace(/\s+/g, ' '),
    acct: document.querySelector('#impAcct').value,
    blocked: document.querySelector('#btnAdd').disabled,
  };
}, csv);

check('recognised, and rewritten into readable columns',
  JSON.stringify(got.mapped) === JSON.stringify(['Date', 'Description', 'Amount', 'Currency']), got.mapped.join(', '));
check('10 Stripe rows become 15 — every sale with a fee is split in two', got.rows.length === 15, `${got.rows.length} rows`);
check('the account is named Stripe AUD', got.acct === 'Stripe AUD', got.acct);
check('it adds up, so it can be added', !got.blocked && /adds up/.test(got.note), got.note.slice(0, 120));
check('the note tells him to mark the bank-side payout Transfer', /Transfer/.test(got.note) && /counts? the income twice/.test(got.note));

const role = r => got.rows.filter(x => x.role === r);
const sum = rs => Math.round(rs.reduce((s, x) => s + x.amt, 0) * 100) / 100;
check('sales and refunds: 330 in, 130 back out', near(sum(role('sale').filter(x => x.amt > 0)), 330) && near(sum(role('sale').filter(x => x.amt < 0)), -130),
  `${sum(role('sale').filter(x => x.amt > 0))} / ${sum(role('sale').filter(x => x.amt < 0))}`);
check('fees: 25.67 on sales + 13.31 of Stripe billing and its GST = 38.98', near(sum(role('fee')), -38.98), `${sum(role('fee'))}`);
check('one payout, 200', role('payout').length === 1 && near(role('payout')[0].amt, -200));
check('a Climate contribution is left to be asked', role('other').length === 1 && /contribution/.test(role('other')[0].desc));
check('everything together is Stripe\'s own net', near(sum(got.rows), -40.48), `${sum(got.rows)}`);

const first = got.rows.find(x => x.role === 'sale' && x.amt === 150);
check('the local date is used, not UTC (31 Jul UTC is 1 Aug here)', first && first.date === '2025-08-01', first && first.date);
check('a sale is named for the customer, with what they bought', first && /Jo Example/.test(first.desc) && /Breathwork/.test(first.desc), first && first.desc);
const two = got.rows.filter(x => x.role === 'sale' && x.amt === 50);
check('two identical $50 tickets the same day stay two rows', two.length === 2 && two[0].ref !== two[1].ref);
check('a refund carries the same key as the sales of that product', got.rows.filter(x => x.mk === 'STRIPE COMMUNITY CIRCLE TICKET').length === 3);
const disp = got.rows.filter(x => /dispute/i.test(x.desc));
check('a dispute is the sale going back plus the $15 dispute fee', disp.length === 1 && disp[0].amt === -80
  && got.rows.some(x => x.role === 'fee' && x.amt === -15), disp.map(x => x.desc + ' ' + x.amt).join(' | '));

/* ---------------- adding it ---------------- */
console.log('\nADDING IT:');
const added = await p.evaluate(() => {
  addParsed();
  const tx = B().tx;
  const pick = f => tx.filter(f).map(t => ({kind: t.kind, tax: t.tax, line: t.line, noSheet: !!t.noSheet, auto: t.auto, done: settled(t), amt: t.amt}));
  return {
    n: tx.length,
    fees: pick(t => t.role === 'fee'),
    payouts: pick(t => t.role === 'payout'),
    sales: pick(t => t.role === 'sale'),
    other: pick(t => t.role === 'other'),
  };
});
check('all 15 added', added.n === 15, `${added.n}`);
check('every fee is filled in: Business · payment fees · return only', added.fees.length === 7
  && added.fees.every(t => t.kind === 'business' && t.tax === 'ex_bank' && t.noSheet && !t.line && t.done && t.auto));
check('the payout is filled in as Transfer', added.payouts.every(t => t.kind === 'transfer' && t.done && t.auto));
check('every sale is marked as income the ATO already has', added.sales.length === 6
  && added.sales.every(t => t.kind === 'business' && t.tax === 'x_income_reported'));
check('but is not finished until it has a sheet line', added.sales.every(t => !t.done && !t.line));
check('the contribution is left completely open', added.other.every(t => !t.kind && !t.done));

const again = await p.evaluate(text => {
  document.querySelector('#impText').value = text; doParse(); addParsed(); return B().tx.length;
}, csv);
check('importing the same month again adds nothing', again === 15, `${again}`);

/* ---------------- sorting a sale ---------------- */
console.log('\nSORTING A SALE:');
const sort = await p.evaluate(() => {
  const line = linesFor('business').find(l => l.kind === 'income');
  const jo = B().tx.find(t => t.role === 'sale' && t.amt === 50);
  go('sort'); filter = 'all'; curId = jo.id; renderList();
  const asked = /Which income line/.test(document.querySelector('.pickbox .lbl')?.textContent || '');
  const offered = pickPool(jo).every(o => TRK[o.key] && TRK[o.key].kind === 'income');
  ruleOn = true; choose(line.key);             // no forcing the mode: this is the real path
  const joRows = B().tx.filter(t => t.mk === 'STRIPE COMMUNITY CIRCLE TICKET');
  const sam = B().tx.filter(t => t.mk !== 'STRIPE COMMUNITY CIRCLE TICKET' && t.role === 'sale');
  return {line: line.key, asked, offered,
    joAll: joRows.every(t => t.line === line.key && settled(t)),
    refundOnLine: joRows.some(t => t.amt < 0 && t.line === line.key),
    samOpen: sam.every(t => !t.line)};
});
check('a sale goes straight to "Which income line?"', sort.asked);
check('and is only offered income lines', sort.offered);
check('R on one ticket files the other ticket — and its refund', sort.joAll && sort.refundOnLine);
check('other products are untouched, even from the same customer', sort.samOpen);

const grid = await p.evaluate(k => {
  const sheet = TRK[k].sheet;
  const d = gridData(sheet, 2025);
  const row = d.groups.flatMap(g => g.items).find(i => i.line.key === k);
  const anyFee = d.groups.flatMap(g => g.items).some(i => i.line.kind === 'expense' && i.months[7] !== 0 && /fee|bank/i.test(i.line.label));
  return {aug: row ? row.months[7] : null, anyFee};
}, sort.line);
check('on the sheet: 50 + 50 − 50 = 50 for August', grid.aug != null && near(grid.aug, 50), `${grid.aug}`);
check('no Stripe fee reaches the sheets', !grid.anyFee);

/* ---------------- the return ---------------- */
console.log('\nTHE RETURN:');
const ret = await p.evaluate(() => {
  S.taxFy = fyOf('2025-08-10').id;
  const d = reportData();
  const bank = d.byCat.ex_bank;
  return {income: d.totalIncome, bank: bank ? bank.aud : 0,
          reportedOnReturn: d.income.some(b => b.cat.key === 'x_income_reported'),
          listedAsOff: d.excluded.some(b => b.cat.key === 'x_income_reported')};
});
check('Stripe sales add nothing to income on the return', near(ret.income, 0) && !ret.reportedOnReturn, `${ret.income}`);
check('and are listed as kept off it', ret.listedAsOff);
check('Stripe fees are on the return as a deduction: 38.98', near(ret.bank, -38.98), `${ret.bank}`);

/* ---------------- other shapes ---------------- */
console.log('\nOTHER SHAPES:');
const shapes = await p.evaluate(() => {
  const H = s => s.split(',');
  const legacy = H('id,Type,Source,Amount,Fee,Net,Currency,Created (UTC),Available On (UTC),Status,Description');
  const legacyBody = [['txn_TESTL1', 'charge', 'ch_TESTL1', '100.00', '3.05', '96.95', 'usd', '2025-08-04 10:00', '2025-08-06', 'available', 'Workbook']];
  const paypal = H('Date,Time,TimeZone,Name,Type,Status,Currency,Gross,Fee,Net,Transaction ID');
  const paypalBody = [['04/08/2025', '10:00', 'AEST', 'Someone', 'Express Checkout Payment', 'Completed', 'AUD', '100.00', '-3.00', '97.00', '9XY12345AB678901C']];
  const L = stripeRows(legacy, legacyBody);
  const broken = stripeRows(H('balance_transaction_id,created,currency,gross,fee,net,reporting_category'),
                            [['txn_TESTX', '2025-08-04', 'aud', '100.00', '3.00', '90.00', 'charge']]);
  return {legacyYes: isStripeCsv(legacy, legacyBody), legacyRows: L.rows.map(r => [r.date, r.cur, r.amt, r.pre.role]),
          paypalNo: !isStripeCsv(paypal, paypalBody), wiseNo: !isStripeCsv(H('ID,Status,Direction,Created on'), []),
          brokenOff: broken.off};
});
check('the older Dashboard export is read too', shapes.legacyYes
  && JSON.stringify(shapes.legacyRows) === JSON.stringify([['2025-08-04', 'USD', 100, 'sale'], ['2025-08-04', 'USD', -3.05, 'fee']]),
  JSON.stringify(shapes.legacyRows));
check('a PayPal export (same Gross/Fee/Net shape) is not taken for Stripe', shapes.paypalNo);
check('nor is Wise', shapes.wiseNo);
check('a file that does not add up is caught', shapes.brokenOff.length === 1, JSON.stringify(shapes.brokenOff));

const blocked = await p.evaluate(() => {
  document.querySelector('#impText').value = 'balance_transaction_id,created,currency,gross,fee,net,reporting_category,description\ntxn_TESTX,2025-08-04,aud,100.00,3.00,90.00,charge,Bad';
  doParse();
  return {disabled: document.querySelector('#btnAdd').disabled, note: document.querySelector('#pdfNote').innerText};
});
check('and cannot be added', blocked.disabled && /DOES NOT ADD UP/.test(blocked.note));

/* ---------------- keeping it ---------------- */
console.log('\nKEEPING IT:');
const kept = await p.evaluate(() => {
  const snap = JSON.parse(JSON.stringify(S));
  snap.mkv = 1;                                           // force the merchant-key migration
  const m = migrate(snap);
  const tx = m.books.track.tx;
  return {keys: tx.filter(t => t.src === 'stripe' && t.role === 'sale').map(t => t.mk),
          fee: tx.find(t => t.role === 'fee')};
});
check('a merchant-key upgrade leaves Stripe product keys alone',
  kept.keys.every(k => /^STRIPE (BREATHWORK WORKSHOP - AUGUST|COMMUNITY CIRCLE TICKET|COACHING SESSION)$/.test(k)), kept.keys.join(', '));
check('a fee still knows it is return only after a reload', kept.fee && kept.fee.noSheet === true);

/* ---------------- the Payments export ---------------- */
/* Payments → Export: one row per attempt, charged amount and converted amount,
   Fee and Taxes On Fee in separate columns, and the payout id in "Transfer".
   Same header names as his real export; every value below is invented. */
console.log('\nTHE PAYMENTS EXPORT:');
const pay = await p.evaluate(() => {
  const head = ['id', 'Created date (UTC)', 'Amount', 'Amount Refunded', 'Currency', 'Captured', 'Converted Amount',
    'Converted Amount Refunded', 'Converted Currency', 'Decline Reason', 'Description', 'Fee', 'Refunded date (UTC)',
    'Statement Descriptor', 'Status', 'Seller Message', 'Taxes On Fee', 'Card ID', 'Customer ID', 'Customer Description',
    'Customer Email', 'Invoice ID', 'Transfer'];
  const row = o => head.map(h => o[h] ?? '');
  const body = [
    {id: 'ch_TESTP1', 'Created date (UTC)': '2025-08-05 10:00:00', Amount: '23.00', 'Amount Refunded': '0.00', Currency: 'usd', Captured: 'true',
     'Converted Amount': '35.10', 'Converted Amount Refunded': '0.00', 'Converted Currency': 'aud', Description: 'Community Night - Bali ($23)',
     Fee: '1.53', 'Taxes On Fee': '0.15', Status: 'Paid', 'Customer Email': 'ana@example.com', Transfer: 'po_TESTA'},
    {id: 'ch_TESTP2', 'Created date (UTC)': '2025-08-05 11:00:00', Amount: '25.00', 'Amount Refunded': '0.00', Currency: 'usd', Captured: 'true',
     'Converted Amount': '38.15', 'Converted Amount Refunded': '0.00', 'Converted Currency': 'aud', Description: 'Community Night - Bali (Early Bird $21 - Save $4) ($25)',
     Fee: '1.64', 'Taxes On Fee': '0.16', Status: 'Paid', 'Customer Email': 'ben@example.com', Transfer: 'po_TESTA'},
    {id: 'ch_TESTP3', 'Created date (UTC)': '2025-08-06 09:00:00', Amount: '100.00', 'Amount Refunded': '100.00', Currency: 'aud', Captured: 'true',
     'Converted Amount': '100.00', 'Converted Amount Refunded': '100.00', 'Converted Currency': 'aud', Description: 'Workshop (AU$100)',
     Fee: '2.00', 'Taxes On Fee': '0.20', 'Refunded date (UTC)': '2025-08-20 02:00:00', Status: 'Refunded', 'Customer Email': 'cy@example.com', Transfer: 'po_TESTB'},
    {id: 'ch_TESTP4', 'Created date (UTC)': '2025-08-07 09:00:00', Amount: '23.00', 'Amount Refunded': '0.00', Currency: 'usd', Captured: 'false',
     'Converted Amount': '35.10', 'Converted Amount Refunded': '0.00', 'Converted Currency': 'aud', Description: 'Community Night - Bali ($23)',
     Fee: '0.00', 'Taxes On Fee': '0.00', Status: 'Failed', 'Decline Reason': 'insufficient_funds', 'Customer Email': 'dee@example.com'},
  ].map(row);
  const text = [head, ...body].map(r => r.map(csvq).join(',')).join('\n');
  S.book = 'track'; B().tx = []; B().rules = {};
  document.querySelector('#impText').value = text; document.querySelector('#impAcct').value = '';
  doParse();
  const {out} = buildRows();
  return {isPay: isStripePayments(head, body), notBalance: !isStripeCsv(head, body),
    rows: out.map(t => ({date: t.date, amt: t.amt, cur: t.cur, role: t.role, mk: t.mk, desc: t.desc})),
    note: document.querySelector('#pdfNote').innerText.replace(/\s+/g, ' '),
    canAdd: !document.querySelector('#btnAdd').disabled};
});
check('recognised as the payments export', pay.isPay && pay.notBalance);
check('the failed attempt is left out', !pay.rows.some(r => r.desc.includes('dee@')) && /1 failed/.test(pay.note));
check('the sale is what reached the balance, in AUD, not the USD charged',
  pay.rows.some(r => r.role === 'sale' && r.amt === 35.1 && r.cur === 'AUD'));
check('the fee is Fee + Taxes On Fee', pay.rows.some(r => r.role === 'fee' && r.amt === -1.68),
  pay.rows.filter(r => r.role === 'fee').map(r => r.amt).join(', '));
check('a refund is its own row on the day it was refunded, and Stripe keeps its fee',
  pay.rows.some(r => r.role === 'sale' && r.amt === -100 && r.date === '2025-08-20') && pay.rows.some(r => r.role === 'fee' && r.amt === -2.2));
check('the same product at two prices is one rule key',
  pay.rows.filter(r => r.mk === 'STRIPE COMMUNITY NIGHT - BALI').length === 2, [...new Set(pay.rows.map(r => r.mk))].join(' | '));
check('the note counts the payouts to mark on the bank side', /2 payouts/.test(pay.note), pay.note.slice(0, 80));
check('and it can be added', pay.canAdd && pay.rows.length === 7, `${pay.rows.length} rows`);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nStripe exports read and split correctly');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
