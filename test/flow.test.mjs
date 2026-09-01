/**
 * End-to-end: parsing, FX conversion, categorising, report totals, CSV export.
 * Checks the numbers, not the pixels.
 *
 *   python3 ../build/make-test-pages.py
 *   python3 -m http.server 8899      (from the project folder)
 *   node test/flow.test.mjs
 */
import {chromium} from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto(BASE + '/local.html');
await p.waitForTimeout(400);

console.log('AMOUNTS:', JSON.stringify(await p.evaluate(() => ({
  idr_dots:  parseAmount('2.500.000', null, 'IDR'),   // 2500000
  idr_1grp:  parseAmount('2.500',     null, 'IDR'),   // 2500
  aud_dot:   parseAmount('2.500',     null, 'AUD'),   // 2.5
  aud_2dp:   parseAmount('1234.56',   null, 'AUD'),
  eu:        parseAmount('1.234.567,89', null, 'AUD'),
  au_th:     parseAmount('1,234.56',  null, 'AUD'),
  idr_comma: parseAmount('25,000,000',null, 'IDR'),
  paren:     parseAmount('(500.00)'),                 // -500
  dr:        parseAmount('$1,200.00 DR'),             // -1200
}))));

console.log('FX:', JSON.stringify(await p.evaluate(() => ({
  exact:   fxRate('USD', '2025-09-15'),
  idr:     fxRate('IDR', '2025-09-15'),
  sunday:  fxRate('USD', '2026-01-04'),   // carried back to Fri 2 Jan
  outside: fxRate('USD', '2019-01-01'),   // clamped
  unknown: fxRate('VND', '2025-09-15'),   // no series
}))));

// Indonesian headers, semicolon delimiter, separate debit/credit columns,
// dot thousands separators - the awkward case.
const idrCsv = `Tanggal;Keterangan;Debet;Kredit;Mata Uang
01/07/2025;PEMBAYARAN KLIEN COACHING;;65.000.000;IDR
15/09/2025;SEWA VILLA CANGGU;25.000.000;;IDR
04/01/2026;AIRBNB RETREAT VENUE;8.500.000;;IDR
20/03/2026;APPLE STORE MACBOOK;3.499.000;;IDR`;
await p.fill('#impAcct', 'BCA IDR');
await p.selectOption('#impCur', 'IDR');
await p.fill('#impText', idrCsv);
await p.click('#btnParse');
await p.waitForTimeout(250);
console.log('DETECTED COLS:', await p.$$eval('#mapFields select',
  ss => ss.map(s => s.previousElementSibling.textContent + ' = ' + (s.selectedOptions[0] || {}).text)));
console.log('PREVIEW:\n' + await p.$$eval('#prevTable tbody tr',
  rs => rs.map(r => [...r.cells].map(c => c.innerText.trim()).join(' | ')).join('\n')));
await p.click('#btnAdd');
await p.waitForTimeout(250);

// A plain AUD statement, including one row outside the financial year.
const audCsv = `Date,Description,Amount
03/07/2025,CANVA PTY LTD SUBSCRIPTION,-21.99
12/05/2026,CANVA PTY LTD SUBSCRIPTION,-21.99
30/06/2026,SPEAKING FEE GIVE IT ALL,1200.00
10/08/2026,OUT OF YEAR PAYMENT,-99.00`;
await p.click('.stage[data-pane="import"]');
await p.fill('#impAcct', 'ANZ AUD');
await p.selectOption('#impCur', 'AUD');
await p.fill('#impText', audCsv);
await p.click('#btnParse');
await p.waitForTimeout(250);
await p.click('#btnAdd');
await p.waitForTimeout(300);
console.log('LOADED:', await p.textContent('#progTxt'));

// Categorise by typing, one Enter each. Merchant learning should auto-fill the
// second Canva line off the first.
for (const term of ['coaching client', 'venue hire', 'venue hire', 'equipment 300', 'software subs', 'speaking']) {
  await p.click('#catSearch');
  await p.fill('#catSearch', term);
  await p.waitForTimeout(110);
  const desc = await p.$eval('#focusCard .fdesc', e => e.textContent.trim()).catch(() => '(none)');
  const top  = await p.$eval('#catList .catbtn .nm', e => e.textContent.trim()).catch(() => '(no match)');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(130);
  console.log('  ' + desc + '  ->  ' + top);
}
console.log('CHIPS:', await p.$$eval('#filterChips .chip', cs => cs.map(c => c.textContent.trim())));

await p.click('.stage[data-pane="report"]');
await p.waitForTimeout(400);
console.log('\nSTATS:\n' + await p.$$eval('.stat', ss => ss.map(s => s.innerText.replace(/\n/g, ' ')).join('\n')));
console.log('\nFLAGS:\n' + await p.$$eval('.flagbox', fs => fs.map(f => '- ' + f.innerText.replace(/\n/g, ' | ')).join('\n')));
console.log('\nSUMMARY CSV:\n' + await p.evaluate(() => summaryCsv()));
console.log('\nTX CSV (first rows):\n' + (await p.evaluate(() => txCsv())).split('\n').slice(0, 4).join('\n'));

console.log('\nPAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
