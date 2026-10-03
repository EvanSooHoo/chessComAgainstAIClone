import { useEffect, useRef, useState } from 'react';
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { Engine } from './engine';
import { MaiaEngine } from './maia';
import { MoveAudio } from './audio';
import { Session, LEVELS, levelFor, readLibrary, saveSession } from './session';
import type { Busy, EngineStatus, Hint, MoveInput, SavedGame } from './types';

function loadSession() {
  try {
    const library = readLibrary();
    const record = library.games.find((game) => game.id === library.current);
    return record ? Session.restore(record) : new Session();
  } catch {
    return new Session();
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

/** Owns game actions and side effects; components only display state and call actions. */
export function useGame() {
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState(loadSession);
  const [selected, setSelected] = useState<Square | null>(null);
  const [orientation, setOrientation] = useState<Color>(session.color);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [promotion, setPromotion] = useState<MoveInput | null>(null);
  const [busy, setBusy] = useState<Busy>('');
  const [engineState, setEngineState] = useState<EngineStatus>('loading');
  const [maiaState, setMaiaState] = useState<EngineStatus>('loading');
  const [engineError, setEngineError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [games, setGames] = useState<SavedGame[]>([]);
  const [sound, setSound] = useState(false);
  const [legalDots, setLegalDots] = useState(true);
  const [notice, setNotice] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [engine] = useState(() => new Engine(setEngineState));
  const [maia] = useState(() => new MaiaEngine(setMaiaState));
  const [audio] = useState(() => new MoveAudio());
  // Refs protect asynchronous replies and keep audio preference current during a search.
  const generation = useRef(0);
  const searching = useRef(false);
  const soundEnabled = useRef(false);

  function persist(current: Session) {
    try {
      setGames(saveSession(current));
      setStorageError('');
    } catch {
      setStorageError('Browser storage is unavailable or full. Export PGN to keep this game.');
    }
  }

  function cancelSearch() {
    generation.current++;
    engine.cancel();
    maia.cancel();
    searching.current = false;
    setBusy('');
    setEngineError('');
  }

  function playSound(capture = false) {
    if (soundEnabled.current) audio.play(capture);
  }

  // A fresh Session object makes game changes visible to React. The rules and
  // saved-game format remain in the original Session class, not in JSX.
  function copySession() {
    return Session.restore(session.record());
  }

  function commit(next: Session) {
    setSession(next);
  }

  async function requestEngine(asHint = false) {
    if (paused) return;
    if (searching.current || session.outcome) return;
    if (!asHint && session.chess.turn() === session.color) return;
    const token = generation.current;
    searching.current = true;
    setBusy(asHint ? 'hint' : 'move');
    setEngineError('');
    try {
      const level = levelFor(session.level);
      const uci = !asHint && level.engine === 'maia'
        ? await maia.bestMove(session.chess, level.elo!)
        : await engine.bestMove(
        session.chess,
        asHint ? LEVELS[4] : levelFor(session.level),
      );
      if (token !== generation.current) return;
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
        throw new Error('The engine did not return a move. Please retry.');
      }
      const move: MoveInput = { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
      if (uci[4]) move.promotion = uci[4] as PieceSymbol;
      if (asHint) {
        const checked = new Chess(session.chess.fen()).move(move);
        setHint({ ...move, san: checked.san });
      } else {
        const next = copySession();
        const result = next.move(move);
        if (!result) throw new Error('The engine returned an invalid move. Please retry.');
        playSound(Boolean(result.captured));
        commit(next);
      }
    } catch (error) {
      if (
        token === generation.current &&
        !(error instanceof Error && error.name === 'AbortError')
      ) {
        setEngineError(errorMessage(error));
      }
    } finally {
      if (token === generation.current) {
        searching.current = false;
        setBusy('');
      }
    }
  }

  useEffect(() => {
    let active = true;
    void engine.init().catch((error) => {
      if (active && !(error instanceof Error && error.name === 'AbortError'))
        setEngineError(errorMessage(error));
    });
    return () => {
      active = false;
      generation.current++;
      searching.current = false;
      engine.cancel();
      maia.cancel();
      audio.dispose();
    };
  }, [engine, audio]);

  useEffect(() => {
    persist(session);
    void requestEngine();
    const beforeUnload = () => {
      try {
        saveSession(session);
      } catch {
        /* In-page saving already reports errors. */
      }
      engine.cancel();
      maia.cancel();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
    // Search only when the actual game changes or Retry is requested, not on UI changes.
  }, [session, retryCount, paused]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const canMove =
    viewPly === null && !busy && !session.outcome && session.chess.turn() === session.color;
  let displayedChess = session.chess;
  if (viewPly !== null) {
    displayedChess = new Chess();
    for (const move of session.chess.history().slice(0, viewPly)) displayedChess.move(move);
  }

  function resetSelection() {
    setSelected(null);
    setHint(null);
    setViewPly(null);
    setPromotion(null);
  }

  function makeMove(from: Square, to: Square, promote?: PieceSymbol) {
    if (!canMove || searching.current) return;
    const candidates = session.chess
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to);
    if (!candidates.length) return;
    if (candidates.some((move) => move.promotion) && !promote) {
      setPromotion({ from, to });
      return;
    }
    const next = copySession();
    const result = next.move({ from, to, promotion: promote });
    if (!result) return;
    resetSelection();
    playSound(Boolean(result.captured));
    commit(next);
  }

  function selectSquare(square: Square) {
    if (!canMove) return;
    if (selected === square) setSelected(null);
    else if (session.chess.get(square)?.color === session.color) setSelected(square);
    else if (selected) makeMove(selected, square);
  }

  function review(ply: number) {
    const length = session.chess.history().length;
    setViewPly(ply >= length ? null : Math.max(0, ply));
    setSelected(null);
  }

  function startGame(color: Color, level: string) {
    persist(session);
    cancelSearch();
    resetSelection();
    setOrientation(color);
    commit(new Session({ color, level }));
  }

  function resumeGame(id: string) {
    try {
      const next = Session.restore(readLibrary().games.find((game) => game.id === id));
      persist(session);
      cancelSearch();
      resetSelection();
      setOrientation(next.color);
      commit(next);
      return true;
    } catch {
      setNotice('This saved game could not be opened.');
      return false;
    }
  }

  function undo() {
    cancelSearch();
    const next = copySession();
    next.undoTurn();
    resetSelection();
    commit(next);
  }

  function resign() {
    cancelSearch();
    const next = copySession();
    next.resign();
    resetSelection();
    commit(next);
  }

  function toggleSound() {
    soundEnabled.current = !soundEnabled.current;
    setSound(soundEnabled.current);
    setNotice(soundEnabled.current ? 'Move sounds on' : 'Move sounds off');
    playSound();
  }

  function refreshLibrary() {
    try {
      setGames(readLibrary().games);
    } catch {
      setGames([]);
      setNotice('Saved games could not be loaded.');
    }
  }

  function retryEngine() {
    cancelSearch();
    const token = generation.current;
    const opponent = levelFor(session.level).engine === 'maia' ? maia : engine;
    void opponent.init().catch((error) => {
      if (
        token === generation.current &&
        !(error instanceof Error && error.name === 'AbortError')
      ) {
        setEngineError(errorMessage(error));
      }
    });
    setRetryCount((count) => count + 1);
  }

  return {
    pause: () => {
      cancelSearch();
      setPaused(true);
    },
    unpause: () => setPaused(false),
    session,
    displayedChess,
    selected,
    orientation,
    viewPly,
    hint,
    promotion,
    busy,
    engineState: levelFor(session.level).engine === 'maia' && busy !== 'hint' ? maiaState : engineState,
    engineError,
    storageError,
    games,
    sound,
    legalDots,
    notice,
    canMove,
    selectSquare,
    makeMove,
    review,
    startGame,
    resumeGame,
    undo,
    resign,
    toggleSound,
    refreshLibrary,
    retryEngine,
    setLegalDots,
    setNotice,
    cancelPromotion: () => setPromotion(null),
    flip: () => setOrientation((color) => (color === 'w' ? 'b' : 'w')),
    requestHint: () => {
      if (canMove) void requestEngine(true);
    },
  };
}

export type GameController = ReturnType<typeof useGame>;
