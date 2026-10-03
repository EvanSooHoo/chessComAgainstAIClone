import { useEffect, useRef, useState } from 'react';
import type { Color, PieceSymbol } from 'chess.js';
import { LEVELS, levelFor, Session } from '../session';
import type { GameController } from '../useGame';
import type { DialogName } from '../types';
import { pieceNames, pieceSrc } from '../pieces';
import { boardImage, download, exportName } from '../exports';
import { Dialog, CloseButton } from './Dialog';
import { Icon } from './Icon';
import { avatarStyle } from './PlayerStrip';

interface GameDialogsProps {
  name: DialogName | null;
  game: GameController;
  onClose: () => void;
  onReview: (pgn: string) => void;
}

export function GameDialogs({ name, game, onClose, onReview }: GameDialogsProps) {
  if (game.promotion) return <PromotionDialog game={game} />;
  switch (name) {
    case 'new':
      return <NewGameDialog game={game} onClose={onClose} />;
    case 'library':
      return <LibraryDialog game={game} onClose={onClose} onReview={onReview} />;
    case 'export':
      return <ExportDialog game={game} onClose={onClose} />;
    case 'help':
      return <HelpDialog onClose={onClose} />;
    case 'resign':
      return (
        <Dialog id="resign-dialog" titleId="resign-title" onClose={onClose}>
          <h2 id="resign-title">Resign this game?</h2>
          <p className="muted">The computer wins. Your game will stay saved for review.</p>
          <div className="dialog-actions">
            <button className="secondary-button" data-close onClick={onClose}>
              Keep playing
            </button>
            <button
              className="danger-button"
              id="confirm-resign"
              onClick={() => {
                game.resign();
                onClose();
              }}
            >
              Resign game
            </button>
          </div>
        </Dialog>
      );
    default:
      return null;
  }
}

function NewGameDialog({ game, onClose }: { game: GameController; onClose: () => void }) {
  const [level, setLevel] = useState(game.session.level);
  const [color, setColor] = useState<Color | 'random'>(game.session.color);

  return (
    <Dialog id="new-dialog" titleId="new-title" onClose={onClose}>
      <form
        id="new-form"
        onSubmit={(event) => {
          event.preventDefault();
          let chosenColor: Color;
          if (color === 'random') chosenColor = Math.random() < 0.5 ? 'w' : 'b';
          else chosenColor = color;
          game.startGame(chosenColor, level);
          onClose();
        }}
      >
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">YOUR NEXT CHALLENGE</div>
            <h2 id="new-title">Choose your opponent</h2>
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <p className="muted">Stockfish challenges or human-like Maia. Your pace. No clock.</p>
        <div className="opponent-grid" id="opponent-grid">
          {LEVELS.map((bot) => (
            <label className="opponent-option" key={bot.id}>
              <input
                type="radio"
                name="level"
                value={bot.id}
                checked={level === bot.id}
                onChange={() => setLevel(bot.id)}
              />
              <span className="opponent-option-body">
                <span className="mini-portrait" style={avatarStyle(bot.color)}>
                  {bot.icon}
                </span>
                <strong>{bot.name}</strong>
                <small>{bot.label}</small>
                <span className="selection-tick">✓</span>
              </span>
            </label>
          ))}
        </div>
        <fieldset className="color-field">
          <legend>Play as</legend>
          <label>
            <input
              type="radio"
              name="color"
              value="w"
              checked={color === 'w'}
              onChange={() => setColor('w')}
            />
            <span>♔ White</span>
          </label>
          <label>
            <input
              type="radio"
              name="color"
              value="b"
              checked={color === 'b'}
              onChange={() => setColor('b')}
            />
            <span>♚ Black</span>
          </label>
          <label>
            <input
              type="radio"
              name="color"
              value="random"
              checked={color === 'random'}
              onChange={() => setColor('random')}
            />
            <span>◐ Random</span>
          </label>
        </fieldset>
        <p className="small muted">
          Your current game stays in My games. Difficulty levels are relative, not Elo ratings.
          {levelFor(level).engine === 'maia' && ' Maia 3 uses a human rating setting, not a guaranteed playing strength. Her 46 MB model loads on her first turn. Hints use Stockfish.'}
        </p>
        <button className="primary-button full-width" type="submit">
          Let's play <Icon name="play" />
        </button>
      </form>
    </Dialog>
  );
}

function LibraryDialog({
  game,
  onClose,
  onReview,
}: {
  game: GameController;
  onClose: () => void;
  onReview: (pgn: string) => void;
}) {
  return (
    <Dialog id="library-dialog" titleId="library-title" onClose={onClose}>
      <div className="dialog-heading">
        <div>
          <div className="eyebrow">ONE MOVE AT A TIME</div>
          <h2 id="library-title">Your saved games</h2>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <p className="muted">Automatically saved in this browser. Resume any game below.</p>
      <div id="library-list">
        {game.games.length ? (
          game.games.map((record) => {
            const bot = levelFor(record.level);
            const date = new Date(record.updatedAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            });
            return (
              <div key={record.id}>
                <button
                  key={record.id}
                  className="saved-game"
                  data-game-id={record.id}
                  onClick={() => {
                    if (game.resumeGame(record.id)) onClose();
                  }}
                >
                  <span className="mini-portrait" style={avatarStyle(bot.color)}>
                    {bot.icon}
                  </span>
                  <span>
                    <strong>You vs. {bot.name}</strong>
                    <small>
                      {date} · {Math.ceil(record.moves.length / 2)} moves ·{' '}
                      {record.color === 'w' ? 'White' : 'Black'}
                    </small>
                  </span>
                  <span className="saved-result">
                    {record.result === '*' ? 'Resume' : record.result} <Icon name="chevron" />
                  </span>
                </button>
                <button
                  className="secondary-button"
                  onClick={() => onReview(Session.restore(record).pgn())}
                >
                  Review &amp; analyze game
                </button>
              </div>
            );
          })
        ) : (
          <p className="muted">Your saved games will appear here after you start playing.</p>
        )}
      </div>
      <p className="small muted">
        Clearing browser data removes these saves. Export PGN to keep a backup.
      </p>
    </Dialog>
  );
}

function PromotionDialog({ game }: { game: GameController }) {
  const choices: PieceSymbol[] = ['q', 'r', 'b', 'n'];
  return (
    <Dialog id="promotion-dialog" titleId="promotion-title" onClose={game.cancelPromotion}>
      <div className="dialog-heading">
        <h2 id="promotion-title">Promote your pawn</h2>
        <CloseButton label="Cancel promotion" onClose={game.cancelPromotion} />
      </div>
      <p className="muted">Choose the piece you'd like.</p>
      <div id="promotion-options">
        {choices.map((type) => (
          <button
            key={type}
            data-promote={type}
            aria-label={`Promote to ${pieceNames[type]}`}
            onClick={() => {
              if (game.promotion) game.makeMove(game.promotion.from, game.promotion.to, type);
            }}
          >
            <img src={pieceSrc({ color: game.session.color, type })} alt="" />
            <span>{pieceNames[type]}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function ExportDialog({ game, onClose }: { game: GameController; onClose: () => void }) {
  const [exportingImage, setExportingImage] = useState(false);
  const [fallbackFen, setFallbackFen] = useState<string | null>(null);
  const fenField = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (fallbackFen !== null) fenField.current?.select();
  }, [fallbackFen]);

  function exportPgn() {
    download(
      new Blob([game.session.pgn()], { type: 'application/x-chess-pgn' }),
      exportName(game.session, 'pgn'),
    );
    game.setNotice('PGN exported. Your full game, ready to replay.');
  }

  async function exportPng() {
    setExportingImage(true);
    try {
      const blob = await boardImage(
        game.displayedChess,
        game.session,
        game.orientation,
        game.viewPly,
      );
      download(blob, exportName(game.session, 'png'));
      game.setNotice('Board image exported.');
    } catch {
      game.setNotice('Image export failed. Please try again.');
    } finally {
      setExportingImage(false);
    }
  }

  async function copyFen() {
    const fen = game.displayedChess.fen();
    try {
      await navigator.clipboard.writeText(fen);
      game.setNotice('Position copied as FEN.');
    } catch {
      setFallbackFen(fen);
      game.setNotice('Select and copy the FEN below.');
    }
  }

  return (
    <Dialog id="export-dialog" titleId="export-title" onClose={onClose}>
      <div className="dialog-heading">
        <div>
          <div className="eyebrow">KEEP THE GOOD GAMES</div>
          <h2 id="export-title">Export your game</h2>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <button className="export-option" id="export-pgn" onClick={exportPgn}>
        <Icon name="download" />
        <span>
          <strong>Download PGN</strong>
          <small>The full game, ready to replay or analyze.</small>
        </span>
        <b>.pgn</b>
      </button>
      <button
        className="export-option"
        id="export-png"
        disabled={exportingImage}
        onClick={() => void exportPng()}
      >
        <Icon name="download" />
        <span>
          <strong>Download board image</strong>
          <small>A PNG of the position you're viewing.</small>
        </span>
        <b>.png</b>
      </button>
      <button className="export-option" id="copy-fen" onClick={() => void copyFen()}>
        <Icon name="folder" />
        <span>
          <strong>Copy position (FEN)</strong>
          <small>Paste this position into another chess app.</small>
        </span>
      </button>
      <textarea
        id="fen-field"
        ref={fenField}
        readOnly
        aria-label="Position FEN"
        hidden={fallbackFen === null}
        value={fallbackFen ?? ''}
      />
    </Dialog>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog id="help-dialog" titleId="help-title" onClose={onClose}>
      <div className="dialog-heading">
        <h2 id="help-title">Make yourself at home</h2>
        <CloseButton onClose={onClose} />
      </div>
      <div className="help-content">
        <p>
          <strong>Make a move.</strong> Click a piece, then a highlighted square, or drag it there.
          With a keyboard, Tab to a square and press Enter to select it.
        </p>
        <p>
          <strong>Practice your way.</strong> Choose an opponent and your color in New game. Hints
          suggest a move; Take back undoes your last turn, including the computer's reply.
        </p>
        <p>
          <strong>Look back.</strong> Click any move to view that position. Use the arrows to step
          through the game, and Latest position to keep playing.
        </p>
        <p>
          <strong>Keep your games.</strong> Every move saves automatically in this browser. Export
          PGN for a replayable backup or PNG for a board image.
        </p>
        <p>
          <strong>Chess rules.</strong> Castling, en passant, and all four promotions are supported.
          Checkmate, stalemate, and insufficient material end the game. For convenient solo play,
          threefold repetition and the fifty-move rule are declared automatically rather than
          requiring a claim.
        </p>
        <p className="small muted">
          Powered by Stockfish 19 Lite and chess.js. An independent local project inspired by
          computer-chess interfaces; not affiliated with Chess.com. No login, clock, or online
          opponent.
        </p>
      </div>
    </Dialog>
  );
}
