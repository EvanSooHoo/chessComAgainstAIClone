// Adapted from chess-outcome-review-game-intelligence's pgnParser and stockfishService.
// Positions use White's perspective consistently; accuracy uses win-percentage loss.
import { Chess, type Color } from 'chess.js';
import type { Engine } from '../engine';

export function parsePgn(pgn: string) {
  if (!pgn.trim()) throw new Error('Paste a PGN game first.');
  const chess = new Chess();
  chess.loadPgn(pgn);
  const moves = chess.history({ verbose: true });
  return { pgn, headers: chess.getHeaders(), moves, initial: moves[0]?.before ?? chess.fen() };
}
export type ParsedGame = ReturnType<typeof parsePgn>;
export interface Evaluation {
  cp: number;
  mate: number | null;
  white: number;
  bestMove: string;
  depth: number;
}
export interface MoveReview {
  accuracy: number;
  loss: number;
  classification: string;
}
export interface Analysis {
  positions: Evaluation[];
  moves: MoveReview[];
  white: number | null;
  black: number | null;
}
export const winPercent = (cp: number) => 100 / (1 + Math.exp(-0.00368208 * cp));
export function scoreMove(before: Evaluation, after: Evaluation, color: Color): MoveReview {
  const loss = Math.max(0, (before.white - after.white) * (color === 'w' ? 1 : -1));
  const accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
  const classification =
    loss < 1
      ? 'Excellent'
      : loss < 3
        ? 'Good'
        : loss < 8
          ? 'Inaccuracy'
          : loss < 15
            ? 'Mistake'
            : 'Blunder';
  return { loss, accuracy, classification };
}
export async function analyzeGame(
  game: ParsedGame,
  engine: Engine,
  progress: (done: number) => void,
  time = 500,
): Promise<Analysis> {
  const chess = new Chess(game.initial);
  const positions: Evaluation[] = [];
  for (let ply = 0; ply <= game.moves.length; ply++) {
    if (ply) chess.move(game.moves[ply - 1].san);
    const sign = chess.turn() === 'w' ? 1 : -1;
    if (chess.isGameOver()) {
      const cp = chess.isCheckmate() ? -sign * 100000 : 0;
      positions.push({
        cp,
        mate: chess.isCheckmate() ? 0 : null,
        // Finished games have exact outcomes, not estimated winning chances.
        white: chess.isCheckmate() ? (chess.turn() === 'w' ? 0 : 100) : 50,
        bestMove: '',
        depth: 0,
      });
    } else {
      const raw = await engine.evaluate(chess, time);
      const cp = raw.cp !== null ? raw.cp * sign : (raw.mate! > 0 ? 1 : -1) * sign * 100000;
      positions.push({
        cp,
        mate: raw.mate === null ? null : raw.mate * sign,
        white: winPercent(cp),
        bestMove: raw.bestMove,
        depth: raw.depth,
      });
    }
    progress(ply + 1);
  }
  const moves = game.moves.map((move, i) => scoreMove(positions[i], positions[i + 1], move.color));
  const average = (color: Color) => {
    const scores = moves.filter((_, i) => game.moves[i].color === color);
    return scores.length
      ? scores.reduce((sum, move) => sum + move.accuracy, 0) / scores.length
      : null;
  };
  return { positions, moves, white: average('w'), black: average('b') };
}
export function originalNotes(game: ParsedGame): Record<number, string> {
  const chess = new Chess();
  chess.loadPgn(game.pgn);
  const comments = new Map(chess.getComments().map(({ fen, comment }) => [fen, comment]));
  return Object.fromEntries(
    [game.initial, ...game.moves.map((move) => move.after)].map((fen, ply) => [
      ply,
      comments.get(fen) ?? '',
    ]),
  );
}
/** Emit comments per ply, including repeated positions (chess.js stores comments by FEN). */
export function annotatedPgn(game: ParsedGame, notes: Record<number, string>) {
  const header = Object.entries(game.headers)
    .map(([key, value]) => `[${key} "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`)
    .join('\n');
  const comment = (ply: number) =>
    notes[ply]?.trim() ? `{${notes[ply].replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'))}}` : '';
  const tokens = [comment(0)];
  game.moves.forEach((move, i) => {
    const number = move.before.split(' ')[5];
    if (move.color === 'w') tokens.push(`${number}.`);
    else if (i === 0) tokens.push(`${number}...`);
    tokens.push(move.san, comment(i + 1));
  });
  tokens.push(game.headers.Result ?? '*');
  return `${header}\n\n${tokens.filter(Boolean).join(' ')}\n`;
}
