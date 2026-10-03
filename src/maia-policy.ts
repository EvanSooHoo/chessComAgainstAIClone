import { Chess } from 'chess.js';

// Maia 3's published input format: side-to-move first, a1..h8, P N B R Q K.
export function maiaInput(chess: Chess) {
  const black = chess.turn() === 'b';
  const tokens = new Float32Array(64 * 12);
  for (const row of chess.board()) for (const piece of row) {
    if (!piece) continue;
    const file = piece.square.charCodeAt(0) - 97;
    const rank = Number(piece.square[1]) - 1;
    const square = (black ? 7 - rank : rank) * 8 + file;
    const channel = 'pnbrqk'.indexOf(piece.type) + (piece.color === chess.turn() ? 0 : 6);
    tokens[square * 12 + channel] = 1;
  }
  const moves = chess.moves({ verbose: true }).map(move => {
    const square = (s: string) => (black ? 8 - Number(s[1]) : Number(s[1]) - 1) * 8 + s.charCodeAt(0) - 97;
    const from = square(move.from), to = square(move.to);
    const index = move.promotion
      ? 4096 + (from % 8) * 32 + (to % 8) * 4 + 'qrbn'.indexOf(move.promotion)
      : from * 64 + to;
    return { uci: move.from + move.to + (move.promotion || ''), index };
  });
  return { tokens, moves };
}

export function sampleMaiaMove(moves: ReturnType<typeof maiaInput>['moves'], logits: ArrayLike<number>, random = Math.random) {
  if (!moves.length) throw new Error('Maia has no legal moves.');
  const scores = moves.map(move => Number(logits[move.index]));
  if (scores.some(score => !Number.isFinite(score))) throw new Error('Maia returned invalid move probabilities.');
  const max = Math.max(...scores);
  const weights = scores.map(score => Math.exp(score - max));
  let target = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < moves.length; i++) {
    target -= weights[i];
    if (target < 0) return moves[i].uci;
  }
  return moves[moves.length - 1].uci;
}
