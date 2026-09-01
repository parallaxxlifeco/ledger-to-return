/**
 * The tracking book: two codes per transaction, and the learn-then-predict
 * behaviour of the tax mapping.
 *
 * Nothing ships pre-mapped. A tracker line gets its tax category the first time
 * you set one on a transaction sitting on it; that then fills every other
 * transaction on the line that wasn't set by hand, and predicts for new imports.
 * A per-transaction override stays a one-off until promoted to the line.
 *
 *   node test/tracking.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b=await chromium.launch(); const p=await b.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('ERR: '+e.message));
await p.goto(BASE+'/local.html'); await p.waitForTimeout(500);
console.log('lines pre-mapped to a tax category:', await p.evaluate(()=>TRACKS.filter(t=>t.tax).length),'of',await p.evaluate(()=>TRACKS.length));

const csv=`Date,Description,Amount,Currency
05/07/2026,EVENTBRITE TICKET SALES,2340.00,AUD
09/07/2026,CANVA PTY LTD SUBSCRIPTION,-21.99,AUD
02/08/2026,GARUDA INDONESIA DPS-SYD,-6850000,IDR
20/09/2026,CANVA PTY LTD SUBSCRIPTION,-21.99,AUD
21/09/2026,CANVA PTY LTD SUBSCRIPTION,-21.99,AUD`;
await p.fill('#impAcct','Wise'); await p.fill('#impText',csv);
await p.click('#btnParse'); await p.waitForTimeout(250);
await p.click('#btnAdd'); await p.waitForTimeout(400);

async function pickLine(term){
  await p.click('#catSearch'); await p.fill('#catSearch',term); await p.waitForTimeout(110);
  await p.keyboard.press('Enter'); await p.waitForTimeout(160);
}
await pickLine('tickets gia');
await pickLine('teachable gia');       // this also auto-applies to the two later Canva rows
await pickLine('business travel');
console.log('\nafter coding lines only:');
console.log(' progress:', await p.textContent('#progTxt'));
console.log(' chips:', await p.$$eval('#filterChips .chip',c=>c.filter(x=>x.offsetParent!==null).map(x=>x.textContent.trim())));
console.log(' rows:', await p.evaluate(()=>B().tx.map(t=>`${t.desc.slice(0,26).padEnd(26)} line=${t.cat?TRK[t.cat].label:'-'} tax=${t.tax?CAT[t.tax].label:'(none)'}`).join('\n')));

// Now set a tax category on the first Teachable row -> should learn for the line and fill the others
await p.click('#filterChips .chip[data-f="notax"]'); await p.waitForTimeout(300);
console.log('\n"Needs tax" list:', await p.$$eval('#rowList .row .t>span',s=>s.map(x=>x.textContent.trim())));
// select the Canva row
await p.evaluate(()=>{ const r=[...document.querySelectorAll('#rowList .row')].find(r=>r.innerText.includes('CANVA')); r.click(); });
await p.waitForTimeout(300);
console.log('focus note:', (await p.textContent('.taxrow')).replace(/\s+/g,' ').slice(0,170));
await p.selectOption('#taxPick','ex_software'); await p.waitForTimeout(500);
console.log('\nafter setting tax once on a Teachable row:');
console.log(' line learned:', await p.evaluate(()=>TRK['gia:give-it-all:teachable'].tax));
console.log(' rows:', await p.evaluate(()=>B().tx.filter(t=>t.desc.includes('CANVA')).map(t=>`${t.date} tax=${t.tax?CAT[t.tax].label:'(none)'} manual=${!!t.taxManual}`).join('\n')));
console.log(' progress:', await p.textContent('#progTxt'));

// override one of them, then promote the override to the whole line
await p.click('#filterChips .chip[data-f="all"]'); await p.waitForTimeout(250);
await p.evaluate(()=>{ const rs=[...document.querySelectorAll('#rowList .row')].filter(r=>r.innerText.includes('CANVA')); rs[2].click(); });
await p.waitForTimeout(250);
await p.selectOption('#taxPick','ex_advert'); await p.waitForTimeout(400);
console.log('\nafter a one-off override on the third Canva row:');
console.log(' rows:', await p.evaluate(()=>B().tx.filter(t=>t.desc.includes('CANVA')).map(t=>`${t.date} tax=${t.tax?CAT[t.tax].label:'-'} manual=${!!t.taxManual}`).join('\n')));
console.log(' line still:', await p.evaluate(()=>CAT[TRK['gia:give-it-all:teachable'].tax].label));
console.log(' promote button present:', await p.isVisible('#learnTax'));
await p.click('#learnTax'); await p.waitForTimeout(400);
console.log('\nafter promoting it to the line:');
console.log(' line now:', await p.evaluate(()=>CAT[TRK['gia:give-it-all:teachable'].tax].label));
console.log(' rows:', await p.evaluate(()=>B().tx.filter(t=>t.desc.includes('CANVA')).map(t=>`${t.date} tax=${t.tax?CAT[t.tax].label:'-'} manual=${!!t.taxManual}`).join('\n')));

// a new transaction on a learned line should now predict
await p.click('.stage[data-pane="import"]'); await p.waitForTimeout(200);
await p.fill('#impAcct','Wise'); await p.fill('#impText','Date,Description,Amount\n05/10/2026,CANVA PTY LTD SUBSCRIPTION,-24.99');
await p.click('#btnParse'); await p.waitForTimeout(250); await p.click('#btnAdd'); await p.waitForTimeout(500);
console.log('\nnewly imported row predicted:', await p.evaluate(()=>{const t=B().tx.find(x=>x.date==='2026-10-05');return `line=${TRK[t.cat].label} tax=${CAT[t.tax].label} auto=${t.auto}`;}));
console.log('progress:', await p.textContent('#progTxt'));
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
