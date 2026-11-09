/**
 * Sheet actuals: an Income / Expenses toggle under each sheet's title, so one
 * half shows at a time. Remembered per sheet in this browser; printing shows
 * both. Figures are invented.
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
await p.waitForFunction(() => typeof gridTable === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };
await p.evaluate(() => {
  localStorage.removeItem('l2r.gridView'); for (const k in gridView) delete gridView[k];
  S.book = 'track'; B().rules = {}; const L = (sh, l) => TRACKS.find(x => x.label === l && x.sheet === sh).key;
  const mk = (id, date, amt, kind, tax, line) => normTx({id, date, desc: id, amt, cur: 'AUD', acct: 'c', mk: id.toUpperCase(), kind, tax, line}, true);
  B().tx = [mk('t', '2026-07-03', 500, 'business', 'x_income_reported', L('gia', 'Tickets')), mk('v', '2026-07-05', -200, 'business', 'ex_venue', L('gia', 'VENUE')),
    mk('c', '2026-07-03', 900, 'business', 'inc_coach', L('budget', 'Coaching Clients')), mk('g', '2026-07-09', -120, 'personal', 'x_personal', L('budget', 'Groceries'))];
  S.gridYear = 2026; hideEmpty = true; renderAll(); go('report'); reportView = 'sheets'; renderReport();
});
const vis = () => p.evaluate(() => [...document.querySelectorAll('.gridsheet')].map(g => [...g.querySelectorAll('.gridpart')].filter(x => x.offsetParent).map(x => x.classList.contains('income') ? 'income' : 'expense')));
check('each sheet opens on Income only', JSON.stringify(await vis()) === '[["income"],["income"]]', JSON.stringify(await vis()));
check('a toggle under each title', await p.evaluate(() => document.querySelectorAll('.gridtoggle').length === 2));
await p.click('[data-gview="budget|expense"]');
check('Expenses on the Budget Tracker shows its expenses, GIA stays on income', JSON.stringify(await vis()) === '[["income"],["expense"]]', JSON.stringify(await vis()));
check('remembered', await p.evaluate(() => JSON.parse(localStorage.getItem('l2r.gridView')).budget === 'expense'));
await p.emulateMedia({media: 'print'});
check('printing shows both halves', JSON.stringify(await vis()) === '[["income","expense"],["income","expense"]]', JSON.stringify(await vis()));
check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
