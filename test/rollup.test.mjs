/**
 * The two sheets against Daniel's own May 2026 figures.
 *
 * GIA Finance Tracking holds the detail; the Budget Tracker holds the same money
 * as roll-up lines. This reproduces May's transactions, codes them to the GIA
 * lines only, and checks BOTH grids come out as his sheets already say they do —
 * including ADMIN / ASSISTANT landing on VA Admin rather than GIA.
 *
 *   node test/rollup.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

/* line label -> the May figure his sheet already carries */
const MAY_GIA = {
  'Tickets': 1401.16, 'Speakers': 1238.49,
  'Reconnected Man': 453.83, 'Founders Breakfast': 296.93,      // income
  'VENUE': 492.62, 'EDITING': 1299.00, 'ADMIN / ASSISTANT': 108.43, 'LOGISTICS': 424.59,
};
const MAY_BUDGET_EXPECTED = {
  'GIA': {income: 2639.65, expense: 2216.21},
  'Reconnected Man': {income: 453.83},
  'Founders Breakfast': {income: 296.93, expense: 47.28},
  'VA Admin': {expense: 108.43},
};

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto(BASE + '/local.html');
await p.waitForTimeout(600);

console.log('line keys are unique:', await p.evaluate(() =>
  TRACKS.length + ' lines, ' + new Set(TRACKS.map(t => t.key)).size + ' distinct keys'));
console.log('seeded roll-ups:');
console.log(await p.evaluate(() => TRACKS.filter(t => t.rollsTo)
  .map(t => `  ${t.group} / ${t.kind} / ${t.label}  ->  ${TRK[t.rollsTo].group} / ${TRK[t.rollsTo].label}`).join('\n')));

/* Post May straight into the store, coded to GIA lines only. */
await p.evaluate(may => {
  const rows = [
    ['Tickets','income'], ['Speakers','income'],
    ['Reconnected Man','income'], ['Founders Breakfast','income'],
    ['VENUE','expense'], ['EDITING','expense'], ['ADMIN / ASSISTANT','expense'],
    ['LOGISTICS','expense'], ['Founders Breakfast','expense'],
  ];
  const amounts = Object.assign({}, may, {'Founders Breakfast|expense': 47.28});
  B().tx = rows.map(([label, kind], i) => {
    const line = TRACKS.find(t => t.sheet === 'gia' && t.label === label && t.kind === kind);
    const amt = amounts[label + '|' + kind] ?? amounts[label];
    return {
      date: '2026-05-' + String(i + 2).padStart(2, '0'),
      desc: label.toUpperCase() + ' MAY', cur: 'AUD',
      amt: kind === 'income' ? amt : -amt,
      acct: 'Test', id: 'm' + i, mk: label.toUpperCase(),
      kind: 'business', line: line.key, tax: kind === 'income' ? 'inc_event' : 'ex_other', auto: false,
    };
  });
  S.gridYear = 2026;
  markDirty();
}, MAY_GIA);
await p.waitForTimeout(800);

const grid = await p.evaluate(sheet => {
  const d = gridData(sheet, 2026);
  const out = {};
  for (const g of d.groups) for (const it of g.items) {
    const v = it.months[4];                       // May
    if (v) out[(it.line.kind === 'income' ? 'in  ' : 'out ') + it.line.label] = Math.round(v * 100) / 100;
  }
  return out;
}, 'gia');
console.log('\nGIA GRID, May:', JSON.stringify(grid, null, 1));

const bud = await p.evaluate(() => {
  const d = gridData('budget', 2026);
  const out = {};
  for (const g of d.groups) for (const it of g.items) {
    const v = it.months[4];
    if (v) out[it.line.label + '|' + it.line.kind] = Math.round(v * 100) / 100;
  }
  return out;
}, );
console.log('\nBUDGET TRACKER GRID, May (all from the roll-up):', JSON.stringify(bud, null, 1));

console.log('\nAGAINST HIS SHEET:');
let bad = 0;
for (const [label, byKind] of Object.entries(MAY_BUDGET_EXPECTED)) {
  for (const [kind, want] of Object.entries(byKind)) {
    const got = bud[label + '|' + kind];
    const ok = Math.abs((got ?? 0) - want) < 0.005;
    if (!ok) bad++;
    console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label} (${kind}): expected ${want.toFixed(2)}, got ${got == null ? 'nothing' : got.toFixed(2)}`);
  }
}
const totalExpense = Object.entries(bud).filter(([k]) => k.endsWith('|expense')).reduce((s, [, v]) => s + v, 0);
console.log(`\n  TRANSFORMATIONS expense from GIA lines: ${totalExpense.toFixed(2)}`);
console.log('  (his May total was 3371.10 including 1154.89 of Budget-Tracker-only lines:');
console.log(`   3371.10 - 1154.89 = ${(3371.10 - 1154.89).toFixed(2)})`);

/* Colour is a shortcut for the eye, not a code to learn: every block keeps one
   slot, the slots are the validated sequence, and no two blocks in the same
   list share one. */
const colour = await p.evaluate(() => {
  const lists = {
    ato: [...new Set(CATS.map(c => c.g))],
    personal: [...new Set(linesFor('personal').map(l => l.group))],
    business: [...new Set(linesFor('business').map(l => l.group))],
  };
  const out = {};
  for (const [k, groups] of Object.entries(lists)) {
    out[k] = {groups: groups.length, slots: groups.map(slotOf)};
  }
  out.stable = slotOf('LIVING') === slotOf('LIVING');
  out.unknown = slotOf('NOT A REAL BLOCK');
  return out;
});
console.log('\nBLOCK COLOURS:');
let cbad = 0;
for (const [list, {groups, slots}] of Object.entries(colour)) {
  if (!slots) continue;
  const distinct = new Set(slots).size === slots.length;
  const inRange = slots.every(s => s >= 1 && s <= 8);
  const sequential = slots.every((s, i) => s === (i % 8) + 1);
  if (!(distinct && inRange && sequential)) cbad++;
  console.log(`  ${distinct && inRange && sequential ? 'OK  ' : 'BAD '} ${list}: ${groups} blocks -> slots ${slots.join(',')}`);
}
if (colour.unknown !== 0) { cbad++; console.log('  BAD  an unknown block should fall back to neutral, got', colour.unknown); }
else console.log('  OK   an unknown block falls back to neutral');

console.log(bad + cbad ? `\n${bad + cbad} CHECK(S) WRONG` : '\nevery figure matches his sheet');

/* The combined export is the file the Google Sheet is built from: every line
   from both sheets, once each, whether or not anything landed on it. */
const csv = await p.evaluate(() => actualsCsv(2026));
const rows = csv.trim().split('\n');
const nLines = await p.evaluate(() => TRACKS.length);
const head = 'Key,Sheet,Block,Type,Line,Scope,Rolls into,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Year';
console.log('\nCOMBINED EXPORT:');
console.log(`  ${rows[0] === head ? 'OK  ' : 'BAD '} header`);
console.log(`  ${rows.length === nLines + 1 ? 'OK  ' : 'BAD '} ${rows.length - 1} rows for ${nLines} lines`);
const keys = new Set(rows.slice(1).map(r => r.split(',')[0]));
console.log(`  ${keys.size === nLines ? 'OK  ' : 'BAD '} every key distinct`);
const venue = rows.find(r => r.startsWith('gia:give-it-all:expense:venue,'));
console.log('  VENUE row:', venue);
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
