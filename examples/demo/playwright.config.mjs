// Phần của dự án: cấu hình Playwright. TAF chỉ gọi lệnh test của target và đọc JSON report
// (TAF đặt PLAYWRIGHT_JSON_OUTPUT_NAME; lệnh test bật --reporter=json,list).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.mjs$/,
  globalSetup: "./e2e/global-setup.mjs",
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:4310",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
