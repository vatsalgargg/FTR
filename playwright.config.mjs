import { defineConfig, devices } from "@playwright/test";

// By default the tests run against `wrangler dev`, the real Workers runtime, so the Worker's CSP and headers are
// enforced exactly as in production. The server uses HTTPS because WebKit applies the CSP's
// upgrade-insecure-requests even to 127.0.0.1, which would block every asset over plain HTTP.
// Set BASE_URL (for example https://ftrgroup.in) to run the same read-only checks against a deployed site.
const PORT = 8788;
const live = process.env.BASE_URL?.replace(/\/$/, "");
const baseURL = live || `https://127.0.0.1:${PORT}`;
// Chromium's background connections otherwise reject the self-signed certificate and flood the server log.
const chromium = live ? {} : { launchOptions: { args: ["--ignore-certificate-errors"] } };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL, ignoreHTTPSErrors: !live, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], ...chromium } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"], ...chromium } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
  webServer: live ? undefined : {
    command: `node scripts/serve-e2e.mjs --port ${PORT} --ip 127.0.0.1 --local-protocol https --log-level warn`,
    url: `${baseURL}/robots.txt`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
