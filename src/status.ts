import { levelFor } from './session';
import type { GameController } from './useGame';

/** Pure presentation logic, kept separate from engine and game mutations. */
export function gameStatus(game: GameController) {
  const { session, viewPly, busy, hint, engineError } = game;
  const outcome = session.outcome;
  if (viewPly !== null)
    return {
      title: 'Reviewing your game',
      detail: 'Return to the latest position to keep playing.',
    };
  if (outcome) {
    const won = outcome.result === (session.color === 'w' ? '1-0' : '0-1');
    let title = `${levelFor(session.level).name} wins`;
    if (outcome.result === '1/2-1/2') title = 'Game drawn';
    else if (won) title = 'You won. Well played!';
    return {
      title,
      detail: `${outcome.reason} · ${outcome.result}. Review the moves or start a new game.`,
    };
  }
  if (engineError) return { title: 'Engine needs a moment', detail: engineError };
  if (busy === 'hint')
    return { title: 'Finding an idea…', detail: 'Looking for a good move in this position.' };
  if (session.chess.turn() !== session.color)
    return {
      title: `${levelFor(session.level).name} is thinking…`,
      detail: 'A good move is worth a little thought.',
    };
  if (hint)
    return {
      title: `Try ${hint.san}`,
      detail: `Move from ${hint.from} to ${hint.to}. The squares are highlighted.`,
    };
  if (session.chess.isCheck())
    return { title: 'You’re in check', detail: 'Protect your king to continue.' };
  const color = session.color === 'w' ? 'White' : 'Black';
  const detail = session.chess.history().length
    ? 'Take your time. Find your next good move.'
    : `You’re playing ${color}. Make yourself at home.`;
  return { title: 'Your move', detail };
}
