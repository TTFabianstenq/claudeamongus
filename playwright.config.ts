import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // allows running against a system chromium when the bundled
        // browser revision is unavailable (e.g. sandboxed CI containers)
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {},
      },
    },
  ],
  webServer: {
    command: "cross-env PORT=3100 AUTH_SECRET=e2e-test-secret tsx server/index.ts",
    url: "http://127.0.0.1:3100/healthz",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
