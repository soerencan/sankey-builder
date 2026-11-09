import { expect, test } from "./fixtures";

test.skip(
	!process.env.PLAYWRIGHT_VISUAL_TESTS,
	"Screenshot baselines use the pinned Linux container; see README.md.",
);

for (const width of [390, 768, 1280]) {
	for (const colorScheme of ["light", "dark"] as const) {
		test(`default layout at ${width}px in ${colorScheme}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ colorScheme });
			await page.goto("./");
			await expect(page.getByRole("img", { name: "Sankey diagram" })).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true,
			);
			await expect(page).toHaveScreenshot(`layout-${width}-${colorScheme}.png`, { fullPage: true });
		});
	}
}

for (const width of [390, 1280]) {
	test(`Appearance panel at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("./");
		await page.getByRole("button", { name: "Appearance", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "Appearance", exact: true })).toBeVisible();
		await expect(page).toHaveScreenshot(`appearance-${width}.png`);
	});

	for (const colorScheme of ["light", "dark"] as const) {
		test(`edited layout with validation feedback at ${width}px in ${colorScheme}`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ colorScheme });
			await page.goto("./");
			await page
				.getByRole("textbox", { name: "Name for Salary", exact: true })
				.fill("Monthly salary and recurring income");
			await page
				.getByRole("textbox", { name: "Name for Budget", exact: true })
				.fill("Household spending and savings");
			await page.locator("#import-file").setInputFiles({
				name: "notes.json",
				mimeType: "application/json",
				buffer: Buffer.from('{"notes":"not a diagram"}'),
			});
			await expect(page.locator("#io-notice")).toContainText("doesn't look like a diagram export");
			await expect(page.getByRole("button", { name: "Dismiss", exact: true })).toBeVisible();
			const value = page.getByRole("textbox", { name: "Value for link 1", exact: true });
			await value.fill("abc");
			await expect(value).toHaveAttribute("aria-invalid", "true");
			await expect(
				page.getByText("Enter a plain number greater than 0.", { exact: true }),
			).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true,
			);
			await expect(page).toHaveScreenshot(`edited-${width}-${colorScheme}.png`, { fullPage: true });
		});
	}
}
