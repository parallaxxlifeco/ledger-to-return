/**
 * Storage across both books: the v1 -> v2 migration (an existing tax-return-only
 * store becomes the Tax return book, untouched), the two books staying separate
 * in their own document sets, recovery after the local cache is wiped, and the
 * tracker line editor.
 *
 *   node test/migration.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b=await chromium.launch(); const ctx=await b.newContext(); const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push('ERR: '+e.message));

// Seed the fake store with v1-shaped data, exactly as the live artifact holds it today.
await p.goto(BASE+'/local-db.html'); await p.waitForTimeout(300);
await p.evaluate(()=>{
  localStorage.clear();
  const tx=[
    {date:"2025-07-01",desc:"STRIPE PAYOUT COACHING",cur:"AUD",amt:4500,acct:"ANZ",id:"a1",mk:"STRIPE PAYOUT COACHING",cat:"inc_coach",auto:false},
    {date:"2025-09-15",desc:"SEWA VILLA CANGGU",cur:"IDR",amt:-25000000,acct:"BCA",id:"a2",mk:"SEWA VILLA CANGGU",cat:"ex_venue",auto:false},
    {date:"2026-05-12",desc:"CANVA PTY LTD",cur:"AUD",amt:-21.99,acct:"ANZ",id:"a3",mk:"CANVA",cat:"ex_software",auto:true}
  ];
  localStorage.setItem('FAKEDB:meta/state',JSON.stringify({rules:{"CANVA":"ex_software"},biz:{name:"Parallaxx",abn:"11 222 333 444"},n:1,at:"x"}));
  localStorage.setItem('FAKEDB:tx/c0',JSON.stringify({i:0,items:tx}));
});
await p.reload(); await p.waitForTimeout(1200);
console.log('v1 -> v2 migration');
console.log('  books:', await p.evaluate(()=>Object.keys(S.books)));
console.log('  tax book tx:', await p.evaluate(()=>S.books.tax.tx.length), '| track:', await p.evaluate(()=>S.books.track.tx.length));
console.log('  tax rules:', await p.evaluate(()=>JSON.stringify(S.books.tax.rules)));
console.log('  biz carried:', await p.evaluate(()=>JSON.stringify(S.books.tax.biz)));
console.log('  active book:', await p.evaluate(()=>S.book));

// switch to tax book, check the old report still works
await p.click('.bookbtn[data-book="tax"]'); await p.waitForTimeout(400);
console.log('  progress in tax book:', await p.textContent('#progTxt'));
await p.click('.stage[data-pane="report"]'); await p.waitForTimeout(500);
console.log('  report chips (should be none in tax book):', await p.$$eval('#reportBody .chip[data-rv]',c=>c.length));
console.log('  stats:', await p.$$eval('.stat',s=>s.map(x=>x.innerText.replace(/\n/g,' ')).join(' // ')));

// add to track book, confirm the two books stay separate and both persist
await p.click('.bookbtn[data-book="track"]'); await p.waitForTimeout(300);
await p.click('.stage[data-pane="import"]'); await p.waitForTimeout(200);
await p.fill('#impAcct','CommBank');
await p.fill('#impText','Date,Description,Amount\n05/07/2026,EVENTBRITE TICKETS,2340.00\n06/07/2026,ADOBE CC,-89.99');
await p.click('#btnParse'); await p.waitForTimeout(300);
await p.click('#btnAdd'); await p.waitForTimeout(1800);
console.log('\nafter adding to track book');
console.log('  tax:', await p.evaluate(()=>S.books.tax.tx.length), '| track:', await p.evaluate(()=>S.books.track.tx.length));
console.log('  docs written:', await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('FAKEDB:')).sort()));

// wipe local cache, reload -> both books must come back from the store
await p.evaluate(()=>{localStorage.removeItem('l2r.state.v2');localStorage.removeItem('l2r.state.v1');});
await p.reload(); await p.waitForTimeout(1400);
console.log('\nafter reload with local cache wiped');
console.log('  tax:', await p.evaluate(()=>S.books.tax.tx.length), '| track:', await p.evaluate(()=>S.books.track.tx.length));
console.log('  tax rules kept:', await p.evaluate(()=>JSON.stringify(S.books.tax.rules)));
console.log('  tracker lines:', await p.evaluate(()=>TRACKS.length));

// tracker line editor: rename + retax, confirm coded transactions follow
await p.click('.bookbtn[data-book="track"]'); await p.waitForTimeout(300);
console.log('\ntracker editor');
console.log('  visible:', await p.isVisible('#tracksCard'), '| rows:', await p.$$eval('#tracksBody .lineedit',r=>r.length));
const before=await p.evaluate(()=>TRK['budget:transformations:brian-mccafferty'].label);
await p.evaluate(()=>{
  const row=[...document.querySelectorAll('#tracksBody .lineedit')].find(r=>r.dataset.k==='budget:transformations:brian-mccafferty');
  const inp=row.querySelector('[data-f="label"]'); inp.value='Brian M (2027)';
  inp.dispatchEvent(new Event('change',{bubbles:true}));
});
await p.waitForTimeout(400);
console.log('  renamed:', before, '->', await p.evaluate(()=>TRK['budget:transformations:brian-mccafferty'].label));
console.log('\nERRORS:',errs.length?errs:'none');
await b.close();
