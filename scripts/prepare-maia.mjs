import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';

const target = 'public/maia/model.onnx';
const sha256 = '405bf76c15727dad8728b352c06a8f3c1b80fb2760e8d666b32485c63d75b856';
const url = 'https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/a6e52f5c811ee18863cb2f0e81f2433a5b9905de/public/maia3/maia3_simplified.onnx';
const valid = bytes => createHash('sha256').update(bytes).digest('hex') === sha256;
let present = false;
try { present = valid(await readFile(target)); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!present) {
  console.log('Downloading pinned Maia 3 model (46 MB)…');
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Maia download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!valid(bytes)) throw new Error('Maia model checksum mismatch');
  await mkdir('public/maia', { recursive: true });
  await writeFile(`${target}.download`, bytes);
  await rename(`${target}.download`, target);
}
console.log('Maia model verified.');
