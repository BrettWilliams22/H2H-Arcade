import type { Page } from "@playwright/test";

/**
 * Takes over the page's clock and stops it, so game time only moves when a
 * test calls page.clock.runFor(). (Without the pause, the clock also keeps
 * running in real time, and slow test machines would make tests flaky.)
 */
export async function freezeClock(page: Page, url = "/"): Promise<void> {
  await page.clock.install();
  await page.goto(url);
  await page.clock.pauseAt(Date.now() + 1_000);
}

/** Collects uncaught page errors so a test can assert there were none. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}
