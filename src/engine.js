export class Engine {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus;
    this.worker = null;
    this.pending = null;
    this.ready = null;
  }
  init() {
    if (this.ready) return this.ready;
    this.onStatus('loading');
    this.ready = new Promise((resolve, reject) => {
      const worker = new Worker('/engine/stockfish-19-lite-single.js');
      this.worker = worker;
      let initialized = false;
      const timer = setTimeout(() => fail(new Error('Stockfish took too long to load. Please retry.')), 30000);
      const fail = error => {
        clearTimeout(timer);
        this.onStatus('error');
        reject(error);
        this.pending?.reject(error);
        this.pending = null;
        worker.terminate();
        if (this.worker === worker) { this.worker = null; this.ready = null; }
      };
      this.rejectInit = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
      worker.onerror = () => fail(new Error('Unable to load Stockfish. Check that the local server is running and retry.'));
      worker.onmessage = ({ data }) => {
        for (const line of String(data).split('\n')) {
          if (line === 'uciok') {
            worker.postMessage('setoption name Hash value 32');
            worker.postMessage('isready');
          }
          if (line === 'readyok' && !initialized) {
            initialized = true;
            clearTimeout(timer);
            this.onStatus('ready');
            resolve();
          }
          if (line.startsWith('bestmove ') && this.pending) {
            const pending = this.pending;
            this.pending = null;
            pending.resolve(line.split(' ')[1]);
          }
        }
      };
      worker.postMessage('uci');
    });
    return this.ready;
  }
  async bestMove(chess, level) {
    await this.init();
    if (this.pending) throw new Error('Engine is already searching');
    const moves = chess.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    // Preserve the full position history so repetition is visible to Stockfish.
    const history = chess.history({ verbose: true });
    const initial = history.length ? history[0].before : chess.fen();
    this.worker.postMessage(`setoption name Skill Level value ${level.skill}`);
    this.worker.postMessage(`position fen ${initial}${moves.length ? ' moves ' + moves.join(' ') : ''}`);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending?.reject(new Error('Engine search timed out. Please retry.'));
        this.pending = null;
        this.cancel();
      }, 20000);
      this.pending = { resolve: move => { clearTimeout(timeout); resolve(move); }, reject: error => { clearTimeout(timeout); reject(error); } };
      this.worker.postMessage(`go depth ${level.depth} movetime ${level.time}`);
    });
  }
  cancel() {
    this.pending?.reject(new DOMException('Cancelled', 'AbortError'));
    this.pending = null;
    this.rejectInit?.();
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }
}
