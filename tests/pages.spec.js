import { test, expect } from '@playwright/test';

test('Maia plays both colors in the Pages build and survives reload', async ({ page }) => {
  test.setTimeout(180000);
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('./');
  for (const color of ['b', 'w']) {
    await page.locator('#new-game').click();
    await page.locator('input[value="maia-1500"]').check();
    await page.locator(`input[name="color"][value="${color}"]`).check();
    await page.locator('#new-form button[type="submit"]').click();
    if (color === 'w') {
      await page.locator('[data-square="e2"]').click();
      await page.locator('[data-square="e4"]').click();
    }
    await expect(page.locator('#engine-label')).toHaveText('Maia 3 · Ready', { timeout: 60000 });
    await expect(page.locator('.move-row button')).toHaveCount(color === 'b' ? 1 : 2);
    await expect(page.locator('#game-status')).toHaveText('Your move');
  }
  await page.reload();
  await expect(page.locator('#opponent-card')).toContainText('Maia');
  await expect(page.locator('.move-row button')).toHaveCount(2);
  await page.locator('#hint').click();
  await expect(page.locator('#game-status')).toContainText('Try ', { timeout: 30000 });
  expect(failures).toEqual([]);
});

test('Pages production build loads assets, runs Stockfish, saves and exports', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('./');
  await expect(page.locator('#engine-label')).toContainText('Ready', { timeout: 30000 });
  await expect(page.locator('.piece')).toHaveCount(32);
  const imageFailures = await page
    .locator('.piece')
    .evaluateAll(
      (images) => images.filter((image) => !image.complete || image.naturalWidth === 0).length,
    );
  expect(imageFailures).toBe(0);
  await expect(page.locator('.brand')).toHaveAttribute('href', '/chessComAgainstAIClone/');
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(page.locator('#game-status')).toHaveText('Your move', { timeout: 15000 });
  await expect(page.locator('.move-row button')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.move-row button')).toHaveCount(2);
  await expect(page.locator('#engine-label')).toContainText('Ready', { timeout: 30000 });
  await page.locator('#export').click();
  const imageDownload = page.waitForEvent('download');
  await page.locator('#export-png').click();
  expect((await imageDownload).suggestedFilename()).toMatch(/\.png$/);
  await page.locator('#export-dialog [data-close]').click();
  await page.screenshot({ path: testInfo.outputPath('pages-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pages-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});
