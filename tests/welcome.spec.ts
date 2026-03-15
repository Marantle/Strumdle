import { test, expect } from "@playwright/test";

test("first-time visitor sees welcome modal", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByText("Welcome to Strumdle!")).toBeVisible();
});

test("returning visitor does not see welcome modal", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("strumdle-welcome-seen", "1");
  });
  await page.goto("/");
  await expect(page.getByText("Welcome to Strumdle!")).not.toBeVisible();
});

test("dismissing welcome modal via button sets key and hides modal", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByText("Welcome to Strumdle!")).toBeVisible();
  await page.getByRole("button", { name: "Let's go!" }).click();
  await expect(page.getByText("Welcome to Strumdle!")).not.toBeVisible();

  const seen = await page.evaluate(() => localStorage.getItem("strumdle-welcome-seen"));
  expect(seen).toBe("1");
});

test("welcome modal does not reappear after dismiss on reload", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Let's go!" }).click();
  await page.reload();
  await expect(page.getByText("Welcome to Strumdle!")).not.toBeVisible();
});

test("dismissing welcome modal via backdrop hides modal", async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByText("Welcome to Strumdle!")).toBeVisible();
  // Click outside the modal card (the backdrop)
  await page.mouse.click(10, 10);
  await expect(page.getByText("Welcome to Strumdle!")).not.toBeVisible();
});
