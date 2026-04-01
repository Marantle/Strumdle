import { test, expect, type Page } from "@playwright/test";

async function makeGuess(page: Page, text: string) {
  await page.getByPlaceholder(/Guess the song/).fill(text);
  await page.getByRole("option").filter({ hasText: text }).first().click();
}

// Run once per test, does NOT run again on page.reload()
test.beforeEach(async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("strumdle-welcome-seen", "1");
    localStorage.setItem("strumdle-whats-new-seen", "9999-12-31");
  });
});

test("archive challenge loads with correct number", async ({ page }) => {
  await page.goto("/1");
  await expect(page.getByText("#1", { exact: false })).toBeVisible();
});

test("correct guess shows result modal with right answer", async ({ page }) => {
  await page.goto("/1");
  await makeGuess(page, "Mock Song 1");
  await expect(page.getByText("Nice one!")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 1");
});

test("wrong guess appears in guess list without showing modal", async ({ page }) => {
  await page.goto("/2");
  await makeGuess(page, "Mock Song 1");
  await expect(page.getByTestId("guess-entry").filter({ hasText: "Mock Song 1" })).toBeVisible();
  await expect(page.getByText("Nice one!")).not.toBeVisible();
});

test("skip 6 times triggers game over with correct answer", async ({ page }) => {
  await page.goto("/1");
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: "Skip" }).click();
  }
  await expect(page.getByText("Better luck next time")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 1");
});

test("answers differ when navigating between challenges", async ({ page }) => {
  await page.goto("/1");
  await makeGuess(page, "Mock Song 1");
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 1");

  await page.locator("button", { hasText: "Past Challenges" }).click();
  await page.getByRole("link", { name: "#2" }).click();

  await expect(page.getByText("#2", { exact: false })).toBeVisible();
  await makeGuess(page, "Mock Song 2");
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 2");
});

test("solved state persists after reload", async ({ page }) => {
  await page.goto("/1");
  await makeGuess(page, "Mock Song 1");
  await expect(page.getByText("Nice one!")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await expect(page.getByText("Nice one!")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 1");
});
