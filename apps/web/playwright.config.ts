import { defineConfig, devices } from "@playwright/test";

// Browser tests. Run with `npm run test:browser` from the project folder.
// The first time on your computer, run `npx playwright install chromium`.
// PW_CHROMIUM_PATH can point at an already-installed Chromium instead.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run preview",
    cwd: import.meta.dirname,
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
