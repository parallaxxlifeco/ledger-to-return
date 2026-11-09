/**
 * Answering several rows at once. Tick rows (or ⌘-click, shift-click for a
 * run) and the answer given to the highlighted row goes to every ticked one:
 * ten restaurant charges, one answer. One Undo takes them all back. Figures
 * and names are invented.
 *
 *   node test/multi.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof fanOut === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await p.evaluate(() => {
  S.book = 'track'; B().rules = {};
  const mk = (id, date, desc, amt) => normTx({id, date, desc, amt, cur: 'AUD', acct: 'card', mk: merchantKey(desc)}, true);
  B().tx = [mk('a', '2026-07-01', 'Warung Example One', -12), mk('b', '2026-07-02', 'Cafe Example Two', -8),
    mk('c', '2026-07-03', 'Bistro Example Three', -20), mk('d', '2026-07-04', 'Grocer Example', -50), mk('e', '2026-07-05', 'Bar Example Four', -15)];
  filter = 'todo'; curId = 'a'; renderAll(); go('sort');
});
// tick b, shift-click range to e from a would take all — do: tick c, ⌘-click e
await p.click('.txcard[data-id="c"] .tick');
await p.click('.txcard[data-id="e"] .line1 .desc', {modifiers: ['Meta']});
const bar = await p.evaluate(() => ({picked: [...picked], bar: (document.querySelector('.multibar') || {}).innerText || ''}));
check('ticking and ⌘-clicking pick rows', JSON.stringify(bar.picked.sort()) === '["c","e"]', JSON.stringify(bar.picked));
check('the answer card says 3 rows get the answer, with their total', /3 rows/.test(bar.bar) && /47/.test(bar.bar), bar.bar);
check('Split is not offered while rows are ticked', await p.evaluate(() => !document.querySelector('[data-split-open]')));

await p.keyboard.press('p');
await p.waitForTimeout(100);
await p.evaluate(() => choose(TRACKS.find(l => l.label === 'Restaurants').key));
const st = await p.evaluate(() => Object.fromEntries(B().tx.map(t => [t.id, [t.kind, t.line && TRK[t.line].label]])));
check('the highlighted row and both ticked rows are Personal · Restaurants', ['a', 'c', 'e'].every(i => st[i][0] === 'personal' && st[i][1] === 'Restaurants'), JSON.stringify(st));
check('rows that were not ticked are left alone', st.b[0] == null && st.d[0] == null, JSON.stringify(st));
check('the ticks are cleared afterwards', await p.evaluate(() => picked.size === 0));

await p.evaluate(() => undoLast());
const un = await p.evaluate(() => B().tx.filter(t => t.kind).length);
check('one Undo takes back all three', un === 0, String(un));

// shift-click for a run, Esc clears
await p.evaluate(() => { curId = 'a'; renderList(); });
await p.click('.txcard[data-id="d"] .line1 .desc', {modifiers: ['Shift']});
const run = await p.evaluate(() => [...picked].sort());
check('shift-click ticks the run from the highlighted row', JSON.stringify(run) === '["b","c","d"]', JSON.stringify(run));
await p.keyboard.press('Escape');
check('Esc clears the ticks', await p.evaluate(() => picked.size === 0));

// a plain click moves on and clears
await p.click('.txcard[data-id="c"] .tick');
await p.click('.txcard[data-id="d"] .line1 .desc');
check('a plain click on another row clears the ticks', await p.evaluate(() => picked.size === 0 && curId === 'd'));

// Tick all unsorted here, then Transfer
await p.evaluate(() => { curId = 'a'; picked.add('b'); renderList(); });
await p.click('[data-pick-all]');
await p.keyboard.press('t');
const tr = await p.evaluate(() => B().tx.filter(t => t.kind === 'transfer').length);
check('"Tick all" then T files every unsorted row as a transfer', tr === 5, String(tr));
await p.screenshot({path: '/tmp/multi.png'});
check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
