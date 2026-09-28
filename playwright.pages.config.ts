import { defineConfig } from '@playwright/test';

// The same smoke test runs against the local production build and the public URL.
const publicUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: 'pages.spec.js',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: publicUrl ?? 'http://127.0.0.1:5181/chessComAgainstAIClone/',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: publicUrl
    ? undefined
    : {
        command: 'npm run preview -- --port 5181 --mode pages',
        url: 'http://127.0.0.1:5181/chessComAgainstAIClone/',
        reuseExistingServer: false,
        timeout: 30000,
      },
});
