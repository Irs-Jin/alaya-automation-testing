require('dotenv').config();
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: false, // ERP forms often share state; run serially unless you confirm otherwise
  retries: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.ALAYA_BASE_URL || 'https://your-alaya-instance.example.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10 * 1000,
    // Opt-in only (ALAYA_MINIMIZED=1) — starts the --headed Chromium window
    // minimized instead of stealing focus, for unattended/background
    // verification runs. Off by default so the runner .bat files (meant
    // for a human to watch) are unaffected.
    launchOptions: {
      args: process.env.ALAYA_MINIMIZED === '1' ? ['--start-minimized'] : [],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
