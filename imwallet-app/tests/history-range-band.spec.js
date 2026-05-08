const { test } = require('@playwright/test');

test('capture history range modal', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('http://localhost:8081', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  // Home quick action '기록'
  const historyBtn = page.getByRole('button', { name: '기록' }).first();
  if (await historyBtn.isVisible().catch(() => false)) {
    await historyBtn.click();
  } else {
    // fallback approximate click on history quick action
    await page.mouse.click(670, 352);
  }

  await page.waitForTimeout(1200);

  const rangeBtn = page.getByRole('button', { name: '기간' }).first();
  if (await rangeBtn.isVisible().catch(() => false)) {
    await rangeBtn.click();
  } else {
    await page.mouse.click(728, 336);
  }

  await page.waitForTimeout(900);
  await page.screenshot({ path: '/tmp/imwallet-history-range-current.png', fullPage: true });
});
