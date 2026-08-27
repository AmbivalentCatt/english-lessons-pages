import { defineConfig, devices } from "@playwright/test";

const basePath = "/english-lessons-preview/";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:4173${basePath}`,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm preview",
    env: {
      ...process.env,
      GITHUB_PAGES_BASE: basePath,
      VITE_APPLICATION_API_BASE: "https://applications.example.invalid",
      VITE_PUBLIC_SITE_URL: `http://127.0.0.1:4173${basePath.slice(0, -1)}`,
      VITE_TURNSTILE_SITE_KEY: "synthetic-public-site-key",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `http://127.0.0.1:4173${basePath}`,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
