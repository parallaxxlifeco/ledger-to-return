/**
 * Two key shapes in one saved file.
 *
 * Reproduces the state found in Daniel's live app on 24 Sep 2026: the saved
 * tracker lines still carried the pre-direction key shape
 * (sheet:block:label), while the seed, the retired list and every transaction
 * he had coded used sheet:block:direction:label.
 *
 * The damage was quiet. TRK lookups missed, so the monthly grid dropped every
 * coded row; the retired lines were never recognised as retired, so the nine
 * software lines he asked to be rid of kept coming back; and nothing said a
 * word about any of it.
 *
 *   node test/keyshape.test.mjs
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

/* Build the broken state: old-shape lines (the full pre-prune set), new-shape
   transactions, and the ambiguous GIA pair that exists in both directions. */
const before = await p.evaluate(() => {
  S.book = 'track'; S.lineFor = {}; B().rules = {};
  TRACKS = seedTracks();
  for (const l of [
    {sheet: 'gia', group: 'GIVE IT ALL', label: 'Teachable', kind: 'expense'},
    {sheet: 'gia', group: 'GIVE IT ALL', label: 'Adobe', kind: 'expense'},
    {sheet: 'budget', group: 'TRANSFORMATIONS', label: 'Adobe', kind: 'expense'},
    {sheet: 'budget', group: 'TRANSFORMATIONS', label: 'Microsoft', kind: 'expense'},
  ]) TRACKS.push({...l, key: l.sheet + ':' + slug(l.group) + ':' + slug(l.label), scope: 'business', rollsTo: null});
  for (const l of TRACKS) l.key = l.sheet + ':' + slug(l.group) + ':' + slug(l.label);   // the old shape, everywhere
  indexTracks(); S.tracks = TRACKS;

  B().tx = [
    normTx({id: 'venue', date: '2026-07-02', desc: 'Venue', amt: -621, cur: 'AUD', acct: 'a', mk: 'VENUE',
            kind: 'business', tax: CATLIST.find(c => /Venue/.test(c.label)).key,
            line: 'gia:give-it-all:expense:venue'}),                       // new shape
    normTx({id: 'giaIn', date: '2026-07-03', desc: 'GIA income', amt: 2860, cur: 'AUD', acct: 'a', mk: 'GIAIN',
            kind: 'business', tax: CATLIST.find(c => /ticket/i.test(c.label)).key,
            line: 'budget:transformations:gia'}),                          // old + ambiguous
    normTx({id: 'giaOut', date: '2026-07-04', desc: 'GIA cost', amt: -1340, cur: 'AUD', acct: 'a', mk: 'GIAOUT',
            kind: 'business', tax: CATLIST.find(c => /Venue/.test(c.label)).key,
            line: 'budget:transformations:gia'}),                          // same key, other way
  ];
  return {
    lines: TRACKS.length,
    trkFindsVenue: !!TRK['gia:give-it-all:expense:venue'],
    softwareShowing: TRACKS.filter(l => ['Teachable', 'Adobe', 'Microsoft'].includes(l.label)).length,
    gridRows: (() => { let n = 0; for (const g of gridData('gia', 2026).groups) for (const it of g.items) if (it.months.some(v => v)) n++; return n; })(),
  };
});
console.log('BEFORE — the state as found:');
check('the saved list carries the retired lines', before.softwareShowing > 0, `${before.softwareShowing} software lines`);
check('a coded transaction points at a line TRK cannot find', !before.trkFindsVenue);
check('so the monthly grid shows nothing', before.gridRows === 0, `${before.gridRows} rows with figures`);

const moved = await p.evaluate(() => ({moved: normaliseTrackKeys(), pruned: pruneRetired()}));
console.log(`\nAFTER — normalise then prune (${moved.moved} keys moved, ${moved.pruned} lines dropped):`);

const after = await p.evaluate(() => ({
  lines: TRACKS.length,
  allNewShape: TRACKS.every(l => /^[a-z]+:[a-z0-9-]+:(income|expense):[a-z0-9-]+$/.test(l.key)),
  software: TRACKS.filter(l => ['Teachable', 'Microsoft', 'Zoom/Video'].includes(l.label)).map(l => l.sheet + '/' + l.label),
  facebook: TRACKS.filter(l => l.label === 'Facebook').map(l => l.sheet),
  venueResolves: !!TRK['gia:give-it-all:expense:venue'],
  giaIn: B().tx.find(t => t.id === 'giaIn').line,
  giaOut: B().tx.find(t => t.id === 'giaOut').line,
  venueTx: B().tx.find(t => t.id === 'venue').line,
  gridRows: (() => { let n = 0; for (const g of gridData('gia', 2026).groups) for (const it of g.items) if (it.months.some(v => v)) n++; return n; })(),
}));
check('every key is the current shape', after.allNewShape, after.lines + ' lines');
check('the software lines are gone', after.software.length === 0, after.software.join(', '));
check('Facebook survives, on the Budget Tracker only', JSON.stringify(after.facebook) === '["budget"]', after.facebook.join(', '));
check('a coded line now resolves', after.venueResolves && after.venueTx === 'gia:give-it-all:expense:venue', after.venueTx);
check('the ambiguous key splits by sign — income to the income line',
  after.giaIn === 'budget:transformations:income:gia', after.giaIn);
check('and the expense to the expense line',
  after.giaOut === 'budget:transformations:expense:gia', after.giaOut);
check('the monthly grid has its figures back', after.gridRows > 0, `${after.gridRows} rows with figures`);

/* Running it again must be a no-op, since it runs on every load. */
const again = await p.evaluate(() => ({moved: normaliseTrackKeys(), pruned: pruneRetired(), lines: TRACKS.length}));
check('running it a second time changes nothing',
  again.moved === 0 && again.pruned === 0 && again.lines === after.lines,
  `moved ${again.moved}, pruned ${again.pruned}`);

/* And a retired line that IS in use must survive. */
const inUse = await p.evaluate(() => {
  const key = 'budget:transformations:expense:adobe';
  TRACKS.push({key, sheet: 'budget', group: 'TRANSFORMATIONS', label: 'Adobe', kind: 'expense', scope: 'business', rollsTo: null});
  indexTracks();
  B().tx.push(normTx({id: 'ad', date: '2026-07-05', desc: 'Adobe', amt: -27.8, cur: 'AUD', acct: 'a', mk: 'ADOBE',
    kind: 'business', tax: CATLIST.find(c => /Software/.test(c.label)).key, line: key}));
  pruneRetired();
  return TRACKS.some(l => l.key === key);
});
check('a retired line with a transaction on it is kept', inUse);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\none key shape, and the retired lines stay gone');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
