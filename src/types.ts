import type { Color, PieceSymbol, Square } from 'chess.js';

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

export interface Hint extends MoveInput {
  san: string;
}
export type Busy = '' | 'hint' | 'move';
export type EngineStatus = 'loading' | 'ready' | 'error';
export type DialogName = 'new' | 'library' | 'export' | 'promotion' | 'resign' | 'help';

export interface Level {
  id: string;
  name: string;
  label: string;
  skill: number;
  depth: number;
  time: number;
  icon: string;
  color: string;
  description: string;
}

export interface Outcome {
  result: '1-0' | '0-1' | '1/2-1/2';
  reason: string;
}

export interface SavedGame {
  version: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  color: Color;
  level: string;
  moves: string[];
  ended: Outcome | null;
  result: Outcome['result'] | '*';
}

export interface Library {
  current: string | null;
  games: SavedGame[];
}
export type GameStorage = Pick<Storage, 'getItem' | 'setItem'>;
