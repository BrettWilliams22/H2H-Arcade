import { FIELD_W, PADDLE_W } from "@h2h/game";
import { expect, test } from "@playwright/test";
import { freezeClock, trackErrors } from "./helpers";

async function noSideways(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("home and play screens fit the screen", async ({ page }) => {
  const errors = trackErrors(page);
  await freezeClock(page);
  await expect(page.getByRole("heading", { name: /BRICK/ })).toBeVisible();
  await noSideways(page);

  await page.getByRole("button", { name: /PRACTICE/ }).click();
  const canvas = page.getByRole("img", { name: "Brickstorm game" });
  await expect(canvas).toBeVisible();
  await page.clock.runFor(1_000);
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport).toBeTruthy();
  if (box && viewport) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(box.width).toBeGreaterThan(200);
  }
  await noSideways(page);
  expect(errors).toEqual([]);
});

test("dragging moves the paddle without launching; a tap launches", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "touch test");
  await freezeClock(page);
  await page.getByRole("button", { name: /PRACTICE/ }).click();
  await page.clock.runFor(3_600);
  const surface = page.getByTestId("play-surface");
  const box = await surface.boundingBox();
  if (!box) throw new Error("no play surface");
  const y = box.y + box.height - 20;
  const touch = (type: string, id: number, x: number) =>
    surface.dispatchEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, isPrimary: id === 1 });

  // Play starts 3.5 s after the button. The ball serves by itself at frame 119, so all of this must happen
  // well before. data-last-serve is the frame of the latest serve.
  const lastServe = () => surface.getAttribute("data-last-serve");

  // Drag from the left edge to the right edge: the paddle follows, but the ball stays on it.
  await touch("pointerdown", 1, box.x + 10);
  for (let i = 1; i <= 5; i++) {
    await touch("pointermove", 1, box.x + (box.width * i) / 5 - 5);
    await page.clock.runFor(60);
  }
  // The page publishes the paddle position every 30 frames; wait past frame 60 so it has arrived.
  await page.clock.runFor(700);
  expect(Number(await surface.getAttribute("data-frame"))).toBeGreaterThanOrEqual(60);
  expect(Number(await surface.getAttribute("data-paddle"))).toBe(FIELD_W - PADDLE_W);

  // Lifting the finger at the end of the swipe doesn't launch either.
  await touch("pointerup", 1, box.x + box.width - 5);
  await page.clock.runFor(200);
  expect(await lastServe()).toBeNull();

  // A quick tap launches, well before the automatic serve.
  await touch("pointerdown", 1, box.x + box.width - 5);
  await touch("pointerup", 1, box.x + box.width - 5);
  await page.clock.runFor(100);
  const served = Number(await lastServe());
  expect(served).toBeGreaterThan(60);
  expect(served).toBeLessThan(119);
});
