/**
 * Business lines or personal lines, for a business expense.
 *
 * Sometimes an expense is a deduction on the return but tracked on his
 * personal Budget Tracker lines. The second question on a business row can be
 * switched to the personal list, and the answer is remembered per merchant.
 *
 *   node test/scope.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof addParsed === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; S.lineFor = {};
  B().tx = [
    normTx({id: 'a', date: '2025-08-01', desc: 'Telkomsel Bali', amt: -30, cur: 'AUD', acct: 'card', mk: 'TELKOMSEL BALI'}, true),
    normTx({id: 'b', date: '2025-09-01', desc: 'Telkomsel Bali', amt: -30, cur: 'AUD', acct: 'card', mk: 'TELKOMSEL BALI'}, true),
    normTx({id: 'c', date: '2025-09-02', desc: 'Money in', amt: 30, cur: 'AUD', acct: 'card', mk: 'MONEY IN'}, true),
  ];
  renderAll(); go('sort'); curId = 'a'; setKind('business'); choose('ex_phone');
});
const first = await p.evaluate(() => ({
  sw: !!document.querySelector('.scopesw'),
  on: document.querySelector('.scopesw .on')?.dataset.scope,
  allBiz: pickPool(currentTx()).every(o => TRK[o.key]?.scope === 'business'),
}));
check('the second question offers the switch', first.sw);
check('business lines by default', first.on === 'business' && first.allBiz);

await p.click('.scopesw [data-scope="personal"]');
await p.waitForTimeout(100);
const pers = await p.evaluate(() => ({
  on: document.querySelector('.scopesw .on')?.dataset.scope,
  allPers: pickPool(currentTx()).every(o => TRK[o.key]?.scope === 'personal'),
  box: document.querySelector('.pickbox')?.className,
}));
check('one click shows the personal lines instead', pers.on === 'personal' && pers.allPers, JSON.stringify(pers));
check('still the green sheets box', /for-sheet/.test(pers.box || ''));

const done = await p.evaluate(() => {
  const k = linesFor('personal').find(l => l.label === 'Groceries').key;
  choose(k);
  const t = B().tx.find(x => x.id === 'a');
  return {kind: t.kind, tax: t.tax, line: TRK[t.line]?.label, settled: settled(t), learned: S.lineFor.ex_phone || null};
});
check('the row stays a business deduction, on a personal line', done.kind === 'business' && done.tax === 'ex_phone' && done.line === 'Groceries' && done.settled, JSON.stringify(done));
check('and does not become the default line for that category', done.learned === null);

const next = await p.evaluate(() => {
  curId = 'b'; resetPick(); setKind('business'); choose('ex_phone');
  return {on: document.querySelector('.scopesw .on')?.dataset.scope,
          guess: pickPool(currentTx())[0]?.g, first: TRK[pickPool(currentTx())[0]?.key]?.label};
});
check('the next one from that merchant opens on personal lines, with the same line suggested',
  next.on === 'personal' && next.guess === 'SUGGESTED' && next.first === 'Groceries', JSON.stringify(next));

const inc = await p.evaluate(() => { curId = 'c'; resetPick(); setKind('business'); choose('inc_other'); return !!document.querySelector('.scopesw'); });
check('no switch for money in — the personal blocks are spending lines', !inc);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nthe switch behaves');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
