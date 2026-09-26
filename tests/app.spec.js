import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';
import fs from 'node:fs/promises';

const square = (page, name) => page.locator(`[data-square="${name}"]`);
async function move(page, from, to) { await square(page, from).click(); await square(page, to).click(); }
async function waitReady(page) { await expect(page.locator('#engine-label')).toContainText('Ready', { timeout: 30000 }); }
async function currentRecord(page) { return page.evaluate(()=>{ const d=JSON.parse(localStorage.getItem('chess-corner-games-v1')); return d.games.find(g=>g.id===d.current); }); }

test('real Stockfish responds legally, autosaves, restores, hints, takebacks, exports and review', async ({ page }) => {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/'); await waitReady(page);
  await expect(page.locator('.piece')).toHaveCount(32);
  await move(page,'e2','e5'); await expect(page.locator('.move-row')).toHaveCount(0);
  await square(page,'e2').click();
  await move(page,'e2','e4');
  await expect(page.locator('#game-status')).toHaveText('Your move',{timeout:15000});
  const saved = await currentRecord(page); expect(saved.moves).toHaveLength(2);
  const replay = new Chess(); saved.moves.forEach(m=>replay.move(m));
  await page.reload(); await waitReady(page); expect((await currentRecord(page)).moves).toEqual(saved.moves);
  await page.locator('#hint').click(); await expect(page.locator('#game-status')).toContainText('Try ',{timeout:15000});
  await expect(page.locator('.hint-square')).toHaveCount(2);
  await page.locator('#first-move').click(); await expect(square(page,'e2').locator('img')).toHaveCount(1);
  await expect(page.locator('#history-label')).toContainText('Review');
  await page.locator('#last-move').click(); await expect(square(page,'e4').locator('img')).toHaveCount(1);
  await page.locator('#export').click();
  const pgnDownload = page.waitForEvent('download'); await page.locator('#export-pgn').click();
  const pgn = await pgnDownload; const text = await fs.readFile(await pgn.path(),'utf8');
  const exported=new Chess(); exported.loadPgn(text); expect(exported.fen()).toEqual(replay.fen());
  const imageDownload=page.waitForEvent('download'); await page.locator('#export-png').click();
  const image=await imageDownload; const png=await fs.readFile(await image.path());
  expect(png.subarray(1,4).toString()).toBe('PNG'); expect(png.readUInt32BE(16)).toBe(1000);
  await page.locator('#export-dialog [data-close]').click();
  await page.locator('#undo').click(); await expect(page.locator('.move-row')).toHaveCount(0);
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('all six difficulty settings play as white while human is black; saved games resume', async ({ page }) => {
  await page.goto('/'); await waitReady(page);
  let firstId;
  for (const level of ['beginner','casual','club','advanced','expert','master']) {
    await page.locator('#new-game').click();
    await page.locator(`input[name="level"][value="${level}"]`).check();
    await page.locator('input[name="color"][value="b"]').check();
    await page.locator('#new-form button[type="submit"]').click();
    await expect(page.locator('#game-status')).toHaveText('Your move',{timeout:20000});
    const record=await currentRecord(page); expect(record.level).toBe(level); expect(record.moves).toHaveLength(1);
    const replay = new Chess(); replay.move(record.moves[0]);
    expect(await page.locator('.square').first().getAttribute('data-square')).toBe('h1');
    firstId ||= record.id;
  }
  await page.locator('#saved-tab').click(); await page.locator(`[data-game-id="${firstId}"]`).click();
  await expect(page.locator('#opponent-card h2')).toHaveText('Sprout');
  await expect(page.locator('#game-status')).toHaveText('Your move');
});

test('new game cancels stale engine reply; resign persists; mobile has no horizontal overflow', async ({ page }) => {
  await page.goto('/'); await waitReady(page);
  await page.locator('#new-game').click(); await page.locator('input[value="master"]').check();
  await page.locator('#new-form button[type="submit"]').click();
  await move(page,'e2','e4'); await page.locator('#undo').click();
  await expect(page.locator('#game-status')).toHaveText('Your move');
  await page.waitForTimeout(3200); expect((await currentRecord(page)).moves).toHaveLength(0);
  await page.locator('#resign').click(); await page.locator('#confirm-resign').click();
  await expect(page.locator('#game-status')).toContainText('wins');
  await page.reload(); await expect(page.locator('#status-detail')).toContainText('Resignation');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});

test('promotion selector uses the chosen piece and restores the move', async ({ page }) => {
  // A legal sequence from the starting position reaches a promotion without a test-only app API.
  await page.addInitScript(()=>{
    const record={version:1,id:'promotion-test',createdAt:'2026-09-22T10:00:00Z',updatedAt:'2026-09-22T10:00:00Z',color:'w',level:'beginner',ended:null,result:'*',moves:['a4','h5','a5','h4','a6','h3','axb7','hxg2']};
    localStorage.setItem('chess-corner-games-v1',JSON.stringify({current:record.id,games:[record]}));
  });
  await page.goto('/'); await waitReady(page);
  await move(page,'b7','a8');
  await expect(page.locator('#promotion-dialog')).toBeVisible();
  await page.getByRole('button',{name:'Promote to knight'}).click();
  await expect(square(page,'a8').locator('img')).toHaveAttribute('src','/pieces/wN.svg');
  expect((await currentRecord(page)).moves[8]).toBe('bxa8=N');
});
