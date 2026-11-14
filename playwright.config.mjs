import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: process.env.ZION_WORDPRESS_TEST_URL || 'http://localhost:8917',
    browserName: 'chromium',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
});
