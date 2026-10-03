import type { Chess } from 'chess.js';
import type { EngineStatus } from './types';
import { maiaInput, sampleMaiaMove } from './maia-policy';

export class MaiaEngine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private rejectInit: ((error: Error) => void) | null = null;
  private pending: { resolve: (logits: Float32Array) => void; reject: (error: Error) => void } | null = null;
  constructor(private onStatus: (status: EngineStatus) => void) {}

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.onStatus('loading');
    this.ready = new Promise((resolve, reject) => {
      const worker = new Worker(`${import.meta.env.BASE_URL}maia/worker.js`);
      this.worker = worker;
      const timer = setTimeout(() => fail(new Error('Maia took too long to load. Please retry.')), 120000);
      this.rejectInit = error => { clearTimeout(timer); reject(error); };
      const fail = (error: Error) => {
        this.cancel(error);
        this.onStatus('error');
      };
      worker.onerror = () => fail(new Error('Unable to load Maia. Please retry.'));
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker) return;
        if (data.type === 'ready') {
          clearTimeout(timer);
          this.rejectInit = null;
          this.onStatus('ready');
          resolve();
        } else if (data.type === 'error') fail(new Error(data.message));
        else if (data.type === 'result') {
          this.pending?.resolve(data.logits);
          this.pending = null;
        }
      };
      worker.postMessage({ type: 'init' });
    });
    return this.ready;
  }

  async bestMove(chess: Chess, elo: number): Promise<string> {
    const ready = this.init();
    await ready;
    if (ready !== this.ready || !this.worker) throw new DOMException('Cancelled', 'AbortError');
    if (this.pending) throw new Error('Maia is already thinking.');
    const { tokens, moves } = maiaInput(chess);
    const logits = await new Promise<Float32Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cancel(new Error('Maia search timed out. Please retry.'));
        this.onStatus('error');
      }, 30000);
      this.pending = {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      };
      this.worker!.postMessage({ type: 'move', tokens, elo });
    });
    return sampleMaiaMove(moves, logits);
  }

  cancel(error: Error = new DOMException('Cancelled', 'AbortError')) {
    this.rejectInit?.(error);
    this.rejectInit = null;
    this.pending?.reject(error);
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }
}
