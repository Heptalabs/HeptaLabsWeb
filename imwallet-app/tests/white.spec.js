const path = require('node:path');
const { test } = require('@playwright/test');

test('debug white screen', async ({ page }) => {
  page.on('console', (msg) => {
    console.log(`[console:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.log(`[pageerror] ${err && err.stack ? err.stack : err}`);
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure();
    console.log(`[requestfailed] ${req.url()} :: ${failure ? failure.errorText : 'unknown'}`);
  });

  await page.goto('http://localhost:8081', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? -1);
  console.log(`[rootChildren] ${rootChildren}`);
  await page.screenshot({ path: path.resolve(process.cwd(), '.tmp_pw_white_screen_debug.png'), fullPage: true });
});
