/**
 * The running total on Sheet actuals: starts from a figure set once (the total
 * at the end of a month, from his sheets), then adds each month's result —
 * money in on income lines less money out on expense lines — both ways, never
 * reset by the year. Transfers and other rows on no line are not counted.
 *
 *   node test/running.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof runningSeries === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; S.gridYear = 2026; delete S.running;
  const L = lab => TRACKS.find(l => l.label === lab).key;
  const mk = (id, date, desc, amt, kind, tax, line) => normTx({id, date, desc, amt, cur: 'AUD', acct: 'card', mk: merchantKey(desc), kind, tax, line}, true);
  B().tx = [
    mk('a', '2026-06-20', 'Before the start', -999, 'personal', 'x_personal', L('Groceries')),
    mk('b', '2026-07-03', 'Client', 1000, 'business', 'inc_coach', L('Contract/Misc')),
    mk('c', '2026-07-09', 'Canva', -300, 'business', 'ex_software', L('Regular Subcriptions')),
    mk('d', '2026-08-02', 'Groceries', -200, 'personal', 'x_personal', L('Groceries')),
    mk('e', '2026-08-04', 'To saver', -500, 'transfer', 'x_transfer', null),
    mk('f', '2026-08-06', 'Canva refund', 50, 'business', 'ex_software', L('Regular Subcriptions')),
  ];
  renderAll(); go('report'); reportView = 'sheets'; renderReport();
});
const unset = await p.evaluate(() => ({form: !!document.querySelector('#runSet[open] #runOpen'), card: !!document.querySelector('.runcard')}));
check('with no starting point, the card asks for one', unset.card && unset.form, JSON.stringify(unset));

await p.fill('#runOpen', '7984.62');
await p.fill('#runAsOf', '2026-06');
await p.click('#runSave');
await p.waitForTimeout(100);
const st = await p.evaluate(() => {
  const r = runningSeries();
  const card = document.querySelector('.runcard').innerText.replace(/\s+/g, ' ');
  return {saved: S.running, jul: r.series['2026-07'], aug: r.series['2026-08'], last: r.last, run: r.run, card};
});
check('the starting point is saved with the data', st.saved && st.saved.open === 7984.62 && st.saved.asOf === '2026-06', JSON.stringify(st.saved));
check('July: +1000 in, −300 out = +700', Math.abs(st.jul.month - 700) < 0.01 && Math.abs(st.jul.run - 8684.62) < 0.01, JSON.stringify(st.jul));
check('August: −200, refund +50, the transfer not counted = −150', Math.abs(st.aug.month + 150) < 0.01 && Math.abs(st.aug.run - 8534.62) < 0.01, JSON.stringify(st.aug));
const pct = await p.evaluate(() => { const r = runningSeries(); return {jun: runChange(r, '2026-06'), jul: runChange(r, '2026-07'), aug: runChange(r, '2026-08'),
  row: [...document.querySelectorAll('.runcard tbody tr')].at(-1).innerText.replace(/\s+/g, ' ')}; });
check('vs start of year: none in the first month, July +8.8% and August +6.9% both against June (the first month there is)',
  pct.jun === null && Math.abs(pct.jul - 700 / 7984.62 * 100) < 0.01 && Math.abs(pct.aug - 550 / 7984.62 * 100) < 0.01 && /▲ 8\.8% ▲ 6\.9%/.test(pct.row), JSON.stringify(pct));
check('rows before the start are not counted again', Math.abs(st.run - 8534.62) < 0.01, String(st.run));
check('the card shows the total now, as a buffer, at the last month', /\+\$8,535 buffer · end of Aug 2026/.test(st.card), st.card.slice(0, 120));

// a negative total reads "to earn back", and it never resets in a new year
const neg = await p.evaluate(() => {
  S.running = {open: -100, asOf: '2026-06'};
  B().tx.push(normTx({id: 'g', date: '2027-01-05', desc: 'Rent', amt: -2000, cur: 'AUD', acct: 'card', mk: 'RENT', kind: 'personal', tax: 'x_personal', line: TRACKS.find(l => l.label === 'Accomodation').key}, true));
  renderReport();
  const r = runningSeries();
  return {jan: r.series['2027-01'], dec: r.series['2026-12'], card: document.querySelector('.runcard').innerText.replace(/\s+/g, ' ')};
});
const negPct = await p.evaluate(() => runChange(runningSeries(), '2027-01'));
check('January is against December: +450 to −1,550 reads as about −444%', Math.abs(negPct + 2000 / 450 * 100) < 0.01, String(negPct));
check('carries across the new year without resetting', Math.abs(neg.dec.run - 450) < 0.01 && Math.abs(neg.jan.run + 1550) < 0.01, JSON.stringify(neg));
check('and below zero it reads "to earn back"', /−\$1,550 to earn back · end of Jan 2027/.test(neg.card), neg.card.slice(0, 120));

// several bad months and then one good one: still measured against January, so it stays red until the year is ahead
const yr = await p.evaluate(() => {
  const rs = {series: {'2025-12': {month: 0, run: 1000}, '2026-01': {month: 100, run: 1100}, '2026-02': {month: -300, run: 800},
    '2026-03': {month: -200, run: 600}, '2026-04': {month: 300, run: 900}, '2026-05': {month: 400, run: 1300}}};
  return {jan: runChange(rs, '2026-01'), feb: runChange(rs, '2026-02'), apr: runChange(rs, '2026-04'), may: runChange(rs, '2026-05'), year: runYearChange(rs, 2026)};
});
check('January is against December (+10%)', Math.abs(yr.jan - 10) < 0.01, JSON.stringify(yr));
check('later months against January: Feb −27%, and April still −18% after its good month', Math.abs(yr.feb + 300 / 11) < 0.01 && Math.abs(yr.apr + 200 / 11) < 0.01, JSON.stringify(yr));
check('green only once the year is ahead of January: May +18%', Math.abs(yr.may - 200 / 11) < 0.01, JSON.stringify(yr));
check('the Year column: last month against the December before (+30%)', Math.abs(yr.year - 30) < 0.01, JSON.stringify(yr));

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
