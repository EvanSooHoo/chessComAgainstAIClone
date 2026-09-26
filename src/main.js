import { Chess } from 'chess.js';
import { Session, LEVELS, levelFor, readLibrary, saveSession } from './session.js';
import { Engine } from './engine.js';
import './style.css';

const $ = selector => document.querySelector(selector);
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  play: '<path d="m9 5 11 7-11 7z"/>',
  folder: '<path d="M3 7h7l2-3h9v16H3z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v1"/>',
  undo: '<path d="m8 5-5 5 5 5M3 10h11a6 6 0 0 1 0 12"/>',
  hint: '<path d="M9 18h6m-6 3h6M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2"/>',
  flip: '<path d="M5 7h14l-4-4m4 14H5l4 4M19 7v4M5 17v-4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  flag: '<path d="M5 22V3c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>',
  volume: '<path d="m3 9 5 0 5-5v16l-5-5H3zM17 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.play}</svg>`;
const names = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const pieceSrc = piece => `/pieces/${piece.color}${piece.type.toUpperCase()}.svg`;

let session, storageError = '', engineState = 'loading', busy = '', engineError = '';
let selected = null, orientation = 'w', viewPly = null, hint = null, generation = 0, promotion = null;
let sound = false, legalDots = true, audioContext;
try {
  const library = readLibrary();
  const record = library.games.find(g => g.id === library.current);
  session = record ? Session.restore(record) : new Session();
} catch { storageError = 'Saved games could not be read. You can still play and export PGN.'; session = new Session(); }
orientation = session.color;

$('#app').innerHTML = `
  <aside class="sidebar">
    <a href="/" class="brand" aria-label="Chess Corner home"><img src="/favicon.svg" alt=""/><span>chess<span class="brand-second">corner</span></span></a>
    <div class="nav-label">YOUR CHESS SPACE</div>
    <nav aria-label="Main navigation">
      <button class="nav-item active" id="nav-play">${icon('play')}<span>Play computer</span></button>
      <button class="nav-item" id="nav-library">${icon('folder')}<span>My games</span><span class="nav-count" id="game-count">0</span></button>
      <button class="nav-item" id="nav-help">${icon('help')}<span>How to play</span></button>
    </nav>
    <div class="sidebar-bottom"><div class="local-badge"><span class="online-dot"></span>No account. Just chess.</div><p>Your games stay in this browser.</p><a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noopener">Open-source credits ↗</a></div>
  </aside>
  <main>
    <header class="page-heading"><div><div class="eyebrow">A LITTLE FOCUS. A GOOD CHALLENGE.</div><h1>Play the computer</h1></div><div class="save-state" id="save-state">${icon('check')}<span>Saved on this device</span></div></header>
    <div class="workspace">
      <section class="board-column" aria-label="Chess game">
        <div class="player-strip" id="top-player"></div>
        <div class="board-frame"><div id="board" class="board" role="group" aria-label="Chessboard"></div></div>
        <div class="player-strip" id="bottom-player"></div>
        <div class="board-footer"><span id="board-caption">Click or drag a piece to make your move.</span><div><button class="icon-button" id="flip" title="Flip board" aria-label="Flip board">${icon('flip')}</button><button class="icon-button" id="sound" title="Turn sound on" aria-label="Turn sound on" aria-pressed="false">${icon('volume')}</button></div></div>
        <div class="notice" id="storage-warning" role="status" hidden></div>
      </section>
      <section class="game-panel" aria-label="Game controls">
        <div class="panel-tabs"><button class="panel-tab active" id="play-tab">${icon('play')} Play</button><button class="panel-tab" id="saved-tab">${icon('folder')} Saved games</button></div>
        <div class="opponent-card" id="opponent-card"></div>
        <div class="status-card"><div class="status-top"><span class="turn-dot" id="turn-dot"></span><h2 id="game-status" aria-live="polite"></h2><span class="turn-badge" id="turn-badge"></span></div><p id="status-detail"></p><button id="retry-engine" class="text-button" hidden>Retry engine</button></div>
        <div class="moves-heading"><span>Moves</span><span id="move-count">0 moves</span></div>
        <div class="move-list" id="move-list" aria-label="Move history"></div>
        <div class="history-controls"><button class="icon-button" id="first-move" title="Starting position" aria-label="Starting position">Ⅰ‹</button><button class="icon-button" id="previous-move" title="Previous move" aria-label="Previous move">‹</button><span id="history-label">Live position</span><button class="icon-button" id="next-move" title="Next move" aria-label="Next move">›</button><button class="icon-button" id="last-move" title="Latest position" aria-label="Latest position">›Ⅰ</button></div>
        <div class="game-actions"><button id="undo">${icon('undo')}<span>Take back</span></button><button id="hint">${icon('hint')}<span>Hint</span></button><button id="export">${icon('download')}<span>Export</span></button><button id="resign">${icon('flag')}<span>Resign</span></button></div>
        <div class="panel-bottom"><button class="primary-button" id="new-game">New game ${icon('play')}</button><p><span class="online-dot" id="engine-dot"></span><span id="engine-label">Loading Stockfish…</span><span class="separator">·</span>Unlimited time</p></div>
      </section>
    </div>
    <footer class="page-footer"><span>Find your next good move.</span><label><input type="checkbox" id="legal-dots" checked/> Show legal moves</label></footer>
  </main>
  <dialog id="new-dialog" aria-labelledby="new-title"><form id="new-form"><div class="dialog-heading"><div><div class="eyebrow">YOUR NEXT CHALLENGE</div><h2 id="new-title">Choose your opponent</h2></div><button type="button" class="close-button" data-close aria-label="Close">×</button></div><p class="muted">Six challenges. Your pace. No clock.</p><div class="opponent-grid" id="opponent-grid"></div><fieldset class="color-field"><legend>Play as</legend><label><input type="radio" name="color" value="w" checked/><span>♔ White</span></label><label><input type="radio" name="color" value="b"/><span>♚ Black</span></label><label><input type="radio" name="color" value="random"/><span>◐ Random</span></label></fieldset><p class="small muted">Your current game stays in My games. Difficulty levels are relative, not Elo ratings.</p><button class="primary-button full-width" type="submit">Let's play ${icon('play')}</button></form></dialog>
  <dialog id="library-dialog" aria-labelledby="library-title"><div class="dialog-heading"><div><div class="eyebrow">ONE MOVE AT A TIME</div><h2 id="library-title">Your saved games</h2></div><button class="close-button" data-close aria-label="Close">×</button></div><p class="muted">Automatically saved in this browser. Resume any game below.</p><div id="library-list"></div><p class="small muted">Clearing browser data removes these saves. Export PGN to keep a backup.</p></dialog>
  <dialog id="export-dialog" aria-labelledby="export-title"><div class="dialog-heading"><div><div class="eyebrow">KEEP THE GOOD GAMES</div><h2 id="export-title">Export your game</h2></div><button class="close-button" data-close aria-label="Close">×</button></div><button class="export-option" id="export-pgn">${icon('download')}<span><strong>Download PGN</strong><small>The full game, ready to replay or analyze.</small></span><b>.pgn</b></button><button class="export-option" id="export-png">${icon('download')}<span><strong>Download board image</strong><small>A PNG of the position you're viewing.</small></span><b>.png</b></button><button class="export-option" id="copy-fen">${icon('folder')}<span><strong>Copy position (FEN)</strong><small>Paste this position into another chess app.</small></span></button><textarea id="fen-field" readonly aria-label="Position FEN" hidden></textarea></dialog>
  <dialog id="promotion-dialog" aria-labelledby="promotion-title"><div class="dialog-heading"><h2 id="promotion-title">Promote your pawn</h2><button class="close-button" data-close aria-label="Cancel promotion">×</button></div><p class="muted">Choose the piece you'd like.</p><div id="promotion-options"></div></dialog>
  <dialog id="resign-dialog" aria-labelledby="resign-title"><h2 id="resign-title">Resign this game?</h2><p class="muted">The computer wins. Your game will stay saved for review.</p><div class="dialog-actions"><button class="secondary-button" data-close>Keep playing</button><button class="danger-button" id="confirm-resign">Resign game</button></div></dialog>
  <dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-heading"><h2 id="help-title">Make yourself at home</h2><button class="close-button" data-close aria-label="Close">×</button></div><div class="help-content"><p><strong>Make a move.</strong> Click a piece, then a highlighted square, or drag it there. With a keyboard, Tab to a square and press Enter to select it.</p><p><strong>Practice your way.</strong> Choose an opponent and your color in New game. Hints suggest a move; Take back undoes your last turn, including the computer's reply.</p><p><strong>Look back.</strong> Click any move to view that position. Use the arrows to step through the game, and Latest position to keep playing.</p><p><strong>Keep your games.</strong> Every move saves automatically in this browser. Export PGN for a replayable backup or PNG for a board image.</p><p><strong>Chess rules.</strong> Castling, en passant, and all four promotions are supported. Checkmate, stalemate, and insufficient material end the game. For convenient solo play, threefold repetition and the fifty-move rule are declared automatically rather than requiring a claim.</p><p class="small muted">Powered by Stockfish 19 Lite and chess.js. An independent local project inspired by computer-chess interfaces; not affiliated with Chess.com. No login, clock, or online opponent.</p></div></dialog>
  <div id="toast" role="status"></div>
`;

const engine = new Engine(status => { engineState = status; renderEngine(); });
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500); }
function showDialog(id) { $(id).showModal(); }
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }));

function persist() {
  try { const games = saveSession(session); $('#game-count').textContent = games.length; storageError = ''; }
  catch { storageError = 'Browser storage is unavailable or full. Export PGN to keep this game.'; }
  $('#storage-warning').hidden = !storageError;
  $('#storage-warning').textContent = storageError;
  $('#save-state').classList.toggle('save-error', !!storageError);
  $('#save-state span').textContent = storageError ? 'Not saved — export a backup' : 'Saved on this device';
}
function displayChess() {
  if (viewPly === null) return session.chess;
  const replay = new Chess();
  session.chess.history().slice(0, viewPly).forEach(move => replay.move(move));
  return replay;
}
function canMove() { return viewPly === null && !busy && !session.outcome && session.chess.turn() === session.color; }
function renderBoard() {
  const chess = displayChess();
  const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = orientation === 'w' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const legal = selected && canMove() ? chess.moves({ square: selected, verbose: true }).map(m => m.to) : [];
  const last = chess.history({ verbose: true }).at(-1);
  let html = '';
  ranks.forEach((rank, row) => [...files].forEach((file, col) => {
    const square = file + rank, piece = chess.get(square);
    const dark = (file.charCodeAt(0) - 97 + rank) % 2 === 0;
    const classes = ['square', dark ? 'dark' : 'light'];
    if (last && (last.from === square || last.to === square)) classes.push('last-move');
    if (selected === square) classes.push('selected');
    if (hint && (hint.from === square || hint.to === square) && viewPly === null) classes.push('hint-square');
    if (piece?.type === 'k' && piece.color === chess.turn() && chess.isCheck()) classes.push('in-check');
    const label = `${square}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} ${names[piece.type]}` : ' empty'}${legal.includes(square) ? ', legal destination' : ''}`;
    html += `<button class="${classes.join(' ')}" data-square="${square}" aria-label="${label}" aria-pressed="${selected === square}" draggable="${!!(piece && piece.color === session.color && canMove())}">${col === 0 ? `<span class="coord rank">${rank}</span>` : ''}${row === 7 ? `<span class="coord file">${file}</span>` : ''}${piece ? `<img class="piece" src="${pieceSrc(piece)}" alt="" draggable="false"/>` : ''}${legalDots && legal.includes(square) ? `<span class="legal-mark ${piece ? 'capture' : ''}"></span>` : ''}</button>`;
  }));
  $('#board').innerHTML = html;
  $('#board').classList.toggle('reviewing', viewPly !== null);
}
function capturedMarkup(color, chess) {
  const captures = chess.history({ verbose: true }).filter(m => m.color === color && m.captured).map(m => m.captured);
  return captures.map(type => `<img src="${pieceSrc({ color: color === 'w' ? 'b' : 'w', type })}" alt="captured ${names[type]}"/>`).join('');
}
function renderPlayers() {
  const bot = levelFor(session.level), chess = displayChess();
  const row = color => {
    const human = color === session.color;
    return `<div class="player-avatar ${human ? 'human-avatar' : ''}" style="--avatar-color:${bot.color}">${human ? '♙' : bot.icon}</div><div class="player-info"><div><strong>${human ? 'You' : bot.name}</strong><span class="player-tag">${human ? 'Let’s play' : bot.label}</span></div><div class="captured">${capturedMarkup(color, chess)}</div></div><span class="player-color ${color}"></span><span class="player-state">${color === 'w' ? 'White' : 'Black'}</span>`;
  };
  $('#top-player').innerHTML = row(orientation === 'w' ? 'b' : 'w');
  $('#bottom-player').innerHTML = row(orientation);
}
function renderMoves() {
  const moves = session.chess.history();
  $('#move-count').textContent = `${Math.ceil(moves.length / 2)} moves`;
  if (!moves.length) $('#move-list').innerHTML = `<div class="empty-moves"><span>♙</span><strong>A fresh board. A fresh start.</strong><p>Your moves will appear here.</p></div>`;
  else {
    let html = '';
    for (let i = 0; i < moves.length; i += 2) {
      html += `<div class="move-row"><span>${i / 2 + 1}.</span>${[i, i + 1].map(index => moves[index] ? `<button data-ply="${index + 1}" class="${(viewPly ?? moves.length) === index + 1 ? 'current' : ''}" aria-label="Move ${Math.floor(index / 2) + 1}, ${index % 2 ? 'Black' : 'White'}, ${esc(moves[index])}">${esc(moves[index])}</button>` : '<span></span>').join('')}</div>`;
    }
    $('#move-list').innerHTML = html;
    $('#move-list .current')?.scrollIntoView({ block: 'nearest' });
  }
  const at = viewPly ?? moves.length;
  $('#history-label').textContent = viewPly === null ? 'Live position' : `Review · ${at} / ${moves.length}`;
  $('#first-move').disabled = $('#previous-move').disabled = at === 0;
  $('#next-move').disabled = $('#last-move').disabled = viewPly === null;
}
function renderEngine() {
  if (!$('#engine-label')) return;
  $('#engine-label').textContent = engineState === 'loading' ? 'Loading Stockfish…' : engineState === 'error' ? 'Engine unavailable' : 'Stockfish 19 · Ready';
  $('#engine-dot').classList.toggle('offline', engineState !== 'ready');
}
function renderStatus() {
  let title, detail;
  const outcome = session.outcome;
  if (viewPly !== null) { title = 'Reviewing your game'; detail = 'Return to the latest position to keep playing.'; }
  else if (outcome) {
    const won = outcome.result === (session.color === 'w' ? '1-0' : '0-1');
    title = outcome.result === '1/2-1/2' ? 'Game drawn' : won ? 'You won. Well played!' : `${levelFor(session.level).name} wins`;
    detail = `${outcome.reason} · ${outcome.result}. Review the moves or start a new game.`;
  } else if (engineError) { title = 'Engine needs a moment'; detail = engineError; }
  else if (busy === 'hint') { title = 'Finding an idea…'; detail = 'Looking for a good move in this position.'; }
  else if (session.chess.turn() !== session.color) { title = `${levelFor(session.level).name} is thinking…`; detail = 'A good move is worth a little thought.'; }
  else if (hint) { title = `Try ${hint.san}`; detail = `Move from ${hint.from} to ${hint.to}. The squares are highlighted.`; }
  else { title = session.chess.isCheck() ? 'You’re in check' : 'Your move'; detail = session.chess.isCheck() ? 'Protect your king to continue.' : session.chess.history().length ? 'Take your time. Find your next good move.' : `You’re playing ${session.color === 'w' ? 'White' : 'Black'}. Make yourself at home.`; }
  $('#game-status').textContent = title;
  $('#status-detail').textContent = detail;
  $('#turn-badge').textContent = outcome ? 'FINISHED' : busy ? 'THINKING' : viewPly !== null ? 'REVIEW' : 'NO CLOCK';
  $('#turn-dot').classList.toggle('thinking', !!busy);
  $('#retry-engine').hidden = !engineError;
  $('#undo').disabled = !session.chess.history().length;
  $('#hint').disabled = !canMove();
  $('#resign').disabled = !!outcome;
  $('#board-caption').textContent = viewPly !== null ? 'Review mode · use the arrows to explore your game.' : outcome ? `${outcome.reason} · Game saved for review.` : 'Click or drag a piece to make your move.';
}
function render() { renderBoard(); renderPlayers(); renderMoves(); renderStatus(); renderEngine(); }
function renderOpponent() {
  const bot = levelFor(session.level), index = LEVELS.indexOf(bot);
  $('#opponent-card').innerHTML = `<div class="opponent-top"><div class="bot-portrait" style="--avatar-color:${bot.color}">${bot.icon}<span class="portrait-spark">✦</span></div><div><div class="eyebrow">YOUR OPPONENT</div><h2>${bot.name}</h2><div class="difficulty"><span>${bot.label}</span><span class="difficulty-bars" aria-label="Difficulty ${index + 1} of 6">${LEVELS.map((_, i) => `<i class="${i <= index ? 'filled' : ''}"></i>`).join('')}</span></div></div><button class="text-button change-opponent" id="change-opponent">Change</button></div><p class="bot-description">${bot.description}</p>`;
  $('#change-opponent').addEventListener('click', openNewGame);
}
function cancelSearch() { generation++; engine.cancel(); busy = ''; engineError = ''; }
function playSound(capture = false) {
  if (!sound) return;
  try {
    audioContext ||= new AudioContext();
    audioContext.resume();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(capture ? 260 : 520, audioContext.currentTime);
    gain.gain.setValueAtTime(0.09, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    oscillator.start(); oscillator.stop(audioContext.currentTime + 0.11);
  } catch { /* Sound is optional. */ }
}
async function requestEngine(asHint = false) {
  if (busy || session.outcome || (!asHint && session.chess.turn() === session.color)) return;
  const token = generation;
  busy = asHint ? 'hint' : 'move'; engineError = ''; renderStatus(); renderBoard();
  try {
    const uci = await engine.bestMove(session.chess, asHint ? LEVELS[4] : levelFor(session.level));
    if (token !== generation) return;
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('The engine did not return a move. Please retry.');
    const move = { from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) };
    if (asHint) {
      const copy = new Chess(session.chess.fen());
      const checked = copy.move(move);
      hint = { ...move, san: checked.san };
    } else {
      const result = session.move(move);
      if (!result) throw new Error('The engine returned an invalid move. Please retry.');
      playSound(!!result.captured); persist();
    }
  } catch (error) {
    if (token === generation && error.name !== 'AbortError') engineError = error.message;
  } finally { if (token === generation) { busy = ''; render(); } }
}
function makeMove(from, to, promote) {
  if (!canMove()) return;
  const candidates = session.chess.moves({ square: from, verbose: true }).filter(m => m.to === to);
  if (!candidates.length) return;
  if (candidates.some(m => m.promotion) && !promote) {
    promotion = { from, to };
    $('#promotion-options').innerHTML = ['q','r','b','n'].map(type => `<button data-promote="${type}" aria-label="Promote to ${names[type]}"><img src="${pieceSrc({ color: session.color, type })}" alt=""/><span>${names[type]}</span></button>`).join('');
    showDialog('#promotion-dialog'); return;
  }
  const result = session.move({ from, to, ...(promote ? { promotion: promote } : {}) });
  if (!result) return;
  selected = null; hint = null; viewPly = null;
  playSound(!!result.captured); persist(); render(); requestEngine();
}
$('#board').addEventListener('click', event => {
  const square = event.target.closest('[data-square]')?.dataset.square;
  if (!square || !canMove()) return;
  if (selected === square) selected = null;
  else if (session.chess.get(square)?.color === session.color) selected = square;
  else if (selected) { makeMove(selected, square); return; }
  renderBoard(); $('#board').querySelector(`[data-square="${square}"]`)?.focus({ preventScroll: true });
});
$('#board').addEventListener('dragstart', event => {
  const square = event.target.closest('[data-square]')?.dataset.square;
  if (!canMove() || session.chess.get(square)?.color !== session.color) { event.preventDefault(); return; }
  event.dataTransfer.setData('text/plain', square); event.dataTransfer.effectAllowed = 'move';
});
$('#board').addEventListener('dragover', event => { if (canMove()) event.preventDefault(); });
$('#board').addEventListener('drop', event => {
  event.preventDefault();
  const from = event.dataTransfer.getData('text/plain'), to = event.target.closest('[data-square]')?.dataset.square;
  if (/^[a-h][1-8]$/.test(from) && to) makeMove(from, to);
});
$('#promotion-options').addEventListener('click', event => {
  const piece = event.target.closest('[data-promote]')?.dataset.promote;
  if (piece && promotion) { const move = promotion; $('#promotion-dialog').close(); promotion = null; makeMove(move.from, move.to, piece); }
});
$('#promotion-dialog').addEventListener('close', () => { promotion = null; });

function review(ply) { const length = session.chess.history().length; viewPly = ply >= length ? null : Math.max(0, ply); selected = null; render(); }
$('#move-list').addEventListener('click', event => { const ply = event.target.closest('[data-ply]')?.dataset.ply; if (ply) review(Number(ply)); });
$('#first-move').onclick = () => review(0);
$('#previous-move').onclick = () => review((viewPly ?? session.chess.history().length) - 1);
$('#next-move').onclick = () => review((viewPly ?? session.chess.history().length) + 1);
$('#last-move').onclick = () => review(Infinity);
$('#flip').onclick = () => { orientation = orientation === 'w' ? 'b' : 'w'; renderBoard(); renderPlayers(); };
$('#sound').onclick = () => { sound = !sound; $('#sound').setAttribute('aria-pressed', String(sound)); $('#sound').setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on'); $('#sound').title = sound ? 'Turn sound off' : 'Turn sound on'; toast(sound ? 'Move sounds on' : 'Move sounds off'); playSound(); };
$('#legal-dots').onchange = event => { legalDots = event.target.checked; renderBoard(); };
$('#undo').onclick = () => { cancelSearch(); session.undoTurn(); selected = hint = viewPly = null; persist(); render(); requestEngine(); };
$('#hint').onclick = () => requestEngine(true);
$('#retry-engine').onclick = () => { cancelSearch(); engine.init().then(() => { renderStatus(); requestEngine(); }).catch(error => { engineError = error.message; renderStatus(); }); };
$('#resign').onclick = () => showDialog('#resign-dialog');
$('#confirm-resign').onclick = () => { cancelSearch(); session.resign(); selected = hint = viewPly = null; persist(); render(); $('#resign-dialog').close(); };

function openNewGame() {
  $('#opponent-grid').innerHTML = LEVELS.map(level => `<label class="opponent-option"><input type="radio" name="level" value="${level.id}" ${level.id === session.level ? 'checked' : ''}/><span class="opponent-option-body"><span class="mini-portrait" style="--avatar-color:${level.color}">${level.icon}</span><strong>${level.name}</strong><small>${level.label}</small><span class="selection-tick">✓</span></span></label>`).join('');
  $(`#new-form input[name="color"][value="${session.color}"]`).checked = true;
  showDialog('#new-dialog');
}
$('#new-game').onclick = openNewGame;
$('#new-form').onsubmit = event => {
  event.preventDefault(); const data = new FormData(event.currentTarget);
  let color = data.get('color'); if (color === 'random') color = Math.random() < 0.5 ? 'w' : 'b';
  persist(); cancelSearch(); session = new Session({ color, level: data.get('level') });
  orientation = color; selected = hint = viewPly = null;
  persist(); renderOpponent(); render(); $('#new-dialog').close(); requestEngine();
};
function openLibrary() {
  let games = [];
  try { games = readLibrary().games; } catch { toast('Saved games could not be loaded.'); }
  $('#library-list').innerHTML = games.length ? games.map(record => {
    const bot = levelFor(record.level), date = new Date(record.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `<button class="saved-game" data-game-id="${esc(record.id)}"><span class="mini-portrait" style="--avatar-color:${bot.color}">${bot.icon}</span><span><strong>You vs. ${bot.name}</strong><small>${esc(date)} · ${Math.ceil(record.moves.length / 2)} moves · ${record.color === 'w' ? 'White' : 'Black'}</small></span><span class="saved-result">${record.result === '*' ? 'Resume' : esc(record.result)} ${icon('chevron')}</span></button>`;
  }).join('') : '<p class="muted">Your saved games will appear here after you start playing.</p>';
  showDialog('#library-dialog');
}
$('#library-list').onclick = event => {
  const id = event.target.closest('[data-game-id]')?.dataset.gameId;
  if (!id) return;
  try {
    const next = Session.restore(readLibrary().games.find(g => g.id === id));
    persist(); cancelSearch(); session = next; orientation = session.color; selected = hint = viewPly = null;
    persist(); renderOpponent(); render(); $('#library-dialog').close(); requestEngine();
  } catch { toast('This saved game could not be opened.'); }
};
$('#nav-library').onclick = $('#saved-tab').onclick = openLibrary;
$('#nav-help').onclick = () => showDialog('#help-dialog');
$('#nav-play').onclick = $('#play-tab').onclick = () => { $('#board').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
$('#export').onclick = () => { $('#fen-field').hidden = true; showDialog('#export-dialog'); };
function download(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const exportName = extension => `chess-corner-${session.createdAt.slice(0,10)}-${session.id.slice(0,8)}.${extension}`;
$('#export-pgn').onclick = () => { download(new Blob([session.pgn()], { type: 'application/x-chess-pgn' }), exportName('pgn')); toast('PGN exported. Your full game, ready to replay.'); };
$('#copy-fen').onclick = async () => {
  const fen = displayChess().fen();
  try { await navigator.clipboard.writeText(fen); toast('Position copied as FEN.'); }
  catch { $('#fen-field').hidden = false; $('#fen-field').value = fen; $('#fen-field').select(); toast('Select and copy the FEN below.'); }
};
$('#export-png').onclick = async () => {
  const button = $('#export-png'); button.disabled = true;
  try {
    const chess = displayChess(), canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1110;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#262522'; ctx.fillRect(0,0,1000,1110);
    ctx.fillStyle = '#f3f1ed'; ctx.font = 'bold 30px system-ui'; ctx.fillText('chess corner', 44, 53);
    ctx.font = '18px system-ui'; ctx.fillStyle = '#c6c3bd'; ctx.fillText(`You vs. ${levelFor(session.level).name} · ${levelFor(session.level).label}`, 44, 85);
    const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba', ranks = orientation === 'w' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
    const pieceImages = new Map();
    await Promise.all(['w','b'].flatMap(color => ['p','n','b','r','q','k'].map(async type => { const image = new Image(); image.src = pieceSrc({color,type}); await image.decode(); pieceImages.set(color+type,image); })));
    ranks.forEach((rank,row) => [...files].forEach((file,col) => {
      const x = 44 + col * 114, y = 114 + row * 114, dark = (file.charCodeAt(0)-97+rank)%2 === 0;
      ctx.fillStyle = dark ? '#779556' : '#ebecd0'; ctx.fillRect(x,y,114,114);
      const piece = chess.get(file+rank); if (piece) ctx.drawImage(pieceImages.get(piece.color+piece.type),x+5,y+5,104,104);
      ctx.fillStyle = dark ? '#ebecd0' : '#57733b'; ctx.font = 'bold 16px system-ui';
      if (col === 0) ctx.fillText(String(rank),x+5,y+20);
      if (row === 7) ctx.fillText(file,x+99,y+108);
    }));
    ctx.fillStyle = '#c6c3bd'; ctx.font = '18px system-ui';
    ctx.fillText(`${session.createdAt.slice(0,10)} · ${viewPly === null ? 'Latest position' : 'After ply ' + viewPly}${session.outcome && viewPly === null ? ' · ' + session.outcome.result : ''}`,44,1067);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Image could not be created'); download(blob, exportName('png')); toast('Board image exported.');
  } catch { toast('Image export failed. Please try again.'); } finally { button.disabled = false; }
};

persist(); renderOpponent(); render();
engine.init().then(() => requestEngine()).catch(error => { if (error.name !== 'AbortError') { engineError = error.message; renderStatus(); } });
window.addEventListener('beforeunload', () => { persist(); engine.cancel(); });
