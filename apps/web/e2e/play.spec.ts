import { readFileSync } from "node:fs";
import { verifyReplay } from "@h2h/game";
import { type Page, expect, test } from "@playwright/test";
import { freezeClock, trackErrors } from "./helpers";

async function startPractice(page: Page) {
  await freezeClock(page);
  await page.getByRole("button", { name: /PRACTICE/ }).click();
  await expect(page.getByTestId("play-surface")).toBeVisible();
}

const frameOf = async (page: Page) => Number(await page.getByTestId("play-surface").getAttribute("data-frame"));

test("a full practice game: the score the browser shows is the score the replay gives", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard and mouse game runs on desktop only");
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await startPractice(page);
  await page.clock.runFor(4_000); // countdown

  // Play with both the keyboard and the mouse, so both input paths are recorded.
  const canvas = await page.getByRole("img", { name: "Brickstorm game" }).boundingBox();
  if (!canvas) throw new Error("no canvas");
  for (let i = 0; i < 44; i++) {
    if (i % 4 < 2) {
      const key = i % 2 === 0 ? "ArrowLeft" : "ArrowRight";
      await page.keyboard.down(key);
      await page.clock.runFor(900);
      await page.keyboard.up(key);
      await page.keyboard.press("Space");
    } else {
      await page.mouse.move(canvas.x + canvas.width * (0.15 + 0.7 * ((i * 37) % 10) / 10), canvas.y + canvas.height / 2);
      await page.clock.runFor(900);
      await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height * 0.9);
    }
    await page.clock.runFor(1_100);
  }
  await page.clock.runFor(5_000);

  const shownScore = Number(await page.getByTestId("final-score").textContent());
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

  // The replay viewer plays it back. Its BACK button and the phone's Back button both return to the results.
  await page.getByRole("button", { name: "WATCH REPLAY" }).click();
  await page.clock.runFor(3_000);
  await expect(page.getByRole("img", { name: /Replay/ })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByTestId("final-score")).toHaveText(String(shownScore));
  await page.getByRole("button", { name: "WATCH REPLAY" }).click();
  await expect(page.getByRole("img", { name: /Replay/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("final-score")).toHaveText(String(shownScore));
  // And Back from the results goes Home.
  await page.goBack();
  await expect(page.getByRole("heading", { name: /BRICK/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the live game's final state fingerprint matches the replay's", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "desktop only");
  test.setTimeout(120_000);
  await startPractice(page);
  await page.clock.runFor(4_000);
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(30_000);
  await page.keyboard.up("ArrowRight");
  await page.clock.runFor(65_000);
  const score = page.getByTestId("final-score");
  const liveHash = Number(await score.getAttribute("data-hash"));
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "DOWNLOAD RECORDING" }).click(),
  ]);
  const checked = verifyReplay(JSON.parse(readFileSync(await download.path(), "utf8")));
  expect(checked.ok && checked.result.hash).toBe(liveHash);
});

test("pausing stops the game, and the keyboard can resume and quit", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard test");
  await startPractice(page);
  await page.clock.runFor(6_000);
  const before = await frameOf(page);
  expect(before).toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  const dialog = page.getByRole("dialog", { name: "Paused" });
  await expect(dialog).toBeVisible();
  await page.clock.runFor(5_000);
  expect(await frameOf(page)).toBe(before);

  // Enter presses the focused RESUME button.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await page.clock.runFor(6_000);
  expect(await frameOf(page)).toBeGreaterThan(before);

  // Esc pauses and Esc again resumes.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Tab to QUIT and press Enter: back to the home screen.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "QUIT" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /BRICK/ })).toBeVisible();
});

// Note: Playwright's goBack() doesn't apply Chrome's rule that skips history
// entries a page added without a tap. The app is built so it only ever adds
// entries during a tap or click, so that rule never applies to it.
test("the phone's Back button pauses the game, and works again after resuming", async ({ page }) => {
  await startPractice(page);
  await page.clock.runFor(5_000);
  const dialog = page.getByRole("dialog", { name: "Paused" });
  await page.goBack();
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("play-surface")).toBeVisible();

  await page.getByRole("button", { name: "RESUME" }).click();
  await expect(dialog).toBeHidden();
  await page.clock.runFor(4_000);
  await page.goBack();
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "QUIT" }).click();
  await expect(page.getByRole("heading", { name: /BRICK/ })).toBeVisible();
});

test("a launch pressed while GO! is showing serves on the first frame", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "keyboard test");
  await startPractice(page);
  await page.clock.runFor(3_200); // "GO!" shows from 3.0 s to 3.5 s
  await page.keyboard.press("Space");
  await page.clock.runFor(1_000);
  expect(await page.getByTestId("play-surface").getAttribute("data-last-serve")).toBe("1");
});
