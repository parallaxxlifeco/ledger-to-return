/**
 * Storage shapes across versions. An older store (transactions carrying `cat`
 * and `tax`, rules as {c,t}) has to land in the current one — personal, business
 * or neither, with a sheet line and, where it belongs on the return, a tax
 * category. Also checks the two books stay separate and survive a wipe of the
 * local cache.
 *
 *   node test/migration.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto(BASE + '/local-db.html');
await p.waitForTimeout(400);

await p.evaluate(() => {
  localStorage.clear();
  const track = [
    {date:"2026-07-05",desc:"EVENTBRITE TICKETS",cur:"AUD",amt:2340,acct:"Wise",id:"t1",mk:"EVENTBRITE TICKETS",cat:"gia:give-it-all:tickets",tax:"inc_event",auto:false},
    {date:"2026-07-06",desc:"WARUNG GROCERIES",cur:"IDR",amt:-450000,acct:"Wise",id:"t2",mk:"WARUNG GROCERIES",cat:"budget:living:groceries",tax:"x_personal",auto:false},
    {date:"2026-07-09",desc:"ADOBE CC",cur:"USD",amt:-89.99,acct:"Wise",id:"t3",mk:"ADOBE",cat:"budget:transformations:adobe",tax:"ex_software",auto:true},
    {date:"2026-07-12",desc:"TRANSFER OUT",cur:"AUD",amt:-500,acct:"Wise",id:"t4",mk:"TRANSFER OUT",cat:null,tax:"x_transfer",auto:false}
  ];
  const tax = [{date:"2025-09-15",desc:"SEWA VILLA",cur:"IDR",amt:-25000000,acct:"BCA",id:"a1",mk:"SEWA VILLA",cat:"ex_venue",auto:false}];
  localStorage.setItem('FAKEDB:meta/state', JSON.stringify({v:2, counts:{tax:1,track:1},
    rules:{tax:{"SEWA VILLA":{c:"ex_venue",t:null}}, track:{"ADOBE":{c:"budget:transformations:adobe",t:"ex_software"}}},
    biz:{tax:{name:"Parallaxx",abn:"11 222 333 444"}, track:{name:"",abn:""}}}));
  localStorage.setItem('FAKEDB:trk/c0', JSON.stringify({i:0, items:track}));
  localStorage.setItem('FAKEDB:tx/c0',  JSON.stringify({i:0, items:tax}));
});
await p.reload();
await p.waitForTimeout(1400);

console.log('MIGRATED (old cat/tax -> kind + line + tax)');
console.log(await p.evaluate(() => S.books.track.tx.map(t =>
  `  ${t.desc.padEnd(18)} ${String(t.kind).padEnd(9)} line=${(t.line ? TRK[t.line].label : '-').padEnd(10)} ` +
  `tax=${(t.tax ? CAT[t.tax].label : '-').padEnd(28)} settled=${settled(t)}`).join('\n')));
console.log('  a personal row stays personal, not excluded:',
  await p.evaluate(() => S.books.track.tx.find(t => t.desc.includes('GROCERIES')).kind));
console.log('  rules rewritten:', await p.evaluate(() => JSON.stringify(S.books.track.rules)));
console.log('  tax book untouched:', await p.evaluate(() => S.books.tax.tx.length + ' rows, name=' + S.books.tax.biz.name));
console.log('  progress:', await p.textContent('#progTxt'));

// A fresh import must be filled by the migrated rule.
await p.click('.stage[data-pane="import"]');
await p.fill('#impAcct', 'Wise');
await p.fill('#impText', 'Date,Description,Amount\n05/09/2026,ADOBE CC,-89.99');
await p.click('#btnParse'); await p.waitForTimeout(280);
await p.click('#btnAdd'); await p.waitForTimeout(600);
console.log('  migrated rule fills a new row:', await p.evaluate(() => {
  const t = B().tx.find(x => x.date === '2026-09-05');
  return `${t.kind}/${CAT[t.tax].label}/${TRK[t.line].label} byRule=${t.auto}`;
}));

// Books stay in their own document sets, and survive losing the local cache.
console.log('  store docs:', await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('FAKEDB:')).sort()));
await p.evaluate(() => localStorage.removeItem('l2r.state.v2'));
await p.reload(); await p.waitForTimeout(1400);
console.log('  after wiping the local cache:', await p.evaluate(() =>
  `tax=${S.books.tax.tx.length} track=${S.books.track.tx.length} lineFor=${Object.keys(S.lineFor).length}`));

console.log('\nPAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
