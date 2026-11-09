/**
 * One line for one-to-one clients. The Budget Tracker's TRANSFORMATIONS income
 * had a line per client; they fold into "Coaching Clients", and Jody's into GIA.
 * A saved list from before gets the new line (first in the block), and every
 * row, rule, learned link and sheet-history figure moves across; the old lines
 * drop out. ProTrader, Vault and the rest stay. Names here are the line names;
 * figures are invented.
 *
 *   node test/coaching.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof pruneRetired === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const r = await p.evaluate(() => {
  const K = n => 'budget:transformations:income:' + n;
  const OLD = ['Brian McCafferty', 'Brian Balfe', 'Gary Moore', 'Dennis', 'Christine', 'Beni Williams', 'Vault', 'Silja', 'Jody', 'ProTrader'];
  // a saved list from before: a line per client, no Coaching Clients
  const seed = seedTracks().map(l => ({...l}));
  const at = seed.findIndex(l => l.key === K('coaching-clients'));
  const before = seed.filter(l => l.key !== K('coaching-clients') && l.key !== K('vault') && l.key !== K('protrader'));
  const olds = OLD.map(label => ({sheet: 'budget', group: 'TRANSFORMATIONS', kind: 'income', label, key: lineKey('budget', 'TRANSFORMATIONS', 'income', label)}));
  before.splice(at, 0, ...olds);
  TRACKS = before; indexTracks(); S.tracks = TRACKS;
  S.addedLines = ['budget:misc-payments:expense:other'];
  S.book = 'track';
  const mk = (id, line, amt) => normTx({id, date: '2026-07-10', desc: id, amt, cur: 'AUD', acct: 'w', mk: id.toUpperCase(), kind: 'business', tax: 'inc_coach', line}, true);
  S.books.track.tx = [mk('brian', K('brian-mccafferty'), 900), mk('silja', K('silja'), 500), mk('jody', K('jody'), 70), mk('pro', K('protrader'), 460)];
  S.books.track.rules = {BRIAN: {k: 'business', l: K('brian-mccafferty'), t: 'inc_coach'}};
  S.lineFor = {inc_coach: K('brian-mccafferty')};
  S.history = {kind: 'ledger-to-return-history', through: '2025-06', open: {asOf: '2025-04', amount: 0},
    months: {'2025-05': {in: 300, out: 0, lines: {[K('brian-mccafferty')]: 100, [K('gary-moore')]: 200}}}};
  normaliseTrackKeys(); pruneRetired();
  const block = TRACKS.filter(l => l.sheet === 'budget' && l.group === 'TRANSFORMATIONS' && l.kind === 'income').map(l => l.label);
  const grid = gridData('budget', 2026).groups.find(g => g.group === 'TRANSFORMATIONS' && g.kind === 'income').items;
  const cc = grid.find(i => i.line.label === 'Coaching Clients');
  const file = readHistory(JSON.stringify({kind: 'ledger-to-return-history', through: '2025-06', open: {asOf: '2025-04', amount: 0},
    months: {'2025-05': {in: 50, out: 0, lines: {[K('dennis')]: 50}}}}));
  return {block, rows: Object.fromEntries(S.books.track.tx.map(t => [t.id, t.line])), rule: S.books.track.rules.BRIAN.l, lineFor: S.lineFor.inc_coach,
    hist: S.history.months['2025-05'].lines, jul: cc && cc.months[6], file: file.months['2025-05'].lines};
});
const K = n => 'budget:transformations:income:' + n;
check('the block: Coaching Clients first, the client names gone, the rest kept',
  JSON.stringify(r.block) === JSON.stringify(['Coaching Clients', 'ProTrader', 'Vault', 'GIA', 'Reconnected Groups', 'Founders Breakfast', 'Contract/Misc'])
  || (r.block[0] === 'Coaching Clients' && !r.block.some(x => /Brian|Gary|Dennis|Christine|Beni|Silja|Jody/.test(x)) && ['ProTrader', 'Vault', 'GIA', 'Contract/Misc'].every(x => r.block.includes(x))), JSON.stringify(r.block));
check('client rows move to Coaching Clients', r.rows.brian === K('coaching-clients') && r.rows.silja === K('coaching-clients'), JSON.stringify(r.rows));
check("Jody's row moves to GIA", r.rows.jody === K('gia'), r.rows.jody);
check('ProTrader stays its own', r.rows.pro === K('protrader'), r.rows.pro);
check('rules and learned links follow', r.rule === K('coaching-clients') && r.lineFor === K('coaching-clients'));
check('sheet history folds and adds up: 100 + 200', JSON.stringify(r.hist) === JSON.stringify({[K('coaching-clients')]: 300}), JSON.stringify(r.hist));
check('the grid shows July 900 + 500 on Coaching Clients', r.jul === 1400, String(r.jul));
check('a history file loaded later with an old name lands on Coaching Clients', JSON.stringify(r.file) === JSON.stringify({[K('coaching-clients')]: 50}), JSON.stringify(r.file));
check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
