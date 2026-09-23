/**
 * Renders the sort screen in its three states (fresh, mid-answer, worked
 * through) in light and dark, at 2x, into screenshots/. Both themes must be
 * checked - the palette is token-driven and it is easy to leave a colour
 * defined only inside one media block.
 *
 *   node test/screenshots.mjs
 */
import {chromium} from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8899/build';
import {mkdirSync} from 'fs';
mkdirSync('screenshots', {recursive:true});
const b=await chromium.launch();
const csv=`Date,Description,Amount,Currency
05/07/2026,EVENTBRITE TICKET SALES GIVE IT ALL,2340.00,AUD
06/07/2026,WARUNG GROCERIES CANGGU,-450000,IDR
09/07/2026,ADOBE CREATIVE CLOUD,-89.99,USD
14/07/2026,GYM MEMBERSHIP CANGGU,-1500000,IDR
20/07/2026,GARUDA INDONESIA DPS-SYD,-6850000,IDR
02/08/2026,TRANSFER TO SAVINGS,-2000.00,AUD
03/08/2026,ADOBE CREATIVE CLOUD,-89.99,USD
09/08/2026,BRIAN MCCAFFERTY COACHING PAYMENT,1500.00,AUD
15/08/2026,WARUNG GROCERIES CANGGU,-380000,IDR
22/08/2026,MICKY EDITING INVOICE 4402,-654.00,AUD`;
for(const scheme of ['light','dark']){
  const ctx=await b.newContext({colorScheme:scheme,viewport:{width:1200,height:1000},deviceScaleFactor:2});
  const p=await ctx.newPage();
  await p.goto(BASE+'/local.html'); await p.waitForTimeout(500);
  await p.fill('#impAcct','Wise multi-currency'); await p.fill('#impText',csv);
  await p.click('#btnParse'); await p.waitForTimeout(250); await p.click('#btnAdd'); await p.waitForTimeout(400);
  // untouched first card
  await p.screenshot({path:`screenshots/sort-fresh-${scheme}.png`});
  // business mid-answer: category chosen, asking for the line
  await p.keyboard.press('b'); await p.waitForTimeout(250);
  await p.fill('#pickInput','event ticket'); await p.waitForTimeout(150);
  await p.keyboard.press('Enter'); await p.waitForTimeout(350);
  await p.screenshot({path:`screenshots/sort-line-${scheme}.png`});
  await p.fill('#pickInput','tickets'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
  // personal
  await p.keyboard.press('p'); await p.waitForTimeout(250);
  await p.screenshot({path:`screenshots/sort-personal-${scheme}.png`});
  await p.fill('#pickInput','groceries'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  // work through a few so the done states show
  await p.keyboard.press('b'); await p.waitForTimeout(200);
  await p.fill('#pickInput','software'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  await p.fill('#pickInput','adobe'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
  await p.keyboard.press('p'); await p.waitForTimeout(200);
  await p.fill('#pickInput','gym'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
  await p.click('#filterChips .chip[data-f="all"]'); await p.waitForTimeout(400);
  await p.screenshot({path:`screenshots/sort-mixed-${scheme}.png`,fullPage:true});
  await ctx.close();
}
await b.close(); console.log('ok');
