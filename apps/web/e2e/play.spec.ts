import { readFileSync } from "node:fs";
import { verifyReplay } from "@h2h/game";
import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

test("a full practice game: the score the browser shows is the score the replay gives", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard game runs on desktop only");
  test.setTimeout(180_000);
  const errors = trackErrors(page);

  // Fake the clock so 90 seconds of play runs quickly. The game only counts frames, so this is safe.
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /PRACTICE/ }).click();
  const surface = page.getByTestId("play-surface");
  await expect(surface).toBeVisible();

  await page.clock.runFor(4_000); // countdown
  // Play: launch, then sweep left and right so the paddle sometimes catches the ball.
  await page.keyboard.down("Space");
  await page.clock.runFor(200);
  await page.keyboard.up("Space");
  for (let i = 0; i < 44; i++) {
    const key = i % 2 === 0 ? "ArrowLeft" : "ArrowRight";
    await page.keyboard.down(key);
    await page.clock.runFor(900);
    await page.keyboard.up(key);
    await page.keyboard.down("Space");
    await page.clock.runFor(1100);
    await page.keyboard.up("Space");
  }
  await page.clock.runFor(5_000);

  const scoreText = await page.getByTestId("final-score").textContent();
  const shownScore = Number(scoreText);
  expect(Number.isInteger(shownScore)).toBe(true);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "DOWNLOAD RECORDING" }).click(),
  ]);
  const recording = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(recording.inputs.length).toBeGreaterThan(10);
  const checked = verifyReplay(recording);
  expect(checked.ok).toBe(true);
  if (checked.ok) expect(checked.result.score).toBe(shownScore);

  // The replay viewer plays it back.
  await page.getByRole("button", { name: "WATCH REPLAY" }).click();
  await page.clock.runFor(3_000);
  await expect(page.getByRole("img", { name: /Replay/ })).toBeVisible();
  await page.getByRole("button", { name: /BACK/ }).click();
  await expect(page.getByTestId("final-score")).toHaveText(String(shownScore));

  expect(errors).toEqual([]);
});

test("pausing stops the clock and resuming continues the same game", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard test");
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /PRACTICE/ }).click();
  await page.clock.runFor(6_000);
  const surface = page.getByTestId("play-surface");
  const before = Number(await surface.getAttribute("data-frame"));
  expect(before).toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await page.clock.runFor(5_000);
  expect(Number(await surface.getAttribute("data-frame"))).toBe(before);

  await page.getByRole("button", { name: "RESUME" }).click();
  await page.clock.runFor(6_000);
  expect(Number(await surface.getAttribute("data-frame"))).toBeGreaterThan(before);
});
