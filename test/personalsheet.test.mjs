/**
 * Personal spending from his sheet. Much of his personal spending is squared
 * up with Luiza rather than paid from a bank account, so it never shows as a
 * transaction. For the months the history file's `personal` covers, the
 * personal blocks come from his Budget Tracker and rows here on personal lines
 * don't count towards them; business lines are always the transactions.
 * The card offers "Update from your sheets…" to load a newer file over the old.
 * Figures here are invented.
 *
 *   node test/personalsheet.test.mjs
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

const base = {kind: 'ledger-to-return-history', source: 'Budget Tracker (test)', through: '2025-06', open: {asOf: '2025-05', amount: 0},
  months: {'2025-06': {in: 500, out: 100, lines: {'budget:transformations:income:contract-misc': 500, 'budget:living:expense:groceries': 100}}}};
fs.writeFileSync('/tmp/ps1.json', JSON.stringify(base));
const withPersonal = {...base, personal: {
  '2025-06': {out: 999, lines: {'budget:living:expense:groceries': 999}},     // already covered by months: ignored
  '2025-07': {out: 800, lines: {'budget:living:expense:accomodation': 500, 'budget:living:expense:groceries': 300}},
}};
fs.writeFileSync('/tmp/ps2.json', JSON.stringify(withPersonal));

await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; delete S.history; delete S.running; S.gridYear = 2025;
  const L = lab => TRACKS.find(l => l.label === lab).key;
  const mk = (id, date, desc, amt, kind, tax, line) => normTx({id, date, desc, amt, cur: 'AUD', acct: 'card', mk: merchantKey(desc), kind, tax, line}, true);
  B().tx = [
    mk('b', '2025-07-03', 'Client', 1000, 'business', 'inc_coach', L('Contract/Misc')),
    mk('s', '2025-07-05', 'Canva', -40, 'business', 'ex_software', L('Regular Subcriptions')),
    mk('c', '2025-07-09', 'Groceries', -120, 'personal', 'x_personal', L('Groceries')),     // replaced by the sheet
    mk('d', '2025-08-09', 'Groceries', -70, 'personal', 'x_personal', L('Groceries')),      // no sheet figure: counts
  ];
  renderAll(); go('report'); reportView = 'sheets'; renderReport();
});
await p.setInputFiles('#histFile', '/tmp/ps1.json');
await p.waitForTimeout(150);
await p.click('#histAdd');
await p.waitForTimeout(150);
const before = await p.evaluate(() => monthTotals()['2025-07']);
check('without personal figures, July is the rows here: +1000 −40 −120', Math.abs(before.net - 840) < 0.01, JSON.stringify(before));
check('with history loaded, the card offers an update', await p.evaluate(() => !!document.querySelector('#histLoad') && /Update from your sheets/.test(document.querySelector('#histLoad').innerText)));

await p.setInputFiles('#histFile', '/tmp/ps2.json');
await p.waitForTimeout(150);
const prev = await p.evaluate(() => document.querySelector('.runcard .flagbox')?.innerText.replace(/\s+/g, ' ') || '');
check('the preview says personal spending comes from the sheet, month by month', /Personal spending, Jul 2025 – Jul 2025: taken from your sheet \(Jul \$800\)/.test(prev), prev.slice(-260));
await p.click('#histAdd');
await p.waitForTimeout(150);
const st = await p.evaluate(() => {
  const t = monthTotals(), g = gridData('budget', 2025), it = lab => g.groups.flatMap(x => x.items).find(i => i.line.label === lab).months;
  return {jun: t['2025-06'], jul: t['2025-07'], aug: t['2025-08'], acc: it('Accomodation').slice(5, 8), gro: it('Groceries').slice(5, 8),
    subs: it('Regular Subcriptions').slice(5, 8), run: runningSeries().run,
    head: document.querySelector('.runcard').innerText.replace(/\s+/g, ' ').slice(0, 260)};
});
check('the update replaced the old file', await p.evaluate(() => !!(S.history && S.history.personal)));
check('July: business from the rows (+1000 −40), personal from the sheet (−800)', Math.abs(st.jul.in - 1000) < 0.01 && Math.abs(st.jul.out - 840) < 0.01 && Math.abs(st.jul.net - 160) < 0.01, JSON.stringify(st.jul));
check('a month the full sheet history covers isn\'t touched by personal', st.jun.out === 100, JSON.stringify(st.jun));
check('a month with no sheet figure still counts the rows here', Math.abs(st.aug.out - 70) < 0.01, JSON.stringify(st.aug));
check('the grid: Accomodation 500 in July from the sheet', JSON.stringify(st.acc) === JSON.stringify([0, 500, 0]), JSON.stringify(st.acc));
check('the grid: Groceries Jun 100 (sheets), Jul 300 (sheet, not the 120 here), Aug 70 (rows)', JSON.stringify(st.gro) === JSON.stringify([100, 300, 70]), JSON.stringify(st.gro));
check('business lines stay the rows: subscriptions 40 in July', JSON.stringify(st.subs) === JSON.stringify([0, 40, 0]), JSON.stringify(st.subs));
check('running total: 0 +400 (Jun) +160 (Jul) −70 (Aug) = 490', Math.abs(st.run - 490) < 0.01, String(st.run));
check('the card says personal spending is from the sheet', /personal spending from your sheet Jul 2025 – Jul 2025/.test(st.head), st.head);

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
