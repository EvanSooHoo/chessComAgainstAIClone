import { useRef, useState } from 'react';
import { useGame } from './useGame';
import { levelFor } from './session';
import type { DialogName } from './types';
import { Board } from './components/Board';
import { PlayerStrip } from './components/PlayerStrip';
import { GamePanel } from './components/GamePanel';
import { GameDialogs } from './components/GameDialogs';
import { Icon } from './components/Icon';

/** Page layout. Game behavior lives in useGame; each component owns its markup. */
export function App() {
  const game = useGame();
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const boardFrame = useRef<HTMLDivElement>(null);
  const bot = levelFor(game.session.level);
  const soundLabel = game.sound ? 'Turn sound off' : 'Turn sound on';
  let caption = 'Click or drag a piece to make your move.';
  if (game.viewPly !== null) caption = 'Review mode · use the arrows to explore your game.';
  else if (game.session.outcome)
    caption = `${game.session.outcome.reason} · Game saved for review.`;

  function openDialog(name: DialogName) {
    if (name === 'library') game.refreshLibrary();
    setDialog(name);
  }

  function showBoard() {
    boardFrame.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  return (
    <>
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="Chess Corner home">
          <img src="/favicon.svg" alt="" />
          <span>
            chess<span className="brand-second">corner</span>
          </span>
        </a>
        <div className="nav-label">YOUR CHESS SPACE</div>
        <nav aria-label="Main navigation">
          <button className="nav-item active" id="nav-play" onClick={showBoard}>
            <Icon name="play" />
            <span>Play computer</span>
          </button>
          <button className="nav-item" id="nav-library" onClick={() => openDialog('library')}>
            <Icon name="folder" />
            <span>My games</span>
            <span className="nav-count" id="game-count">
              {game.games.length}
            </span>
          </button>
          <button className="nav-item" id="nav-help" onClick={() => openDialog('help')}>
            <Icon name="help" />
            <span>How to play</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge">
            <span className="online-dot" />
            No account. Just chess.
          </div>
          <p>Your games stay in this browser.</p>
          <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener">
            Open-source credits ↗
          </a>
        </div>
      </aside>
      <main>
        <header className="page-heading">
          <div>
            <div className="eyebrow">A LITTLE FOCUS. A GOOD CHALLENGE.</div>
            <h1>Play the computer</h1>
          </div>
          <div className={`save-state${game.storageError ? ' save-error' : ''}`} id="save-state">
            <Icon name="check" />
            <span>
              {game.storageError ? 'Not saved — export a backup' : 'Saved on this device'}
            </span>
          </div>
        </header>
        <div className="workspace">
          <section className="board-column" aria-label="Chess game">
            <PlayerStrip
              id="top-player"
              color={game.orientation === 'w' ? 'b' : 'w'}
              playerColor={game.session.color}
              bot={bot}
              chess={game.displayedChess}
            />
            <div className="board-frame" ref={boardFrame}>
              <Board
                chess={game.displayedChess}
                orientation={game.orientation}
                playerColor={game.session.color}
                selected={game.selected}
                canMove={game.canMove}
                legalDots={game.legalDots}
                reviewing={game.viewPly !== null}
                hint={game.hint}
                onSelect={game.selectSquare}
                onMove={game.makeMove}
              />
            </div>
            <PlayerStrip
              id="bottom-player"
              color={game.orientation}
              playerColor={game.session.color}
              bot={bot}
              chess={game.displayedChess}
            />
            <div className="board-footer">
              <span id="board-caption">{caption}</span>
              <div>
                <button
                  className="icon-button"
                  id="flip"
                  title="Flip board"
                  aria-label="Flip board"
                  onClick={game.flip}
                >
                  <Icon name="flip" />
                </button>
                <button
                  className="icon-button"
                  id="sound"
                  title={soundLabel}
                  aria-label={soundLabel}
                  aria-pressed={game.sound}
                  onClick={game.toggleSound}
                >
                  <Icon name="volume" />
                </button>
              </div>
            </div>
            <div className="notice" id="storage-warning" role="status" hidden={!game.storageError}>
              {game.storageError}
            </div>
          </section>
          <GamePanel game={game} onOpenDialog={openDialog} onShowBoard={showBoard} />
        </div>
        <footer className="page-footer">
          <span>Find your next good move.</span>
          <label>
            <input
              type="checkbox"
              id="legal-dots"
              checked={game.legalDots}
              onChange={(event) => game.setLegalDots(event.target.checked)}
            />{' '}
            Show legal moves
          </label>
        </footer>
      </main>
      <GameDialogs name={dialog} game={game} onClose={() => setDialog(null)} />
      <div id="toast" role="status" className={game.notice ? 'visible' : ''}>
        {game.notice}
      </div>
    </>
  );
}
