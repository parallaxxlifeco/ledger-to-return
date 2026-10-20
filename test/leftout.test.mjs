/**
 * The report's "Left out" card gives an amount: what went out that is not the
 * business, broken down, with money in on its own line. Stripe sales (their
 * own box) are not in it, and transfers are counted but never added.
 *
 *   node test/leftout.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof leftOutStat === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const card = await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; S.taxFy = fyOf('2025-08-10').id;
  let i = 0;
  const mk = (desc, amt, kind, tax) => normTx({id: 'r' + (++i), date: '2025-08-1' + (i % 9), desc, amt, cur: 'AUD', acct: 'card',
    mk: merchantKey(desc), kind, tax}, true);
  B().tx = [
    mk('Woolworths', -100, 'personal', 'x_personal'), mk('Cafe', -50, 'personal', 'x_personal'),
    mk('Refund shop', 15, 'personal', 'x_personal'),
    mk('Owner draw', -200, 'exclude', 'x_drawings'),
    mk('To saver', -500, 'transfer', 'x_transfer'), mk('From card', 500, 'transfer', 'x_transfer'),
    mk('Gift', 40, 'exclude', 'x_personal_in'),
    Object.assign(mk('Stripe sale', 1000, 'exclude', 'x_income_reported'), {src: 'stripe', role: 'sale', ref: 'ch_1', biz: true}),
  ];
  renderAll(); go('report');
  const el = [...document.querySelectorAll('.stat')].find(e => /Left out/i.test(e.innerText));
  return el ? el.innerText.replace(/\s+/g, ' ') : '';
});
check('the card is there', !!card, card);
check('headline is the money out, not business: 100+50+200', /\$350\b/.test(card), card);
check('broken down, largest first', /drawings \$200 · personal \$150/.test(card), card);
check('money in on its own line: 15+40', /\$55 in/.test(card), card);
check('transfers counted, not added', /2 transfers, not added/.test(card) && !/\$500/.test(card), card);
check('Stripe kept out of it: 7 items, not 8', /\b7 items\b/.test(card) && !/\$1,000/.test(card), card);

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
