import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/browser",
	forbidOnly: !!process.env.CI,
	workers: 1,
	retries: 0,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: "http://127.0.0.1:4173/sankey-builder/",
		viewport: { width: 1280, height: 900 },
		colorScheme: "light",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{ name: "chromium", testIgnore: "**/visual.spec.ts", use: { browserName: "chromium" } },
		{ name: "webkit", testIgnore: "**/visual.spec.ts", use: { browserName: "webkit" } },
		{ name: "visual", testMatch: "**/visual.spec.ts", use: { browserName: "chromium" } },
	],
	webServer: {
		command: "node tests/browser/serve.ts",
		url: "http://127.0.0.1:4173/sankey-builder/",
		reuseExistingServer: false,
	},
});
