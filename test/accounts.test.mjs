/**
 * Accounts: the same statement under another name is caught, and an account
 * can be renamed (or folded into another) and removed.
 *
 * His NetBank Saver statement went in three times under three names —
 * "CommBank NetBank Saver 1986", "Parallaxx Income", "parallaxx income" — and
 * nothing stopped it, because a row's id includes the account name.
 *
 *   node test/accounts.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1300, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Parallaxx Income' : undefined));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof knownIds === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };
const csv = 'Date,Description,Amount\n10/02/2025,Direct Credit 158824 AMAZON COMMERCIA,406.73\n05/07/2025,Transfer to xx0000 CommBank app Freight,-430.00\n05/07/2025,Transfer to xx0000 CommBank app Freight,-430.00';

const imp = async acct => p.evaluate(([text, acct]) => {
  document.querySelector('#impText').value = text; document.querySelector('#impAcct').value = acct;
  doParse(); const note = document.querySelector('#dupNote').innerText; addParsed(); return {n: B().tx.length, note};
}, [csv, acct]);

await p.evaluate(() => { S.book = 'track'; B().tx = []; B().rules = {}; });
const first = await imp('CommBank NetBank Saver 1986');
check('first import goes in', first.n === 2, `${first.n} rows`);
const again = await imp('Parallaxx Income');
check('the same statement under a different account name is caught', again.n === 2 && /3 already loaded/.test(again.note), `${again.n} rows · ${again.note}`);

const ren = await p.evaluate(() => { renderAll(); document.querySelector('[data-ren="CommBank NetBank Saver 1986"]').click();
  return [...new Set(B().tx.map(t => t.acct))]; });
check('Rename moves every row to the new name', JSON.stringify(ren) === JSON.stringify(['Parallaxx Income']), JSON.stringify(ren));
const third = await imp('CommBank NetBank Saver 1986');
check('and a later import under the old name is still caught', third.n === 2, `${third.n}`);

const del = await p.evaluate(() => {
  B().tx.push(normTx({id: 'x', date: '2025-08-01', desc: 'Other', amt: -1, cur: 'AUD', acct: 'spare', mk: 'OTHER'}, true));
  renderAll(); document.querySelector('[data-del="spare"]').click(); return B().tx.map(t => t.acct);
});
check('Remove takes out one account and nothing else', del.length === 2 && del.every(a => a === 'Parallaxx Income'), JSON.stringify(del));

const stripe = await p.evaluate(() => {
  const k = new Set();
  const a = {date: '2025-08-02', desc: 'Stripe sale · Ticket', amt: 50, ref: 'stripe|ch_1'}, c = {...a, ref: 'stripe|ch_2'};
  B().tx.push({...a, id: txId(a), acct: 'Stripe'});
  return isKnown(knownIds(B()), {...c, acct: 'Stripe'});
});
check('two identical Stripe sales with their own references are not taken for duplicates', stripe === false);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\naccounts behave');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
