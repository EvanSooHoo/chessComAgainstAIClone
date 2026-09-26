import { Chess, type Color } from 'chess.js';
import type { GameStorage, Level, Library, MoveInput, Outcome, SavedGame } from './types';

export const LEVELS: Level[] = [
  {
    id: 'beginner',
    name: 'Sprout',
    label: 'Beginner',
    skill: 0,
    depth: 1,
    time: 120,
    icon: '🌱',
    color: '#88a85a',
    description: 'A gentle place to start. Take your time, try ideas, and find your rhythm.',
  },
  {
    id: 'casual',
    name: 'Scout',
    label: 'Casual',
    skill: 2,
    depth: 3,
    time: 220,
    icon: '🦊',
    color: '#c08956',
    description: 'A curious sparring partner. Keep your pieces safe and watch for opportunities.',
  },
  {
    id: 'club',
    name: 'Sage',
    label: 'Club player',
    skill: 6,
    depth: 7,
    time: 500,
    icon: '🦉',
    color: '#8b82ac',
    description:
      'Patient, perceptive, and ready to put your plans to the test. Your next good game starts here.',
  },
  {
    id: 'advanced',
    name: 'Summit',
    label: 'Advanced',
    skill: 11,
    depth: 11,
    time: 850,
    icon: '🏔️',
    color: '#669aab',
    description: 'A steeper climb. Look a little further ahead and make every move count.',
  },
  {
    id: 'expert',
    name: 'Ember',
    label: 'Expert',
    skill: 17,
    depth: 16,
    time: 1600,
    icon: '🔥',
    color: '#bc705c',
    description: 'A sharp opponent with little room for error. Bring your best calculation.',
  },
  {
    id: 'master',
    name: 'Obsidian',
    label: 'Master',
    skill: 20,
    depth: 22,
    time: 2800,
    icon: '💎',
    color: '#777e9b',
    description:
      'Stockfish at full skill with a longer search. A serious challenge, one move at a time.',
  },
];
export const levelFor = (id: string) => LEVELS.find((l) => l.id === id) || LEVELS[2];

export function gameOutcome(chess: Chess): Outcome | null {
  if (chess.isCheckmate())
    return { result: chess.turn() === 'w' ? '0-1' : '1-0', reason: 'Checkmate' };
  if (chess.isStalemate()) return { result: '1/2-1/2', reason: 'Stalemate' };
  if (chess.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'Insufficient material' };
  if (chess.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'Threefold repetition' };
  if (chess.isDrawByFiftyMoves()) return { result: '1/2-1/2', reason: 'Fifty-move rule' };
  return null;
}

export class Session {
  id: string;
  createdAt: string;
  color: Color;
  level: string;
  chess: Chess;
  ended: Outcome | null;
  constructor({
    color = 'w',
    level = 'club',
    id,
    createdAt,
  }: { color?: Color; level?: string; id?: string; createdAt?: string } = {}) {
    this.id = id || crypto.randomUUID();
    this.createdAt = createdAt || new Date().toISOString();
    this.color = color === 'b' ? 'b' : 'w';
    this.level = levelFor(level).id;
    this.chess = new Chess();
    this.ended = null;
    this.updateHeaders();
  }
  updateHeaders() {
    const bot = `${levelFor(this.level).name} (Stockfish, ${levelFor(this.level).label})`;
    this.chess.header(
      'Event',
      'Chess Corner practice',
      'Site',
      'Local',
      'Date',
      this.createdAt.slice(0, 10).replaceAll('-', '.'),
      'Round',
      '-',
      'White',
      this.color === 'w' ? 'You' : bot,
      'Black',
      this.color === 'b' ? 'You' : bot,
      'Result',
      this.outcome?.result || '*',
    );
  }
  get outcome() {
    return this.ended || gameOutcome(this.chess);
  }
  move(move: string | MoveInput) {
    if (this.outcome) return null;
    try {
      const result = this.chess.move(move);
      this.updateHeaders();
      return result;
    } catch {
      return null;
    }
  }
  undoTurn() {
    if (!this.chess.history().length) return false;
    this.ended = null;
    this.chess.undo();
    if (this.chess.turn() !== this.color && this.chess.history().length) this.chess.undo();
    this.updateHeaders();
    return true;
  }
  resign() {
    if (!this.outcome)
      this.ended = { result: this.color === 'w' ? '0-1' : '1-0', reason: 'Resignation' };
    this.updateHeaders();
  }
  record(): SavedGame {
    return {
      version: 1,
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
      color: this.color,
      level: this.level,
      moves: this.chess.history(),
      ended: this.ended,
      result: this.outcome?.result || '*',
    };
  }
  pgn() {
    this.updateHeaders();
    return this.chess.pgn({ maxWidth: 80 });
  }
  static restore(record: SavedGame | undefined) {
    if (
      record?.version !== 1 ||
      !Array.isArray(record.moves) ||
      record.moves.length > 3000 ||
      typeof record.id !== 'string' ||
      !['w', 'b'].includes(record.color) ||
      !Number.isFinite(Date.parse(record.createdAt))
    )
      throw new Error('Invalid saved game');
    const session = new Session(record);
    for (const move of record.moves) {
      if (typeof move !== 'string' || !session.move(move))
        throw new Error('Invalid move in saved game');
    }
    if (record.ended) {
      if (
        record.ended.reason !== 'Resignation' ||
        record.ended.result !== (record.color === 'w' ? '0-1' : '1-0')
      )
        throw new Error('Invalid result');
      session.ended = record.ended;
    }
    session.updateHeaders();
    return session;
  }
}

export const STORAGE_KEY = 'chess-corner-games-v1';
export function readLibrary(storage: GameStorage = localStorage): Library {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { current: null, games: [] };
  const data: Library = JSON.parse(raw);
  if (!Array.isArray(data.games)) throw new Error('Saved-game library is invalid');
  return data;
}
export function saveSession(session: Session, storage: GameStorage = localStorage) {
  const library = readLibrary(storage);
  const record = session.record();
  const games = [record, ...library.games.filter((g) => g.id !== record.id)];
  storage.setItem(STORAGE_KEY, JSON.stringify({ current: session.id, games }));
  return games;
}
