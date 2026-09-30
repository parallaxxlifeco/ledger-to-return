/**
 * Splitting a transaction.
 *
 * One payment, two answers: a dinner shared with his partner, or a bill that is
 * partly business. The row becomes two parts that add back to the original to
 * the cent; each is answered on its own; "Join back" undoes it; and importing
 * the same statement again does not bring the original back.
 *
 *   node test/split.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof splitTx === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await p.evaluate(() => {
  S.book = 'track'; B().rules = {};
  const row = {date: '2025-08-02', desc: 'Montana Del Cafe Bangli', amt: -47.79, cur: 'AUD', acct: 'card'};
  B().tx = [normTx({...row, id: txId(row), mk: merchantKey(row.desc)}, true)];
  renderAll(); go('sort'); curId = B().tx[0].id; renderList();
});

console.log('50 / 50:');
await p.click('[data-split-open]');
await p.waitForTimeout(80);
const form = await p.evaluate(() => ({open: !!document.querySelector('.splitrow.open'), focus: document.activeElement?.id}));
check('Split… opens the form, with the keyboard on it', form.open && form.focus === 'splitPct', JSON.stringify(form));
await p.click('[data-split-go="50"]');
await p.waitForTimeout(80);
const half = await p.evaluate(() => ({
  parts: B().tx.map(t => ({id: t.id, amt: t.amt, split: t.split && t.split.pct, desc: t.desc})),
  cur: curId, chip: !!document.querySelector('.chip-split'),
}));
check('two parts', half.parts.length === 2);
check('that add back to the cent', Math.round((half.parts[0].amt + half.parts[1].amt) * 100) === -4779
  && Math.abs(half.parts[0].amt - half.parts[1].amt) <= 0.011, half.parts.map(x => x.amt).join(' + '));
check('same description on both', half.parts.every(x => x.desc === 'Montana Del Cafe Bangli'));
check('the first part is open to answer, and marked as split', half.cur === half.parts[0].id && half.chip);

console.log('\nANSWERING EACH PART:');
const answered = await p.evaluate(() => {
  const [a, c] = B().tx;
  curId = a.id; resetPick(); setKind('personal');
  choose(linesFor('personal').find(l => l.label === 'Restaurants').key);
  curId = c.id; resetPick(); setKind('personal');
  const offered = pickPool(currentTx())[0];
  choose('x_partner');
  const [x, y] = B().tx;
  return {offered: offered && offered.key, a: [x.kind, TRK[x.line]?.label], c: [y.kind, y.tax], both: settled(x) && settled(y),
          mine: -x.amt, grid: gridData('budget', 2025).groups.flatMap(g => g.items).find(i => i.line.label === 'Restaurants').months[7]};
});
check('the other half is offered "Partner\'s share — not recorded" first', answered.offered === 'x_partner', answered.offered);
check('your half on Restaurants, theirs off the books', answered.a[0] === 'personal' && answered.a[1] === 'Restaurants' && answered.c[0] === 'exclude' && answered.c[1] === 'x_partner',
  JSON.stringify(answered));
check('the sheet shows only your half', Math.abs(answered.grid - answered.mine) < 0.005, `${answered.grid} of 47.79`);

console.log('\nIMPORTING AGAIN:');
const again = await p.evaluate(() => {
  document.querySelector('#impText').value = 'Date,Description,Amount\n02/08/2025,Montana Del Cafe Bangli,-47.79';
  document.querySelector('#impAcct').value = 'card';
  doParse(); addParsed();
  return B().tx.length;
});
check('the original does not come back', again === 2, `${again} rows`);

console.log('\nJOIN BACK:');
const joined = await p.evaluate(() => {
  filter = 'all'; curId = B().tx[0].id; renderList();
  document.querySelector('[data-split-join]').click();
  const t = B().tx[0];
  return {n: B().tx.length, amt: t.amt, split: !!t.split, open: !settled(t)};
});
check('one row again, the full amount, waiting for an answer', joined.n === 1 && joined.amt === -47.79 && !joined.split && joined.open, JSON.stringify(joined));

console.log('\nA CUSTOM SPLIT:');
const custom = await p.evaluate(() => {
  const row = {date: '2025-08-05', desc: 'Telkomsel', amt: -1000000, cur: 'IDR', acct: 'card'};
  B().tx.push(normTx({...row, id: txId(row), mk: 'TELKOMSEL'}, true));
  curId = B().tx[1].id; splitTx(curId, 70);
  const ps = B().tx.filter(t => t.split && t.split.of === txId(row));
  return ps.map(t => [t.amt, t.split.pct]);
});
check('70 / 30, whole rupiah', JSON.stringify(custom) === JSON.stringify([[-700000, 70], [-300000, 30]]), JSON.stringify(custom));

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nsplitting behaves');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
