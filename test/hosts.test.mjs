/**
 * The same source runs on two hosts. This checks both, and the hand-over
 * between them.
 *
 *   build/local.html     standalone, exactly what GitHub Pages serves
 *   build/local-db.html  the Claude artifact shape
 *
 *   node test/hosts.test.mjs
 */
import {chromium} from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const errs = [];

const CSV = `Date,Description,Amount,Currency
05/07/2026,EVENTBRITE TICKET SALES,2340.00,AUD
06/07/2026,SEWA VILLA CANGGU,-25000000,IDR
09/07/2026,CANVA PTY LTD SUBSCRIPTION,-21.99,AUD`;

async function page(file){
  const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => errs.push(file + ': ' + e.message));
  await p.goto(BASE + '/' + file);
  await p.waitForTimeout(600);
  return p;
}

/* ---------- standalone ---------- */
console.log('== standalone (what GitHub Pages serves) ==');
let p = await page('local.html');
console.log(' full document:', await p.evaluate(() => !!document.doctype && !!document.head.querySelector('meta[name=viewport]')));
console.log(' storage mode:', await p.evaluate(() => Store.mode));
console.log(' storage chip:', (await p.textContent('#saveFlag')).trim());
console.log(' storage card shown:', await p.isVisible('#storageCard'));
console.log(' connect disabled without a client id:', await p.evaluate(() => !!document.querySelector('#btnConnect')?.disabled));
console.log(' google script tag present:', await p.evaluate(() => !!document.querySelector('script[src*="accounts.google.com"]')));

await p.fill('#impAcct','Wise'); await p.fill('#impText',CSV);
await p.click('#btnParse'); await p.waitForTimeout(300);
await p.click('#btnAdd'); await p.waitForTimeout(600);
for(const [kind, cat, line] of [['b','event ticket','tickets'], ['b','venue hire','venue'], ['p','groceries', null]]){
  await p.keyboard.press(kind); await p.waitForTimeout(200);
  await p.fill('#pickInput', cat); await p.keyboard.press('Enter'); await p.waitForTimeout(280);
  if(line){ await p.fill('#pickInput', line); await p.keyboard.press('Enter'); await p.waitForTimeout(280); }
}
console.log(' after sorting:', await p.textContent('#progTxt'), '| chip:', (await p.textContent('#saveFlag')).trim());
await p.reload(); await p.waitForTimeout(800);
console.log(' survives reload (browser storage):', await p.textContent('#progTxt'));

// setting a client id enables the connect button without any Google call
await p.evaluate(() => { localStorage.setItem('l2r.googleClientId','test-123.apps.googleusercontent.com'); });
await p.reload(); await p.waitForTimeout(700);
console.log(' connect enabled once a client id is set:', await p.evaluate(() => !!document.querySelector('#btnConnect') && !document.querySelector('#btnConnect').disabled));
const backup = await p.evaluate(() => JSON.stringify({...S, tracks: TRACKS}));
await p.context().close();

/* ---------- artifact ---------- */
console.log('\n== artifact (Claude) ==');
p = await page('local-db.html');
console.log(' storage mode:', await p.evaluate(() => Store.mode));
console.log(' storage chip:', (await p.textContent('#saveFlag')).trim());
console.log(' storage card hidden in the artifact:', !(await p.isVisible('#storageCard')));
await p.fill('#impAcct','Wise'); await p.fill('#impText',CSV);
await p.click('#btnParse'); await p.waitForTimeout(300);
await p.click('#btnAdd'); await p.waitForTimeout(1800);
console.log(' db docs written:', await p.evaluate(() => Object.keys(localStorage).filter(k=>k.startsWith('FAKEDB:')).sort()));
await p.evaluate(() => localStorage.removeItem('l2r.state.v2'));
await p.reload(); await p.waitForTimeout(1400);
console.log(' reload from the artifact store with local cache wiped:', await p.textContent('#progTxt'));
await p.context().close();

/* ---------- hand-over: artifact backup -> standalone ---------- */
console.log('\n== moving data across ==');
p = await page('local.html');
await p.evaluate(() => localStorage.clear());
await p.reload(); await p.waitForTimeout(600);
console.log(' starts empty:', await p.textContent('#progTxt'));
await p.evaluate(json => {
  const p2 = migrate(JSON.parse(json));
  S = Object.assign(S, p2);
  if (Array.isArray(p2.tracks) && p2.tracks.length) { TRACKS = p2.tracks; indexTracks(); }
  markDirty(); renderAll();
}, backup);
await p.waitForTimeout(500);
console.log(' after restoring the backup:', await p.textContent('#progTxt'));
console.log(' codes intact:', await p.evaluate(() => B().tx.map(t => `${t.kind||'-'}/${t.line?TRK[t.line].label:'-'}`).join(', ')));
console.log(' learned category -> line kept:', await p.evaluate(() => Object.entries(S.lineFor).map(([c,l]) => CAT[c].label+' -> '+TRK[l].label).join(', ') || '(none yet)'));
await p.context().close();

console.log('\nPAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
