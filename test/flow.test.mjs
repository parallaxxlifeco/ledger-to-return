/**
 * Parsing, FX conversion, the personal/business sort flow, and what comes
 * out the far end. Checks the numbers, not the pixels.
 *
 *   python3 build/make-index.py && python3 build/make-test-pages.py
 *   python3 -m http.server 8899
 *   node test/flow.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

/* The sort screen in one place, so the tests read like the keystrokes you'd
   actually make: P / B / N, then type and Enter. */
export const sort = {
  active: p => p.$eval('.txcard.cur .desc', e => e.textContent.trim()).catch(() => '(none)'),
  prompt: p => p.$eval('.txcard.cur .pickbox .lbl', e => e.textContent.trim()).catch(() => '(no picker)'),
  options: (p, n = 6) => p.$$eval('.txcard.cur .pickopt .nm', e => e.map(x => x.textContent.trim())).then(a => a.slice(0, n)),
  async kind(p, key) { await p.keyboard.press(key); await p.waitForTimeout(220); },
  async pick(p, text) {
    await p.fill('#pickInput', text); await p.waitForTimeout(140);
    await p.keyboard.press('Enter'); await p.waitForTimeout(320);
  },
};

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto(BASE + '/local.html');
await p.waitForTimeout(600);

console.log('AMOUNTS:', JSON.stringify(await p.evaluate(() => ({
  idr_dots:  parseAmount('2.500.000', null, 'IDR'),   // 2500000
  idr_1grp:  parseAmount('2.500',     null, 'IDR'),   // 2500
  aud_dot:   parseAmount('2.500',     null, 'AUD'),   // 2.5
  eu:        parseAmount('1.234.567,89', null, 'AUD'),
  paren:     parseAmount('(500.00)'),                 // -500
  dr:        parseAmount('$1,200.00 DR'),             // -1200
}))));
console.log('FX:', JSON.stringify(await p.evaluate(() => ({
  exact:   fxRate('USD', '2025-09-15'),
  sunday:  fxRate('USD', '2026-01-04'),   // carried back to Fri 2 Jan
  outside: fxRate('USD', '2019-01-01'),   // clamped
}))));

// Indonesian headers, semicolons, debit/credit columns, dot thousands.
await p.fill('#impAcct', 'BCA IDR');
await p.selectOption('#impCur', 'IDR');
await p.fill('#impText', `Tanggal;Keterangan;Debet;Kredit;Mata Uang
01/07/2026;PEMBAYARAN KLIEN COACHING;;65.000.000;IDR
15/07/2026;SEWA VILLA CANGGU;25.000.000;;IDR
04/08/2026;WARUNG BELANJA;450.000;;IDR`);
await p.click('#btnParse'); await p.waitForTimeout(280);
console.log('DETECTED COLS:', await p.$$eval('#mapFields select',
  ss => ss.map(s => s.previousElementSibling.textContent + ' = ' + (s.selectedOptions[0] || {}).text)));
console.log('PREVIEW:\n' + await p.$$eval('#prevTable tbody tr',
  rs => rs.map(r => [...r.cells].map(c => c.innerText.trim()).join(' | ')).join('\n')));
await p.click('#btnAdd'); await p.waitForTimeout(400);

// A plain AUD statement, including one row outside the financial year.
await p.click('.stage[data-pane="import"]');
await p.fill('#impAcct', 'CommBank'); await p.selectOption('#impCur', 'AUD');
await p.fill('#impText', `Date,Description,Amount
09/07/2026,ADOBE CREATIVE CLOUD,-89.99
02/08/2026,TRANSFER TO SAVINGS,-2000.00
20/08/2026,ADOBE CREATIVE CLOUD,-89.99
10/08/2027,OUT OF YEAR PAYMENT,-99.00`);
await p.click('#btnParse'); await p.waitForTimeout(280);
await p.click('#btnAdd'); await p.waitForTimeout(500);
console.log('LOADED:', await p.textContent('#progTxt'));

console.log('\nSORTING');
console.log(' row:', await sort.active(p));
await sort.kind(p, 'b');
console.log('  prompt:', await sort.prompt(p), '\n  offers:', await sort.options(p, 4));
await sort.pick(p, 'coaching client');
console.log('  then asks:', await sort.prompt(p), '\n  offers:', await sort.options(p, 3));
await sort.pick(p, 'brian mccafferty');

console.log(' row:', await sort.active(p));
await sort.kind(p, 'b');
await sort.pick(p, 'venue hire');
await sort.pick(p, 'venue');

console.log(' row:', await sort.active(p));
await sort.kind(p, 'p');
console.log('  prompt:', await sort.prompt(p), '\n  offers:', await sort.options(p, 4));
await sort.pick(p, 'groceries');

console.log(' row:', await sort.active(p));
await sort.kind(p, 'b');
await sort.pick(p, 'software');
await sort.pick(p, 'adobe');

console.log(' row:', await sort.active(p));
await sort.kind(p, 'n');
console.log('  prompt:', await sort.prompt(p));
await sort.pick(p, 'drawings');

console.log('\nEVERY ROW:');
console.log(await p.evaluate(() => B().tx.map(t =>
  `  ${t.date} ${t.desc.slice(0, 26).padEnd(26)} ${String(t.kind || '-').padEnd(9)} ` +
  `${t.tax ? CAT[t.tax].label : '-'} / ${t.line ? TRK[t.line].label : 'no line'}${t.auto ? '  (rule)' : ''}`).join('\n')));
console.log('learned category -> line:', await p.evaluate(() =>
  Object.entries(S.lineFor).map(([c, l]) => CAT[c].label + ' -> ' + TRK[l].label).join(', ')));
console.log('progress:', await p.textContent('#progTxt'));

await p.click('.stage[data-pane="report"]'); await p.waitForTimeout(450);
await p.click('#reportBody .chip[data-rv="sheets"]'); await p.waitForTimeout(600);
console.log('\nMONTHLY GRID:');
console.log(await p.evaluate(() => [...document.querySelectorAll('table.grid tbody tr')]
  .map(r => [...r.cells].map(c => c.innerText.trim()).join(' | ')).filter(x => /\$/.test(x)).join('\n')));
await p.click('#reportBody .chip[data-rv="tax"]'); await p.waitForTimeout(500);
console.log('\nTAX VIEW:', await p.$$eval('.stat', s => s.map(x => x.innerText.replace(/\n/g, ' ')).join(' // ')));
console.log('\nFLAGS:\n' + await p.$$eval('#reportInner .flagbox', f => f.map(x => '- ' + x.innerText.replace(/\n/g, ' | ')).join('\n')));
console.log('\nTRANSACTION CSV:\n' + (await p.evaluate(() => txCsv())).split('\n').slice(0, 3).join('\n'));

console.log('\nPAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
