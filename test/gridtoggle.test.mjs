/**
 * Sheet actuals as Business and Personal: GIA's blocks with TRANSFORMATIONS
 * and PARALLAXX under Business, the personal blocks under Personal. One
 * Income / Expenses switch, shown under each title, and they move together.
 * Roll-ups are left out here so a GIA figure isn't counted twice. Remembered
 * in this browser; printing shows both halves. Figures are invented.
 *
 *   node test/gridtoggle.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 1000}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof sectionData === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };
await p.evaluate(() => {
  localStorage.removeItem('l2r.gridView'); for (const k in gridView) delete gridView[k];
  S.book = 'track'; B().rules = {}; delete S.history; const L = (sh, l) => TRACKS.find(x => x.label === l && x.sheet === sh).key;
  const mk = (id, date, amt, kind, tax, line) => normTx({id, date, desc: id, amt, cur: 'AUD', acct: 'c', mk: id.toUpperCase(), kind, tax, line}, true);
  B().tx = [mk('t', '2026-07-03', 500, 'business', 'x_income_reported', L('gia', 'Reconnected Groups')), mk('v', '2026-07-05', -200, 'business', 'ex_venue', L('gia', 'VENUE')),
    mk('c', '2026-07-03', 900, 'business', 'inc_coach', L('budget', 'Coaching Clients')), mk('g', '2026-07-09', -120, 'personal', 'x_personal', L('budget', 'Groceries'))];
  S.gridYear = 2026; hideEmpty = true; renderAll(); go('report'); reportView = 'sheets'; renderReport();
});
const heads = await p.evaluate(() => [...document.querySelectorAll('#reportInner .sechead h2')].map(h => h.textContent));
check('two sections: Business, then Personal', JSON.stringify(heads) === '["Business","Personal"]', JSON.stringify(heads));
const blocks = await p.evaluate(() => [...document.querySelectorAll('.gridsheet')].map(g => [...g.querySelectorAll('tr.grouprow')].map(r => r.dataset.sec)));
check('Business holds GIA\'s blocks with TRANSFORMATIONS and PARALLAXX', blocks[0].some(s => s.startsWith('gia|')) && blocks[0].some(s => /\|TRANSFORMATIONS$/.test(s))
  && !blocks[0].some(s => /LIVING|SELF-CARE|LIFESTYLE/.test(s)), JSON.stringify(blocks[0]));
check('Personal holds only the personal blocks', blocks[1].length && blocks[1].every(s => /LIVING|SELF-CARE|LIFESTYLE|PERSONAL|MISC/.test(s)), JSON.stringify(blocks[1]));
const inc = await p.evaluate(() => sectionData('business', 2026).groups.filter(g => g.kind === 'income').reduce((a, g) => a + g.items.reduce((x, it) => x + it.months[6], 0), 0));
check('a GIA sale isn\'t counted twice through its Budget Tracker roll-up: July income 500 + 900', inc === 1400, String(inc));

const vis = () => p.evaluate(() => [...document.querySelectorAll('.gridsheet')].map(g => [...g.querySelectorAll('.gridpart')].filter(x => x.offsetParent).map(x => x.classList.contains('income') ? 'income' : 'expense')));
check('both sections open on Income', JSON.stringify(await vis()) === '[["income"],[]]', JSON.stringify(await vis()));
check('Personal says it has no income lines', await p.evaluate(() => /No income lines under Personal/.test(document.querySelectorAll('.gridsheet')[1].innerText)));
await p.click('.gridtoggle >> nth=1 >> [data-gview="expense"]');
check('switching under one title switches both', JSON.stringify(await vis()) === '[["expense"],["expense"]]', JSON.stringify(await vis()));
check('and both toggles show it', await p.evaluate(() => [...document.querySelectorAll('[data-gview="expense"]')].every(b => b.getAttribute('aria-pressed') === 'true')));
check('remembered', await p.evaluate(() => JSON.parse(localStorage.getItem('l2r.gridView')).all === 'expense'));
await p.emulateMedia({media: 'print'});
check('printing shows both halves', JSON.stringify(await vis()) === '[["income","expense"],["expense"]]', JSON.stringify(await vis()));
check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
