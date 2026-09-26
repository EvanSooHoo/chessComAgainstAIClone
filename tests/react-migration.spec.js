import { test, expect } from '@playwright/test';

const square = (page, name) => page.locator(`[data-square="${name}"]`);
const ready = (page) =>
  expect(page.locator('#engine-label')).toContainText('Ready', { timeout: 30000 });
const record = (page) =>
  page.evaluate(() => {
    const library = JSON.parse(localStorage.getItem('chess-corner-games-v1'));
    return library.games.find((game) => game.id === library.current);
  });

test('keyboard and drag moves, board controls, and native modal focus survive React rendering', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  await square(page, 'e2').focus();
  await page.keyboard.press('Enter');
  await expect(square(page, 'e2')).toBeFocused();
  await expect(page.locator('.legal-mark')).toHaveCount(2);
  await page.locator('#legal-dots').uncheck();
  await expect(page.locator('.legal-mark')).toHaveCount(0);
  await page.locator('#legal-dots').check();
  await square(page, 'e4').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#game-status')).toHaveText('Your move');
  expect((await record(page)).moves[0]).toBe('e4');

  await page.locator('#undo').click();
  await square(page, 'd2').dragTo(square(page, 'd4'));
  await expect(page.locator('#game-status')).toHaveText('Your move');
  expect((await record(page)).moves[0]).toBe('d4');
  await page.locator('#flip').click();
  await expect(page.locator('.square').first()).toHaveAttribute('data-square', 'h1');
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#new-game').click();
  await expect(page.locator('#new-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#new-dialog')).toHaveCount(0);
  await expect(page.locator('#new-game')).toBeFocused();
  expect(errors).toEqual([]);
});

test('clipboard denial shows selectable FEN and storage failure still permits play and export', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError');
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Denied')) },
    });
  });
  await page.goto('/');
  await ready(page);
  await expect(page.locator('#storage-warning')).toBeVisible();
  await square(page, 'e2').click();
  await square(page, 'e4').click();
  await expect(page.locator('#game-status')).toHaveText('Your move');
  await expect(page.locator('.move-row')).toHaveCount(1);
  await page.locator('#export').click();
  await page.locator('#copy-fen').click();
  await expect(page.locator('#fen-field')).toBeVisible();
  await expect(page.locator('#fen-field')).toHaveValue(/ w /);
  const download = page.waitForEvent('download');
  await page.locator('#export-pgn').click();
  expect((await download).suggestedFilename()).toMatch(/\.pgn$/);
});

test('engine load failure can be retried without reloading the game', async ({ page }) => {
  await page.route('**/engine/*.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#retry-engine')).toBeVisible();
  await page.unroute('**/engine/*.js');
  await page.locator('#retry-engine').click();
  await ready(page);
  await expect(page.locator('#retry-engine')).toBeHidden();
  await square(page, 'e2').click();
  await square(page, 'e4').click();
  await expect(page.locator('#game-status')).toHaveText('Your move');
  expect((await record(page)).moves).toHaveLength(2);
});

test('new game and Strict Mode restoration never accept a reply from an old game', async ({
  page,
}) => {
  await page.goto('/');
  await ready(page);
  await page.locator('#new-game').click();
  await page.locator('input[value="master"]').check();
  await page.locator('#new-form button[type="submit"]').click();
  await square(page, 'e2').click();
  await square(page, 'e4').click();
  const previousId = (await record(page)).id;
  await page.locator('#new-game').click();
  await page.locator('input[value="beginner"]').check();
  await page.locator('#new-form button[type="submit"]').click();
  await page.waitForTimeout(3200);
  expect((await record(page)).id).not.toBe(previousId);
  expect((await record(page)).moves).toEqual([]);
  await page.locator('#saved-tab').click();
  await page.locator(`[data-game-id="${previousId}"]`).click();
  // Reload while the resumed computer turn is still being calculated.
  await page.reload();
  await ready(page);
  await expect(page.locator('#game-status')).toHaveText('Your move', { timeout: 15000 });
  expect((await record(page)).id).toBe(previousId);
  expect((await record(page)).moves).toHaveLength(2);
});
