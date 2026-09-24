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

/* It is a decision about the answer being made, so it belongs beside the
   answer — not below forty options where it cannot be seen. */
const place = await p.evaluate(() => {
  curId = 'o1'; setKind('business'); renderList();
  const card = document.querySelector('.txcard.cur');
  const box = card.querySelector('.rulebox'), pick = card.querySelector('.pickbox');
  const kinds = card.querySelector('.kindrow');
  return {
    order: [...card.children].map(c => c.className).join(' > '),
    underTheButtons: box && kinds && box.getBoundingClientRect().top > kinds.getBoundingClientRect().top,
    aboveTheList: box && pick && box.getBoundingClientRect().top < pick.getBoundingClientRect().top,
  };
});
check('the rule box sits under the four answers', place.underTheButtons, place.order);
check('and above the list, not below it', place.aboveTheList);
check('the chip counts them', panel.chip === '1', panel.chip);
check('the row says what it fills and how much it has touched', /Personal/.test(panel.text) && /filled in/.test(panel.text), panel.text);

/* --- a rule for a transfer: T finishes the row in one press, so the box has to
   be there to tick BEFORE it --- */
console.log('\nTRANSFER RULES:');
const xfer = await p.evaluate(() => {
  S.book = 'track'; B().rules = {};
  B().tx = [
    ['x1', 'Payment Received, Thank You', 673.48], ['x2', 'Payment Received, Thank You', 5252],
    ['x3', 'Payment Received, Thank You', 3000], ['y1', 'Wise Australia Pty Ltd', -500], ['y2', 'Wise Australia Pty Ltd', -800],
  ].map(([id, desc, amt]) => normTx({id, date: '2025-07-07', desc, amt, cur: 'AUD', acct: 'card', mk: merchantKey(desc)}));
  renderAll(); go('sort');
  curId = 'x1'; renderList();
  const boxBefore = !!document.querySelector('.txcard.cur .rulebox');
  ruleOn = true;                            // what pressing r does
  setKind('transfer');
  const t = id => B().tx.find(x => x.id === id);
  const carried = ['x2', 'x3'].every(id => t(id).kind === 'transfer' && t(id).auto);
  const rules = Object.keys(B().rules);
  /* without the box ticked, T is still just T */
  curId = 'y1'; resetPick(); renderList();
  setKind('transfer');
  return {boxBefore, carried, rules, noRuleWithoutTick: !B().rules[t('y1').mk], y2: t('y2').kind || null};
});
check('the rule box is there before anything is chosen', xfer.boxBefore);
check('R then T makes a transfer rule', xfer.rules.includes('RECEIVED THANK YOU'), xfer.rules.join(', '));
check('and the other two card payments become transfers too', xfer.carried);
check('T on its own still makes no rule', xfer.noRuleWithoutTick && xfer.y2 === null, `y2 left as ${xfer.y2}`);

/* --- the sheet line is always asked; a category is not a line --- */
console.log('\nSHEET LINE IS ALWAYS ASKED:');
const guess = await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; S.lineFor = {};
  const L = n => linesFor('business').find(l => l.label === n && l.kind === 'expense').key;
  const contractors = CATLIST.find(c => c.label === 'Contractors & freelancers').key;
  B().tx = [
    ['ed1', 'Upwork Editor', -80], ['iv1', 'Ivan Hristov', -500], ['iv2', 'Ivan Hristov', -500], ['ed2', 'Upwork Editor', -90],
  ].map(([id, desc, amt], i) => normTx({id, date: '2025-08-0' + (i + 1), desc, amt, cur: 'AUD', acct: 'a', mk: merchantKey(desc)}));
  renderAll(); go('sort');
  const answer = (id, line) => { curId = id; setKind('business'); choose(contractors); choose(line); };
  answer('ed1', L('EDITING'));                         // contractors -> EDITING, first time
  answer('iv1', L('Ivan - Socials'));                  // contractors -> Ivan, for Ivan
  /* second Ivan: category chosen, and it must STOP and ask, guessing Ivan */
  curId = 'iv2'; setKind('business'); choose(contractors);
  const ivanAsked = pickMode === 'line' && !currentTx().line;
  const ivanGuess = pickPool(currentTx())[0];
  /* second editor: guesses EDITING from the editor's own history, not Ivan's */
  choose(L('Ivan - Socials'));
  curId = 'ed2'; setKind('business'); choose(contractors);
  const edGuess = pickPool(currentTx())[0];
  return {ivanAsked, ivan: ivanGuess && [TRK[ivanGuess.key].label, ivanGuess.g],
          ed: edGuess && TRK[edGuess.key].label, preselected: pickSel === 0};
});
check('a category no longer files the line silently', guess.ivanAsked);
check('the guess for Ivan is Ivan - Socials, from his last invoice', guess.ivan && guess.ivan[0] === 'Ivan - Socials' && guess.ivan[1] === 'SUGGESTED', JSON.stringify(guess.ivan));
check('the guess for the editor is still EDITING — merchant beats category', guess.ed === 'EDITING', guess.ed);
check('the guess is already selected, so Enter takes it', guess.preselected);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nrules behave');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
