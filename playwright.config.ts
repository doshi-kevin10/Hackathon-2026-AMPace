import { defineConfig } from "@playwright/test";

// Next dev only allows one instance per project — when a dev server is already
// running, point the tests at it: E2E_PORT=3000 npm run test:e2e
const port = Number(process.env.E2E_PORT ?? 3199);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
  },
  webServer: {
    command: `npm run dev -- -p ${port}`,
    port,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
