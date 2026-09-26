import type { Chess, Color, Square } from 'chess.js';
import type { Hint } from '../types';
import { pieceNames, pieceSrc } from '../pieces';

interface BoardProps {
  chess: Chess;
  orientation: Color;
  playerColor: Color;
  selected: Square | null;
  canMove: boolean;
  legalDots: boolean;
  reviewing: boolean;
  hint: Hint | null;
  onSelect: (square: Square) => void;
  onMove: (from: Square, to: Square) => void;
}

export function Board({
  chess,
  orientation,
  playerColor,
  selected,
  canMove,
  legalDots,
  reviewing,
  hint,
  onSelect,
  onMove,
}: BoardProps) {
  const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const legal =
    selected && canMove
      ? chess.moves({ square: selected, verbose: true }).map((move) => move.to)
      : [];
  const lastMove = chess.history({ verbose: true }).at(-1);

  return (
    <div
      id="board"
      className={`board${reviewing ? ' reviewing' : ''}`}
      role="group"
      aria-label="Chessboard"
    >
      {ranks.flatMap((rank, row) =>
        [...files].map((file, column) => {
          const square = (file + rank) as Square;
          const piece = chess.get(square);
          const dark = (file.charCodeAt(0) - 97 + rank) % 2 === 0;
          const isLegal = legal.includes(square);
          const classes = ['square', dark ? 'dark' : 'light'];
          if (lastMove?.from === square || lastMove?.to === square) classes.push('last-move');
          if (selected === square) classes.push('selected');
          if (!reviewing && (hint?.from === square || hint?.to === square))
            classes.push('hint-square');
          if (piece?.type === 'k' && piece.color === chess.turn() && chess.isCheck())
            classes.push('in-check');

          // A readable description for screen readers, independent of the artwork.
          let label = square as string;
          if (piece) {
            const colorName = piece.color === 'w' ? 'White' : 'Black';
            label += ` ${colorName} ${pieceNames[piece.type]}`;
          } else {
            label += ' empty';
          }
          if (isLegal) label += ', legal destination';

          return (
            <button
              key={square}
              className={classes.join(' ')}
              data-square={square}
              aria-label={label}
              aria-pressed={selected === square}
              draggable={Boolean(piece && piece.color === playerColor && canMove)}
              onClick={() => onSelect(square)}
              onDragStart={(event) => {
                if (!canMove || piece?.color !== playerColor) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.setData('text/plain', square);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (canMove) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = event.dataTransfer.getData('text/plain');
                if (/^[a-h][1-8]$/.test(from)) onMove(from as Square, square);
              }}
            >
              {column === 0 && <span className="coord rank">{rank}</span>}
              {row === 7 && <span className="coord file">{file}</span>}
              {piece && <img className="piece" src={pieceSrc(piece)} alt="" draggable={false} />}
              {legalDots && isLegal && <span className={`legal-mark${piece ? ' capture' : ''}`} />}
            </button>
          );
        }),
      )}
    </div>
  );
}
