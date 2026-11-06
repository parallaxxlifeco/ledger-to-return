/**
 * "Reconnected Man" is "Reconnected Groups" (it carries the men's and the
 * women's income). A saved list with the old name is renamed on load and every
 * row, rule and roll-up follows; a history file with the old key lands on the
 * new line. And "Other" sits at the bottom of its block.
 *
 *   node test/rename.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof normaliseTrackKeys === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const r = await p.evaluate(() => {
  // a saved list from before: the old label and key
  const old = seedTracks().map(l => ({...l}));
  for (const l of old) if (/reconnected-groups/.test(l.key)) { l.label = 'Reconnected Man'; l.key = l.key.replace('reconnected-groups', 'reconnected-man'); }
  for (const l of old) if (l.rollsTo) l.rollsTo = l.rollsTo.replace('reconnected-groups', 'reconnected-man');
  TRACKS = old; indexTracks();
  S.book = 'track';
  S.books.track.tx = [normTx({id: 'x', date: '2026-05-01', desc: 'Stripe sale', amt: 99, cur: 'AUD', acct: 's', mk: 'X', kind: 'business', tax: 'x_income_reported', line: 'gia:circles:income:reconnected-man'}, true)];
  S.books.track.rules = {X: {k: 'business', l: 'gia:circles:income:reconnected-man', t: 'x_income_reported'}};
  normaliseTrackKeys(); pruneRetired();
  const gia = TRACKS.find(l => l.key === 'gia:circles:income:reconnected-groups');
  const hist = readHistory(JSON.stringify({kind: 'ledger-to-return-history', through: '2025-06', open: {asOf: '2025-04', amount: 0},
    months: {'2025-05': {in: 10, out: 0, lines: {'budget:transformations:income:reconnected-man': 10}}}}));
  const order = gridData('budget', 2026).groups.find(g => g.group === 'TRANSFORMATIONS' && g.kind === 'expense').items.map(i => i.line.label);
  const pick = linesFor('business').filter(l => l.group === 'TRANSFORMATIONS' && l.kind === 'expense').map(l => l.label);
  return {label: gia && gia.label, rollsTo: gia && gia.rollsTo, row: S.books.track.tx[0].line, rule: S.books.track.rules.X.l,
    oldLeft: TRACKS.some(l => /reconnected-man/.test(l.key)), names: TRACKS.filter(l => /reconnected/i.test(l.label)).map(l => l.label),
    hist: Object.keys(hist.months['2025-05'].lines), lastGrid: order[order.length - 1], lastPick: pick[pick.length - 1]};
});
check('the line is called Reconnected Groups', r.label === 'Reconnected Groups', JSON.stringify(r));
check('rows and rules move to it', r.row === 'gia:circles:income:reconnected-groups' && r.rule === 'gia:circles:income:reconnected-groups');
check('it still rolls into the Budget Tracker line of the same name', r.rollsTo === 'budget:transformations:income:reconnected-groups', r.rollsTo);
check('no "Reconnected Man" left, and no duplicate', !r.oldLeft && r.names.length === 2 && r.names.every(n => n === 'Reconnected Groups'), JSON.stringify(r.names));
check('a history file with the old key lands on the new line', JSON.stringify(r.hist) === JSON.stringify(['budget:transformations:income:reconnected-groups']), JSON.stringify(r.hist));
check('"Other" is last under TRANSFORMATIONS in the grid', r.lastGrid === 'Other', r.lastGrid);
check('and in the pick list', r.lastPick === 'Other', r.lastPick);

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
