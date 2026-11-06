/**
 * Sheet actuals grid: each block its own pastel colour, lines alternating
 * light and lighter, and every block opens and closes from its header (the
 * Total stays). Remembered in this browser. "Close / open all" does them all.
 *
 *   node test/gridblocks.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof wireGridBlocks === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await p.evaluate(() => {
  localStorage.removeItem('l2r.gridClosed'); gridClosed.clear();
  S.book = 'track'; B().rules = {}; delete S.history; S.gridYear = 2025;
  const L = lab => TRACKS.find(l => l.label === lab).key;
  const mk = (id, date, desc, amt, kind, tax, line) => normTx({id, date, desc, amt, cur: 'AUD', acct: 'card', mk: merchantKey(desc), kind, tax, line}, true);
  B().tx = [mk('a', '2025-07-01', 'Tickets', 100, 'business', 'inc_event', L('Tickets')), mk('b', '2025-07-02', 'Speakers', 50, 'business', 'inc_speak', L('Speakers')),
            mk('c', '2025-07-03', 'Venue', -40, 'business', 'ex_venue', L('VENUE'))];
  renderAll(); go('report'); reportView = 'sheets'; renderReport();
});
const look = await p.evaluate(() => {
  const heads = [...document.querySelectorAll('tr.grouprow.sec')];
  const bg = el => getComputedStyle(el.querySelector('td')).backgroundColor;
  const giRows = [...document.querySelectorAll('tr.sec[data-of^="gia|income|GIVE IT ALL"]')];
  const per = sh => heads.filter(h => h.dataset.sec.startsWith(sh + '|'));
  const distinct = sh => new Set(per(sh).map(h => h.style.getPropertyValue('--g'))).size === per(sh).length;
  return {n: heads.length, colours: distinct('gia') && distinct('budget') ? heads.length : -1,
    alt: giRows.length >= 2 && bg(giRows[0]) !== bg(giRows[1]), tinted: bg(giRows[0]) !== 'rgb(255, 255, 255)'};
});
check('every block has a header', look.n >= 2, JSON.stringify(look));
check('each block in a sheet its own colour', look.colours === look.n, JSON.stringify(look));
check('lines alternate light and lighter, in the block\'s colour', look.alt && look.tinted, JSON.stringify(look));

await p.click('tr.grouprow[data-sec="gia|income|GIVE IT ALL"]');
const closed = await p.evaluate(() => ({lines: [...document.querySelectorAll('tr[data-of="gia|income|GIVE IT ALL"]')].every(r => getComputedStyle(r).display === 'none'),
  total: getComputedStyle(document.querySelector('tr.grouprow[data-sec="gia|income|GIVE IT ALL"]').nextElementSibling.nextElementSibling.nextElementSibling).display !== 'none',
  saved: JSON.parse(localStorage.getItem('l2r.gridClosed'))}));
check('clicking the header closes the block — lines hidden', closed.lines, JSON.stringify(closed));
check('remembered in this browser', closed.saved.includes('gia|income|GIVE IT ALL'));
await p.evaluate(() => renderReport());
check('still closed after a redraw', await p.evaluate(() => document.querySelector('tr.grouprow[data-sec="gia|income|GIVE IT ALL"]').classList.contains('closed')));
await p.click('tr.grouprow[data-sec="gia|income|GIVE IT ALL"]');
check('click again to open', await p.evaluate(() => [...document.querySelectorAll('tr[data-of="gia|income|GIVE IT ALL"]')].every(r => getComputedStyle(r).display !== 'none')));

await p.click('#gridAll');
const allClosed = await p.evaluate(() => [...document.querySelectorAll('tr.grouprow.sec')].every(r => r.classList.contains('closed')));
await p.click('#gridAll');
const allOpen = await p.evaluate(() => [...document.querySelectorAll('tr.grouprow.sec')].every(r => !r.classList.contains('closed')));
check('"Close / open all" closes every block, then opens them', allClosed && allOpen);

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
