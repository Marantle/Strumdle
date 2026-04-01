/**
 * Acceptance test: full play-through across 5 challenges with mixed outcomes,
 * then verifies grid states and navigation back and forth.
 *
 * Challenges:
 *   #1 (2020-01-01) - fail slow:     6 deliberately typed wrong guesses
 *   #2 (2020-01-02) - fail fast:     6 rapid skips
 *   #3 (2020-01-03) - succeed fast:  correct on first attempt
 *   #4 (2020-01-04) - succeed slow:  2 wrong guesses then correct
 *   #5 (2020-01-05) - in-progress:   3 wrong guesses, game still running (today)
 */

import { test, expect, type Page } from "@playwright/test";

async function makeGuess(page: Page, text: string) {
  await page.getByPlaceholder(/Guess the song/).fill(text);
  await page.getByRole("option").filter({ hasText: text }).first().dispatchEvent("click");
}

async function closeModal(page: Page) {
  await page.getByRole("button", { name: "Close" }).dispatchEvent("click");
}

async function openGrid(page: Page) {
  const btn = page.locator("button", { hasText: "Past Challenges" });
  await btn.dispatchEvent("click");
}

async function assertGridStatus(page: Page, n: number, status: "solved" | "failed" | "in-progress" | "current" | "unplayed") {
  await expect(page.getByTestId(`challenge-${n}`)).toHaveAttribute("data-status", status);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/1");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("strumdle-welcome-seen", "1");
    localStorage.setItem("strumdle-whats-new-seen", "9999-12-31");
  });
});

test("full acceptance: mixed outcomes → grid states → back-and-forth navigation", async ({ page }) => {
  // ── PHASE 1: Play through all 5 challenges ──────────────────────────────

  // #1:Fail slow: 6 deliberate wrong guesses
  await page.goto("/1");
  for (const song of ["Mock Song 2", "Mock Song 3", "Mock Song 4", "Mock Song 5", "Mock Song 2", "Mock Song 3"]) {
    await makeGuess(page, song);
  }
  await expect(page.getByText("Better luck next time")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 1");
  await closeModal(page);

  // #2:Fail fast: 6 rapid skips
  await page.goto("/2");
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("Better luck next time")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 2");
  await closeModal(page);

  // #3:Succeed fast: correct on first guess
  await page.goto("/3");
  await makeGuess(page, "Mock Song 3");
  await expect(page.getByText("Nice one!")).toBeVisible();
  await expect(page.getByText("You got it in 1")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 3");
  await closeModal(page);

  // #4:Succeed after 2 wrong guesses
  await page.goto("/4");
  await makeGuess(page, "Mock Song 1");
  await makeGuess(page, "Mock Song 2");
  await makeGuess(page, "Mock Song 4");
  await expect(page.getByText("Nice one!")).toBeVisible();
  await expect(page.getByText("You got it in 3")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 4");
  await closeModal(page);

  // #5 (today):In-progress: 3 wrong guesses, game still running
  await page.goto("/");
  await makeGuess(page, "Mock Song 1");
  await makeGuess(page, "Mock Song 2");
  await makeGuess(page, "Mock Song 3");
  // Game not finished:no modal
  await expect(page.getByText("Nice one!")).not.toBeVisible();
  await expect(page.getByText("Better luck next time")).not.toBeVisible();

  // ── PHASE 2: Verify grid states from #4's results modal ─────────────────

  await page.goto("/4"); // auto-opens solved modal
  await expect(page.getByText("Nice one!")).toBeVisible();
  await openGrid(page);

  await assertGridStatus(page, 1, "failed");
  await assertGridStatus(page, 2, "failed");
  await assertGridStatus(page, 3, "solved");
  await assertGridStatus(page, 4, "current");
  await assertGridStatus(page, 5, "in-progress");

  // ── PHASE 3: Navigate to #3 and verify its state ────────────────────────

  const c3 = page.getByTestId("challenge-3");
  await c3.dispatchEvent("click");
  await expect(page.getByText("Nice one!")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 3");

  await openGrid(page);
  await assertGridStatus(page, 1, "failed");
  await assertGridStatus(page, 2, "failed");
  await assertGridStatus(page, 3, "current");
  await assertGridStatus(page, 4, "solved");
  await assertGridStatus(page, 5, "in-progress");

  // ── PHASE 4: Navigate to #1 and verify failed state ─────────────────────

  const c1 = page.getByTestId("challenge-1");
  await c1.dispatchEvent("click");
  await expect(page.getByText("Better luck next time")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 1");

  await openGrid(page);
  await assertGridStatus(page, 1, "current");
  await assertGridStatus(page, 2, "failed");
  await assertGridStatus(page, 3, "solved");
  await assertGridStatus(page, 4, "solved");
  await assertGridStatus(page, 5, "in-progress");

  // ── PHASE 5: Navigate back to today (#5) and verify in-progress ──────────

  const c5 = page.getByTestId("challenge-5");
  await c5.dispatchEvent("click"); // links to "/"
  await page.waitForURL("/"); // wait for cross-route navigation to settle before asserting
  // Today's game is in-progress:no modal, 3 guesses visible
  await expect(page.getByText("Nice one!")).not.toBeVisible();
  await expect(page.getByTestId("guess-entry")).toHaveCount(3);
});

test("View Results persists after replay: close modal → play → View Results still visible → clicking it stops playback and reopens modal", async ({ page }) => {
  await page.goto("/3");
  await makeGuess(page, "Mock Song 3");
  await expect(page.getByText("Nice one!")).toBeVisible();
  await closeModal(page);

  // View Results should be visible after closing modal
  await expect(page.getByRole("button", { name: "View Results" })).toBeVisible();

  // Click Play:View Results must still be present while replaying
  await page.getByRole("button", { name: /Play|Replay/ }).dispatchEvent("click");
  await expect(page.getByRole("button", { name: "View Results" })).toBeVisible();

  // Clicking View Results stops playback and reopens the modal
  await page.getByRole("button", { name: "View Results" }).dispatchEvent("click");
  await expect(page.getByText("Nice one!")).toBeVisible();
  await expect(page.getByTestId("modal-song-title")).toHaveText("Mock Song 3");
  // Stop button should be gone (playback stopped)
  await expect(page.getByRole("button", { name: "Stop" })).not.toBeVisible();
});
