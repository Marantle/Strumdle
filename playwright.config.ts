import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chrome",        use: { ...devices["Desktop Chrome"] } },
    { name: "safari",        use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 12"] } },
  ],
  webServer: {
    command: "npx vite --config vite.test.config.ts --port 5174",
    url: "http://localhost:5174",
    reuseExistingServer: false,
  },
});
