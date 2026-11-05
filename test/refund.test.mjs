/**
 * Refunds come off the charge they reverse. Money back from a merchant is
 * offered "Refund it" (F): it is filed on the same category and sheet line as
 * the purchase, so the two cancel — and a split purchase's refund is split the
 * same way. The report lists refunds of business costs still filed as
 * something else.
 *
 *   node test/refund.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof applyRefund === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; S.lineFor = {}; S.taxFy = fyOf('2025-08-10').id;
  const travel = linesFor('business').find(l => l.label === 'Business Travel / Ads').key;
  const soft = linesFor('business').find(l => l.label === 'Regular Subcriptions').key;
  const mk = (id, date, desc, amt, x) => Object.assign(normTx({id, date, desc, amt, cur: 'AUD', acct: 'card', mk: merchantKey(desc)}, true), x || {});
  B().tx = [
    // a business flight refunded the same day, the refund filed as a transfer
    mk('f1', '2025-07-27', 'Trip.Com Tokyo', -550.47, {kind: 'business', tax: 'ex_air', line: travel}),
    mk('f2', '2025-07-27', 'Trip.Com Tokyo', 556.94, {kind: 'transfer', tax: 'x_transfer'}),
    // a flight split with his partner: his half business, hers a transfer
    mk('k1~1', '2025-10-17', 'Kiwi Com Brno', -880.77, {kind: 'transfer', tax: 'x_transfer', split: {of: 'k1', part: 1, n: 2, pct: 50, amt: -1761.54}}),
    mk('k1~2', '2025-10-17', 'Kiwi Com Brno', -880.77, {kind: 'business', tax: 'ex_air', line: travel, split: {of: 'k1', part: 2, n: 2, pct: 50, amt: -1761.54}}),
    mk('k2', '2025-10-20', 'Kiwi Com Brno', 1761.54),
    // a part refund of a subscription, not sorted yet
    mk('a1', '2026-01-20', 'Adobe Saggart', -100.30, {kind: 'business', tax: 'ex_software', line: soft}),
    mk('a2', '2026-02-04', 'Adobe Saggart', 50.15),
    // money in from someone never paid: no offer
    mk('z1', '2025-08-01', 'Random Payer', 40),
    // a refund of something only ever moved as a transfer: no offer
    mk('s1', '2026-01-28', 'Seek Sophie', -745),
    mk('s2', '2026-01-28', 'Seek Sophie', 745),
  ];
  B().tx.find(x => x.id === 's1').kind = 'transfer'; B().tx.find(x => x.id === 's1').tax = 'x_transfer';
  renderAll();
});

const offers = await p.evaluate(() => Object.fromEntries(['f2', 'k2', 'a2', 'z1', 's2'].map(id => {
  const m = refundOffer(B().tx.find(x => x.id === id)); return [id, m ? m.key : null];
})));
check('the flight refund matches its charge', offers.f2 === 'f1', JSON.stringify(offers));
check('the split flight refund matches the whole split charge', offers.k2 === 'k1');
check('a part refund matches the charge that covers it', offers.a2 === 'a1');
check('no offer for money from someone never paid', offers.z1 === null);
check('no offer when the charge was only ever a transfer', offers.s2 === null);

// The report lists the missed ones (business costs only)
await p.evaluate(() => go('report'));
const flag = await p.evaluate(() => [...document.querySelectorAll('.flagbox')].map(e => e.innerText.replace(/\s+/g, ' ')).find(x => /refund/i.test(x)) || '');
check('report flags 3 refunds of business costs not taken off', /^3 refunds of business costs not taken off/.test(flag), flag);
const before = await p.evaluate(() => reportData().totalExpense);

await p.click('[data-refunds]');
await p.waitForTimeout(150);
let st = await p.evaluate(() => ({sort: document.querySelector('#pane-sort').classList.contains('on'), cur: curId,
  rows: [...document.querySelectorAll('.queue .txcard')].map(e => e.dataset.id),
  offer: document.querySelector('.refundrow')?.innerText.replace(/\s+/g, ' ')}));
check('Show them opens Sort on just those refunds', st.sort && JSON.stringify(st.rows) === JSON.stringify(['f2', 'k2', 'a2']) && st.cur === 'f2', JSON.stringify(st));
check('the card offers the refund, naming the charge and where it goes', /Refund of the 27 Jul.*550\.47.*Airfares · Business Travel \/ Ads/.test(st.offer || ''), st.offer);

await p.keyboard.press('f');
await p.waitForTimeout(100);
st = await p.evaluate(() => { const t = B().tx.find(x => x.id === 'f2'); return {kind: t.kind, tax: t.tax, line: t.line, of: t.refundOf, cur: curId,
  chip: !!document.querySelector('.queue .txcard[data-id="f2"] .chip-refund')}; });
check('F files it like the charge', st.kind === 'business' && st.tax === 'ex_air' && /travel/.test(st.line) && st.of === 'f1', JSON.stringify(st));
check('and moves to the next refund, with a refund chip on the done one', st.cur === 'k2' && st.chip, JSON.stringify(st));

await p.click('[data-refund]');
await p.waitForTimeout(100);
st = await p.evaluate(() => B().tx.filter(x => x.split && x.split.of === 'k2').map(x => ({id: x.id, amt: x.amt, kind: x.kind, tax: x.tax, of: x.refundOf})));
check('the split refund is split the same way, each half like its half', st.length === 2 && st[0].kind === 'transfer' && st[1].kind === 'business' && st[1].tax === 'ex_air'
  && st[0].amt === 880.77 && st[1].amt === 880.77 && st.every(x => x.of === 'k1'), JSON.stringify(st));
check('and stays in view', await p.evaluate(() => fromReport && fromReport.ids.has('k2~2')));

await p.evaluate(() => { curId = 'a2'; resetPick(); renderList(); });
await p.keyboard.press('f');
await p.waitForTimeout(100);
const after = await p.evaluate(() => reportData().totalExpense);
check('business expenses come down by the business refunds (556.94 + 880.77 + 50.15)', Math.abs((before - after) - 1487.86) < 0.02, `${before} → ${after}`);

const grid = await p.evaluate(() => {
  const d = gridData('budget', 2025), it = d.groups.flatMap(g => g.items).find(i => i.line.label === 'Business Travel / Ads');
  return it ? it.months : null;
});
check('the sheet line nets out: July 550.47 − 556.94', grid && Math.abs(grid[6] - (550.47 - 556.94)) < 0.02, JSON.stringify(grid));

await p.evaluate(() => goBackToReport());
const gone = await p.evaluate(() => [...document.querySelectorAll('.flagbox')].some(e => /refunds? of business costs/.test(e.innerText)));
check('the report flag is gone once they are all taken off', !gone);

// Undo takes one back
await p.evaluate(() => { go('sort'); undoLast(); });
st = await p.evaluate(() => { const t = B().tx.find(x => x.id === 'a2'); return t && {kind: t.kind, of: t.refundOf}; });
check('Undo takes the last refund back', st && !st.kind && !st.of, JSON.stringify(st));

// Manual: money in on Business offers expense categories as a refund
const manual = await p.evaluate(() => {
  curId = 'z1'; resetPick(); renderList(); setKind('business');
  const t = currentTx(), pool = pickPool(t);
  const has = pool.some(o => o.g === 'REFUND OF AN EXPENSE' && o.key === 'ex_software');
  choose('ex_software');
  return {has, lineMode: lineMode(t), kinds: [...new Set(pickPool(t).map(o => TRK[o.key] && TRK[o.key].kind))]};
});
check('Business on money in also lists expense categories, as refunds', manual.has, JSON.stringify(manual));
check('and then asks for an expense line', manual.lineMode && manual.kinds.length === 1 && manual.kinds[0] === 'expense', JSON.stringify(manual));

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
