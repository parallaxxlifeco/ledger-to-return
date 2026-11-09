/**
 * Two identical rows on one statement are two transactions — two plane
 * tickets, same flight, same price, same day. The second used to be skipped as
 * "already loaded". Now: both load; loading the file again adds nothing; a file
 * with both, over data that has one, adds the missing one; and two statements
 * loaded together that overlap still count a shared row once. Invented figures.
 *
 *   node test/twins.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof mergeStatementRows === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const r = await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; B().tx = [];
  const row = (date, desc, amt) => ({date, desc, amt, cur: 'AUD', acct: 'CommBank card 0000', mk: merchantKey(desc)});
  const file = [row('2026-09-23', 'Airline Example New York', -1538.09), row('2026-09-23', 'Airline Example New York', -1538.09), row('2026-09-24', 'Cafe Example', -5)];
  const a = addRows(file.map(x => ({...x})));
  const ids = B().tx.map(t => t.id);
  const again = addRows(file.map(x => ({...x})));
  // data that only has one of the two, as the old importer left it
  B().tx = B().tx.filter((t, i) => !(t.desc.startsWith('Airline') && i === 1));
  const before = B().tx.filter(t => t.desc.startsWith('Airline')).length;
  const fill = addRows(file.map(x => ({...x})));
  const after = B().tx.filter(t => t.desc.startsWith('Airline')).length;
  const uniq = new Set(B().tx.map(t => t.id)).size === B().tx.length;
  // statements dropped in together
  const s = (date, desc, aud) => ({date, desc, aud});
  const m1 = mergeStatementRows([[s('2026-07-01', 'X', -1), s('2026-07-01', 'X', -1)], [s('2026-07-01', 'X', -1), s('2026-07-02', 'Y', -2)]]);
  const m2 = mergeStatementRows([[s('2026-07-02', 'Y', -2)], [s('2026-07-02', 'Y', -2)]]);
  return {added: a.added, twoIds: new Set(ids).size === ids.length && ids.length === 3, again: again.added, before, fill: fill.added, after, uniq,
    m1: m1.length, m2: m2.length};
});
check('both identical tickets load from one file', r.added === 3 && r.twoIds, JSON.stringify(r));
check('loading the same file again adds nothing', r.again === 0, String(r.again));
check('over data that has only one, the missing twin is added', r.before === 1 && r.fill === 1 && r.after === 2, JSON.stringify(r));
check('no two rows share an id', r.uniq);
check('statements loaded together: a row twice in one file stays twice, a shared row counts once', r.m1 === 3 && r.m2 === 1, JSON.stringify(r));
check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
