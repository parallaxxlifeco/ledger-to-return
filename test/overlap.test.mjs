/**
 * The same transaction from two statements is loaded once. A card's PDF and
 * NetBank's export describe one purchase differently, so the match is on what
 * doesn't change: date, currency, amount to the cent, first word of the
 * merchant — counted, so two identical coffees match two. On import the copies
 * are skipped; ones already loaded are listed under What's loaded, removed in
 * one press from the account you don't keep, handing over any answer.
 *
 *   node test/overlap.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof importPlan === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const imp = (text, acct) => p.evaluate(([text, acct]) => {
  document.querySelector('#impText').value = text; document.querySelector('#impAcct').value = acct;
  doParse(); const note = document.querySelector('#dupNote').innerText; addParsed(); return {n: B().tx.length, note};
}, [text, acct]);

await p.evaluate(() => { S.book = 'track'; B().tx = []; B().rules = {}; });
// the PDF statement, to 9 June: two identical coffees on the 6th
const pdf = 'Date,Description,Amount\n02/06/2026,Merc Lounge Badung Kab,-47.28\n04/06/2026,Adobe Saggart,-21.94\n06/06/2026,Beige Coffee Pererenan Badun,-6.61\n06/06/2026,Beige Coffee Pererenan Badun,-6.61\n09/06/2026,Lush Kitchen Badung,-8.29';
const a = await imp(pdf, 'CommBank card 4345');
check('first statement goes in', a.n >= 4, String(a.n));
const base = a.n;
// NetBank's export for all of June, written differently, plus new rows
const csv = 'Date,Description,Amount\n02/06/2026,MERC LOUNGE BADUNG KAB. IDN ##0626 717600.00,-47.28\n04/06/2026,Adobe SAGGART IRL ##0626 717.60 TU,-21.94\n06/06/2026,BEIGE COFFEE PERERENAN Badung IDN ##0626,-6.61\n09/06/2026,LUSH KITCHEN Badung IDN ##06,-8.29\n09/06/2026,FRESTIVE PERERENAN Badung,-18.60\n15/06/2026,55 KNOTS MILLERS POINNSW,-104.72\n04/06/2026,Adobe SAGGART IRL ##0626,-99.00';
const plan = await p.evaluate(text => { document.querySelector('#impText').value = text; document.querySelector('#impAcct').value = 'Mastercard June 2026'; doParse();
  return document.querySelector('#dupNote').innerText; }, csv);
check('the preview says how many are already in from another statement', /3 ready/.test(plan) && /4 already in from another statement/.test(plan), plan);
const c = await imp(csv, 'Mastercard June 2026');
const rows = await p.evaluate(() => B().tx.filter(t => t.acct === 'Mastercard June 2026').map(t => t.desc.slice(0, 12) + ' ' + t.amt));
check('only the new rows are added: Frestive, 55 Knots, and the different Adobe amount', c.n === base + 3 && rows.length === 3, JSON.stringify(rows));
check('a same-day coffee on one statement matches only one of the two', base === 5 || base === 4, String(base));

// already loaded twice: clean up
const ov = await p.evaluate(() => {
  const mk = (id, date, desc, amt, acct, x) => Object.assign(normTx({id, date, desc, amt, cur: 'AUD', acct, mk: merchantKey(desc)}, true), x || {});
  B().tx = [
    mk('p1', '2026-06-01', 'Anthropic* Claude Sub San Fr', -159.11, 'CommBank card 4345'),
    mk('p2', '2026-06-02', 'Fiverreu Limassol', -249.43, 'CommBank card 4345', {kind: 'business', tax: 'ex_contract', line: TRACKS.find(l => l.label === 'EDITING').key}),
    mk('p3', '2026-06-03', 'Something Else', -10, 'CommBank card 4345'),
    mk('n1', '2026-06-01', 'ANTHROPIC* CLAUDE SUB SAN FRANCISC', -159.11, 'Mastercard June 2026', {kind: 'business', tax: 'ex_software', line: TRACKS.find(l => l.label === 'Regular Subcriptions').key}),
    mk('n2', '2026-06-02', 'FiverrEU Limassol CYP ##0626', -249.43, 'Mastercard June 2026'),
    // a statement loaded three times under three names
    mk('s1', '2025-07-28', 'Direct Credit 158824 AMAZON CO', 151.65, 'Parallaxx Income'),
    mk('s2', '2025-07-28', 'Direct Credit 158824 AMAZON CO', 151.65, 'parallaxx income'),
    mk('s3', '2025-07-28', 'Direct Credit 158824 AMAZON CO', 151.65, 'CommBank NetBank Saver 1986'),
    // Stripe rows are never matched
    mk('t1', '2026-06-05', 'Stripe sale · a@b.c', 50, 'Stripe 2025', {src: 'stripe', ref: 'ch_1'}),
    mk('t2', '2026-06-05', 'Stripe sale · a@b.c', 50, 'Stripe 2025', {src: 'stripe', ref: 'ch_2'}),
  ];
  renderAll(); go('import');
  return {groups: findOverlaps().map(g => ({accts: g.accts, n: g.n, keep: g.keep})),
    flags: [...document.querySelectorAll('#acctList .flagbox')].map(e => e.innerText.replace(/\s+/g, ' '))};
});
check('two groups: the card pair, and the Saver three ways', ov.groups.length === 2, JSON.stringify(ov.groups));
const card = ov.groups.find(g => g.accts.includes('Mastercard June 2026')), saver = ov.groups.find(g => g.accts.length === 3);
check('card pair: 2 loaded twice, keeping the bigger account by default', card && card.n === 2 && card.keep === 'CommBank card 4345', JSON.stringify(card));
check('Saver: 1 in all three', saver && saver.n === 1, JSON.stringify(saver));
check('listed under What\'s loaded', ov.flags.length === 2 && ov.flags.some(f => /2 transactions loaded twice/.test(f)), JSON.stringify(ov.flags));

const after = await p.evaluate(() => {
  const i = findOverlaps().findIndex(g => g.accts.includes('Mastercard June 2026'));
  document.querySelector(`[data-ovgo="${i}"]`).click();
  const t = id => B().tx.find(x => x.id === id);
  return {ids: B().tx.map(x => x.id), p1: t('p1') && {kind: t('p1').kind, tax: t('p1').tax}, p2: t('p2') && t('p2').tax};
});
check('the copies are gone from the account not kept', !after.ids.includes('n1') && !after.ids.includes('n2') && after.ids.includes('p3'), JSON.stringify(after.ids));
check('an unsorted kept row takes the copy\'s answer; a sorted one keeps its own', after.p1 && after.p1.tax === 'ex_software' && after.p2 === 'ex_contract', JSON.stringify(after));

const sv = await p.evaluate(() => {
  const i = findOverlaps().findIndex(g => g.accts.length === 3);
  document.querySelector(`[data-ovkeep="${i}"]`).value = 'parallaxx income';
  document.querySelector(`[data-ovgo="${i}"]`).click();
  return {ids: B().tx.map(x => x.id), left: findOverlaps().length, stripe: B().tx.filter(x => x.src === 'stripe').length};
});
check('Saver: keeps the one you choose, removes the other two', sv.ids.includes('s2') && !sv.ids.includes('s1') && !sv.ids.includes('s3'), JSON.stringify(sv.ids));
check('nothing left loaded twice; Stripe rows untouched', sv.left === 0 && sv.stripe === 2, JSON.stringify(sv));

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
