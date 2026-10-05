import { FIELD_W, PADDLE_W } from "@h2h/game";
import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

async function noSideways(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("home and play screens fit the screen", async ({ page }) => {
  const errors = trackErrors(page);
  await page.clock.install();
  await page.goto("/");
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

test("touch launches the ball and dragging moves the paddle", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "touch test");
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /PRACTICE/ }).click();
  await page.clock.runFor(4_000);
  const surface = page.getByTestId("play-surface");
  const box = await surface.boundingBox();
  if (!box) throw new Error("no play surface");
  const y = box.y + box.height - 20;

  // Touch near the left edge and hold, sliding to the right: the paddle should follow.
  await surface.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch", clientX: box.x + 10, clientY: y, isPrimary: true });
  await page.clock.runFor(1_000);
  for (let i = 1; i <= 10; i++) {
    await surface.dispatchEvent("pointermove", { pointerId: 1, pointerType: "touch", clientX: box.x + (box.width * i) / 10 - 5, clientY: y, isPrimary: true });
    await page.clock.runFor(100);
  }
  await page.clock.runFor(1_000);
  // The finger ended at the right edge, so the paddle should be pinned right; the touch launched the ball.
  const paddle = Number(await surface.getAttribute("data-paddle"));
  expect(paddle).toBe(FIELD_W - PADDLE_W);
  expect(Number(await surface.getAttribute("data-serves"))).toBeGreaterThanOrEqual(1);

  // After lifting the finger, the paddle stays put.
  await surface.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch", clientX: box.x + box.width - 5, clientY: y, isPrimary: true });
  await page.clock.runFor(1_000);
  expect(Number(await surface.getAttribute("data-paddle"))).toBe(paddle);
});
