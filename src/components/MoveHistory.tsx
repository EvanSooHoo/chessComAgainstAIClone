import { useEffect, useRef } from 'react';

interface MoveHistoryProps {
  moves: string[];
  viewPly: number | null;
  onReview: (ply: number) => void;
}

export function MoveHistory({ moves, viewPly, onReview }: MoveHistoryProps) {
  const currentMove = useRef<HTMLButtonElement>(null);
  const at = viewPly ?? moves.length;
  useEffect(() => {
    currentMove.current?.scrollIntoView({ block: 'nearest' });
  }, [at, moves.length]);

  const rows = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push(
      <div className="move-row" key={index}>
        <span>{index / 2 + 1}.</span>
        {[index, index + 1].map((plyIndex) => {
          const move = moves[plyIndex];
          if (!move) return <span key={plyIndex} />;
          const current = at === plyIndex + 1;
          const color = plyIndex % 2 ? 'Black' : 'White';
          return (
            <button
              key={plyIndex}
              ref={current ? currentMove : undefined}
              data-ply={plyIndex + 1}
              className={current ? 'current' : ''}
              aria-label={`Move ${Math.floor(plyIndex / 2) + 1}, ${color}, ${move}`}
              onClick={() => onReview(plyIndex + 1)}
            >
              {move}
            </button>
          );
        })}
      </div>,
    );
  }

  return (
    <>
      <div className="moves-heading">
        <span>Moves</span>
        <span id="move-count">{Math.ceil(moves.length / 2)} moves</span>
      </div>
      <div className="move-list" id="move-list" aria-label="Move history">
        {moves.length ? (
          rows
        ) : (
          <div className="empty-moves">
            <span>♙</span>
            <strong>A fresh board. A fresh start.</strong>
            <p>Your moves will appear here.</p>
          </div>
        )}
      </div>
      <div className="history-controls">
        <button
          className="icon-button"
          id="first-move"
          title="Starting position"
          aria-label="Starting position"
          disabled={at === 0}
          onClick={() => onReview(0)}
        >
          Ⅰ‹
        </button>
        <button
          className="icon-button"
          id="previous-move"
          title="Previous move"
          aria-label="Previous move"
          disabled={at === 0}
          onClick={() => onReview(at - 1)}
        >
          ‹
        </button>
        <span id="history-label">
          {viewPly === null ? 'Live position' : `Review · ${at} / ${moves.length}`}
        </span>
        <button
          className="icon-button"
          id="next-move"
          title="Next move"
          aria-label="Next move"
          disabled={viewPly === null}
          onClick={() => onReview(at + 1)}
        >
          ›
        </button>
        <button
          className="icon-button"
          id="last-move"
          title="Latest position"
          aria-label="Latest position"
          disabled={viewPly === null}
          onClick={() => onReview(Infinity)}
        >
          ›Ⅰ
        </button>
      </div>
    </>
  );
}
