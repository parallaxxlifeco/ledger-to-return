/**
 * "?" — the web search for a merchant loads in the right-hand pane, beside the
 * row, instead of a new tab. Google (embeddable mode) or Bing; Esc or Close
 * puts the list back, and so does answering. On a narrow screen, where there
 * is no right pane, it still opens a tab.
 *
 *   node test/who.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const ctx = await b.newContext({viewport: {width: 1440, height: 900}});
// No real searches from a test: both engines answer with a stub page.
await ctx.route(/(google|bing)\.com\/search/, r => r.fulfill({status: 200, contentType: 'text/html', body: '<p>stub results</p>'}));
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
let tabs = 0; ctx.on('page', () => tabs++);
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof whoPanel === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

await p.evaluate(() => {
  S.book = 'track'; B().rules = {}; S.lineFor = {};
  const mk = (id, desc, d) => normTx({id, date: '2025-08-0' + d, desc, amt: -10 * d, cur: 'AUD', acct: 'card', mk: merchantKey(desc)}, true);
  B().tx = [mk('a', 'Paypal *Merc Lounge 35314369001 Badung', 1), mk('b', 'Warung Sushi', 2)];
  renderAll(); go('sort'); curId = 'a'; renderList();
});
check('no search pane to begin with', await p.evaluate(() => !document.querySelector('.whopane')));

await p.click('.qcur [data-who]');
await p.waitForTimeout(100);
let st = await p.evaluate(() => ({pane: !!document.querySelector('.sortright .whopane'),
  src: (document.querySelector('iframe.whoframe') || {}).src || '', on: !!document.querySelector('.qcur a.whois.on')}));
check('? opens the search in the right pane', st.pane, st.src);
check('Google, embeddable, with the cleaned name', /google\.com\/search\?igu=1&q=Merc%20Lounge%20Badung$/.test(st.src), st.src);
check('the ? shows as on', st.on);
check('no new tab', tabs === 0);

await p.click('[data-who-eng="bing"]');
st = await p.evaluate(() => (document.querySelector('iframe.whoframe') || {}).src || '');
check('Bing switch', /bing\.com\/search\?q=Merc%20Lounge%20Badung$/.test(st), st);

await p.keyboard.press('Escape');
st = await p.evaluate(() => ({pane: !!document.querySelector('.whopane'), idle: !!document.querySelector('.sortright .pickidle')}));
check('Esc closes it and the placeholder is back', !st.pane && st.idle, JSON.stringify(st));

await p.click('.qcur [data-who]');
await p.click('[data-who-close]');
check('Close button closes it', await p.evaluate(() => !document.querySelector('.whopane')));

await p.click('.qcur [data-who]');
await p.keyboard.press('b');
await p.waitForTimeout(100);
st = await p.evaluate(() => ({pane: !!document.querySelector('.whopane'), list: !!document.querySelector('.sortright .pickbox'), kind: B().tx[0].kind}));
check('answering Business closes it and the list opens', !st.pane && st.list && st.kind === 'business', JSON.stringify(st));

await p.click('.qcur [data-who]');
await p.keyboard.press('ArrowDown');
await p.waitForTimeout(100);
st = await p.evaluate(() => ({pane: !!document.querySelector('.whopane'), cur: curId}));
check('moving to the next row closes it', !st.pane, JSON.stringify(st));

// Narrow: one column, so a tab.
await p.setViewportSize({width: 700, height: 900});
await p.waitForTimeout(150);
await p.evaluate(() => { curId = 'a'; resetPick(); renderList(); });
const pop = p.waitForEvent('popup', {timeout: 3000}).catch(() => null);
await p.click('.txcard.cur [data-who]');
const tab = await pop;
check('narrow screen: opens a new tab', !!tab && /google\.com\/search\?q=Merc/.test(tab.url()), tab && tab.url());
check('and no pane', await p.evaluate(() => !document.querySelector('.whopane')));

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
