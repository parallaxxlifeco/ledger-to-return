/**
 * Undo: a wrong press is taken back in one step.
 *
 * A business answer takes several presses (kind, category, line) and may fill
 * in other rows by a rule; Undo takes back the whole of it. ⌘Z / Ctrl+Z does
 * the same. The suggested line is red, its heading grey.
 *
 *   node test/undo.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof undoLast === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; S.lineFor = {};
  const mk = (id, desc, d) => normTx({id, date: '2025-08-0' + d, desc, amt: -10 * d, cur: 'AUD', acct: 'card', mk: merchantKey(desc)}, true);
  B().tx = [mk('a', 'Canva Pty Ltd', 1), mk('b', 'Canva Pty Ltd', 2), mk('c', 'Warung Sushi', 3)];
  renderAll(); go('sort'); curId = 'a'; renderList();
});
const none = await p.evaluate(() => !document.querySelector('[data-undo]'));
check('no Undo button before anything is answered', none);

const answered = await p.evaluate(() => {
  setKind('business'); ruleOn = true; choose('ex_software');
  choose(linesFor('business').find(l => l.label === 'Regular Subcriptions').key);
  return {a: settled(B().tx[0]), b: settled(B().tx[1]), rule: Object.keys(B().rules).length, btn: !!document.querySelector('[data-undo]'), cur: curId};
});
check('a three-press answer with a rule fills two rows', answered.a && answered.b && answered.rule === 1, JSON.stringify(answered));
check('and the Undo button appears', answered.btn);

await p.click('[data-undo]');
await p.waitForTimeout(100);
const undone = await p.evaluate(() => ({a: B().tx[0].kind, b: B().tx[1].kind, rule: Object.keys(B().rules).length, cur: curId, lineFor: Object.keys(S.lineFor).length}));
check('one Undo takes back the whole answer, the rule and what it filled', !undone.a && !undone.b && undone.rule === 0 && undone.lineFor === 0, JSON.stringify(undone));
check('and puts you back on that row', undone.cur === 'a');

const keys = await p.evaluate(() => { curId = 'c'; resetPick(); renderList(); setKind('transfer'); return B().tx[2].kind; });
await p.keyboard.press('Control+z');
await p.waitForTimeout(100);
const z = await p.evaluate(() => ({c: B().tx[2].kind, cur: curId}));
check('Ctrl+Z undoes a one-press transfer', keys === 'transfer' && !z.c && z.cur === 'c', JSON.stringify(z));

const empty = await p.evaluate(() => { undoLast(); return document.querySelector('#toast').textContent; });
check('nothing left to undo says so', /Nothing to undo/.test(empty), empty);

const sug = await p.evaluate(() => {
  const web = linesFor('business').find(l => l.label === 'Web/Email/Phone').key;
  B().tx.push(normTx({id: 'd', date: '2025-07-01', desc: 'Telkomsel', amt: -5, cur: 'AUD', acct: 'card', mk: 'TELKOMSEL', kind: 'business', tax: 'ex_phone', line: web}, true));
  B().tx.push(normTx({id: 'e', date: '2025-09-01', desc: 'Telkomsel', amt: -5, cur: 'AUD', acct: 'card', mk: 'TELKOMSEL'}, true));
  curId = 'e'; resetPick(); setKind('business'); choose('ex_phone');
  const head = document.querySelector('.pickhead'), opt = document.querySelector('.pickopt');
  return {head: head.innerText, headStyle: head.getAttribute('style'), optStyle: opt.getAttribute('style')};
});
check('the suggested line is red', /--sug/.test(sug.optStyle), sug.optStyle);
check('its heading stays grey', /SUGGESTED/i.test(sug.head) && !/--sug/.test(sug.headStyle), sug.headStyle);

const who = await p.evaluate(() => {
  const t = {desc: 'Paypal *Dailyhabits 35314369001'}, u = {desc: 'Merc Lounge Badung Kab'}, v = {desc: 'Transfer to xx1994 CommBank app Coaching'};
  const a = document.querySelector('.qcur a.whois, .txcard.cur a.whois');
  return {q: [whoQuery(t), whoQuery(u), whoQuery(v)], href: a && a.href, target: a && a.target};
});
check('the ? searches for the merchant, without processor prefixes or reference numbers',
  JSON.stringify(who.q) === JSON.stringify(['Dailyhabits', 'Merc Lounge Badung Kab', 'Transfer to CommBank app Coaching']), JSON.stringify(who.q));
check('in a new tab', /google\.com\/search\?q=Telkomsel/.test(who.href || '') && who.target === '_blank', `${who.href} ${who.target}`);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nundo behaves');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
