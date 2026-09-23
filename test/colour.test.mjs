/**
 * The block colours, checked rather than admired.
 *
 * The pick list washes every row in its block's colour so a long list can be
 * scanned. That only works if the text on top of the wash stays readable, in
 * both themes, for all eight hues — and that is exactly the thing a later tweak
 * to a tint percentage breaks without anyone noticing.
 *
 *   node test/colour.test.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';

/* WCAG AA: 4.5:1 for body text, 3:1 for the bolder heading type. */
const FLOOR = {label: 4.5, note: 4.5, heading: 3};

const b = await chromium.launch();
let bad = 0;
const check = (label, ok, extra = '') => { if (!ok) bad++; console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label}${extra ? ' — ' + extra : ''}`); };

for (const mode of ['light', 'dark']) {
  const p = await (await b.newContext({colorScheme: mode})).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`${BASE}/local.html`);
  await p.waitForFunction(() => typeof addParsed === 'function');

  const res = await p.evaluate(() => {
    /* Resolve whatever colour syntax the browser returns — color-mix()
       serialises as oklab()/color(), which no regex should be parsing. Painting
       it and reading the pixel back is the only honest way to get sRGB. */
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const cx = cv.getContext('2d', {willReadFrequently: true});
    const solve = css => {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, 1, 1);      // rows sit on an opaque surface
      cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
    };
    const srgb = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = v => 0.2126 * srgb(v[0]) + 0.7152 * srgb(v[1]) + 0.0722 * srgb(v[2]);
    const ratio = (x, y) => { const a = lum(x), c = lum(y); const [hi, lo] = a > c ? [a, c] : [c, a]; return (hi + 0.05) / (lo + 0.05); };

    const seen = {label: [], note: [], heading: []}, slots = new Set();
    for (const kind of ['business', 'personal']) {
      S.book = 'track';
      B().tx = [normTx({id: 'x', date: '2026-07-02', desc: 'x', amt: -57.29, cur: 'AUD', acct: 'a', mk: 'X'})];
      renderAll(); go('sort'); curId = 'x'; setKind(kind); renderList();
      for (const o of document.querySelectorAll('.pickopt')) {
        const bg = solve(getComputedStyle(o).backgroundColor);
        slots.add(getComputedStyle(o).borderLeftColor);
        seen.label.push(ratio(bg, solve(getComputedStyle(o.querySelector('.nm')).color)));
        const n = o.querySelector('.note');
        if (n) seen.note.push(ratio(bg, solve(getComputedStyle(n).color)));
      }
      for (const h of document.querySelectorAll('.pickhead')) {
        const cs = getComputedStyle(h);
        seen.heading.push(ratio(solve(cs.backgroundColor), solve(cs.color)));
      }
    }
    return {
      worst: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, Math.min(...v)])),
      counted: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length])),
      distinctRails: slots.size,
    };
  });

  console.log(`\n${mode.toUpperCase()} — text on the block wash:`);
  for (const [k, floor] of Object.entries(FLOOR)) {
    const got = res.worst[k];
    check(`${k} (${res.counted[k]} measured)`, got >= floor, `worst ${got.toFixed(2)}:1, floor ${floor}:1`);
  }
  check('the selected row is reachable and distinct', res.distinctRails >= 5, `${res.distinctRails} distinct rails`);
  if (errs.length) { bad++; console.log('  BAD  page errors:', errs); }
}

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nevery block colour is readable in both themes');
await b.close();
process.exit(bad ? 1 : 0);
