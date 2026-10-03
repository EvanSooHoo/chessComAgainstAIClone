import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Color } from 'chess.js';
import { Engine } from '../engine';
import { Board } from '../components/Board';
import { download } from '../exports';
import {
  analyzeGame,
  annotatedPgn,
  originalNotes,
  parsePgn,
  type Analysis,
  type ParsedGame,
} from './model';
import './review.css';

const STORAGE = 'chess-corner-review-v1';
// Review/annotation flow adapted from the sibling project's GameReplay and AnnotationPanel.
export function ReviewWorkspace({ pgn, onClose }: { pgn: string; onClose: () => void }) {
  const [input, setInput] = useState(pgn);
  const [game, setGame] = useState<ParsedGame | null>(() => {
    try {
      return pgn ? parsePgn(pgn) : null;
    } catch {
      return null;
    }
  });
  const [notes, setNotes] = useState<Record<number, string>>(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null');
      if (draft?.pgn === pgn && draft.notes && typeof draft.notes === 'object') return draft.notes;
    } catch {
      /* Storage warning is handled by the saving effect. */
    }
    return pgn ? originalNotes(parsePgn(pgn)) : {};
  });
  const [ply, setPly] = useState(0);
  const [orientation, setOrientation] = useState<Color>('w');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState(500);
  const active = useRef<{ engine: Engine; token: number } | null>(null);
  const generation = useRef(0);
  const chess = useMemo(
    () => new Chess(ply && game ? game.moves[ply - 1].after : game?.initial),
    [game, ply],
  );
  function cancel() {
    generation.current++;
    active.current?.engine.cancel();
    active.current = null;
    setRunning(false);
  }
  useEffect(
    () => () => {
      generation.current++;
      active.current?.engine.cancel();
    },
    [],
  );
  useEffect(() => {
    if (!game) return;
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify({ pgn: game.pgn, notes }));
      setStorageError('');
    } catch {
      setStorageError('Session storage is unavailable or full. Export PGN now to keep your notes.');
    }
  }, [game, notes]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setPly((value) =>
          Math.max(
            0,
            Math.min(game?.moves.length ?? 0, value + (event.key === 'ArrowLeft' ? -1 : 1)),
          ),
        );
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [game]);
  function load(value: string) {
    try {
      const parsed = parsePgn(value);
      cancel();
      setGame(parsed);
      setInput(value);
      let nextNotes = originalNotes(parsed);
      try {
        const draft = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null');
        if (draft?.pgn === value) nextNotes = draft.notes;
      } catch {
        /* Use imported notes. */
      }
      setNotes(nextNotes);
      setPly(0);
      setAnalysis(null);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid PGN.');
    }
  }
  async function analyze() {
    if (!game) return;
    cancel();
    const token = ++generation.current;
    const engine = new Engine();
    active.current = { engine, token };
    setRunning(true);
    setProgress(0);
    setError('');
    setAnalysis(null);
    try {
      const result = await analyzeGame(
        game,
        engine,
        (done) => {
          if (generation.current === token) setProgress(done);
        },
        time,
      );
      if (generation.current === token) setAnalysis(result);
    } catch (cause) {
      if (generation.current === token)
        setError(cause instanceof Error ? cause.message : 'Analysis failed.');
    } finally {
      engine.cancel();
      if (generation.current === token) {
        setRunning(false);
        active.current = null;
      }
    }
  }
  const evaluation = analysis?.positions[ply];
  const move = ply ? game?.moves[ply - 1] : null;
  const review = ply ? analysis?.moves[ply - 1] : null;
  let recommendation = '';
  if (ply && analysis && game) {
    try {
      const best = analysis.positions[ply - 1].bestMove;
      recommendation =
        new Chess(game.moves[ply - 1].before).move({
          from: best.slice(0, 2),
          to: best.slice(2, 4),
          promotion: best[4],
        })?.san ?? '';
    } catch {
      /* Terminal positions have no recommendation. */
    }
  }
  return (
    <main className="review-page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">LEARN FROM EVERY MOVE</div>
          <h1>Game review</h1>
        </div>
        <button className="secondary-button" onClick={onClose}>
          Back to play
        </button>
      </header>
      <p className="review-reminder" role="status">
        Review notes use session storage in this tab. Please export PGN before closing it. Your
        played games still use local storage.
      </p>
      {storageError && <p role="alert">{storageError}</p>}
      <details className="review-import" open={!game || undefined}>
        <summary>Import a PGN / restore review</summary>
        <label>
          PGN game
          <textarea
            aria-label="PGN game"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </label>
        <div className="review-actions">
          <button className="secondary-button" onClick={() => load(input)}>
            Load PGN
          </button>
          <label>
            Open .pgn file{' '}
            <input
              type="file"
              accept=".pgn,text/plain"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                  if (file.size > 2_000_000) {
                    setError('Choose a PGN smaller than 2 MB.');
                    return;
                  }
                  try {
                    load(await file.text());
                  } catch {
                    setError('Could not read this file.');
                  }
                }
              }}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => {
              try {
                const draft = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null');
                if (draft?.pgn) load(draft.pgn);
                else setError('No review draft in this tab.');
              } catch {
                setError('No readable review draft.');
              }
            }}
          >
            Restore last review
          </button>
        </div>
        <p className="small muted">
          Import one game at a time. Mainline moves, headers and comments are supported; variations
          and numeric annotation glyphs are not retained. Export your current notes before loading
          another game.
        </p>
      </details>
      {error && <p role="alert">{error}</p>}
      {game && (
        <>
          <div className="review-actions">
            <button className="primary-button" disabled={running} onClick={() => void analyze()}>
              {analysis ? 'Analyze again' : 'Analyze'}
            </button>
            <select
              aria-label="Analysis depth"
              disabled={running}
              value={time}
              onChange={(event) => setTime(Number(event.target.value))}
            >
              <option value={500}>Standard · 0.5s / position</option>
              <option value={1500}>Deeper · 1.5s / position</option>
            </select>
            {running && (
              <button className="secondary-button" onClick={cancel}>
                Cancel analysis
              </button>
            )}
            <button
              className="secondary-button"
              onClick={() =>
                download(
                  new Blob([annotatedPgn(game, notes)], { type: 'application/x-chess-pgn' }),
                  'chess-review.pgn',
                )
              }
            >
              Export PGN
            </button>
            <span role="status">
              {running
                ? `Analyzing ${progress} / ${game.moves.length + 1} positions…`
                : analysis
                  ? 'Analysis complete'
                  : 'Ready to analyze'}
            </span>
          </div>
          {running && <progress max={game.moves.length + 1} value={progress} />}
          <div className="review-grid">
            <section>
              <h2>
                {game.headers.White || 'White'} vs. {game.headers.Black || 'Black'}
              </h2>
              <p className="muted">
                {game.headers.Event} · {game.headers.Result || '*'}
              </p>
              <div className="board-frame">
                <Board
                  chess={chess}
                  orientation={orientation}
                  playerColor="w"
                  selected={null}
                  canMove={false}
                  legalDots={false}
                  reviewing
                  hint={null}
                  onSelect={() => {}}
                  onMove={() => {}}
                />
              </div>
              <div className="review-actions">
                <button onClick={() => setPly(0)} disabled={!ply} aria-label="First position">
                  |‹
                </button>
                <button
                  onClick={() => setPly(ply - 1)}
                  disabled={!ply}
                  aria-label="Previous position"
                >
                  ‹
                </button>
                <span>
                  {ply} / {game.moves.length}
                </span>
                <button
                  onClick={() => setPly(ply + 1)}
                  disabled={ply === game.moves.length}
                  aria-label="Next position"
                >
                  ›
                </button>
                <button
                  onClick={() => setPly(game.moves.length)}
                  disabled={ply === game.moves.length}
                  aria-label="Last position"
                >
                  ›|
                </button>
                <button onClick={() => setOrientation((value) => (value === 'w' ? 'b' : 'w'))}>
                  Flip board
                </button>
              </div>
              <p>
                {evaluation
                  ? evaluation.mate === 0
                    ? evaluation.cp > 0
                      ? 'White wins by checkmate'
                      : 'Black wins by checkmate'
                    : evaluation.mate !== null
                      ? `${evaluation.cp > 0 ? 'White' : 'Black'} has mate in ${Math.abs(evaluation.mate)}`
                      : `Evaluation: ${evaluation.cp >= 0 ? '+' : ''}${(evaluation.cp / 100).toFixed(2)} pawns (White’s perspective)`
                  : 'Analyze to see the position evaluation.'}
              </p>
            </section>
            <section className="review-panel">
              {analysis && (
                <>
                  <div className="review-scores">
                    <div>
                      White accuracy
                      <strong>
                        {analysis.white === null ? '—' : `${analysis.white.toFixed(1)}%`}
                      </strong>
                    </div>
                    <div>
                      Black accuracy
                      <strong>
                        {analysis.black === null ? '—' : `${analysis.black.toFixed(1)}%`}
                      </strong>
                    </div>
                  </div>
                  <h2>Position advantage</h2>
                  <p className="small muted">
                    Top favors White · bottom favors Black · center is equal.
                  </p>
                  <svg
                    className="advantage-chart"
                    viewBox="0 0 600 180"
                    role="img"
                    aria-label="Position advantage throughout the game"
                  >
                    <rect width="600" height="90" fill="#e0ddd2" />
                    <rect y="90" width="600" height="90" fill="#282c29" />
                    <line x1="0" x2="600" y1="90" y2="90" stroke="#92998d" />
                    <polyline
                      fill="none"
                      stroke="#79b84c"
                      strokeWidth="3"
                      points={analysis.positions
                        .map(
                          (point, i) =>
                            `${(i / Math.max(1, game.moves.length)) * 600},${180 - point.white * 1.8}`,
                        )
                        .join(' ')}
                    />
                    <line
                      x1={(ply / Math.max(1, game.moves.length)) * 600}
                      x2={(ply / Math.max(1, game.moves.length)) * 600}
                      y1="0"
                      y2="180"
                      stroke="#db922a"
                      strokeWidth="3"
                    />
                    {analysis.positions.map((point, i) => (
                      <circle
                        key={i}
                        cx={(i / Math.max(1, game.moves.length)) * 600}
                        cy={180 - point.white * 1.8}
                        r="9"
                        fill="transparent"
                        onClick={() => setPly(i)}
                      >
                        <title>
                          Position {i}: White advantage {point.white.toFixed(1)}%
                        </title>
                      </circle>
                    ))}
                  </svg>
                  <input
                    className="review-slider"
                    type="range"
                    aria-label="Review position"
                    min="0"
                    max={game.moves.length}
                    value={ply}
                    onChange={(event) => setPly(Number(event.target.value))}
                  />
                  <p className="small muted">
                    Estimated advantage, not a prediction of your personal chance of winning.
                  </p>
                </>
              )}
              <div className="review-moves">
                <button aria-pressed={ply === 0} onClick={() => setPly(0)}>
                  Start
                </button>
                {game.moves.map((entry, i) => (
                  <button
                    key={i}
                    aria-pressed={ply === i + 1}
                    onClick={() => setPly(i + 1)}
                    title={analysis?.moves[i].classification}
                  >
                    {entry.before.split(' ')[5]}
                    {entry.color === 'w' ? '.' : '…'} {entry.san}
                    {notes[i + 1] ? ' ✎' : ''}
                    {analysis && (
                      <small className={analysis.moves[i].classification.toLowerCase()}>
                        {analysis.moves[i].classification}
                      </small>
                    )}
                  </button>
                ))}
              </div>
              <div className="review-note">
                <h2>
                  {move
                    ? `${move.color === 'w' ? 'White' : 'Black'} played ${move.san}`
                    : 'Starting position'}{' '}
                  <button
                    aria-label="Edit position note"
                    title="Edit position note"
                    onClick={() => setEditing(!editing)}
                  >
                    ✎
                  </button>
                </h2>
                {review && (
                  <p>
                    {review.classification} · {review.accuracy.toFixed(1)}% move accuracy
                    {recommendation && ` · Engine preferred ${recommendation}`}
                  </p>
                )}
                {editing ? (
                  <label>
                    Position note
                    <textarea
                      aria-label="Position note"
                      value={notes[ply] ?? ''}
                      onChange={(event) =>
                        setNotes((previous) => ({ ...previous, [ply]: event.target.value }))
                      }
                    />
                    <span className="small muted">
                      Saved to this tab as you type. Braces become parentheses in PGN comments.
                    </span>
                    <button className="secondary-button" onClick={() => setEditing(false)}>
                      Done
                    </button>
                  </label>
                ) : (
                  <p className="note-text">
                    {notes[ply] || 'Use the pencil to add your thoughts to this position.'}
                  </p>
                )}
              </div>
            </section>
          </div>
          <details className="review-method">
            <summary>How analysis and accuracy work</summary>
            <p>
              Stockfish 19 Lite evaluates every position, including the final one, at full strength
              with a time limit. Positive pawn scores favor White. The graph converts evaluations to
              a modeled White advantage using the{' '}
              <a href="https://lichess.org/page/accuracy" target="_blank" rel="noreferrer">
                Lichess win-percentage formula
              </a>
              . Move accuracy measures how much that advantage fell for the player who moved. Player
              accuracy is the arithmetic mean of their move accuracies; it is neither Chess.com CAPS
              nor Lichess’s weighted game score. Classes use advantage loss: under 1 Excellent,
              under 3 Good, under 8 Inaccuracy, under 15 Mistake, otherwise Blunder (percentage
              points). These are estimates, not Elo ratings; deeper searches can change them.
              Imported resignation or time-loss results do not override the board evaluation.
            </p>
          </details>
        </>
      )}
    </main>
  );
}
