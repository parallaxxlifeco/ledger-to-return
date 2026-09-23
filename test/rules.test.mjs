/**
 * Rules: opt-in, visible, and removable without collateral damage.
 *
 * The case this was built for: one Gojek answer ("food, personal") became every
 * Gojek after it — but Gojek is sometimes a ride, and sometimes business. So a
 * rule must never be made without being asked for, and removing one must be able
 * to undo what IT did without touching what the person decided themselves.
 *
 *   node test/rules.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof addParsed === 'function');

let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const seed = () => p.evaluate(() => {
  S.book = 'track'; S.lineFor = {}; B().rules = {};
  const mk = d => merchantKey(d);
  B().tx = [
    ['g1', 'Gopay-Gojek Jakarta Selat', -8.98],
    ['g2', 'Gopay-Gojek Jakarta Selat', -11.04],
    ['g3', 'Gopay-Gojek Jakarta Selat', -14.20],
    ['g4', 'Gopay-Gojek Jakarta Selat', -6.10],
    ['o1', 'Pepito Market Pererena', -57.29],
  ].map(([id, desc, amt]) => normTx({id, date: '2026-07-02', desc, amt, cur: 'AUD', acct: 'card', mk: mk(desc)}));
  renderAll(); go('sort');
});

/* --- 1. a rule is never made unless asked for --- */
await seed();
await p.evaluate(() => { curId = 'g1'; setKind('personal'); });
await p.waitForTimeout(120);
const optIn = await p.evaluate(() => ({box: document.querySelector('#ruleChk')?.checked, flag: ruleOn}));
check('the Make a rule box starts unticked', optIn.box === false && optIn.flag === false, `box=${optIn.box} flag=${optIn.flag}`);

const line = await p.evaluate(() => linesFor('personal').find(l => l.label === 'Restaurants').key);
await p.evaluate(k => choose(k), line);
await p.waitForTimeout(120);
const after = await p.evaluate(() => ({rules: Object.keys(B().rules).length, filled: B().tx.filter(t => t.auto).length, g1: !!B().tx.find(t => t.id === 'g1').line}));
check('answering one row makes no rule', after.rules === 0, `${after.rules} rules`);
check('and fills nothing else in', after.filled === 0, `${after.filled} auto-filled`);
check('the row you answered is coded', after.g1);

/* --- 2. ticking it still works, and carries --- */
await p.evaluate(k => { curId = 'g2'; setKind('personal'); ruleOn = true; renderList(); choose(k); }, line);
await p.waitForTimeout(150);
const made = await p.evaluate(() => {
  const o = B().tx.find(t => t.id === 'o1');
  return {rules: Object.keys(B().rules).length, auto: B().tx.filter(t => t.auto).length,
          otherCoded: !!(o.line || o.kind || o.auto)};
});
check('ticking it makes the rule', made.rules === 1, `${made.rules} rules`);
check('and carries to the other Gojek rows', made.auto === 2, `${made.auto} filled (g3, g4)`);
check('a different merchant is untouched', made.otherCoded === false);

/* --- 3. Backspace clears the row, not the rule --- */
await p.evaluate(() => { curId = 'g3'; unassign(); });
await p.waitForTimeout(120);
const bs = await p.evaluate(() => ({rules: Object.keys(B().rules).length, g3: B().tx.find(t => t.id === 'g3').line}));
check('clearing a row leaves the rule alone', bs.rules === 1 && !bs.g3, `${bs.rules} rules, g3 line=${bs.g3}`);

/* --- 4. Remove: stop it happening again, keep what it did --- */
await p.evaluate(() => { const mk = Object.keys(B().rules)[0]; removeRule(mk, false); });
await p.waitForTimeout(150);
const kept = await p.evaluate(() => ({rules: Object.keys(B().rules).length,
  g1: !!B().tx.find(t => t.id === 'g1').line, g4: !!B().tx.find(t => t.id === 'g4').line}));
check('Remove takes the rule away', kept.rules === 0);
check('and leaves the rows it already filled', kept.g4, 'g4 still coded');
check('and the one you answered yourself', kept.g1, 'g1 still coded');

/* --- 5. Remove & reopen: undo the rule's work, keep your own --- */
await seed();
await p.evaluate(k => { curId = 'g1'; setKind('personal'); ruleOn = false; renderList(); choose(k); }, line);
await p.waitForTimeout(120);
await p.evaluate(k => { curId = 'g2'; setKind('personal'); ruleOn = true; renderList(); choose(k); }, line);
await p.waitForTimeout(150);
const before = await p.evaluate(() => ({auto: B().tx.filter(t => t.auto).length, coded: B().tx.filter(t => t.line).length}));
await p.evaluate(() => removeRule(Object.keys(B().rules)[0], true));
await p.waitForTimeout(200);
const reopened = await p.evaluate(() => ({
  rules: Object.keys(B().rules).length,
  g1: !!B().tx.find(t => t.id === 'g1').line,     // answered by hand, before the rule
  g2: !!B().tx.find(t => t.id === 'g2').line,     // answered by hand, made the rule
  g3: !!B().tx.find(t => t.id === 'g3').line,     // filled by the rule
  g4: !!B().tx.find(t => t.id === 'g4').line,
  todo: B().tx.filter(t => !settled(t)).length,
  filter,
}));
console.log(`\n  (before: ${before.coded} coded, ${before.auto} of them by the rule)`);
check('the rule is gone', reopened.rules === 0);
check('rows the RULE filled come back to be answered', !reopened.g3 && !reopened.g4);
check('rows YOU answered are untouched', reopened.g1 && reopened.g2);
check('and the list drops you on what needs answering', reopened.filter === 'todo' && reopened.todo === 3, `${reopened.todo} to sort`);

/* --- 6. the panel reports honestly --- */
await p.evaluate(k => { curId = 'g3'; setKind('personal'); ruleOn = true; renderList(); choose(k); }, line);
await p.evaluate(() => { document.querySelector('#rulesCard').style.display = ''; renderRules(); });
await p.waitForTimeout(150);
const panel = await p.evaluate(() => ({
  rows: document.querySelectorAll('.rulerow').length,
  text: document.querySelector('.rulerow')?.innerText.replace(/\s+/g, ' ').trim(),
  chip: document.querySelector('#c-rules')?.textContent,
}));
check('one row per rule', panel.rows === 1, `${panel.rows}`);
check('the chip counts them', panel.chip === '1', panel.chip);
check('the row says what it fills and how much it has touched', /Personal/.test(panel.text) && /filled in/.test(panel.text), panel.text);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nrules behave');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
