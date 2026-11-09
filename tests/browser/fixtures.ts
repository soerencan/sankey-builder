import { test as base, expect } from "@playwright/test";

export const test = base.extend({
	page: async ({ page }, use) => {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("console", (message) => {
			if (["error", "warning"].includes(message.type())) errors.push(message.text());
		});
		page.on("requestfailed", (request) =>
			errors.push(`${request.url()}: ${request.failure()?.errorText}`),
		);
		page.on("response", (response) => {
			if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
		});
		await use(page);
		expect(errors, "browser errors and failed requests").toEqual([]);
	},
});

export { expect };
