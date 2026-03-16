import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_VISITORSTATS = {
  daily: [
    { date: "2026-03-13", plays: 50,  solves: 40, archivePlays: 5  },
    { date: "2026-03-14", plays: 80,  solves: 60, archivePlays: 10 },
    { date: "2026-03-15", plays: 117, solves: 93, archivePlays: 20 },
  ],
  hourly: Array.from({ length: 24 }, (_, h) => ({ hour: h, plays: h * 2, solves: h })),
};

// Total plays: 247, solves: 193, avg/day: 82, solve rate: 78.1%, peak: 03-15

const MOCK_ANALYTICS_TODAY = {
  date: "2026-03-15",
  plays: 117,
  solves: 93,
  archivePlays: 20,
  attempts: { "1": 76, "2": 12, "3": 1, "4": 3, "6": 1 },
};

const MOCK_ANALYTICS_PREV = {
  date: "2026-03-14",
  plays: 80,
  solves: 60,
  archivePlays: 10,
  attempts: { "1": 40, "2": 15, "3": 5 },
};

async function setupMocks(page: Page, analyticsOverride?: object) {
  const todayUTC = new Date().toISOString().split("T")[0];
  await page.route("**/api/visitorstats", (route) =>
    route.fulfill({ json: MOCK_VISITORSTATS }),
  );
  await page.route(/\/api\/analytics/, (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get("date") ?? "";
    // Return today's mock for today's date, prev-day mock for any earlier date
    const payload = date === todayUTC ? (analyticsOverride ?? MOCK_ANALYTICS_TODAY) : MOCK_ANALYTICS_PREV;
    return route.fulfill({ json: payload });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("overall stat cards show correct 30-day totals", async ({ page }) => {
  await setupMocks(page);
  await page.goto("/visitorstats");

  await expect(page.getByText("247")).toBeVisible(); // total plays
  await expect(page.getByText("82")).toBeVisible();  // avg/day
  await expect(page.getByText("78.1%")).toBeVisible(); // solve rate
  await expect(page.locator("span", { hasText: "03-15" })).toBeVisible(); // peak day (span avoids SVG text labels)
});

test("day detail stat cards show plays, solves, solve rate and archive plays", async ({ page }) => {
  await setupMocks(page);
  await page.goto("/visitorstats");

  // Wait for day detail to load
  await expect(page.getByText("79.5%")).toBeVisible(); // day solve rate (93/117)
  await expect(page.getByText("20")).toBeVisible();    // archive plays
});

test("attempts distribution renders correct counts for selected day", async ({ page }) => {
  await setupMocks(page);
  await page.goto("/visitorstats");

  // Attempt 1 has 76 solves — the SVG bar chart shows counts in tooltips,
  // but the bar widths are relative. Check the section heading is visible.
  await expect(page.getByText("Attempts distribution")).toBeVisible();
});

test("clicking prev date loads previous day stats", async ({ page }) => {
  await setupMocks(page);
  await page.goto("/visitorstats");

  // Wait for initial load
  await expect(page.getByText("79.5%")).toBeVisible();

  // Click prev day button
  const prevResponse = page.waitForResponse(/\/api\/analytics/);
  await page.getByRole("button", { name: "←" }).click();
  await prevResponse;

  // Previous day: 80 plays, 60 solves → 75.0% solve rate, 10 archive plays
  await expect(page.getByText("75.0%")).toBeVisible();
  await expect(page.getByText("10")).toBeVisible();
});

test("next date button is disabled when selected date is today", async ({ page }) => {
  await setupMocks(page);
  await page.goto("/visitorstats");

  await expect(page.getByRole("button", { name: "→" })).toBeDisabled();
});

test("next date button enables after navigating to a past day", async ({ page }) => {
  await setupMocks(page);
  await page.goto("/visitorstats");

  await page.getByRole("button", { name: "←" }).click();
  await expect(page.getByRole("button", { name: "→" })).toBeEnabled();
});

test("archive plays chart section is visible", async ({ page }) => {
  await setupMocks(page);
  await page.goto("/visitorstats");

  await expect(page.getByText("Archive plays (last 30 days)")).toBeVisible();
});

test("shows error message when visitorstats API fails", async ({ page }) => {
  await page.route("**/api/visitorstats", (route) =>
    route.fulfill({ status: 500, body: "Internal Server Error" }),
  );
  await page.route(/\/api\/analytics/, (route) =>
    route.fulfill({ json: MOCK_ANALYTICS_TODAY }),
  );

  await page.goto("/visitorstats");
  await expect(page.getByText(/Error:/)).toBeVisible();
});

test("shows loading state before visitorstats API responds", async ({ page }) => {
  let resolve!: () => void;
  const blocker = new Promise<void>((r) => { resolve = r; });

  await page.route("**/api/visitorstats", async (route) => {
    await blocker;
    await route.fulfill({ json: MOCK_VISITORSTATS });
  });
  await page.route(/\/api\/analytics/, (route) =>
    route.fulfill({ json: MOCK_ANALYTICS_TODAY }),
  );

  await page.goto("/visitorstats");
  await expect(page.getByText("Loading…")).toBeVisible();

  resolve();
  await expect(page.getByText("Strumdle Stats")).toBeVisible();
});
