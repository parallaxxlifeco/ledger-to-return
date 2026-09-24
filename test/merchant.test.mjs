/**
 * Merchant keys, and Amazon.
 *
 * Amazon pays out as AMAZON.CSVZTKNY0, AMAZON.CLSEYQR6L ... — a fresh code
 * every time. Keyed on the whole string, his twenty payouts were twenty
 * different merchants, so a rule made on one never caught the next. And with no
 * product-sales category they could only go under Other business income, which
 * then learned its way onto the Amazon line.
 *
 *   node test/merchant.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof merchantKey === 'function');

let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

console.log('KEYS:');
const keys = await p.evaluate(() => Object.fromEntries([
  'AMAZON.CSVZTKNY0', 'AMAZON.CZZUSCOGM', 'AMAZON.RC5XR74G4 London',
  'Upwork -818382738ref Dublin', 'Upwork -820547013ref Dublin',
  'WWW.FACEBOOK.COM', 'Gopay-Gojek Jakarta Selat', 'Paypal *Dailyhabits 35314369001',
].map(d => [d, merchantKey(d)])));
check('every Amazon payout is one merchant',
  keys['AMAZON.CSVZTKNY0'] === 'AMAZON' && keys['AMAZON.CZZUSCOGM'] === 'AMAZON', keys['AMAZON.CZZUSCOGM']);
check('including a code with no digits in it', keys['AMAZON.CZZUSCOGM'] === 'AMAZON');
check('an Amazon purchase stays a different merchant', keys['AMAZON.RC5XR74G4 London'] === 'AMAZON LONDON', keys['AMAZON.RC5XR74G4 London']);
check('Upwork invoices collapse to one', keys['Upwork -818382738ref Dublin'] === keys['Upwork -820547013ref Dublin'], keys['Upwork -818382738ref Dublin']);
check('a dotted name is a name, not a code', keys['WWW.FACEBOOK.COM'] === 'FACEBOOK', keys['WWW.FACEBOOK.COM']);
check('ordinary names are untouched', keys['Gopay-Gojek Jakarta Selat'] === 'GOPAY GOJEK JAKARTA');

console.log('\nPRODUCT SALES:');
const cat = await p.evaluate(() => {
  const c = CATLIST.find(x => x.label === 'Product sales');
  return c && {kind: c.kind, ato: c.ato, group: c.group};
});
check('there is a product-sales category', !!cat, JSON.stringify(cat));
check('it is income, and lands on the ATO schedule as business income',
  cat && cat.kind === 'income' && /business income/i.test(cat.ato), cat && cat.ato);

console.log('\nSAVED DATA FROM BEFORE:');
const mig = await p.evaluate(() => {
  const old = {v: 3, book: 'track', lineFor: {}, taxFy: 'fy2526', books: {
    tax: {tx: [], rules: {}, biz: {}},
    track: {biz: {}, rules: {
      'AMAZON CSVZTKNY0': {k: 'business', l: 'budget:parallaxx:income:amazon-us', t: 'inc_product'},
      'GOPAY GOJEK JAKARTA': {k: 'personal', l: 'budget:lifestyle:expense:taxi-fuel-tolls', t: 'x_personal'},
    }, tx: [
      {id: 'a', date: '2025-08-04', desc: 'AMAZON.CSVZTKNY0', amt: 627.43, cur: 'USD', acct: 'Wise', mk: 'AMAZON CSVZTKNY0'},
      {id: 'b', date: '2025-08-18', desc: 'AMAZON.CLSEYQR6L', amt: 38.06, cur: 'USD', acct: 'Wise', mk: 'AMAZON CLSEYQR6L'},
      {id: 'c', date: '2025-09-02', desc: 'AMAZON.CZZUSCOGM', amt: 36.51, cur: 'USD', acct: 'Wise', mk: 'AMAZON CZZUSCOGM'},
      {id: 'd', date: '2025-09-05', desc: 'AMAZON.RC5XR74G4 London', amt: -44.00, cur: 'GBP', acct: 'Wise', mk: 'AMAZON RC5XR74G4 LONDON'},
      {id: 'g', date: '2025-09-06', desc: 'Gopay-Gojek Jakarta Selat', amt: -8.98, cur: 'IDR', acct: 'card', mk: 'GOPAY GOJEK JAKARTA'},
    ]},
  }};
  const m = migrate(JSON.parse(JSON.stringify(old)));
  const again = migrate(JSON.parse(JSON.stringify(m)));
  return {
    keys: m.books.track.tx.map(t => t.mk),
    rules: Object.keys(m.books.track.rules),
    mkv: m.mkv,
    stable: JSON.stringify(again.books.track.rules) === JSON.stringify(m.books.track.rules)
         && again.books.track.tx.map(t => t.mk).join() === m.books.track.tx.map(t => t.mk).join(),
  };
});
check('stored keys are brought up to date', mig.keys.slice(0, 3).every(k => k === 'AMAZON'), mig.keys.join(' | '));
check('the Amazon rule follows its rows to the new key', mig.rules.includes('AMAZON') && !mig.rules.includes('AMAZON CSVZTKNY0'), mig.rules.join(', '));
check('a rule without a code is left exactly where it was', mig.rules.includes('GOPAY GOJEK JAKARTA'));
check('and running it again changes nothing', mig.stable && mig.mkv >= 2);

console.log('\nONE RULE, ALL PAYOUTS:');
const run = await p.evaluate(() => {
  S.book = 'track'; S.lineFor = {}; B().rules = {};
  B().tx = [
    ['p1', 'AMAZON.CSVZTKNY0', 627.43], ['p2', 'AMAZON.CLSEYQR6L', 38.06], ['p3', 'AMAZON.CZZUSCOGM', 36.51],
    ['x1', 'AMAZON.RC5XR74G4 London', -44.00],
  ].map(([id, desc, amt]) => normTx({id, date: '2025-08-04', desc, amt, cur: 'USD', acct: 'Wise', mk: merchantKey(desc)}));
  renderAll(); go('sort');
  curId = 'p1'; setKind('business'); ruleOn = true; renderList();
  choose(CATLIST.find(c => c.label === 'Product sales').key);
  const line = linesFor('business').find(l => l.label === 'Amazon US' && l.kind === 'income');
  if (pickMode === 'line') choose(line.key);
  const t = id => B().tx.find(x => x.id === id);
  return {
    filled: ['p2', 'p3'].map(id => t(id).line === line.key && t(id).tax === CATLIST.find(c => c.label === 'Product sales').key),
    purchaseTouched: !!(t('x1').line || t('x1').kind),
  };
});
check('the other payouts fill themselves in, category and line', run.filled.every(Boolean), JSON.stringify(run.filled));
check('an Amazon purchase is left alone', !run.purchaseTouched);

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\none rule now covers every Amazon payout');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
