/* Maia 3 inference runs off the UI thread. Runtime and model are served locally. */
importScripts('../ort/ort.wasm.min.js');
ort.env.wasm.wasmPaths = new URL('../ort/', self.location.href).href;
ort.env.wasm.numThreads = 1;
let session;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      session = await ort.InferenceSession.create(new URL('model.onnx', self.location.href).href, { executionProviders: ['wasm'], graphOptimizationLevel: 'disabled' });
      self.postMessage({ type: 'ready' });
    } else {
      const output = await session.run({
        tokens: new ort.Tensor('float32', data.tokens, [1, 64, 12]),
        elo_self: new ort.Tensor('float32', Float32Array.of(data.elo), [1]),
        elo_oppo: new ort.Tensor('float32', Float32Array.of(data.elo), [1]),
      });
      self.postMessage({ type: 'result', logits: output.logits_move.data });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: `Maia could not run: ${error.message}. Please retry.` });
  }
};
