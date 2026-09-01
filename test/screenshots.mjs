/**
 * Renders all three stages in light and dark, at 2x, into screenshots/.
 * Both themes must be checked - the palette is token-driven and it is easy to
 * leave a colour defined only inside one media block.
 *
 *   node test/screenshots.mjs
 */
import {chromium} from 'playwright';
import {mkdirSync} from 'fs';

const BASE = process.env.BASE || 'http://localhost:8899/build';
mkdirSync('screenshots', {recursive: true});
const b = await chromium.launch();

const csv = `Date,Description,Amount,Currency
01/07/2025,STRIPE PAYOUT COACHING CLIENT,4500.00,AUD
03/07/2025,CANVA PTY LTD SUBSCRIPTION,-21.99,AUD
09/07/2025,GARUDA INDONESIA DPS-SYD,-6850000,IDR
15/09/2025,SEWA VILLA CANGGU EVENT SPACE,-25000000,IDR
15/09/2025,ZOOM VIDEO COMMUNICATIONS,-21.99,USD
02/10/2025,META PLATFORMS ADS,-880.00,AUD
04/01/2026,AIRBNB BALI RETREAT VENUE,-8500000,IDR
14/02/2026,WARUNG DINNER WITH CLIENT,-1250000,IDR
20/03/2026,APPLE STORE MACBOOK PRO,-3499.00,AUD
02/04/2026,EVENTBRITE TICKET SALES GIVE IT ALL,2340.00,AUD
12/05/2026,CANVA PTY LTD SUBSCRIPTION,-21.99,AUD
30/06/2026,SPEAKING FEE CORPORATE OFFSITE,1200.00,USD`;

for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({colorScheme: scheme, viewport: {width: 1440, height: 960}, deviceScaleFactor: 2});
  const p = await ctx.newPage();
  await p.goto(BASE + '/local.html');
  await p.waitForTimeout(400);
  await p.fill('#impAcct', 'Wise multi-currency');
  await p.fill('#impText', csv);
  await p.click('#btnParse');
  await p.waitForTimeout(250);
  await p.screenshot({path: `screenshots/import-${scheme}.png`, fullPage: true});
  await p.click('#btnAdd');
  await p.waitForTimeout(300);
  for (const t of ['coaching client','software subs','airfare','venue hire','software subs','advertising','venue hire','meals entertainment','equipment 300','event ticket']) {
    await p.click('#catSearch'); await p.fill('#catSearch', t);
    await p.waitForTimeout(90); await p.keyboard.press('Enter'); await p.waitForTimeout(110);
  }
  await p.fill('#catSearch', '');
  await p.click('#filterChips .chip[data-f="all"]');
  await p.waitForTimeout(250);
  await p.screenshot({path: `screenshots/sort-${scheme}.png`});
  await p.click('.stage[data-pane="report"]');
  await p.waitForTimeout(400);
  await p.screenshot({path: `screenshots/report-${scheme}.png`, fullPage: true});
  await ctx.close();
  console.log('captured', scheme);
}
await b.close();
