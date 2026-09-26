import type { CSSProperties } from 'react';
import type { Chess, Color } from 'chess.js';
import type { Level } from '../types';
import { pieceNames, pieceSrc } from '../pieces';

export function avatarStyle(color: string): CSSProperties {
  return { '--avatar-color': color } as CSSProperties;
}

interface PlayerStripProps {
  id: string;
  color: Color;
  playerColor: Color;
  bot: Level;
  chess: Chess;
}

export function PlayerStrip({ id, color, playerColor, bot, chess }: PlayerStripProps) {
  const human = color === playerColor;
  const captures = chess
    .history({ verbose: true })
    .filter((move) => move.color === color && move.captured);
  const opponentColor = color === 'w' ? 'b' : 'w';
  return (
    <div className="player-strip" id={id}>
      <div
        className={`player-avatar${human ? ' human-avatar' : ''}`}
        style={avatarStyle(bot.color)}
      >
        {human ? '♙' : bot.icon}
      </div>
      <div className="player-info">
        <div>
          <strong>{human ? 'You' : bot.name}</strong>
          <span className="player-tag">{human ? 'Let’s play' : bot.label}</span>
        </div>
        <div className="captured">
          {captures.map((move, index) => {
            if (!move.captured) return null;
            return (
              <img
                key={index}
                src={pieceSrc({ color: opponentColor, type: move.captured })}
                alt={`captured ${pieceNames[move.captured]}`}
              />
            );
          })}
        </div>
      </div>
      <span className={`player-color ${color}`} />
      <span className="player-state">{color === 'w' ? 'White' : 'Black'}</span>
    </div>
  );
}
