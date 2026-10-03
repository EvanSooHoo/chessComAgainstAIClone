import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { analyzeGame, annotatedPgn, originalNotes, parsePgn, scoreMove, winPercent } from '../src/review/model.ts';
import type { Engine } from '../src/engine.ts';
const evaluation = (cp: number) => ({ cp, mate: null, white: winPercent(cp), depth: 10, bestMove: 'e2e4' });
test('accuracy penalizes the moving player, not alternating score perspectives', () => {
  assert.ok(scoreMove(evaluation(0), evaluation(-300), 'w').accuracy < 50);
  assert.ok(scoreMove(evaluation(0), evaluation(300), 'b').accuracy < 50);
  assert.ok(scoreMove(evaluation(0), evaluation(300), 'w').accuracy > 99.9);
});
test('PGN notes and setup headers survive export, including black starting move', () => {
  const game = parsePgn('[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n[Result "*"]\n\n1... e5 {original note} 2. Nf3 *');
  const notes = originalNotes(game);
  assert.equal(notes[1], 'original note');
  notes[2] = 'Develop knight {with tempo}';
  const pgn = annotatedPgn(game, notes);
  assert.match(pgn, /1\.\.\. e5/);
  const restored = new Chess(); restored.loadPgn(pgn);
  assert.equal(restored.history().length, 2);
  assert.equal(restored.getComment(), 'Develop knight (with tempo)');
});
test('analysis evaluates initial and final positions, normalizes Black scores and handles mate', async () => {
  const game = parsePgn('1. f3 e5 2. g4 Qh4# 0-1');
  const turns: string[] = [];
  const engine = { evaluate: async (chess: Chess) => { turns.push(chess.turn()); return { cp: 100, mate: null, depth: 12, bestMove: '' }; } } as unknown as Engine;
  const progress: number[] = [];
  const result = await analyzeGame(game, engine, done => progress.push(done));
  assert.equal(result.positions.length, 5);
  assert.equal(result.positions[1].cp, -100);
  assert.equal(result.positions[4].white, 0);
  assert.equal(result.positions[4].mate, 0);
  assert.deepEqual(turns, ['w', 'b', 'w', 'b']);
  assert.deepEqual(progress, [1, 2, 3, 4, 5]);
});

test('finished positions have exact White win percentages without an engine search', async () => {
  const engine = { evaluate: async () => { throw new Error('Finished games need no search'); } } as unknown as Engine;
  for (const [fen, expected] of [
    ['7k/6Q1/5K2/8/8/8/8/8 b - - 0 1', 100],
    ['7K/6q1/5k2/8/8/8/8/8 w - - 0 1', 0],
    ['7k/5Q2/5K2/8/8/8/8/8 b - - 0 1', 50],
  ] as const) {
    const game = parsePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n*`);
    const result = await analyzeGame(game, engine, () => {});
    assert.equal(result.positions[0].white, expected);
  }
});
