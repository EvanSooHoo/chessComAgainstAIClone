import { LEVELS, levelFor } from '../session';
import type { GameController } from '../useGame';
import type { DialogName } from '../types';
import { gameStatus } from '../status';
import { Icon } from './Icon';
import { MoveHistory } from './MoveHistory';
import { avatarStyle } from './PlayerStrip';

interface GamePanelProps {
  game: GameController;
  onOpenDialog: (dialog: DialogName) => void;
  onShowBoard: () => void;
}

export function GamePanel({ game, onOpenDialog, onShowBoard }: GamePanelProps) {
  const { session, busy, viewPly, engineState } = game;
  const bot = levelFor(session.level);
  const levelIndex = LEVELS.indexOf(bot);
  const status = gameStatus(game);
  const moves = session.chess.history();
  let badge = 'NO CLOCK';
  if (session.outcome) badge = 'FINISHED';
  else if (busy) badge = 'THINKING';
  else if (viewPly !== null) badge = 'REVIEW';
  let engineLabel = 'Stockfish 19 · Ready';
  if (bot.engine === 'maia' && busy !== 'hint') engineLabel = engineState === 'ready' ? 'Maia 3 · Ready' : 'Maia 3 · Loads on her turn';
  if (engineState === 'loading') engineLabel = 'Loading Stockfish…';
  if (engineState === 'loading' && bot.engine === 'maia' && busy !== 'hint') engineLabel = busy === 'move' ? 'Loading Maia 3…' : 'Maia 3 · Loads on her turn';
  else if (engineState === 'error') engineLabel = 'Engine unavailable';

  return (
    <section className="game-panel" aria-label="Game controls">
      <div className="panel-tabs">
        <button className="panel-tab active" id="play-tab" onClick={onShowBoard}>
          <Icon name="play" /> Play
        </button>
        <button className="panel-tab" id="saved-tab" onClick={() => onOpenDialog('library')}>
          <Icon name="folder" /> Saved games
        </button>
      </div>
      <div className="opponent-card" id="opponent-card">
        <div className="opponent-top">
          <div className="bot-portrait" style={avatarStyle(bot.color)}>
            {bot.icon}
            <span className="portrait-spark">✦</span>
          </div>
          <div>
            <div className="eyebrow">YOUR OPPONENT</div>
            <h2>{bot.name}</h2>
            <div className="difficulty">
              <span>{bot.label}</span>
              {bot.engine !== 'maia' && <span className="difficulty-bars" aria-label={`Difficulty ${levelIndex + 1} of 6`}>
                {LEVELS.filter(level => !level.engine).map((level, index) => (
                  <i key={level.id} className={index <= levelIndex ? 'filled' : ''} />
                ))}
              </span>}
            </div>
          </div>
          <button
            className="text-button change-opponent"
            id="change-opponent"
            onClick={() => onOpenDialog('new')}
          >
            Change
          </button>
        </div>
        <p className="bot-description">{bot.description}</p>
      </div>
      <div className="status-card">
        <div className="status-top">
          <span className={`turn-dot${busy ? ' thinking' : ''}`} id="turn-dot" />
          <h2 id="game-status" aria-live="polite">
            {status.title}
          </h2>
          <span className="turn-badge" id="turn-badge">
            {badge}
          </span>
        </div>
        <p id="status-detail">{status.detail}</p>
        <button
          id="retry-engine"
          className="text-button"
          hidden={!game.engineError}
          onClick={game.retryEngine}
        >
          Retry engine
        </button>
      </div>
      <MoveHistory moves={moves} viewPly={viewPly} onReview={game.review} />
      <div className="game-actions">
        <button id="undo" disabled={!moves.length} onClick={game.undo}>
          <Icon name="undo" />
          <span>Take back</span>
        </button>
        <button id="hint" disabled={!game.canMove} onClick={game.requestHint}>
          <Icon name="hint" />
          <span>Hint</span>
        </button>
        <button id="export" onClick={() => onOpenDialog('export')}>
          <Icon name="download" />
          <span>Export</span>
        </button>
        <button
          id="resign"
          disabled={Boolean(session.outcome)}
          onClick={() => onOpenDialog('resign')}
        >
          <Icon name="flag" />
          <span>Resign</span>
        </button>
      </div>
      <div className="panel-bottom">
        <button className="primary-button" id="new-game" onClick={() => onOpenDialog('new')}>
          New game <Icon name="play" />
        </button>
        <p>
          <span
            className={`online-dot${engineState !== 'ready' ? ' offline' : ''}`}
            id="engine-dot"
          />
          <span id="engine-label">{engineLabel}</span>
          <span className="separator">·</span>Unlimited time
        </p>
      </div>
    </section>
  );
}
