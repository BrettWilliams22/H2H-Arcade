import { defineConfig, devices } from "@playwright/test";

// Browser tests. Run with `npm run test:browser` from the project folder.
// The first time on your computer, run `npx playwright install chromium`.
// PW_CHROMIUM_PATH can point at an already-installed Chromium instead.
//
// `npm run test:engines` also runs the Device Check in Safari's engine
// (WebKit) and Firefox, to prove they compute the same scores as Chrome and
// the server. Install those browsers first: `npx playwright install webkit firefox`.
const chromium = { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined } };

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:4173" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...chromium } },
    { name: "phone", use: { ...devices["Pixel 7"], ...chromium } },
    // Only run by `npm run test:engines`.
    { name: "iphone-webkit", testMatch: /device-check/, use: { ...devices["iPhone 13"] } },
    { name: "firefox", testMatch: /device-check/, use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: "npm run build && npm run preview",
    cwd: import.meta.dirname,
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
