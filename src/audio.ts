/** Same optional move/capture tones as the original interface. */
export class MoveAudio {
  private context: AudioContext | null = null;

  play(capture = false) {
    try {
      this.context ??= new AudioContext();
      const context = this.context;
      void context.resume().catch(() => {});
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(capture ? 260 : 520, context.currentTime);
      gain.gain.setValueAtTime(0.09, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.11);
    } catch {
      /* Audio is optional; moves still work if it is unavailable. */
    }
  }

  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
