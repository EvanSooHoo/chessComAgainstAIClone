import { defineConfig } from '@playwright/test';
export default defineConfig({
  testIgnore: '**/pages.spec.js',
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5180',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
