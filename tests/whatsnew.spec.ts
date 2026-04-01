import { test, expect } from "@playwright/test";

test("first-time visitor does not see whats new modal", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByText("What's New")).not.toBeVisible();
});

test("returning visitor who has never seen whats new sees the modal", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("strumdle-welcome-seen", "1");
  });
  await page.goto("/");
  await expect(page.getByText("What's New")).toBeVisible();
});

test("returning visitor who already saw current version does not see modal again", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("strumdle-welcome-seen", "1");
    localStorage.setItem("strumdle-whats-new-seen", "2026-04-01");
  });
  await page.goto("/");
  await expect(page.getByText("What's New")).not.toBeVisible();
});

test("dismissing whats new modal stores current version and hides modal", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("strumdle-welcome-seen", "1");
  });
  await page.goto("/");
  await expect(page.getByText("What's New")).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByText("What's New")).not.toBeVisible();

  const seen = await page.evaluate(() => localStorage.getItem("strumdle-whats-new-seen"));
  expect(seen).toBe("2026-04-01");
});

test("returning visitor who has seen a newer version does not see modal", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("strumdle-welcome-seen", "1");
    localStorage.setItem("strumdle-whats-new-seen", "9999-12-31");
  });
  await page.goto("/");
  await expect(page.getByText("What's New")).not.toBeVisible();
});

test("whats new does not appear after dismiss on reload", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("strumdle-welcome-seen", "1");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Got it" }).click();
  await page.reload();
  await expect(page.getByText("What's New")).not.toBeVisible();
});
