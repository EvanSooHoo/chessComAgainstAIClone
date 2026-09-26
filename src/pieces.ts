import type { Color, PieceSymbol } from 'chess.js';

export const pieceNames: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

export function pieceSrc(piece: { color: Color; type: PieceSymbol }) {
  return `/pieces/${piece.color}${piece.type.toUpperCase()}.svg`;
}
