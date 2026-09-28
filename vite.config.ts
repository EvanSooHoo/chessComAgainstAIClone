import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Local development stays at /; the Pages site lives under the repository name.
  base: mode === 'pages' ? '/chessComAgainstAIClone/' : '/',
}));
