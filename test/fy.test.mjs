/**
 * Financial years.
 *
 * The case: a CommBank statement runs 11 June to 8 July 2025, so its rows
 * straddle two financial years — and the June ones belong to FY 2024-25, which
 * a hand-written list did not contain at all. They could not be filed anywhere.
 *
 * Sorting is deliberately year-agnostic: a transaction is coded once, and every
 * year's report reads from the same answers. The year only decides what the tax
 * report shows.
 *
 *   node test/fy.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof fyOf === 'function');

let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const years = await p.evaluate(() => ({
  labels: FY_LIST.map(f => f.label),
  ids: FY_LIST.map(f => f.id),
  current: CUR_FY.label,
  active: activeFY().label,
  bounds: FY_LIST.map(f => `${f.start}..${f.end}`),
}));
console.log('YEARS:');
check('a window of five, not a fixed three', years.labels.length === 5, years.labels.join(' | '));
check('ids keep the old shape so saved files still resolve',
  years.ids.every(i => /^fy\d{4}$/.test(i)) && years.ids.includes('fy2526'), years.ids.join(', '));
check('each runs 1 July to 30 June',
  years.bounds.every(s => s.endsWith('-06-30') && s.includes('-07-01..')), years.bounds[0]);
check('it opens on the year we are actually in', years.active === years.current, years.active);

console.log('\nWHERE A DATE LANDS:');
const lands = await p.evaluate(() => ({
  june: fyOf('2025-06-23')?.label, july: fyOf('2025-07-08')?.label,
  firstDay: fyOf('2025-07-01')?.label, lastDay: fyOf('2025-06-30')?.label,
  ancient: fyOf('2001-01-01'),
}));
check('23 June 2025 is FY 2024–25', lands.june === 'FY 2024–25', String(lands.june));
check('8 July 2025 is FY 2025–26', lands.july === 'FY 2025–26', String(lands.july));
check('the boundary falls the right way',
  lands.lastDay === 'FY 2024–25' && lands.firstDay === 'FY 2025–26',
  `30 Jun → ${lands.lastDay}, 1 Jul → ${lands.firstDay}`);
check('a date outside the window returns nothing rather than guessing', lands.ancient === null);

console.log('\nSORTING DOES NOT CARE WHICH YEAR IS OPEN:');
const sorted = await p.evaluate(() => {
  S.book = 'track'; S.taxFy = 'fy2627';            // deliberately the wrong year
  B().tx = [normTx({id: 'j', date: '2025-06-23', desc: 'Pepito Market', amt: -57.29, cur: 'AUD', acct: 'card', mk: 'PEPITO'})];
  renderAll(); go('sort'); curId = 'j'; setKind('personal');
  const asked = pickPool(currentTx()).length;
  choose(linesFor('personal').find(l => l.label === 'Groceries').key);
  return {asked, settled: settled(B().tx[0]), line: B().tx[0].line};
});
check('it still asks, and still takes the answer', sorted.asked > 0 && sorted.settled, `${sorted.asked} options offered`);

console.log('\nTHE NOTE, AND THE WAY OUT:');
const note = await p.evaluate(() => {
  /* it was just answered, so it has left the To sort list */
  filter = 'all'; curId = 'j'; renderList();
  const el = document.querySelector('.txcard.cur .fx');
  return {text: el ? el.innerText.replace(/\s+/g, ' ') : null,
          button: !!document.querySelector('.txcard.cur [data-fy]')};
});
check('it names the year the row belongs to', /FY 2024–25/.test(note.text || ''), note.text);
check('it does not call it a problem', !/Outside|warning/i.test(note.text || ''), note.text);
check('and offers one click to go there', note.button);

await p.click('.txcard.cur [data-fy]');
await p.waitForTimeout(250);
const after = await p.evaluate(() => ({
  active: activeFY().label,
  header: document.querySelector('#fyTop')?.value,
  note: document.querySelector('.txcard.cur .fx')?.innerText || '',
}));
check('clicking it switches the year', after.active === 'FY 2024–25', after.active);
check('the header control follows', after.header === 'fy2425', String(after.header));
check('and the note goes away', !/Counts in/.test(after.note));

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nyears behave');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
