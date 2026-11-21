import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against the real stack (Neon, Nexconn, Gemini, Blob). No mocks.
 * Local:  npm run dev (port 3104) then `npm run test:e2e`
 * Prod:   E2E_BASE_URL=https://<prod-url> npm run test:e2e
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3104";

export default defineConfig({
  testDir: "./e2e",
  timeout: 6 * 60_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
    ...devices["Pixel 7"],
  },
  projects: [{ name: "mobile-chromium", use: { browserName: "chromium" } }],
});
