/**
 * The report's categories open up to show their transactions, and a wrong one
 * can be changed from there — the app goes to Sort with it open, then comes
 * straight back to the report once it is answered.
 *
 *   node test/report.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof reassign === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; S.taxFy = fyOf('2025-08-10').id;
  const soft = linesFor('business').find(l => l.label === 'Regular Subcriptions').key;
  const mk = (id, desc, amt, tax) => normTx({id, date: '2025-08-0' + id.slice(1), desc, amt, cur: 'AUD', acct: 'card', mk: merchantKey(desc),
    kind: 'business', tax, line: soft}, true);
  B().tx = [mk('a1', 'Canva Pty Ltd', -20, 'ex_software'), mk('a2', 'Zoom Video', -25, 'ex_software'), mk('a3', 'Qantas Airways', -400, 'ex_software')];
  renderAll(); go('report');
});
const closed = await p.evaluate(() => ({rows: document.querySelectorAll('.catrow').length, detail: document.querySelectorAll('.catdetail').length}));
check('categories are rows you can open, closed to start', closed.rows >= 1 && closed.detail === 0, JSON.stringify(closed));

await p.click('.catrow[data-cat="ex_software"]');
await p.waitForTimeout(100);
const open = await p.evaluate(() => [...document.querySelectorAll('.catdetail tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')));
check('opening one lists its transactions', open.length === 3 && open.some(x => /Qantas/.test(x)), open.join(' | '));
check('each with its sheet line and a Change button', open.every(x => /Regular Subcriptions/.test(x) && /Change/.test(x)));

await p.evaluate(() => document.querySelector('.catdetail [data-reassign="a3"]').click());
await p.waitForTimeout(150);
const sort = await p.evaluate(() => ({pane: document.querySelector('#pane-sort').classList.contains('on'), cur: curId,
  ato: !!document.querySelector('.pickbox.for-ato')}));
check('Change opens Sort on that transaction, with the tax categories ready', sort.pane && sort.cur === 'a3' && sort.ato, JSON.stringify(sort));

await p.evaluate(() => { choose('ex_air'); choose(linesFor('business').find(l => l.label === 'Business Travel / Ads').key); });
await p.waitForTimeout(150);
const back = await p.evaluate(() => {
  const d = reportData();
  return {report: document.querySelector('#pane-report').classList.contains('on'),
    soft: d.byCat.ex_software ? d.byCat.ex_software.n : 0, air: d.byCat.ex_air ? d.byCat.ex_air.n : 0,
    stillOpen: !!document.querySelector('.catrow.open[data-cat="ex_software"]')};
});
check('answering it goes straight back to the report', back.report);
check('where it has moved category', back.soft === 2 && back.air === 1, JSON.stringify(back));
check('and the section you had open is still open', back.stillOpen);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nthe report opens up');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
