import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { Session, gameOutcome, saveSession, readLibrary } from '../src/session.ts';

test('legal moves, illegal moves and exact PGN/saved-game round trip', () => {
  const game = new Session({ color: 'b', level: 'expert' });
  assert.equal(game.move({ from: 'e2', to: 'e5' }), null);
  for (const move of ['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6','O-O']) assert.ok(game.move(move));
  assert.equal(game.chess.get('g1').type, 'k');
  const restored = Session.restore(JSON.parse(JSON.stringify(game.record())));
  assert.equal(restored.chess.fen(), game.chess.fen());
  assert.equal(restored.color, 'b');
  assert.equal(restored.level, 'expert');
  const replay = new Chess(); replay.loadPgn(game.pgn());
  assert.equal(replay.fen(), game.chess.fen());
});
test('takeback removes human turn plus engine response; also works during thinking', () => {
  const game = new Session(); game.move('e4'); game.move('e5');
  assert.equal(game.undoTurn(), true); assert.equal(game.chess.history().length, 0);
  game.move('d4'); game.undoTurn(); assert.equal(game.chess.history().length, 0);
  const black = new Session({ color: 'b' }); ['e4','e5','Nf3'].forEach(m => black.move(m));
  black.undoTurn(); assert.deepEqual(black.chess.history(), ['e4']); assert.equal(black.chess.turn(), 'b');
});
test('resignation survives save and exports correct result, takeback reopens game', () => {
  const game = new Session(); game.move('e4'); game.move('e5'); game.resign();
  assert.equal(Session.restore(game.record()).outcome.result, '0-1');
  assert.match(game.pgn(), /\[Result "0-1"\]/);
  assert.equal(game.move('Nf3'), null);
  game.undoTurn(); assert.equal(game.outcome, null); assert.match(game.pgn(), /\[Result "\*"\]/);
});
test('checkmate, stalemate, material and repetition endings', () => {
  const mate = new Session(); ['f3','e5','g4','Qh4#'].forEach(m => mate.move(m));
  assert.deepEqual(mate.outcome, { result:'0-1',reason:'Checkmate' });
  assert.equal(gameOutcome(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).reason, 'Stalemate');
  assert.equal(gameOutcome(new Chess('7k/8/6K1/8/8/8/8/8 w - - 0 1')).reason, 'Insufficient material');
  const repetition = new Session(); ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8'].forEach(m=>repetition.move(m));
  assert.equal(Session.restore(repetition.record()).outcome.reason,'Threefold repetition');
  assert.equal(gameOutcome(new Chess('7k/8/6K1/8/8/8/8/R7 w - - 100 80')).reason,'Fifty-move rule');
});
test('en passant and all four promotion choices', () => {
  const game = new Session(); ['e4','a6','e5','d5','exd6'].forEach(m=>assert.ok(game.move(m)));
  assert.equal(game.chess.get('d5'), undefined); assert.equal(game.chess.get('d6').color,'w');
  for (const promotion of ['q','r','b','n']) {
    const chess = new Chess('7k/P7/6K1/8/8/8/8/8 w - - 0 1');
    chess.move({from:'a7',to:'a8',promotion}); assert.equal(chess.get('a8').type,promotion);
  }
});
test('saving updates current game and preserves other games without duplicates', () => {
  const store = new Map(); const storage = { getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v) };
  const first = new Session(); saveSession(first,storage); first.move('e4'); saveSession(first,storage);
  const second = new Session(); saveSession(second,storage);
  const library = readLibrary(storage); assert.equal(library.games.length,2); assert.equal(library.current,second.id);
  assert.deepEqual(library.games[1].moves,['e4']);
});
test('invalid saves rejected instead of partially replayed', () => {
  const data = new Session().record(); data.moves = ['e4','Qa9'];
  assert.throws(()=>Session.restore(data));
});
