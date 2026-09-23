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
      B().tx = [
        normTx({id: 'x', date: '2026-07-02', desc: 'x', amt: -57.29, cur: 'AUD', acct: 'a', mk: 'X'}),
        normTx({id: 'y', date: '2026-07-03', desc: 'y', amt: -12.03, cur: 'IDR', acct: 'a', mk: 'Y'}),
      ];
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
    /* The row being answered sits on an accent wash. Everything printed on it —
       the description, the account, the rate note, the FY warning — has to
       survive that, and a tint nudge is exactly what would break it. */
    const card = document.querySelector('.txcard.cur');
    /* What a piece of text actually sits on is the nearest ancestor that paints
       a background — not the card. Compare against the card and a white label on
       the selected blue button reads as 1.18:1, which is a bug in the ruler, not
       the page. */
    const behind = el => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return solve(c);
      }
      return solve(getComputedStyle(document.body).backgroundColor);
    };
    const onCard = [];
    for (const sel of ['.line1 .desc', '.line1 .d', '.amt .aud', '.line2 .acct', '.fx', '.kindbtn b', '.kindbtn span']) {
      for (const el of card.querySelectorAll(sel)) {
        onCard.push({sel, r: ratio(behind(el), solve(getComputedStyle(el).color))});
      }
    }
    return {
      worst: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, Math.min(...v)])),
      counted: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length])),
      distinctRails: slots.size,
      card: {worst: Math.min(...onCard.map(o => o.r)), n: onCard.length,
             where: onCard.sort((a, b) => a.r - b.r)[0].sel},
      lifted: getComputedStyle(card).backgroundColor !== getComputedStyle(document.querySelector('.txcard:not(.cur)')).backgroundColor,
    };
  });

  console.log(`\n${mode.toUpperCase()} — text on the block wash:`);
  for (const [k, floor] of Object.entries(FLOOR)) {
    const got = res.worst[k];
    check(`${k} (${res.counted[k]} measured)`, got >= floor, `worst ${got.toFixed(2)}:1, floor ${floor}:1`);
  }
  check('the selected row is reachable and distinct', res.distinctRails >= 5, `${res.distinctRails} distinct rails`);
  check('the row being answered is a different colour from the rest', res.lifted);
  check(`text on it stays readable (${res.card.n} measured)`, res.card.worst >= 4.5,
    `worst ${res.card.worst.toFixed(2)}:1 on ${res.card.where}`);
  if (errs.length) { bad++; console.log('  BAD  page errors:', errs); }
}

console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nevery block colour is readable in both themes');
await b.close();
process.exit(bad ? 1 : 0);
