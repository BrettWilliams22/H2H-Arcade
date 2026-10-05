import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

test("this browser computes exactly the same scores as Node", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/check");
  const status = page.getByTestId("device-check-status");
  await expect(status).toHaveAttribute("data-status", /pass|fail/, { timeout: 30_000 });
  await expect(status).toHaveAttribute("data-status", "pass");
  expect(errors).toEqual([]);
});
