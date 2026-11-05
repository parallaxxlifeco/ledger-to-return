/**
 * Drive: a bar across the top whenever this tab isn't saving to Drive (or a
 * save to Drive failed), and on connect, this browser and Drive are put in
 * step without losing either side — nothing unsaved here → take Drive; Drive
 * unchanged since → send this browser's; both changed → ask, and keep the
 * other one as a dated snapshot. Uses a stand-in for Drive.
 *
 *   node test/drivesync.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
const b = await chromium.launch();
const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/local.html`);
await p.waitForFunction(() => typeof reconcile === 'function');
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

const banner = await p.evaluate(() => { renderStorage(); const e = document.querySelector('#driveBanner'); return {shown: !e.hidden, txt: e.innerText.replace(/\s+/g, ' ')}; });
check('not on Drive: the bar is up with a Connect button', banner.shown && /Not saving to Google Drive.*Connect Google Drive/.test(banner.txt), JSON.stringify(banner));
check('no pop-up on a dev host (tests)', await p.evaluate(() => !document.querySelector('#driveAsk').open));

// a stand-in Drive
await p.evaluate(() => {
  window.FAKE = {saved: [], snaps: [], fail: false};
  window.fakeStore = () => ({mode: 'drive', name: 'Google Drive', connected: true,
    async load() { return null; },
    async save(st) { if (FAKE.fail) throw new Error('401'); const at = 'T' + (FAKE.saved.length + 1); FAKE.saved.push({at, n: st.books.track.tx.length}); return at; },
    async snapshot(st, label) { FAKE.snaps.push({label, n: st.books.track.tx.length}); return 'snap'; }});
  const row = (id, kind) => normTx({id, date: '2026-06-01', desc: 'Row ' + id, amt: -10, cur: 'AUD', acct: 'card', mk: 'ROW', kind, tax: kind === 'personal' ? 'x_personal' : null}, true);
  window.mkState = (ids, kind) => { const st = JSON.parse(JSON.stringify(S)); st.books.track.tx = ids.map(i => row(i, kind)); return st; };
  S.book = 'track';
});

// 1. nothing unsaved here → take Drive
let r = await p.evaluate(async () => {
  localStorage.setItem('l2r.sync', JSON.stringify({at: 'D1', pending: false}));
  B().tx = mkState(['a'], null).books.track.tx;
  Store = fakeStore();
  const remote = {...mkState(['a', 'b'], 'personal'), savedAt: 'D2'};
  const how = await reconcile(remote);
  return {how, n: B().tx.length, sync: JSON.parse(localStorage.getItem('l2r.sync'))};
});
check('nothing unsaved here: Drive\'s version is taken', r.how === 'loaded' && r.n === 2 && r.sync.at === 'D2' && r.sync.pending === false, JSON.stringify(r));

// 2. changes here, Drive unchanged since → send this browser's
r = await p.evaluate(async () => {
  localStorage.setItem('l2r.sync', JSON.stringify({at: 'D2', pending: true}));
  B().tx = mkState(['a', 'b'], 'personal').books.track.tx; B().tx[0].kind = null;   // an answer changed, same row count
  FAKE.saved = [];
  const remote = {...mkState(['a', 'b'], 'personal'), savedAt: 'D2'};
  const how = await reconcile(remote);
  return {how, saved: FAKE.saved, kind: B().tx[0].kind, sync: JSON.parse(localStorage.getItem('l2r.sync'))};
});
check('changes here, Drive unchanged: this browser\'s version goes up — even with the same row count', r.how === 'pushed' && r.saved.length === 1 && r.kind === null && r.sync.pending === false, JSON.stringify(r));

// 3. both changed → ask; OK keeps this browser's, Drive's kept as a snapshot
r = await p.evaluate(async () => {
  localStorage.setItem('l2r.sync', JSON.stringify({at: 'D2', pending: true}));
  B().tx = mkState(['a'], null).books.track.tx;
  FAKE.saved = []; FAKE.snaps = [];
  let asked = ''; window.confirm = m => { asked = m; return true; };
  const how = await reconcile({...mkState(['a', 'b', 'c'], 'personal'), savedAt: 'D3'});
  return {how, asked: /different versions/.test(asked), snaps: FAKE.snaps, saved: FAKE.saved.length, n: B().tx.length};
});
check('both changed: asked, and OK keeps this browser\'s', r.how === 'kept-local' && r.asked && r.saved === 1 && r.n === 1, JSON.stringify(r));
check('Drive\'s version kept as a dated snapshot', r.snaps.length === 1 && r.snaps[0].n === 3 && /Drive copy/.test(r.snaps[0].label), JSON.stringify(r.snaps));

// 4. both changed, Cancel → Drive's version, this browser's kept as a snapshot
r = await p.evaluate(async () => {
  localStorage.setItem('l2r.sync', JSON.stringify({at: 'D2', pending: true}));
  B().tx = mkState(['a'], null).books.track.tx;
  FAKE.snaps = []; window.confirm = () => false;
  const how = await reconcile({...mkState(['a', 'b', 'c'], 'personal'), savedAt: 'D3'});
  return {how, snaps: FAKE.snaps, n: B().tx.length};
});
check('Cancel: Drive\'s version is used, this browser\'s kept as a snapshot', r.how === 'kept-drive' && r.n === 3 && r.snaps.length === 1 && r.snaps[0].n === 1, JSON.stringify(r));

// 5. no record yet (first time on this version) → asked, not silently replaced
r = await p.evaluate(async () => {
  localStorage.removeItem('l2r.sync');
  B().tx = mkState(['a'], null).books.track.tx;
  let asked = false; window.confirm = () => { asked = true; return true; };
  const how = await reconcile({...mkState(['a', 'b'], 'personal'), savedAt: 'D9'});
  return {how, asked};
});
check('no record yet: asked rather than replaced', r.asked && r.how === 'kept-local', JSON.stringify(r));

// 6. identical → nothing to do
r = await p.evaluate(async () => {
  const st = mkState(['a'], 'personal'); B().tx = JSON.parse(JSON.stringify(st.books.track.tx)); S.books.tax = st.books.tax;
  let asked = false; window.confirm = () => { asked = true; return true; };
  return {how: await reconcile({...st, savedAt: 'D10'}), asked};
});
check('identical: nothing asked', r.how === 'same' && !r.asked, JSON.stringify(r));

// 7. saving: in step when it works; a failed save puts the bar back up
r = await p.evaluate(async () => {
  FAKE.fail = false; await persist();
  const ok = {sync: JSON.parse(localStorage.getItem('l2r.sync')), bar: !document.querySelector('#driveBanner').hidden};
  FAKE.fail = true; await persist();
  const e = document.querySelector('#driveBanner');
  return {ok, failSync: JSON.parse(localStorage.getItem('l2r.sync')), bar: !e.hidden, txt: e.innerText.replace(/\s+/g, ' ')};
});
check('a save to Drive marks this browser in step, and the bar goes', r.ok.sync.pending === false && !r.ok.bar, JSON.stringify(r.ok));
check('a failed save marks changes unsaved and puts up Reconnect', r.failSync.pending === true && r.bar && /Drive stopped saving.*Reconnect/.test(r.txt), JSON.stringify(r));

check('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
