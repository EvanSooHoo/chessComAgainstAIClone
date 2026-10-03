import { mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('node_modules/stockfish');
async function find(dir) {
  const found = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'node_modules') found.push(...await find(name));
    else if (/^stockfish-19-lite-single\.(js|wasm)$/.test(item.name)) found.push(name);
  }
  return found;
}
const files = await find(root);
if (files.length !== 2) throw new Error('Stockfish lite worker and WASM files not found');
await mkdir('public/engine', { recursive: true });
for (const file of files) await copyFile(file, path.join('public/engine', path.basename(file)));
await copyFile(path.join(root, 'Copying.txt'), 'public/engine/COPYING.txt');
console.log('Stockfish worker, WASM, and license copied to public/engine');
await mkdir('public/ort', { recursive: true });
const ort = 'node_modules/onnxruntime-web/dist';
for (const name of await readdir(ort)) {
  if (['ort.wasm.min.js', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'].includes(name))
    await copyFile(path.join(ort, name), path.join('public/ort', name));
}
console.log('ONNX Runtime assets copied to public/ort');
