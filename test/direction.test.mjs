/**
 * Money out can't be ticket sales.
 *
 * Every pick list is filtered to the direction the money actually went, and a
 * rule only speaks for rows going the same way. The gap this was written for:
 * the ATO category list was already filtered, but the SHEET LINE list that
 * follows it was not — so choosing an expense category then offered "Tickets".
 *
 *   node test/direction.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof pickPool === 'function');

let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const load = () => p.evaluate(() => {
  S.book = 'track'; S.lineFor = {}; B().rules = {};
  B().tx = [
    normTx({id: 'out', date: '2026-07-02', desc: 'Venue hire', amt: -621, cur: 'AUD', acct: 'a', mk: 'VENUE HIRE'}),
    normTx({id: 'in', date: '2026-07-03', desc: 'Ticket money', amt: 2860, cur: 'AUD', acct: 'a', mk: 'TICKET MONEY'}),
  ];
  renderAll(); go('sort');
});
await load();

/* --- the ATO category list --- */
const cats = await p.evaluate(() => {
  const r = {};
  for (const id of ['out', 'in']) {
    curId = id; setKind('business');
    r[id] = pickPool(currentTx()).map(o => o.label);
  }
  return r;
});
check('an expense offers no income categories',
  !cats.out.some(l => /ticket|sales|income|fees received/i.test(l)) && cats.out.length > 0,
  `${cats.out.length} options`);
check('income offers ticket sales', cats.in.some(l => /ticket/i.test(l)), cats.in.filter(l => /ticket/i.test(l)).join(', '));
check('the two lists do not overlap',
  !cats.out.some(l => cats.in.includes(l)), `${cats.out.length} out / ${cats.in.length} in`);

/* --- the sheet line list that follows it: the actual gap --- */
const lines = await p.evaluate(() => {
  const out = {};
  for (const [id, cat] of [['out', 'Venue hire & event production'], ['in', 'Event & ticket sales']]) {
    curId = id; setKind('business');
    const c = CATLIST.find(x => x.label === cat);
    choose(c.key);                                  // steps on to the line question
    out[id] = {mode: pickMode, labels: pickPool(currentTx()).map(o => o.label)};
  }
  return out;
});
check('picking an expense category asks for a line', lines.out.mode === 'line');
check('and offers no income lines',
  !lines.out.labels.some(l => ['Tickets', 'Speakers', 'Partners', 'Reconnected Man'].includes(l)),
  `${lines.out.labels.length} lines, e.g. ${lines.out.labels.slice(0, 3).join(', ')}`);
check('income offers Tickets', lines.in.labels.includes('Tickets'),
  `${lines.in.labels.length} lines`);
check('and offers no expense lines', !lines.in.labels.includes('VENUE'), lines.in.labels.slice(0, 4).join(', '));

/* --- a learned pairing can't jump direction --- */
const learned = await p.evaluate(() => {
  const inc = CATLIST.find(x => x.label === 'Event & ticket sales');
  S.lineFor[inc.key] = TRACKS.find(l => l.label === 'VENUE').key;   // deliberately wrong
  curId = 'in'; setKind('business'); choose(inc.key);
  return {line: currentTx().line, mode: pickMode};
});
check('a learned line pointing the wrong way is ignored',
  !learned.line && learned.mode === 'line', `line=${learned.line}`);

/* --- a rule does not reach across direction --- */
await load();
const rule = await p.evaluate(() => {
  B().tx.push(normTx({id: 'refund', date: '2026-07-05', desc: 'Venue hire', amt: 300, cur: 'AUD', acct: 'a', mk: 'VENUE HIRE'}));
  const c = CATLIST.find(x => x.label === 'Venue hire & event production');
  const l = TRACKS.find(x => x.label === 'VENUE').key;
  renderAll(); curId = 'out'; setKind('business'); ruleOn = true; renderList();
  choose(c.key);
  if (pickMode === 'line') choose(l);
  const r = B().tx.find(t => t.id === 'refund');
  return {saved: Object.keys(B().rules).length, refundCoded: !!(r.tax || r.line), refundAuto: !!r.auto};
});
check('the rule is saved', rule.saved === 1);
check('the refund going the other way is left unsorted', !rule.refundCoded && !rule.refundAuto);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\ndirection is respected everywhere');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
