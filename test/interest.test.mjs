/**
 * Bank interest: income on his own return, not business income. Offered for
 * money in under Personal (and under Other), reported on its own line in the
 * tax view and the Summary CSV, kept out of business income, the sheets and
 * the "Left out" card.
 *
 *   node test/interest.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof leftOutStat === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const r = await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; S.taxFy = fyOf('2025-09-01').id;
  const mk = (id, date, desc, amt) => normTx({id, date, desc, amt, cur: 'AUD', acct: 'saver', mk: merchantKey(desc)}, true);
  B().tx = [mk('i1', '2025-09-01', 'Credit Interest', 0.31), mk('i2', '2025-10-01', 'Credit Interest', 0.64),
            mk('c1', '2025-09-05', 'Client', 500), mk('i3', '2025-11-01', 'Credit Interest', 1.27)];
  // i2 was filled by an old rule; i3 was answered by hand
  Object.assign(B().tx[1], {kind: 'exclude', tax: 'x_personal_in', auto: true});
  Object.assign(B().tx[3], {kind: 'transfer', tax: 'x_transfer', auto: false});
  B().rules[B().tx[0].mk] = {k: 'exclude', l: null, t: 'x_personal_in'};
  B().tx[2].kind = 'business'; B().tx[2].tax = 'inc_coach'; B().tx[2].line = TRACKS.find(l => l.label === 'Contract/Misc').key;
  renderAll(); go('sort'); curId = 'i1'; renderList();
  setKind('personal');
  const personal = pickPool(currentTx()).map(o => o.key);
  ruleOn = true; choose('x_interest');
  const t1 = B().tx.find(x => x.id === 'i1'), t2 = B().tx.find(x => x.id === 'i2');
  curId = 'c1'; resetPick(); setKind('exclude');
  const other = pickPool(currentTx()).map(o => o.key);
  B().tx[2].kind = 'business'; B().tx[2].tax = 'inc_coach'; B().tx[2].line = TRACKS.find(l => l.label === 'Contract/Misc').key;
  const d = reportData();
  go('report'); reportView = 'tax'; renderReport();
  const html = document.querySelector('#reportInner').innerText;
  const left = document.querySelector('.stat:last-child')?.innerText || '';
  return {personal: personal.slice(0, 3), other, t1: {kind: t1.kind, tax: t1.tax, line: t1.line}, t2: t2.tax, t3: B().tx.find(x => x.id === 'i3').tax, income: d.totalIncome,
    section: /Other income on the return — not business[\s\S]*Bank interest[\s\S]*0\.95/.test(html), left,
    csv: summaryCsv().split('\n').filter(l => /Bank interest/.test(l)), sheetCount: Object.keys(monthResults()).length,
    month: monthResults()['2025-09']};
});
check('Personal on money in offers Bank interest, next to Not recorded', r.personal.includes('x_interest') && r.personal.includes('x_personal_in'), JSON.stringify(r.personal));
check('choosing it files it as interest, on no sheet line', r.t1.kind === 'exclude' && r.t1.tax === 'x_interest' && !r.t1.line, JSON.stringify(r.t1));
check('the new rule updates a row the old rule filled', r.t2 === 'x_interest');
check('but not one you answered yourself', r.t3 === 'x_transfer', r.t3);
check('Other offers it too', r.other.includes('x_interest'), JSON.stringify(r.other));
check('not in business income', Math.abs(r.income - 500) < 0.01, String(r.income));
check('its own section in the tax view: 0.31 + 0.64', r.section);
check('a line in the Summary CSV', r.csv.length === 1 && /Gross interest/.test(r.csv[0]) && /0\.95/.test(r.csv[0]), JSON.stringify(r.csv));
check('not on the sheets or in the running total', Math.abs(r.month - 500) < 0.01, String(r.month));

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
