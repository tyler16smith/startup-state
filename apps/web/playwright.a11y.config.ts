import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	testMatch: /.*a11y\.spec\.ts/,
	timeout: 30_000,
	use: {
		baseURL: "http://127.0.0.1:3100",
		trace: "on-first-retry",
	},
	webServer: {
		command: "pnpm exec next dev --turbo -p 3100",
		reuseExistingServer: true,
		timeout: 120_000,
		url: "http://127.0.0.1:3100",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
