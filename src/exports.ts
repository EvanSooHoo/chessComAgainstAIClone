import type { Chess, Color, Square } from 'chess.js';
import { Session, levelFor } from './session';
import { pieceSrc } from './pieces';

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function exportName(session: Session, extension: string) {
  return `chess-corner-${session.createdAt.slice(0, 10)}-${session.id.slice(0, 8)}.${extension}`;
}

export async function boardImage(
  chess: Chess,
  session: Session,
  orientation: Color,
  viewPly: number | null,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1110;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  ctx.fillStyle = '#262522';
  ctx.fillRect(0, 0, 1000, 1110);
  ctx.fillStyle = '#f3f1ed';
  ctx.font = 'bold 30px system-ui';
  ctx.fillText('chess corner', 44, 53);
  ctx.font = '18px system-ui';
  ctx.fillStyle = '#c6c3bd';
  ctx.fillText(
    `You vs. ${levelFor(session.level).name} · ${levelFor(session.level).label}`,
    44,
    85,
  );
  const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba',
    ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const pieceImages = new Map<string, HTMLImageElement>();
  await Promise.all(
    (['w', 'b'] as const).flatMap((color) =>
      (['p', 'n', 'b', 'r', 'q', 'k'] as const).map(async (type) => {
        const image = new Image();
        image.src = pieceSrc({ color, type });
        await image.decode();
        pieceImages.set(color + type, image);
      }),
    ),
  );
  ranks.forEach((rank, row) =>
    [...files].forEach((file, col) => {
      const x = 44 + col * 114,
        y = 114 + row * 114,
        dark = (file.charCodeAt(0) - 97 + rank) % 2 === 0;
      ctx.fillStyle = dark ? '#779556' : '#ebecd0';
      ctx.fillRect(x, y, 114, 114);
      const piece = chess.get((file + rank) as Square);
      if (piece) ctx.drawImage(pieceImages.get(piece.color + piece.type)!, x + 5, y + 5, 104, 104);
      ctx.fillStyle = dark ? '#ebecd0' : '#57733b';
      ctx.font = 'bold 16px system-ui';
      if (col === 0) ctx.fillText(String(rank), x + 5, y + 20);
      if (row === 7) ctx.fillText(file, x + 99, y + 108);
    }),
  );
  ctx.fillStyle = '#c6c3bd';
  ctx.font = '18px system-ui';
  ctx.fillText(
    `${session.createdAt.slice(0, 10)} · ${viewPly === null ? 'Latest position' : 'After ply ' + viewPly}${session.outcome && viewPly === null ? ' · ' + session.outcome.result : ''}`,
    44,
    1067,
  );
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Image could not be created');
  return blob;
}
