/**
 * Staying current. A change made in another tab shows here straight away; ↻
 * (and coming back to the tab) loads what another device saved to Drive; and
 * each page is drawn fresh when opened.
 *
 *   node test/refresh.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const ctx = await b.newContext({viewport: {width: 1440, height: 900}});
const A = await ctx.newPage(), Bp = await ctx.newPage();
const errs = [];
for (const p of [A, Bp]) p.on('pageerror', e => errs.push(e.message));
await A.goto(`${BASE}/local.html`);
await A.waitForFunction(() => typeof refreshFromStore === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await A.evaluate(async () => {
  S.book = 'track'; B().rules = {};
  B().tx = [normTx({id: 'r1', date: '2026-06-02', desc: 'Groceries', amt: -40, cur: 'AUD', acct: 'card', mk: 'GROCERIES'}, true)];
  renderAll(); await persist();
});
await Bp.goto(`${BASE}/local.html`);
await Bp.waitForFunction(() => typeof refreshFromStore === 'function');
await Bp.evaluate(() => { go('sort'); });
const before = await Bp.evaluate(() => ({n: B().tx.length, kind: B().tx[0].kind, todo: document.querySelector('#filterChips')?.innerText}));
check('the second tab opens with the same data', before.n === 1 && !before.kind, JSON.stringify(before));

// A sorts the row; B should pick it up without a reload
await A.evaluate(async () => { const t = B().tx[0]; t.kind = 'personal'; t.tax = 'x_personal'; t.line = TRACKS.find(l => l.label === 'Groceries').key; await persist(); });
await Bp.waitForTimeout(300);
const after = await Bp.evaluate(() => ({kind: B().tx[0].kind, line: B().tx[0].line, todoChip: [...document.querySelectorAll('#filterChips .chip')].map(c => c.innerText.replace(/\s+/g, ' '))[0]}));
check('a change in the other tab arrives without a reload', after.kind === 'personal' && /Groceries|groceries/.test(after.line || ''), JSON.stringify(after));
check('and the page is redrawn with it', /To sort 0/.test(after.todoChip || ''), after.todoChip);

// ↻ exists and works in local mode
const btn = await Bp.evaluate(async () => { const b = document.querySelector('#btnRefresh'); if (!b) return null; b.click(); await new Promise(r => setTimeout(r, 200)); return true; });
check('there is a ↻ button in the top bar', btn === true);

// Drive: another device saved; ↻ loads it
const drive = await Bp.evaluate(async () => {
  const remote = JSON.parse(JSON.stringify(S)); remote.books.track.tx.push(normTx({id: 'r2', date: '2026-06-05', desc: 'Cafe', amt: -9, cur: 'AUD', acct: 'card', mk: 'CAFE'}, true));
  remote.savedAt = 'X2';
  localStorage.setItem('l2r.sync', JSON.stringify({at: 'X1', pending: false}));
  window.findDriveFile = async () => ({id: 'f', modifiedTime: 'M2'});
  lastRemoteAt = 'M1';
  Store = {mode: 'drive', connected: true, async load() { return remote; }, async save() { return 'X3'; }, async snapshot() {}};
  await refreshFromStore(true);
  const n1 = B().tx.length;
  // nothing new on Drive this time: no change
  lastRemoteAt = 'M2';
  await refreshFromStore(true);
  return {n1, n2: B().tx.length};
});
check('↻ loads what another device saved to Drive', drive.n1 === 2, JSON.stringify(drive));
check('and does nothing when Drive has nothing new', drive.n2 === 2);

// pages drawn fresh when opened
const fresh = await Bp.evaluate(() => { const chip = () => [...document.querySelectorAll('#filterChips .chip')][0].innerText.replace(/\s+/g, ' ');
  const was = chip(); B().tx[0].line = null; B().tx[0].kind = null; go('sort'); return {was, now: chip()}; });
check('opening Sort redraws it (the Cafe row from Drive, plus the one just cleared)', /To sort 1/.test(fresh.was) && /To sort 2/.test(fresh.now), JSON.stringify(fresh));

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
