/**
 * Storage: chunked writes to the db capability, and recovery after the local
 * cache is wiped. Imports 300 rows so the chunking (120 per document) is
 * actually exercised.
 *
 *   node test/persistence.test.mjs
 */
import {chromium} from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto(BASE + '/local-db.html');
await p.waitForTimeout(500);
console.log('save flag at boot:', await p.textContent('#saveFlag'));

const rows = [];
for (let i = 0; i < 300; i++) {
  const d = new Date(Date.UTC(2025, 6, 1) + i * 86400000).toISOString().slice(0, 10).split('-').reverse().join('/');
  rows.push(`${d},MERCHANT ${i % 17} SOME PLACE,${i % 3 === 0 ? '' : '-'}${(50 + i * 3.7).toFixed(2)},${['AUD','IDR','USD'][i % 3]}`);
}
await p.fill('#impAcct', 'Bulk test');
await p.fill('#impText', 'Date,Description,Amount,Currency\n' + rows.join('\n'));
await p.click('#btnParse');
await p.waitForTimeout(500);
await p.click('#btnAdd');
await p.waitForTimeout(2500);

console.log('loaded:', await p.textContent('#progTxt'), '| flag:', await p.textContent('#saveFlag'));
console.log('db writes:', await p.evaluate(() => window.__dbcalls), '(expect chunks + 1 meta)');
console.log('chunk docs:', await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('FAKEDB:tx/')).sort()));

await p.click('#catSearch');
await p.fill('#catSearch', 'software');
await p.keyboard.press('Enter');
await p.waitForTimeout(1500);
const before = await p.textContent('#progTxt');

// Wipe the local mirror so the reload has to come back from the store.
await p.evaluate(() => localStorage.removeItem('l2r.state.v1'));
await p.reload();
await p.waitForTimeout(1200);
console.log('after reload with local cache wiped:', await p.textContent('#progTxt'), '| before:', before);
console.log('learned rules restored:', await p.evaluate(() => Object.keys(S.rules).length));

console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
