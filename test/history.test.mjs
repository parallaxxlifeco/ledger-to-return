/**
 * History from his own sheets: a file of months (money in, out, each line's
 * figure) up to a month, and what was carried into the first. Loaded from the
 * Sheet actuals card, shown first, added on "Add it". From then on those
 * months come from the sheets — in the summary, the line grid and the running
 * total, which starts where the sheets did — and later months from the app.
 * Figures here are invented.
 *
 *   node test/history.test.mjs
 */
import {chromium} from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof readHistory === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const HIST = {kind: 'ledger-to-return-history', source: 'Budget Tracker (test)', through: '2025-06', open: {asOf: '2025-04', amount: -100},
  months: {
    '2025-05': {in: 1000, out: 600, lines: {'budget:transformations:income:contract-misc': 1000, 'budget:living:expense:groceries': 600}},
    '2025-06': {in: 500, out: 700, lines: {'budget:transformations:income:contract-misc': 500, 'budget:living:expense:groceries': 700}},
  }, folded: {'Transformations · Old client': 'Contract/Misc'}};
fs.writeFileSync('/tmp/hist.test.json', JSON.stringify(HIST));

await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; delete S.history; delete S.running; S.gridYear = 2025;
  const L = lab => TRACKS.find(l => l.label === lab).key;
  const mk = (id, date, desc, amt, kind, tax, line) => normTx({id, date, desc, amt, cur: 'AUD', acct: 'card', mk: merchantKey(desc), kind, tax, line}, true);
  B().tx = [
    mk('a', '2025-06-20', 'Groceries partial', -55, 'personal', 'x_personal', L('Groceries')),     // a month the sheets cover: replaced by them
    mk('b', '2025-07-03', 'Client', 300, 'business', 'inc_coach', L('Contract/Misc')),
    mk('c', '2025-07-09', 'Groceries', -120, 'personal', 'x_personal', L('Groceries')),
  ];
  renderAll(); go('report'); reportView = 'sheets'; renderReport();
});
check('the card offers to load history from the sheets', await p.evaluate(() => !!document.querySelector('#histLoad')));
await p.setInputFiles('#histFile', '/tmp/hist.test.json');
await p.waitForTimeout(200);
const prev = await p.evaluate(() => ({box: document.querySelector('.runcard .flagbox')?.innerText.replace(/\s+/g, ' ') || '', saved: !!S.history}));
check('it is shown first, not added', /May 2025 – Jun 2025, starting from −\$100 carried in/.test(prev.box) && !prev.saved, prev.box.slice(0, 160));
check('the preview runs the total: −100 +400 = +300, then −200 = +100', /May 2025 \$1,000 \$600 \+\$400 \+\$300/.test(prev.box) && /Jun 2025 \$500 \$700 −\$200 \+\$100/.test(prev.box), prev.box);
check('and says which old lines were folded into which', /Old client → Contract\/Misc/.test(prev.box));

await p.click('#histAdd');
await p.waitForTimeout(150);
const st = await p.evaluate(() => {
  const r = runningSeries(), t = monthTotals();
  const g = gridData('budget', 2025), grocer = g.groups.flatMap(x => x.items).find(i => i.line.label === 'Groceries');
  return {saved: !!S.history, jun: t['2025-06'], jul: t['2025-07'], run: r.run, last: r.last, runJun: r.series['2025-06'].run,
    grocer: grocer && grocer.months.slice(4, 7), head: document.querySelector('.runcard').innerText.replace(/\s+/g, ' ').slice(0, 160),
    remove: !!document.querySelector('#histRemove'), years: [...document.querySelectorAll('#gridYear option')].map(o => o.value)};
});
check('added on "Add it"', st.saved);
check('a month the sheets cover comes from them, not the partial rows here', st.jun.in === 500 && st.jun.out === 700, JSON.stringify(st.jun));
check('after that, the app: July +300 −120', st.jul.net === 180, JSON.stringify(st.jul));
check('the running total starts where the sheets did: +100 at June, +280 at July', Math.abs(st.runJun - 100) < 0.01 && Math.abs(st.run - 280) < 0.01 && st.last === '2025-07', JSON.stringify(st));
check('the line grid shows the sheets for their months: Groceries May 600, Jun 700, Jul 120', JSON.stringify(st.grocer) === JSON.stringify([600, 700, 120]), JSON.stringify(st.grocer));
check('the card says where the figures come from, and offers Remove', /your sheets May 2025 – Jun 2025, then this app/.test(st.head) && st.remove, st.head);

const rm = await p.evaluate(() => { window.confirm = () => true; document.querySelector('#histRemove').click(); return {saved: !!S.history, jun: monthTotals()['2025-06']}; });
check('Remove takes it out again, and the rows here show for that month', !rm.saved && rm.jun.out === 55, JSON.stringify(rm));

const badFile = await p.evaluate(() => { try { readHistory('{"kind":"something else"}'); return false; } catch (e) { return true; } });
check('a file that isn\'t a history file is refused', badFile);

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
