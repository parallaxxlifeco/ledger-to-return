/**
 * One book. The Tax return / Tracking switch is gone and the app is always
 * Tracking. Rows only ever loaded into the old Tax return book are brought
 * across once, as if imported: duplicates skipped (here the statement already
 * in Tracking), rules applied, onto the Tracking account of the same name.
 *
 *   node test/onebook.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof mergeTaxBook === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

check('no Tax return / Tracking switch on the page', await p.evaluate(() => !document.querySelector('.bookbtn')));
check('opens in Tracking', await p.evaluate(() => S.book === 'track'));

const r = await p.evaluate(() => {
  const SAVER = 'CommBank NetBank Saver 1986';
  const mk = (id, date, desc, amt, acct, x) => Object.assign({id, date, desc, amt, cur: 'AUD', acct, mk: merchantKey(desc)}, x || {});
  delete S.taxMerged;
  S.books.track.tx = [normTx(mk('t1', '2025-07-28', 'Direct Credit 158824 AMAZON COMMERCIA', 151.65, SAVER, {kind: 'business', tax: 'inc_product', line: TRACKS.find(l => l.label === 'Amazon AU').key}), true)];
  S.books.track.rules = {[merchantKey('Direct Credit 158824 AMAZON COMMERCIA')]: {k: 'business', l: TRACKS.find(l => l.label === 'Amazon AU').key, t: 'inc_product'}};
  const OLD = SAVER + ' - Parallaxx Income AUD';
  S.books.tax.tx = [
    mk('o1', '2025-07-28', 'Direct Credit 158824 AMAZON COMMERCIA', 151.65, OLD, {cat: 'inc_product'}),   // already in Tracking
    mk('o2', '2025-08-25', 'Direct Credit 158824 AMAZON COMMERCIA', 114.15, OLD),                          // new — the rule fills it
    mk('o3', '2025-09-01', 'Credit Interest', 0.05, OLD),                                                   // new, unsorted
  ];
  const n = mergeTaxBook();
  const tr = S.books.track.tx;
  const again = mergeTaxBook();
  return {n, again, book: S.book, rows: tr.map(t => ({date: t.date, acct: t.acct, kind: t.kind, auto: t.auto})), oldKept: S.books.tax.tx.length, flag: !!S.taxMerged};
});
check('the two new rows come across; the one already in Tracking is skipped', r.n === 2 && r.rows.length === 3, JSON.stringify(r.rows));
check('onto the Tracking account of the same name', r.rows.every(x => x.acct === 'CommBank NetBank Saver 1986'), JSON.stringify(r.rows.map(x => x.acct)));
check('rules apply: the Amazon payout is filled in, the interest waits in Sort', r.rows.find(x => x.date === '2025-08-25').kind === 'business' && r.rows.find(x => x.date === '2025-08-25').auto
  && !r.rows.find(x => x.date === '2025-09-01').kind, JSON.stringify(r.rows));
check('only once', r.again === 0 && r.flag);
check('the old book\'s data is left as it was, not deleted', r.oldKept === 3);
check('still in Tracking', r.book === 'track');

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
