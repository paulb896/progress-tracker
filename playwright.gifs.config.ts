import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results-gifs',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    screenshot: 'off',
    launchOptions: {
      // Make captured scenario demos more legible and “human-paced”.
      slowMo: 220,
      // WebGL can render inconsistently in headless video capture depending on GPU/driver.
      // Force a more deterministic software GL path so the Three.js header demo records cleanly.
      args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
    },
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 900, height: 520 },
        video: 'on',
      },
    },
  ],
})
