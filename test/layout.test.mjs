/**
 * The sort screen's two panes.
 *
 * Wide screens: the transaction being answered and the whole queue on the left,
 * the pick list on the right, always in the same place — so nothing jumps
 * between rows. The one being answered is highlighted in the queue. Narrow
 * screens keep the single column.
 *
 *   node test/layout.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

const b = await chromium.launch();
let bad = 0;
const errs = [];
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const seed = p => p.evaluate(() => {
  S.book = 'track'; B().rules = {};
  const d = ['Seaweed Resto Badung', 'Montana Del Cafe Bangli', 'Gopay-Gojek Jakarta', 'Canva Pty Ltd Sydney', 'Pepito Market'];
  B().tx = d.map((x, i) => normTx({id: 't' + i, date: '2025-07-1' + i, desc: x, amt: -(5 + i), cur: 'AUD', acct: 'card', mk: merchantKey(x)}, true));
  renderAll(); go('sort'); curId = 't1'; renderList();
});

console.log('WIDE:');
{
  const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`${BASE}/local.html`);
  await p.waitForFunction(() => typeof addParsed === 'function');
  await seed(p);
  const idle = await p.evaluate(() => ({
    panes: !!document.querySelector('#rowList.splitmode .sortleft') && !!document.querySelector('#rowList.splitmode .sortright'),
    queue: document.querySelectorAll('.queue .txcard').length,
    cur: document.querySelector('.queue .txcard.qcur')?.dataset.id,
    idle: !!document.querySelector('.sortright .pickidle'),
  }));
  check('two panes', idle.panes);
  check('the whole queue sits under the card', idle.queue === 5, `${idle.queue}`);
  check('the one being answered is highlighted in it', idle.cur === 't1', idle.cur);
  check('before an answer, the right pane says what to do', idle.idle);

  const rightBefore = await p.evaluate(() => { const r = document.querySelector('.sortright').getBoundingClientRect(); return [r.left, r.top]; });
  await p.evaluate(() => setKind('personal'));
  const picking = await p.evaluate(() => {
    const r = document.querySelector('.sortright').getBoundingClientRect();
    const m = document.querySelector('.sortright .pickmenu').getBoundingClientRect();
    return {pos: [r.left, r.top], inRight: !!document.querySelector('.sortright .pickbox.for-sheet'), menuH: m.height};
  });
  check('the list opens in the right pane', picking.inRight);
  check('without moving anything', JSON.stringify(picking.pos) === JSON.stringify(rightBefore), JSON.stringify([rightBefore, picking.pos]));
  check('and gets most of the screen', picking.menuH > 500, `${Math.round(picking.menuH)}px`);

  await p.click('.queue .txcard[data-id="t3"]');
  await p.waitForTimeout(100);
  const moved = await p.evaluate(() => ({cur: curId, hl: document.querySelector('.queue .txcard.qcur')?.dataset.id,
    top: document.querySelector('.sortleft > .txcard.cur')?.dataset.id}));
  check('clicking a row in the queue opens it, and the highlight follows', moved.cur === 't3' && moved.hl === 't3' && moved.top === 't3', JSON.stringify(moved));
}

console.log('\nNARROW:');
{
  const p = await (await b.newContext({viewport: {width: 760, height: 900}})).newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`${BASE}/local.html`);
  await p.waitForFunction(() => typeof addParsed === 'function');
  await seed(p);
  const n = await p.evaluate(() => ({split: document.querySelector('#rowList').classList.contains('splitmode'),
    cards: document.querySelectorAll('#rowList > .txcard').length}));
  check('a narrow window keeps the single column', !n.split && n.cards === 5, JSON.stringify(n));
}

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nthe panes behave');
console.log('PAGE ERRORS:', errs.length ? errs : 'none');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
