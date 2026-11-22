import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Los tests usan backend, base y mails reales: bajo carga en paralelo 5 s quedan justos.
  expect: { timeout: 10_000 },
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 240_000,
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
